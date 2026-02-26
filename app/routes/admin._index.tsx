import { Link, useLoaderData } from "react-router";
import { Navbar } from "~/components/Navbar";
import { db } from "~/db.server";
import { calculatePricing, formatAud } from "~/lib/pricing";
import { requireAdmin } from "~/session.server";
import type { Route } from "./+types/admin._index";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Admin Dashboard — Rio-Aus Flights" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAdmin(request);

  const [campaigns, bookingAgg, cargoAgg] = await Promise.all([
    db.campaign.findMany({
      include: {
        bookings: { select: { passengerCount: true, status: true } },
        cargoRequests: { select: { weightKg: true, status: true } },
        _count: { select: { votes: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.booking.aggregate({
      _count: { id: true },
      _sum: { passengerCount: true },
    }),
    db.cargoRequest.aggregate({
      _count: { id: true },
      _sum: { weightKg: true },
    }),
  ]);

  const confirmedPassengers = await db.booking.aggregate({
    where: { status: "CONFIRMED" },
    _sum: { passengerCount: true },
  });

  const approvedCargoKg = await db.cargoRequest.aggregate({
    where: { status: "APPROVED" },
    _sum: { weightKg: true },
  });

  const activeCampaigns = campaigns.filter((c) =>
    ["VOTING", "CONFIRMED"].includes(c.status)
  );

  return {
    user,
    campaigns,
    stats: {
      totalCampaigns: campaigns.length,
      activeCampaigns: activeCampaigns.length,
      totalBookings: bookingAgg._count.id,
      totalPassengers: bookingAgg._sum.passengerCount ?? 0,
      confirmedPassengers: confirmedPassengers._sum.passengerCount ?? 0,
      totalCargoRequests: cargoAgg._count.id,
      approvedCargoKg: approvedCargoKg._sum.weightKg ?? 0,
    },
  };
}

const CAMPAIGN_STATUS_STYLE: Record<string, { dot: string; badge: string; label: string }> = {
  DRAFT:     { dot: "bg-gray-400",   badge: "bg-gray-100 text-gray-600",     label: "Draft" },
  VOTING:    { dot: "bg-green-500",  badge: "bg-green-100 text-green-800",   label: "Voting open" },
  CLOSED:    { dot: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-800", label: "Closed" },
  CONFIRMED: { dot: "bg-blue-500",   badge: "bg-blue-100 text-blue-800",     label: "Confirmed" },
  CANCELLED: { dot: "bg-red-500",    badge: "bg-red-100 text-red-700",       label: "Cancelled" },
};

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminIndexPage() {
  const { user, campaigns, stats } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} />

      <main className="max-w-6xl mx-auto px-6 py-12 space-y-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin dashboard</h1>
            <p className="text-gray-400 mt-1">Overview of all campaigns and activity.</p>
          </div>
          <Link
            to="/admin/campaigns/new"
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm"
          >
            + New campaign
          </Link>
        </div>

        {/* ── Stats grid ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total campaigns" value={stats.totalCampaigns} sub={`${stats.activeCampaigns} active`} icon="📋" />
          <StatCard label="Total bookings" value={stats.totalBookings} sub={`${stats.confirmedPassengers} confirmed pax`} icon="🎫" />
          <StatCard label="Total passengers" value={stats.totalPassengers} sub="reserved seats" icon="👥" />
          <StatCard label="Approved cargo" value={`${Math.round(stats.approvedCargoKg)}kg`} sub={`${stats.totalCargoRequests} requests`} icon="📦" />
        </div>

        {/* ── Campaigns table ──────────────────────────────────── */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">All campaigns</h2>

          {campaigns.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
              <p className="text-gray-400">No campaigns yet.</p>
              <Link to="/admin/campaigns/new" className="mt-3 inline-block text-sm text-blue-600 font-medium">
                Create the first one →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => {
                const pricing = calculatePricing(c);
                const statusInfo = CAMPAIGN_STATUS_STYLE[c.status] ?? CAMPAIGN_STATUS_STYLE.DRAFT;

                return (
                  <div
                    key={c.id}
                    className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-blue-100 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-2 w-2 h-2 rounded-full shrink-0 ${statusInfo.dot}`} />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{c.title}</p>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusInfo.badge}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 mt-0.5">
                          {c.route} · Voting ends {formatDate(c.votingEndsAt)}
                          {c.confirmedDate && ` · Flying ${formatDate(c.confirmedDate)}`}
                        </p>
                        <div className="flex gap-4 mt-2 text-xs text-gray-400">
                          <span>{pricing.activePassengers} pax</span>
                          <span>{c._count.votes} votes</span>
                          <span>{pricing.approvedCargoKg}kg cargo</span>
                          {pricing.pricePerPerson != null && (
                            <span className="font-medium text-blue-600">
                              {formatAud(pricing.pricePerPerson)}/pax
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <Link
                        to={`/campaigns/${c.id}`}
                        className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-gray-300 transition-colors"
                      >
                        Public view
                      </Link>
                      <Link
                        to={`/admin/campaigns/${c.id}`}
                        className="text-sm px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors"
                      >
                        Manage →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xl">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm font-medium text-gray-500 mt-0.5">{label}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}
