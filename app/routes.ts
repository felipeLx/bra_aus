import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),

  // Auth
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  route("logout", "routes/logout.tsx"),

  // Campaigns (public + logged in)
  route("campaigns", "routes/campaigns.tsx"),
  route("campaigns/:id", "routes/campaigns.$id.tsx"),

  // User dashboard
  route("dashboard", "routes/dashboard.tsx"),

  // Locale switcher
  route("locale", "routes/locale.tsx"),

  // Admin
  route("admin", "routes/admin._index.tsx"),
  route("admin/campaigns/new", "routes/admin.campaigns.new.tsx"),
  route("admin/campaigns/:id", "routes/admin.campaigns.$id.tsx"),
] satisfies RouteConfig;
