import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { createAppQueryClient } from "./lib/queryClient";
import { RouteSpinner } from "./components/layout/RouteSpinner";

export const getRouter = () => {
  const queryClient = createAppQueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Warm route + data on hover/touch so navigation feels instant.
    defaultPreload: "intent",
    defaultPreloadDelay: 40,
    defaultPreloadStaleTime: 30_000,
    // Avoid flashing a spinner for fast transitions.
    defaultPendingMs: 250,
    defaultPendingMinMs: 300,
    defaultPendingComponent: RouteSpinner,
  });

  return router;
};
