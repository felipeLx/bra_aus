import { Link, useLoaderData } from "react-router";
import { useTranslation } from "react-i18next";
import { Navbar } from "~/components/Navbar";
import { db } from "~/db.server";
import { calculatePricing, formatAud } from "~/lib/pricing";
import { getUser } from "~/session.server";
import type { Route } from "./+types/campaigns";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Campaigns — Rio-Aus Flights" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUser(request);

  const campaigns = await db.campaign.findMany({
    where: { status: { in: ["VOTING", "CONFIRMED", "CLOSED"] } },
    include: {
      bookings: { select: { passengerCount: true, status: true } },
      cargoRequests: { select: { weightKg: true, status: true } },
      candidateDates: { select: { id: true }, orderBy: { date: "asc" } },
      _count: { select: { votes: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return { user, campaigns };
}

export const handle = { i18n: "translation" };

export default function CampaignsPage() {
  const { user, campaigns } = useLoaderData<typeof loader>();
  const { t } = useTranslation();

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    VOTING:    { label: t("campaigns.statusVoting"),    color: "bg-green-100 text-green-800" },
    CLOSED:    { label: t("campaigns.statusClosed"),    color: "bg-yellow-100 text-yellow-800" },
    CONFIRMED: { label: t("campaigns.statusConfirmed"), color: "bg-blue-100 text-blue-800" },
    CANCELLED: { label: t("campaigns.statusCancelled"), color: "bg-red-100 text-red-800" },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} />

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t("campaigns.title")}</h1>
        <p className="text-gray-500 mb-8">{t("campaigns.subtitle")}</p>

        {campaigns.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg">{t("campaigns.empty")}</p>
            <p className="text-sm mt-1">{t("campaigns.emptySub")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.map((campaign) => {
              const pricing = calculatePricing(campaign);
              const status = STATUS_LABELS[campaign.status] ?? { label: campaign.status, color: "bg-gray-100 text-gray-800" };

              return (
                <Link
                  key={campaign.id}
                  to={`/campaigns/${campaign.id}`}
                  className="block bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md hover:border-blue-100 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}>
                          {status.label}
                        </span>
                        <span className="text-xs text-gray-400">{campaign.route}</span>
                      </div>
                      <h2 className="text-lg font-semibold text-gray-900 truncate">{campaign.title}</h2>
                      {campaign.description && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{campaign.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        {t("campaigns.votingEnds", {
                          date: new Date(campaign.votingEndsAt).toLocaleDateString("en-AU", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }),
                        })}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      {pricing.pricePerPerson != null ? (
                        <>
                          <p className="text-2xl font-bold text-blue-600">
                            {formatAud(pricing.pricePerPerson)}
                          </p>
                          <p className="text-xs text-gray-400">{t("campaigns.perPersonNow")}</p>
                        </>
                      ) : pricing.bestCasePrice != null ? (
                        <>
                          <p className="text-2xl font-bold text-gray-400">
                            {formatAud(pricing.bestCasePrice)}
                          </p>
                          <p className="text-xs text-gray-400">{t("campaigns.ifFullPlane")}</p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400">{t("campaigns.pricingTbd")}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {t("campaigns.bookings", { count: pricing.activePassengers })}
                        {" · "}
                        {t("campaigns.votes", { count: campaign._count.votes })}
                      </p>
                    </div>
                  </div>

                  {/* Seat fill bar */}
                  {pricing.seatsFillPercent != null && (
                    <div className="mt-4">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>
                          {t("campaigns.seatsFilled", {
                            active: pricing.activePassengers,
                            total: pricing.seatsTotal,
                          })}
                        </span>
                        <span>{Math.round(pricing.seatsFillPercent)}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${Math.min(pricing.seatsFillPercent, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
