import { data, redirect, Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { useState } from "react";
import { Navbar } from "~/components/Navbar";
import { db } from "~/db.server";
import { requireAdmin } from "~/session.server";
import type { Route } from "./+types/admin.campaigns.new";

export function meta({}: Route.MetaArgs) {
  return [{ title: "New Campaign — Admin" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAdmin(request);
  return { user };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);

  const formData = await request.formData();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const route = String(formData.get("route") ?? "").trim();
  const votingEndsAt = new Date(String(formData.get("votingEndsAt")));
  const totalCharterCostAud = Number(formData.get("totalCharterCostAud")) || null;
  const maxPassengers = Number(formData.get("maxPassengers")) || null;
  const cargoRatePerKg = Number(formData.get("cargoRatePerKg")) || null;
  const rawDates = formData.getAll("candidateDates").map((d) => String(d)).filter(Boolean);

  const errors: Record<string, string> = {};
  if (!title) errors.title = "Title is required.";
  if (!route) errors.route = "Route is required.";
  if (isNaN(votingEndsAt.getTime())) errors.votingEndsAt = "Voting end date is required.";
  if (rawDates.length < 2) errors.candidateDates = "Add at least 2 candidate dates.";
  if (Object.keys(errors).length) return data({ errors }, { status: 400 });

  const campaign = await db.campaign.create({
    data: {
      title,
      description,
      route,
      votingEndsAt,
      totalCharterCostAud,
      maxPassengers,
      cargoRatePerKg,
      status: "VOTING",
      candidateDates: {
        create: rawDates.map((d) => ({ date: new Date(d) })),
      },
    },
  });

  return redirect(`/campaigns/${campaign.id}`);
}

export default function AdminNewCampaignPage() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [dates, setDates] = useState<string[]>(["", "", ""]);

  function addDate() {
    setDates((prev) => [...prev, ""]);
  }

  function removeDate(i: number) {
    setDates((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateDate(i: number, value: string) {
    setDates((prev) => prev.map((d, idx) => (idx === i ? value : d)));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} />

      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Create new campaign</h1>

        <Form method="post" className="space-y-6">
          {/* Basic info */}
          <section className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Campaign details</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                name="title"
                type="text"
                required
                placeholder="Mid-Year 2025 — Sydney ↔ São Paulo"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {actionData?.errors?.title && (
                <p className="mt-1 text-xs text-red-600">{actionData.errors.title}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Route <span className="text-gray-400 font-normal">(IATA codes)</span>
              </label>
              <input
                name="route"
                type="text"
                required
                placeholder="SYD-GRU"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {actionData?.errors?.route && (
                <p className="mt-1 text-xs text-red-600">{actionData.errors.route}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-gray-400 font-normal">optional</span>
              </label>
              <textarea
                name="description"
                rows={3}
                placeholder="Any additional info for passengers..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Voting closes on</label>
              <input
                name="votingEndsAt"
                type="datetime-local"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {actionData?.errors?.votingEndsAt && (
                <p className="mt-1 text-xs text-red-600">{actionData.errors.votingEndsAt}</p>
              )}
            </div>
          </section>

          {/* Pricing */}
          <section className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Pricing</h2>
            <p className="text-xs text-gray-400">
              Set the charter cost and the system will automatically calculate the per-person price
              as bookings come in. Cargo revenue offsets the passenger cost.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total charter cost (AUD)
                </label>
                <input
                  name="totalCharterCostAud"
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="1000000"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max passengers (seats)
                </label>
                <input
                  name="maxPassengers"
                  type="number"
                  min="1"
                  placeholder="500"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cargo rate (AUD per kg)
                </label>
                <input
                  name="cargoRatePerKg"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="5.00"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Business cargo revenue will reduce the per-person passenger cost.
                </p>
              </div>
            </div>
          </section>

          {/* Candidate dates */}
          <section className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
              Candidate dates
            </h2>
            <p className="text-xs text-gray-400">
              Add at least 2 dates for users to vote on. The date with most votes will be the one
              you contact Qantas to close the charter.
            </p>

            {actionData?.errors?.candidateDates && (
              <p className="text-xs text-red-600">{actionData.errors.candidateDates}</p>
            )}

            <div className="space-y-2">
              {dates.map((d, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    name="candidateDates"
                    type="date"
                    value={d}
                    onChange={(e) => updateDate(i, e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {dates.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeDate(i)}
                      className="text-gray-400 hover:text-red-500 text-sm px-2"
                      aria-label="Remove date"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addDate}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + Add another date
            </button>
          </section>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? "Creating…" : "Create campaign"}
          </button>
        </Form>
      </main>
    </div>
  );
}
