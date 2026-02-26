import { Form, Link, useLocation } from "react-router";

type NavUser = {
  name: string;
  role: string;
} | null;

export function Navbar({ user }: { user: NavUser }) {
  const location = useLocation();

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
          {navLink("/campaigns", "Campaigns")}
          {user && navLink("/dashboard", "My trips")}
          {user?.role === "ADMIN" && navLink("/admin", "Admin")}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <>
              <span className="hidden sm:block text-sm text-gray-500">{user.name}</span>
              <Form method="post" action="/logout">
                <button
                  type="submit"
                  className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                >
                  Sign out
                </button>
              </Form>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-full transition-colors"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
