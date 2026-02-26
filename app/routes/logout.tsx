import { redirect } from "react-router";
import { logout } from "~/session.server";
import type { Route } from "./+types/logout";

export async function action({ request }: Route.ActionArgs) {
  return logout(request);
}

// Redirect GET requests (e.g. direct URL access) back home
export async function loader() {
  return redirect("/");
}
