import { data, redirect, Form, Link, useLoaderData, useNavigation } from "react-router";
import { Navbar } from "~/components/Navbar";
import { db } from "~/db.server";
import { sendCargoApprovedEmail, sendCargoRejectedEmail, sendFlightConfirmedEmail } from "~/lib/email.server";
import { calculatePricing, formatAud } from "~/lib/pricing";
import { requireAdmin } from "~/session.server";
import type { Route } from "./+types/admin.campaigns.$id";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `Manage: ${data?.campaign?.title ?? "Campaign"} — Admin` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireAdmin(request);

  const campaign = await db.campaign.findUnique({
    where: { id: params.id },
    include: {
      candidateDates: {
        include: { _count: { select: { votes: true } } },
        orderBy: { date: "asc" },
      },
      bookings: {
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
      cargoRequests: {
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!campaign) throw new Response("Not found", { status: 404 });

  const pricing = calculatePricing(campaign);
  return { user, campaign, pricing };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireAdmin(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent"));

  if (intent === "publish") {
    await db.campaign.update({ where: { id: params.id }, data: { status: "VOTING" } });
    return redirect(`/admin/campaigns/${params.id}`);
  }

  if (intent === "close-voting") {
    await db.campaign.update({ where: { id: params.id }, data: { status: "CLOSED" } });
    return redirect(`/admin/campaigns/${params.id}`);
  }

  if (intent === "confirm-date") {
    const confirmedDate = new Date(String(formData.get("confirmedDate")));
    if (isNaN(confirmedDate.getTime())) {
      return data({ error: "Select a valid date to confirm." }, { status: 400 });
    }

    const campaign = await db.campaign.findUnique({
      where: { id: params.id },
      include: {
        bookings: { select: { passengerCount: true, status: true } },
        cargoRequests: { select: { weightKg: true, status: true } },
      },
    });

    await db.campaign.update({
      where: { id: params.id },
      data: { status: "CONFIRMED", confirmedDate },
    });

    // Confirm all pending bookings and fetch passengers for emails
    const [updatedBookings] = await Promise.all([
      db.booking.findMany({
        where: { campaignId: params.id, status: "PENDING" },
        include: { user: { select: { email: true, name: true } } },
      }),
      db.booking.updateMany({
        where: { campaignId: params.id, status: "PENDING" },
        data: { status: "CONFIRMED" },
      }),
    ]);

    // Fire-and-forget emails to all confirmed passengers
    if (campaign) {
      const pricing = calculatePricing(campaign);
      const dateStr = confirmedDate.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
      Promise.allSettled(
        updatedBookings.map((b) =>
          sendFlightConfirmedEmail({
            to: b.user.email,
            name: b.user.name,
            campaignTitle: campaign.title,
            route: campaign.route,
            confirmedDate: dateStr,
            pricePerPerson: pricing.pricePerPerson != null ? formatAud(pricing.pricePerPerson) : null,
            campaignId: params.id,
          })
        )
      );
    }

    return redirect(`/admin/campaigns/${params.id}`);
  }

  if (intent === "cancel") {
    await db.campaign.update({ where: { id: params.id }, data: { status: "CANCELLED" } });
    await db.booking.updateMany({
      where: { campaignId: params.id },
      data: { status: "CANCELLED" },
    });
    return redirect(`/admin/campaigns/${params.id}`);
  }

  if (intent === "approve-cargo") {
    const cargoId = String(formData.get("cargoId"));
    const cargo = await db.cargoRequest.update({
      where: { id: cargoId },
      data: { status: "APPROVED" },
      include: {
        user: { select: { email: true } },
        campaign: { select: { title: true, cargoRatePerKg: true } },
      },
    });
    sendCargoApprovedEmail({
      to: cargo.user.email,
      businessName: cargo.businessName,
      campaignTitle: cargo.campaign.title,
      weightKg: cargo.weightKg,
      totalCost: cargo.campaign.cargoRatePerKg != null
        ? formatAud(cargo.weightKg * cargo.campaign.cargoRatePerKg)
        : `${cargo.weightKg}kg`,
      campaignId: params.id,
    });
    return redirect(`/admin/campaigns/${params.id}#cargo`);
  }

  if (intent === "reject-cargo") {
    const cargoId = String(formData.get("cargoId"));
    const adminNotes = String(formData.get("adminNotes") ?? "").trim() || null;
    const cargo = await db.cargoRequest.update({
      where: { id: cargoId },
      data: { status: "REJECTED", adminNotes },
      include: {
        user: { select: { email: true } },
        campaign: { select: { title: true } },
      },
    });
    sendCargoRejectedEmail({
      to: cargo.user.email,
      businessName: cargo.businessName,
      campaignTitle: cargo.campaign.title,
      reason: adminNotes,
      campaignId: params.id,
    });
    return redirect(`/admin/campaigns/${params.id}#cargo`);
  }

  return data({ error: "Unknown intent." }, { status: 400 });
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-AU", {
    weekday: "short", day: "numeric", month: "long", year: "numeric",
  });
}

export default function AdminCampaignPage() {
  const { user, campaign, pricing } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const totalVotes = campaign.candidateDates.reduce((s, d) => s + d._count.votes, 0);
  const leadingDate = [...campaign.candidateDates].sort(
    (a, b) => b._count.votes - a._count.votes
  )[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} />

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{campaign.title}</h1>
          <p className="text-gray-400 text-sm mt-1">{campaign.route} · Status: <strong>{campaign.status}</strong></p>
        </div>

        {/* ── Status actions ───────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Campaign actions</h2>
          <div className="flex flex-wrap gap-3">
            {campaign.status === "DRAFT" && (
              <Form method="post">
                <input type="hidden" name="intent" value="publish" />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
                >
                  Open voting
                </button>
              </Form>
            )}
            {campaign.status === "VOTING" && (
              <Form method="post">
                <input type="hidden" name="intent" value="close-voting" />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded-lg disabled:opacity-50"
                >
                  Close voting
                </button>
              </Form>
            )}
            {(campaign.status === "VOTING" || campaign.status === "CLOSED") && (
              <Form method="post">
                <input type="hidden" name="intent" value="cancel" />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                >
                  Cancel campaign
                </button>
              </Form>
            )}
          </div>
        </section>

        {/* ── Confirm a date ───────────────────────────────────── */}
        {(campaign.status === "CLOSED" || campaign.status === "VOTING") && !campaign.confirmedDate && (
          <section className="bg-white rounded-2xl border border-blue-100 p-6">
            <h2 className="font-semibold text-gray-700 mb-1">Confirm flight date</h2>
            <p className="text-sm text-gray-400 mb-4">
              Leading date:{" "}
              <strong className="text-gray-700">
                {leadingDate ? formatDate(leadingDate.date) : "—"}
              </strong>{" "}
              ({leadingDate?._count.votes ?? 0} votes)
            </p>
            <Form method="post" className="flex gap-3 items-end">
              <input type="hidden" name="intent" value="confirm-date" />
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmed date (after Qantas agreement)
                </label>
                <input
                  name="confirmedDate"
                  type="date"
                  defaultValue={
                    leadingDate
                      ? new Date(leadingDate.date).toISOString().split("T")[0]
                      : ""
                  }
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                Confirm & notify
              </button>
            </Form>
          </section>
        )}

        {campaign.confirmedDate && (
          <div className="rounded-2xl bg-green-50 border border-green-200 px-6 py-4">
            <p className="text-green-800 font-semibold">
              ✓ Flight confirmed for {formatDate(campaign.confirmedDate)}
            </p>
            <p className="text-green-600 text-sm mt-1">All pending bookings have been confirmed.</p>
          </div>
        )}

        {/* ── Pricing summary ──────────────────────────────────── */}
        {campaign.totalCharterCostAud && (
          <section className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-700 mb-4">Pricing summary</h2>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="text-gray-400">Charter cost</dt>
                <dd className="font-semibold text-gray-900">{formatAud(pricing.charterCost)}</dd>
              </div>
              <div>
                <dt className="text-gray-400">Cargo revenue</dt>
                <dd className="font-semibold text-green-700">−{formatAud(pricing.cargoRevenue)}</dd>
              </div>
              <div>
                <dt className="text-gray-400">Passenger pool</dt>
                <dd className="font-semibold text-gray-900">{formatAud(pricing.passengerPool)}</dd>
              </div>
              <div>
                <dt className="text-gray-400">Active passengers</dt>
                <dd className="font-semibold text-gray-900">{pricing.activePassengers}</dd>
              </div>
              <div>
                <dt className="text-gray-400">Price per person</dt>
                <dd className="font-bold text-blue-700 text-base">
                  {pricing.pricePerPerson != null ? formatAud(pricing.pricePerPerson) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-gray-400">Approved cargo</dt>
                <dd className="font-semibold text-gray-900">{pricing.approvedCargoKg} kg</dd>
              </div>
            </dl>
          </section>
        )}

        {/* ── Vote results ─────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Vote results ({totalVotes} total)</h2>
          {campaign.candidateDates.length === 0 ? (
            <p className="text-gray-400 text-sm">No candidate dates.</p>
          ) : (
            <div className="space-y-3">
              {[...campaign.candidateDates]
                .sort((a, b) => b._count.votes - a._count.votes)
                .map((d) => {
                  const pct = totalVotes > 0 ? (d._count.votes / totalVotes) * 100 : 0;
                  return (
                    <div key={d.id} className="flex items-center gap-4">
                      <span className="text-sm text-gray-700 w-44 shrink-0">{formatDate(d.date)}</span>
                      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-500 shrink-0 w-16 text-right">
                        {d._count.votes} votes
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </section>

        {/* ── Bookings ─────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-700 mb-4">
            Bookings ({campaign.bookings.length})
          </h2>
          {campaign.bookings.length === 0 ? (
            <p className="text-gray-400 text-sm">No bookings yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="pb-2 font-medium">Passenger</th>
                  <th className="pb-2 font-medium">Pax</th>
                  <th className="pb-2 font-medium">Class</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {campaign.bookings.map((b) => (
                  <tr key={b.id} className="py-2">
                    <td className="py-2">
                      <p className="font-medium text-gray-900">{b.user.name}</p>
                      <p className="text-gray-400">{b.user.email}</p>
                    </td>
                    <td className="py-2 text-gray-700">{b.passengerCount}</td>
                    <td className="py-2 text-gray-700">{b.seatClass}</td>
                    <td className="py-2">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          b.status === "CONFIRMED"
                            ? "bg-green-100 text-green-800"
                            : b.status === "CANCELLED"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* ── Cargo requests ───────────────────────────────────── */}
        <section id="cargo" className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-700 mb-4">
            Cargo requests ({campaign.cargoRequests.length})
          </h2>
          {campaign.cargoRequests.length === 0 ? (
            <p className="text-gray-400 text-sm">No cargo requests yet.</p>
          ) : (
            <div className="space-y-4">
              {campaign.cargoRequests.map((c) => (
                <div key={c.id} className="rounded-xl border border-gray-100 p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">{c.businessName}</p>
                      <p className="text-sm text-gray-400">{c.user.email}</p>
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        c.status === "APPROVED"
                          ? "bg-green-100 text-green-800"
                          : c.status === "REJECTED"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{c.description}</p>
                  <p className="text-sm text-gray-500">
                    {c.weightKg}kg{c.volumeM3 ? ` · ${c.volumeM3}m³` : ""} · {c.cargoType}
                    {campaign.cargoRatePerKg && (
                      <span className="ml-2 font-medium text-gray-700">
                        = {formatAud(c.weightKg * campaign.cargoRatePerKg)}
                      </span>
                    )}
                  </p>

                  {c.status === "PENDING" && (
                    <div className="flex gap-2 pt-1">
                      <Form method="post">
                        <input type="hidden" name="intent" value="approve-cargo" />
                        <input type="hidden" name="cargoId" value={c.id} />
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
                        >
                          Approve
                        </button>
                      </Form>
                      <Form method="post" className="flex gap-2">
                        <input type="hidden" name="intent" value="reject-cargo" />
                        <input type="hidden" name="cargoId" value={c.id} />
                        <input
                          name="adminNotes"
                          type="text"
                          placeholder="Reason (optional)"
                          className="rounded-lg border border-gray-200 px-2 py-1 text-xs w-40 focus:outline-none focus:border-gray-400"
                        />
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </Form>
                    </div>
                  )}
                  {c.adminNotes && (
                    <p className="text-xs text-gray-400 italic">Note: {c.adminNotes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
