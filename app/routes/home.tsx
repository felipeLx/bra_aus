import { Form, Link, useLoaderData } from "react-router";
import { getUser } from "~/session.server";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Rio-Aus Flights" },
    { name: "description", content: "Organising charter flights between Australia and Brazil." },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUser(request);
  return { user };
}

export default function Home() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <span className="text-xl font-bold text-gray-900">Rio-Aus Flights ✈️</span>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-sm text-gray-600">Hi, {user.name}</span>
              <Form method="post" action="/logout">
                <button
                  type="submit"
                  className="text-sm text-gray-500 hover:text-gray-900 underline"
                >
                  Sign out
                </button>
              </Form>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900">
                Sign in
              </Link>
              <Link
                to="/register"
                className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <main className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h1 className="text-5xl font-bold text-gray-900 leading-tight">
          Australia ↔ Brazil,
          <br />
          <span className="text-blue-600">together.</span>
        </h1>
        <p className="mt-6 text-xl text-gray-500 max-w-2xl mx-auto">
          We organise group charter flights twice a year. Vote on your preferred date, book your
          seat, and share the cost — the more people who join, the cheaper it gets.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          {user ? (
            <Link
              to="/campaigns"
              className="px-8 py-3 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
            >
              View open campaigns
            </Link>
          ) : (
            <>
              <Link
                to="/register"
                className="px-8 py-3 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
              >
                Join the next flight
              </Link>
              <Link
                to="/login"
                className="px-8 py-3 text-base font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
