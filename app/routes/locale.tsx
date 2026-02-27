import { redirect } from "react-router";
import type { Route } from "./+types/locale";
import { localeCookie } from "~/i18next.server";
import { supportedLngs, fallbackLng } from "~/i18n";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const lng = String(formData.get("lng") ?? fallbackLng);
  const redirectTo = String(formData.get("redirectTo") ?? "/");

  const safeLng = (supportedLngs as readonly string[]).includes(lng)
    ? lng
    : fallbackLng;

  return redirect(redirectTo, {
    headers: { "Set-Cookie": await localeCookie.serialize(safeLng) },
  });
}

// GET fallback — just redirect home
export async function loader() {
  return redirect("/");
}
