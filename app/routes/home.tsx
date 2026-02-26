import { Link, useLoaderData } from "react-router";
import { Navbar } from "~/components/Navbar";
import { db } from "~/db.server";
import { formatAud } from "~/lib/pricing";
import { getUser } from "~/session.server";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Rio-Aus Flights — Australia ↔ Brazil, together" },
    { name: "description", content: "Group charter flights between Australia and Brazil. Vote, book, share the cost." },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUser(request);

  const nextCampaign = await db.campaign.findFirst({
    where: { status: "VOTING" },
    orderBy: { votingEndsAt: "asc" },
  });

  const stats = await db.$queryRaw<{ passengers: bigint; campaigns: bigint }[]>`
    SELECT
      (SELECT COALESCE(SUM("passengerCount"), 0) FROM "Booking" WHERE status != 'CANCELLED') AS passengers,
      (SELECT COUNT(*) FROM "Campaign" WHERE status IN ('VOTING','CONFIRMED')) AS campaigns
  `;

  return {
    user,
    nextCampaign,
    stats: {
      passengers: Number(stats[0]?.passengers ?? 0),
      campaigns: Number(stats[0]?.campaigns ?? 0),
    },
  };
}

const STEPS = [
  { icon: "🗳️", title: "Vote", desc: "Pick your preferred travel date. The date with the most votes is the one we take to Qantas." },
  { icon: "✈️", title: "Book", desc: "Reserve your seat. The price per person drops in real-time as more people join." },
  { icon: "🤝", title: "Fly", desc: "Once we confirm the charter, you pay your share and we handle the rest." },
];

const PRICE_EXAMPLES = [100, 200, 350, 500];

export default function Home() {
  const { user, nextCampaign, stats } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-white">
      <Navbar user={user} />

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50 -z-10" />
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-blue-100 rounded-full blur-3xl opacity-30 -z-10" />
        <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-indigo-100 rounded-full blur-3xl opacity-30 -z-10" />

        <div className="max-w-6xl mx-auto px-6 py-24 md:py-36">
          <div className="max-w-2xl">
            {nextCampaign && (
              <Link
                to={`/campaigns/${nextCampaign.id}`}
                className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-full mb-6 transition-colors"
              >
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                Voting open now →
              </Link>
            )}

            <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 leading-[1.1] tracking-tight">
              Australia ↔ Brazil,
              <br />
              <span className="text-blue-600">together.</span>
            </h1>

            <p className="mt-6 text-xl text-gray-500 leading-relaxed max-w-xl">
              We organise group charter flights twice a year on the direct Sydney–São Paulo route.
              The more people who join, the less <em>everyone</em> pays.
            </p>

            {(stats.passengers > 0 || stats.campaigns > 0) && (
              <div className="mt-6 flex flex-wrap gap-3">
                {stats.campaigns > 0 && (
                  <span className="text-sm font-medium text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm">
                    {stats.campaigns} campaign{stats.campaigns !== 1 ? "s" : ""} active
                  </span>
                )}
                {stats.passengers > 0 && (
                  <span className="text-sm font-medium text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm">
                    {stats.passengers} seat{stats.passengers !== 1 ? "s" : ""} reserved
                  </span>
                )}
              </div>
            )}

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                to="/campaigns"
                className="px-8 py-3 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm hover:shadow-md transition-all"
              >
                View campaigns
              </Link>
              {!user && (
                <Link
                  to="/register"
                  className="px-8 py-3 text-base font-semibold text-gray-700 bg-white border border-gray-200 hover:border-gray-300 rounded-xl shadow-sm hover:shadow-md transition-all"
                >
                  Create free account
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Price visualiser ────────────────────────────────── */}
      <section className="bg-gray-900 text-white py-20">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-3">The price drops as more people join</h2>
          <p className="text-gray-400 mb-12 max-w-lg mx-auto">
            The charter cost is split equally. Cargo from businesses reduces costs further.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {PRICE_EXAMPLES.map((pax) => (
              <div key={pax} className="bg-white/5 hover:bg-white/10 rounded-2xl p-5 transition-colors">
                <p className="text-gray-400 text-sm mb-1">{pax} passengers</p>
                <p className="text-2xl font-bold">{formatAud(1_000_000 / pax)}</p>
                <p className="text-gray-500 text-xs mt-1">per person</p>
              </div>
            ))}
          </div>

          <p className="mt-6 text-gray-600 text-xs">
            Example using an A$1,000,000 charter. Cargo revenue reduces the passenger cost.
          </p>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">How it works</h2>
            <p className="mt-3 text-gray-400">Twice a year, same simple process.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            {STEPS.map((step, i) => (
              <div key={step.title} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-px bg-gray-100 -translate-x-8" />
                )}
                <div className="w-16 h-16 flex items-center justify-center text-3xl bg-blue-50 rounded-2xl mb-5">
                  {step.icon}
                </div>
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-widest">
                  Step {i + 1}
                </span>
                <h3 className="mt-1 text-xl font-bold text-gray-900">{step.title}</h3>
                <p className="mt-2 text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Business CTA ────────────────────────────────────── */}
      <section className="bg-indigo-50 py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-white rounded-3xl p-10 shadow-sm border border-indigo-100 flex flex-col md:flex-row items-start md:items-center gap-8">
            <div className="text-5xl">📦</div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900">Have cargo to ship to Brazil?</h2>
              <p className="mt-2 text-gray-500 leading-relaxed">
                Businesses can reserve hold space at a fixed rate per kg. Your booking revenue is
                deducted from the total cost, making tickets cheaper for everyone on board.
              </p>
            </div>
            <Link
              to={user ? "/campaigns" : "/register"}
              className="shrink-0 px-6 py-3 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-xl transition-colors"
            >
              Ship with us →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-400">
          <span>Rio-Aus Flights · Australia ↔ Brazil</span>
          <div className="flex gap-5">
            <Link to="/campaigns" className="hover:text-gray-600 transition-colors">Campaigns</Link>
            {user && <Link to="/dashboard" className="hover:text-gray-600 transition-colors">My trips</Link>}
            {!user && <Link to="/register" className="hover:text-gray-600 transition-colors">Register</Link>}
          </div>
        </div>
      </footer>
    </div>
  );
}
