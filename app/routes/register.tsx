import { data, redirect, Form, Link, useActionData } from "react-router";
import { useTranslation } from "react-i18next";
import { registerUser } from "~/auth.server";
import { sendWelcomeEmail } from "~/lib/email.server";
import { createUserSession, getUserId } from "~/session.server";
import type { Route } from "./+types/register";

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await getUserId(request);
  if (userId) return redirect("/");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  const role = formData.get("role") === "BUSINESS" ? "BUSINESS" : "USER";

  const errors: Record<string, string> = {};
  if (!name) errors.name = "Name is required.";
  if (!email) errors.email = "Email is required.";
  if (password.length < 8) errors.password = "Password must be at least 8 characters.";
  if (password !== confirm) errors.confirmPassword = "Passwords do not match.";
  if (Object.keys(errors).length) return data({ errors }, { status: 400 });

  const result = await registerUser({ name, email, password, role });
  if ("error" in result) {
    return data({ errors: { [result.error.field]: result.error.message } }, { status: 400 });
  }

  // Fire-and-forget — never blocks the redirect
  sendWelcomeEmail({ to: email, name });

  return createUserSession({ request, userId: result.user.id, redirectTo: "/" });
}

export const handle = { i18n: "translation" };

export default function RegisterPage() {
  const actionData = useActionData<typeof action>();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">{t("register.title")}</h1>
          <p className="mt-2 text-sm text-gray-600">
            {t("register.haveAccount")}{" "}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
              {t("register.signIn")}
            </Link>
          </p>
        </div>

        <Form method="post" className="mt-8 space-y-6 bg-white p-8 rounded-xl shadow">
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                {t("register.fullName")}
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {actionData?.errors?.name && (
                <p className="mt-1 text-sm text-red-600">{actionData.errors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                {t("register.email")}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {actionData?.errors?.email && (
                <p className="mt-1 text-sm text-red-600">{actionData.errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                {t("register.password")}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {actionData?.errors?.password && (
                <p className="mt-1 text-sm text-red-600">{actionData.errors.password}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                {t("register.confirmPassword")}
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {actionData?.errors?.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{actionData.errors.confirmPassword}</p>
              )}
            </div>

            {/* Account type */}
            <div>
              <p className="block text-sm font-medium text-gray-700 mb-2">{t("register.accountType")}</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="relative flex cursor-pointer rounded-lg border border-gray-300 bg-white p-4 shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 hover:border-gray-400">
                  <input type="radio" name="role" value="USER" defaultChecked className="sr-only" />
                  <span className="flex flex-1 flex-col">
                    <span className="block text-sm font-medium text-gray-900">{t("register.passengerLabel")}</span>
                    <span className="mt-1 block text-xs text-gray-500">{t("register.passengerDesc")}</span>
                  </span>
                </label>
                <label className="relative flex cursor-pointer rounded-lg border border-gray-300 bg-white p-4 shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 hover:border-gray-400">
                  <input type="radio" name="role" value="BUSINESS" className="sr-only" />
                  <span className="flex flex-1 flex-col">
                    <span className="block text-sm font-medium text-gray-900">{t("register.businessLabel")}</span>
                    <span className="mt-1 block text-xs text-gray-500">{t("register.businessDesc")}</span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {t("register.createAccount")}
          </button>
        </Form>
      </div>
    </div>
  );
}
