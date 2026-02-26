import { data, redirect, Form, Link, useLoaderData, useActionData, useNavigation } from "react-router";
import { Navbar } from "~/components/Navbar";
import { db } from "~/db.server";
import { calculatePricing, formatAud } from "~/lib/pricing";
import { getUser, requireUserId } from "~/session.server";
import type { Route } from "./+types/campaigns.$id";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `${data?.campaign?.title ?? "Campaign"} — Rio-Aus Flights` }];
}

// ─── Loader ────────────────────────────────────────────────────

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await getUser(request);

  const campaign = await db.campaign.findUnique({
    where: { id: params.id },
    include: {
      candidateDates: {
        include: { _count: { select: { votes: true } } },
        orderBy: { date: "asc" },
      },
      bookings: { select: { passengerCount: true, status: true } },
      cargoRequests: { select: { weightKg: true, status: true } },
    },
  });

  if (!campaign) throw new Response("Not found", { status: 404 });

  const userVote = user
    ? await db.vote.findUnique({
        where: { userId_campaignId: { userId: user.id, campaignId: campaign.id } },
      })
    : null;

  const userBooking = user
    ? await db.booking.findUnique({
        where: { userId_campaignId: { userId: user.id, campaignId: campaign.id } },
      })
    : null;

  const userCargo = user
    ? await db.cargoRequest.findFirst({
        where: { userId: user.id, campaignId: campaign.id },
      })
    : null;

  const totalVotes = campaign.candidateDates.reduce((sum, d) => sum + d._count.votes, 0);
  const pricing = calculatePricing(campaign);

  return { campaign, user, userVote, userBooking, userCargo, totalVotes, pricing };
}

// ─── Action ────────────────────────────────────────────────────

