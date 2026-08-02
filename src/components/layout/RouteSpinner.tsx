export function RouteSpinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-primary" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
