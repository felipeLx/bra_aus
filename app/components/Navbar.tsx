import { Form, Link, useLocation } from "react-router";
import { useTranslation } from "react-i18next";

type NavUser = {
  name: string;
  role: string;
} | null;

export function Navbar({ user }: { user: NavUser }) {
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const lng = i18n.language;

  const navLink = (to: string, label: string) => {
    const active = location.pathname === to || location.pathname.startsWith(to + "/");
    return (
      <Link
        to={to}
        className={`text-sm font-medium transition-colors ${
          active ? "text-blue-600" : "text-gray-500 hover:text-gray-900"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="text-xl font-bold text-gray-900 tracking-tight">
            Rio<span className="text-blue-600">-Aus</span>
          </span>
          <span className="text-gray-300 font-light">✈</span>
        </Link>

        {/* Centre links */}
        <div className="flex items-center gap-6">
          {navLink("/campaigns", t("nav.campaigns"))}
          {user && navLink("/dashboard", t("nav.myTrips"))}
          {user?.role === "ADMIN" && (
            <Link
              to="/admin"
              className={`text-sm font-semibold transition-colors ${
                location.pathname.startsWith("/admin")
                  ? "text-orange-600"
                  : "text-orange-500 hover:text-orange-700"
              }`}
            >
              {t("nav.admin")}
            </Link>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Language switcher */}
          <Form method="post" action="/locale" className="flex items-center gap-0.5">
            <input type="hidden" name="redirectTo" value={location.pathname} />
            <button
              name="lng"
              value="en"
              type="submit"
              className={`text-xs px-2 py-1 rounded transition-colors ${
                lng === "en"
                  ? "bg-blue-100 text-blue-700 font-semibold"
                  : "text-gray-400 hover:text-gray-700"
              }`}
            >
              EN
            </button>
            <button
              name="lng"
              value="pt-BR"
              type="submit"
              className={`text-xs px-2 py-1 rounded transition-colors ${
                lng === "pt-BR"
                  ? "bg-blue-100 text-blue-700 font-semibold"
                  : "text-gray-400 hover:text-gray-700"
              }`}
            >
              PT
            </button>
          </Form>

          {user ? (
            <>
              <span className="hidden sm:block text-sm text-gray-500">{user.name}</span>
              <Form method="post" action="/logout">
                <button
                  type="submit"
                  className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                >
                  {t("nav.signOut")}
                </button>
              </Form>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                {t("nav.signIn")}
              </Link>
              <Link
                to="/register"
                className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-full transition-colors"
              >
                {t("nav.getStarted")}
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
