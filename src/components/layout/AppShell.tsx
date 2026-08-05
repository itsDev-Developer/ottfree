import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, Tv, LogOut, Shield } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSession, logout } from "@/services/backend";
import { fetchSiteSettings } from "@/lib/cloudSettings";
import { motion } from "framer-motion";
import { useEffect, useMemo, type ReactNode } from "react";
import { trackVisit } from "@/store/analytics";
import { useSpatialNavigation } from "@/hooks/useSpatialNavigation";
import { SiteFooter } from "./SiteFooter";

const navItems = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search },
];

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const session = useQuery({ queryKey: ["session"], queryFn: fetchSession, staleTime: 60_000 });
  const site = useQuery({ queryKey: ["site-settings"], queryFn: fetchSiteSettings, staleTime: 5 * 60 * 1000 });
  const isAdmin = !!session.data?.isAdmin;

  const mobileNav = useMemo(
    () => (isAdmin ? [...navItems, { to: "/admin", label: "Admin", icon: Shield }] : navItems),
    [isAdmin],
  );


  const siteName = site.data?.site_name || "OttFree";
  const logoUrl = site.data?.logo_url;

  useEffect(() => { trackVisit(path); }, [path]);

  // TV remote / arrow-key focus movement across rows, grids and cards.
  useSpatialNavigation();


  const doLogout = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      qc.clear();
      window.location.assign("/login");
    },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to content
      </a>
      {site.data?.header_html && (
        <div
          className="border-b border-white/10 bg-primary/10 px-4 py-2 text-center text-xs md:px-8"
          dangerouslySetInnerHTML={{ __html: site.data.header_html }}
        />
      )}
      <header className="glass sticky top-0 z-40 flex h-16 items-center gap-4 px-4 md:px-8">

        <Link to="/home" className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt={siteName} className="h-8 w-8 rounded-lg object-cover" />
          ) : (
            <div className="gradient-primary flex h-8 w-8 items-center justify-center rounded-lg shadow-lg shadow-primary/40">
              <Tv className="h-4 w-4 text-white" />
            </div>
          )}
          <span className="font-display text-lg font-bold tracking-tight">
            {siteName}
          </span>
        </Link>
        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {navItems.map((n) => {
            const active = path === n.to || (n.to !== "/home" && path.startsWith(n.to));
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-white/10"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <span className="relative">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/search"
            className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-muted-foreground transition hover:bg-white/10 md:flex"
          >
            <Search className="h-4 w-4" />
            <span>Search titles, OTT sources…</span>
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              className="hidden items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20 md:flex"
            >
              <Shield className="h-4 w-4" /> Admin
            </Link>
          )}
          <Link
            to="/search"
            aria-label="Search"
            className="rounded-full border border-white/10 bg-white/5 p-2 text-muted-foreground transition hover:bg-white/10 hover:text-foreground md:hidden"
          >
            <Search className="h-4 w-4" />
          </Link>
          <button
            onClick={() => doLogout.mutate()}
            disabled={doLogout.isPending}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-muted-foreground transition hover:bg-white/10 hover:text-foreground disabled:opacity-50"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main id="main" className="flex-1 pb-28 md:pb-8">
        {children}
      </main>

      <SiteFooter />

      <nav className="glass fixed bottom-3 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] md:hidden">
        {mobileNav.map((n) => {
          const active = path === n.to || (n.to !== "/home" && path.startsWith(n.to));
          return (
            <Link
              key={n.to}
              to={n.to}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition ${
                active ? "gradient-primary text-white" : "text-muted-foreground"
              }`}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </Link>
          );
        })}
      </nav>

    </div>
  );
}