export async function action({ request, params }: Route.ActionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent"));

  // ── Vote ──────────────────────────────────────────────────────
  if (intent === "vote") {
    const candidateDateId = String(formData.get("candidateDateId"));

    const campaign = await db.campaign.findUnique({ where: { id: params.id } });
    if (!campaign || campaign.status !== "VOTING") {
      return data({ error: "Voting is not open for this campaign." }, { status: 400 });
    }

    await db.vote.upsert({
      where: { userId_campaignId: { userId, campaignId: params.id } },
      create: { userId, campaignId: params.id, candidateDateId },
      update: { candidateDateId },
    });

    return redirect(`/campaigns/${params.id}`);
  }

  // ── Book ──────────────────────────────────────────────────────
  if (intent === "book") {
    const passengerCount = Number(formData.get("passengerCount")) || 1;
    const seatClass = String(formData.get("seatClass") ?? "ECONOMY") as "ECONOMY" | "BUSINESS" | "FIRST";
    const specialRequirements = String(formData.get("specialRequirements") ?? "").trim() || null;

    await db.booking.upsert({
      where: { userId_campaignId: { userId, campaignId: params.id } },
      create: { userId, campaignId: params.id, passengerCount, seatClass, specialRequirements },
      update: { passengerCount, seatClass, specialRequirements },
    });

    return redirect(`/campaigns/${params.id}#booking`);
  }

  // ── Cargo ─────────────────────────────────────────────────────
  if (intent === "cargo") {
    const businessName = String(formData.get("businessName") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const weightKg = Number(formData.get("weightKg"));
    const volumeM3 = Number(formData.get("volumeM3")) || null;
    const cargoType = String(formData.get("cargoType") ?? "").trim();

    if (!businessName || !description || !weightKg || !cargoType) {
      return data({ error: "Please fill in all required cargo fields." }, { status: 400 });
    }

    await db.cargoRequest.create({
      data: { userId, campaignId: params.id, businessName, description, weightKg, volumeM3, cargoType },
    });

    return redirect(`/campaigns/${params.id}#cargo`);
  }

  return data({ error: "Unknown action." }, { status: 400 });
}

// ─── UI helpers ────────────────────────────────────────────────

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

function PricingCard({ pricing }: { pricing: ReturnType<typeof calculatePricing> }) {
  return (
    <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
      <p className="text-blue-200 text-sm font-medium uppercase tracking-wide mb-1">Live price estimate</p>

      {pricing.pricePerPerson != null ? (
        <p className="text-5xl font-bold mb-1">{formatAud(pricing.pricePerPerson)}</p>
      ) : (
        <p className="text-3xl font-bold mb-1 text-blue-200">No bookings yet</p>
      )}
      <p className="text-blue-200 text-sm mb-6">per person · updates as more people join</p>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-blue-300">Charter cost</p>
          <p className="font-semibold">{formatAud(pricing.charterCost)}</p>
        </div>
        {pricing.cargoRevenue > 0 && (
          <div>
            <p className="text-blue-300">Cargo offset</p>
            <p className="font-semibold text-green-300">−{formatAud(pricing.cargoRevenue)}</p>
          </div>
        )}
        <div>
          <p className="text-blue-300">Passenger pool</p>
          <p className="font-semibold">{formatAud(pricing.passengerPool)}</p>
        </div>
        <div>
          <p className="text-blue-300">Active bookings</p>
          <p className="font-semibold">{pricing.activePassengers} pax</p>
        </div>
      </div>

      {pricing.seatsTotal != null && (
        <div className="mt-5">
          <div className="flex justify-between text-xs text-blue-200 mb-1.5">
            <span>{pricing.activePassengers} of {pricing.seatsTotal} seats filled</span>
            {pricing.bestCasePrice != null && (
              <span>Best case: {formatAud(pricing.bestCasePrice)}/pax</span>
            )}
          </div>
          <div className="h-2 bg-blue-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{ width: `${Math.min(pricing.seatsFillPercent ?? 0, 100)}%` }}
            />
          </div>
          <p className="text-xs text-blue-200 mt-1">
            Invite more people to lower the price for everyone.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────

export default function CampaignDetailPage() {
  const { campaign, user, userVote, userBooking, userCargo, totalVotes, pricing } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const isVotingOpen = campaign.status === "VOTING";
  const maxVotes = Math.max(...campaign.candidateDates.map((d) => d._count.votes), 1);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} />

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <StatusBadge status={campaign.status} />
            <span className="text-sm text-gray-400 font-mono">{campaign.route}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{campaign.title}</h1>
          {campaign.description && (
            <p className="mt-2 text-gray-500">{campaign.description}</p>
          )}
          <p className="mt-2 text-sm text-gray-400">
            Voting closes {formatDate(campaign.votingEndsAt)}
          </p>
          {campaign.confirmedDate && (
            <p className="mt-1 text-sm font-medium text-green-700">
              ✓ Flight confirmed for {formatDate(campaign.confirmedDate)}
            </p>
          )}
        </div>

        {/* Pricing */}
        {campaign.totalCharterCostAud && <PricingCard pricing={pricing} />}

        {/* Admin link */}
        {user?.role === "ADMIN" && (
          <div className="flex justify-end">
            <Link
              to={`/admin/campaigns/${campaign.id}`}
              className="text-sm text-gray-500 underline hover:text-gray-700"
            >
              Manage this campaign →
            </Link>
          </div>
        )}

        {/* ── Vote ────────────────────────────────────────────── */}
        <section id="vote">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {isVotingOpen ? "Vote for your preferred date" : "Vote results"}
          </h2>

          {campaign.candidateDates.length === 0 ? (
            <p className="text-gray-400">No candidate dates set yet.</p>
          ) : (
            <div className="space-y-3">
              {campaign.candidateDates.map((d) => {
                const isUserVote = userVote?.candidateDateId === d.id;
                const votePercent = totalVotes > 0 ? (d._count.votes / totalVotes) * 100 : 0;
                const isLeading =
                  d._count.votes === maxVotes && d._count.votes > 0;

                return (
                  <div
                    key={d.id}
                    className={`rounded-xl border p-4 ${
                      isUserVote
                        ? "border-blue-400 bg-blue-50"
                        : isLeading
                        ? "border-green-200 bg-green-50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        {isLeading && <span className="text-green-600 text-sm">★</span>}
                        <span className="font-medium text-gray-900">{formatDate(d.date)}</span>
                        {isUserVote && (
                          <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                            Your vote
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm text-gray-500">
                          {d._count.votes} vote{d._count.votes !== 1 ? "s" : ""}
                        </span>
                        {isVotingOpen && user && !isUserVote && (
                          <Form method="post">
                            <input type="hidden" name="intent" value="vote" />
                            <input type="hidden" name="candidateDateId" value={d.id} />
                            <button
                              type="submit"
                              disabled={isSubmitting}
                              className="text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-300 hover:border-blue-500 px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
                            >
                              Vote
                            </button>
                          </Form>
                        )}
                        {isVotingOpen && !user && (
                          <Link
                            to="/login"
                            className="text-sm text-blue-600 border border-blue-300 px-3 py-1 rounded-lg"
                          >
                            Sign in to vote
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Vote bar */}
                    <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isLeading ? "bg-green-500" : "bg-blue-400"
                        }`}
                        style={{ width: `${votePercent}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {Math.round(votePercent)}% of votes
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Book a seat ─────────────────────────────────────── */}
        {user && user.role !== "BUSINESS" && (
          <section id="booking" className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              {userBooking ? "Update your booking" : "Book your seat"}
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              Your booking is pending until the flight is confirmed by the admin.
            </p>

            {actionData?.error && (
              <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">
                {actionData.error}
              </p>
            )}

            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="book" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Number of passengers
                  </label>
                  <select
                    name="passengerCount"
                    defaultValue={userBooking?.passengerCount ?? 1}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? "person" : "people"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Seat class</label>
                  <select
                    name="seatClass"
                    defaultValue={userBooking?.seatClass ?? "ECONOMY"}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="ECONOMY">Economy</option>
                    <option value="BUSINESS">Business</option>
                    <option value="FIRST">First class</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Special requirements{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  name="specialRequirements"
                  rows={3}
                  defaultValue={userBooking?.specialRequirements ?? ""}
                  placeholder="Dietary needs, accessibility, etc."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
              >
                {isSubmitting
                  ? "Saving…"
                  : userBooking
                  ? "Update booking"
                  : "Request booking"}
              </button>

              {userBooking && (
                <p className="text-center text-xs text-gray-400">
                  Status:{" "}
                  <span className="font-medium text-gray-600">{userBooking.status}</span>
                </p>
              )}
            </Form>
          </section>
        )}

        {/* ── Cargo request ────────────────────────────────────── */}
        {user && user.role === "BUSINESS" && (
          <section id="cargo" className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Cargo request</h2>
            {campaign.cargoRatePerKg && (
              <p className="text-sm text-gray-500 mb-1">
                Rate: <span className="font-semibold text-gray-700">{formatAud(campaign.cargoRatePerKg)}/kg</span>
              </p>
            )}
            <p className="text-sm text-gray-500 mb-5">
              Submit your cargo details. The admin will review and approve your request.
            </p>

            {userCargo ? (
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-2 text-sm">
                <p className="font-medium text-gray-900">Cargo request submitted</p>
                <p className="text-gray-600">
                  {userCargo.businessName} · {userCargo.weightKg}kg · {userCargo.cargoType}
                </p>
                <p>
                  Status:{" "}
                  <span
                    className={`font-medium ${
                      userCargo.status === "APPROVED"
                        ? "text-green-700"
                        : userCargo.status === "REJECTED"
                        ? "text-red-600"
                        : "text-yellow-700"
                    }`}
                  >
                    {userCargo.status}
                  </span>
                </p>
                {userCargo.adminNotes && (
                  <p className="text-gray-500 italic">Note: {userCargo.adminNotes}</p>
                )}
                {campaign.cargoRatePerKg && userCargo.status === "APPROVED" && (
                  <p className="font-semibold text-gray-900">
                    Your cargo cost: {formatAud(userCargo.weightKg * campaign.cargoRatePerKg)}
                  </p>
                )}
              </div>
            ) : (
              <>
                {actionData?.error && (
                  <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">
                    {actionData.error}
                  </p>
                )}
                <Form method="post" className="space-y-4">
                  <input type="hidden" name="intent" value="cargo" />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Business name
                      </label>
                      <input
                        name="businessName"
                        type="text"
                        required
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Weight (kg)
                      </label>
                      <input
                        name="weightKg"
                        type="number"
                        min="1"
                        step="0.1"
                        required
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Volume (m³) <span className="text-gray-400 font-normal">optional</span>
                      </label>
                      <input
                        name="volumeM3"
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cargo type
                      </label>
                      <input
                        name="cargoType"
                        type="text"
                        placeholder="e.g. Wine, machinery parts, clothing"
                        required
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        name="description"
                        rows={3}
                        required
                        placeholder="Describe your cargo, any special handling requirements, etc."
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {isSubmitting ? "Submitting…" : "Submit cargo request"}
                  </button>
                </Form>
              </>
            )}
          </section>
        )}

        {/* Prompt non-logged-in users */}
        {!user && (
          <div className="text-center py-10 bg-white rounded-2xl border border-gray-100">
            <p className="text-gray-700 font-medium">Want to vote or book?</p>
            <p className="text-gray-400 text-sm mt-1 mb-4">
              Create a free account to participate.
            </p>
            <div className="flex justify-center gap-3">
              <Link
                to="/register"
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                Get started
              </Link>
              <Link
                to="/login"
                className="px-5 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Sign in
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    VOTING: "bg-green-100 text-green-800",
    CLOSED: "bg-yellow-100 text-yellow-800",
    CONFIRMED: "bg-blue-100 text-blue-800",
    CANCELLED: "bg-red-100 text-red-800",
    DRAFT: "bg-gray-100 text-gray-600",
  };
  const labels: Record<string, string> = {
    VOTING: "Voting open",
    CLOSED: "Voting closed",
    CONFIRMED: "Confirmed",
    CANCELLED: "Cancelled",
    DRAFT: "Draft",
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {labels[status] ?? status}
    </span>
  );
}
