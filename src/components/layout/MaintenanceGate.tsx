import { useQuery } from "@tanstack/react-query";
import { fetchMaintenanceSettings, fetchSiteSettings } from "@/lib/cloudSettings";
import { fetchSession } from "@/services/backend";
import { Wrench } from "lucide-react";
import type { ReactNode } from "react";

export function MaintenanceGate({ children }: { children: ReactNode }) {
  const maintenance = useQuery({
    queryKey: ["site-settings", "maintenance"],
    queryFn: fetchMaintenanceSettings,
    staleTime: 60_000,
  });
  const site = useQuery({
    queryKey: ["site-settings"],
    queryFn: fetchSiteSettings,
    staleTime: 5 * 60 * 1000,
  });
  const session = useQuery({ queryKey: ["session"], queryFn: fetchSession, staleTime: 60_000 });

  const enabled = !!maintenance.data?.enabled;
  const isAdmin = !!session.data?.isAdmin;

  if (!enabled || isAdmin) return <>{children}</>;

  const title = maintenance.data?.title || "We'll be right back";
  const message =
    maintenance.data?.message ||
    "The site is temporarily down for maintenance. Please check back shortly.";
  const eta = maintenance.data?.eta;
  const siteName = site.data?.site_name || "OttFree";

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass w-full max-w-lg rounded-3xl p-10 text-center">
        <div className="gradient-primary mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg shadow-primary/40">
          <Wrench className="h-6 w-6" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-bold">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
        {eta && (
          <p className="mt-4 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-muted-foreground inline-block">
            Estimated back: {eta}
          </p>
        )}
        <p className="mt-8 text-xs text-muted-foreground/70">— {siteName}</p>
      </div>
    </div>
  );
}
