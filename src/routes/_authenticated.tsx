import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { MaintenanceGate } from "@/components/layout/MaintenanceGate";
import { fetchSession } from "@/services/backend";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData({
      queryKey: ["session"],
      queryFn: fetchSession,
      staleTime: 60_000,
    });
    if (!session.authenticated) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    return { session };
  },
  component: () => (
    <MaintenanceGate>
      <AppShell>
        <Outlet />
      </AppShell>
    </MaintenanceGate>
  ),
});
