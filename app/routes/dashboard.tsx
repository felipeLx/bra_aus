import { Link, useLoaderData } from "react-router";
import { Navbar } from "~/components/Navbar";
import { db } from "~/db.server";
import { calculatePricing, formatAud } from "~/lib/pricing";
import { requireUser } from "~/session.server";
import type { Route } from "./+types/dashboard";

export function meta({}: Route.MetaArgs) {
  return [{ title: "My Trips — Rio-Aus Flights" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);

  const [bookings, votes, cargoRequests] = await Promise.all([
    db.booking.findMany({
      where: { userId: user.id },
      include: {
        campaign: {
          include: {
            bookings: { select: { passengerCount: true, status: true } },
            cargoRequests: { select: { weightKg: true, status: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.vote.findMany({
      where: { userId: user.id },
      include: {
        campaign: { select: { id: true, title: true, status: true } },
        candidateDate: { select: { date: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.cargoRequest.findMany({
      where: { userId: user.id },
      include: {
        campaign: { select: { id: true, title: true, cargoRatePerKg: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return { user, bookings, votes, cargoRequests };
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
  });
}

const BOOKING_STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-700",
};

const CARGO_STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-700",
};

export default function DashboardPage() {
  const { user, bookings, votes, cargoRequests } = useLoaderData<typeof loader>();

  const totalPassengers = bookings
    .filter((b) => b.status !== "CANCELLED")
    .reduce((s, b) => s + b.passengerCount, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} />

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-10">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Hey, {user.name.split(" ")[0]} 👋
          </h1>
          <p className="text-gray-400 mt-1">
            {totalPassengers > 0
              ? `You have ${totalPassengers} seat${totalPassengers !== 1 ? "s" : ""} reserved.`
              : "No bookings yet. Find an open campaign and join!"}
          </p>
        </div>

        {/* ── My Bookings ─────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">My bookings</h2>
            <Link to="/campaigns" className="text-sm text-blue-600 hover:text-blue-700">
              Browse campaigns →
            </Link>
          </div>

          {bookings.length === 0 ? (
            <EmptyState
              icon="✈️"
              title="No bookings yet"
              desc="Join an open campaign to reserve your seat."
              cta={{ label: "View campaigns", to: "/campaigns" }}
            />
          ) : (
            <div className="space-y-3">
              {bookings.map((b) => {
                const pricing = calculatePricing(b.campaign);
                return (
                  <Link
                    key={b.id}
                    to={`/campaigns/${b.campaign.id}`}
                    className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 p-5 hover:border-blue-100 hover:shadow-sm transition-all"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{b.campaign.title}</p>
                      <p className="text-sm text-gray-400 mt-0.5">
                        {b.passengerCount} seat{b.passengerCount !== 1 ? "s" : ""} ·{" "}
                        {b.seatClass.charAt(0) + b.seatClass.slice(1).toLowerCase()} class
                      </p>
                    </div>
                    <div className="text-right">
                      {pricing.pricePerPerson != null && (
                        <p className="text-lg font-bold text-blue-600">
                          {formatAud(pricing.pricePerPerson * b.passengerCount)}
                        </p>
                      )}
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${BOOKING_STATUS_STYLE[b.status] ?? ""}`}
                      >
                        {b.status}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* ── My Votes ────────────────────────────────────────── */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">My votes</h2>

          {votes.length === 0 ? (
            <EmptyState
              icon="🗳️"
              title="No votes yet"
              desc="Open a campaign and vote for your preferred date."
              cta={{ label: "View campaigns", to: "/campaigns" }}
            />
          ) : (
            <div className="space-y-3">
              {votes.map((v) => (
                <Link
                  key={v.id}
                  to={`/campaigns/${v.campaign.id}`}
                  className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 p-5 hover:border-blue-100 hover:shadow-sm transition-all"
                >
                  <div>
                    <p className="font-semibold text-gray-900">{v.campaign.title}</p>
                    <p className="text-sm text-gray-400 mt-0.5">
                      Voted for{" "}
                      <span className="font-medium text-gray-600">
                        {formatDate(v.candidateDate.date)}
                      </span>
                    </p>
                  </div>
                  <CampaignStatusBadge status={v.campaign.status} />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── My Cargo (business only) ─────────────────────────── */}
        {(user.role === "BUSINESS" || cargoRequests.length > 0) && (
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">My cargo requests</h2>

            {cargoRequests.length === 0 ? (
              <EmptyState
                icon="📦"
                title="No cargo requests yet"
                desc="Open a campaign page and submit your cargo details."
                cta={{ label: "View campaigns", to: "/campaigns" }}
              />
            ) : (
              <div className="space-y-3">
                {cargoRequests.map((c) => {
                  const cargoRevenue =
                    c.campaign.cargoRatePerKg && c.status === "APPROVED"
                      ? c.weightKg * c.campaign.cargoRatePerKg
                      : null;
                  return (
                    <Link
                      key={c.id}
                      to={`/campaigns/${c.campaign.id}`}
                      className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 p-5 hover:border-blue-100 hover:shadow-sm transition-all"
                    >
                      <div>
                        <p className="font-semibold text-gray-900">{c.businessName}</p>
                        <p className="text-sm text-gray-400 mt-0.5">
                          {c.campaign.title} · {c.weightKg}kg · {c.cargoType}
                        </p>
                      </div>
                      <div className="text-right">
                        {cargoRevenue != null && (
                          <p className="text-sm font-bold text-green-700 mb-1">
                            {formatAud(cargoRevenue)}
                          </p>
                        )}
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${CARGO_STATUS_STYLE[c.status] ?? ""}`}
                        >
                          {c.status}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  desc,
  cta,
}: {
  icon: string;
  title: string;
  desc: string;
  cta: { label: string; to: string };
}) {
  return (
    <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="font-medium text-gray-900">{title}</p>
      <p className="text-sm text-gray-400 mt-1 mb-4">{desc}</p>
      <Link
        to={cta.to}
        className="text-sm font-medium text-blue-600 hover:text-blue-700"
      >
        {cta.label}
      </Link>
    </div>
  );
}

function CampaignStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    VOTING: "bg-green-100 text-green-800",
    CLOSED: "bg-yellow-100 text-yellow-800",
    CONFIRMED: "bg-blue-100 text-blue-800",
    CANCELLED: "bg-red-100 text-red-700",
  };
  const labels: Record<string, string> = {
    VOTING: "Voting open",
    CLOSED: "Voting closed",
    CONFIRMED: "Confirmed",
    CANCELLED: "Cancelled",
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {labels[status] ?? status}
    </span>
  );
}
