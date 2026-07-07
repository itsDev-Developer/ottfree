import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { fetchSession } from "@/services/backend";
import { getVisits, getPlays, clearAnalytics, type VisitEvent, type PlayEvent } from "@/store/analytics";
import { Activity, Eye, Play, Users, Trash2, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData({
      queryKey: ["session"],
      queryFn: fetchSession,
      staleTime: 60_000,
    });
    if (!session.isAdmin) {
      throw redirect({ to: "/home", search: { redirect: location.href } as never });
    }
  },
  component: AdminPage,
});

const DAY = 24 * 60 * 60 * 1000;

function AdminPage() {
  const [visits, setVisits] = useState<VisitEvent[]>([]);
  const [plays, setPlays] = useState<PlayEvent[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setVisits(getVisits());
    setPlays(getPlays());
  }, [tick]);

  const stats = useMemo(() => {
    const now = Date.now();
    const last24Visits = visits.filter((v) => now - v.ts < DAY).length;
    const last7Visits = visits.filter((v) => now - v.ts < 7 * DAY).length;
    const sessions = new Set(visits.map((v) => v.session)).size;
    const paths = new Map<string, number>();
    for (const v of visits) paths.set(v.path, (paths.get(v.path) ?? 0) + 1);
    const topPaths = [...paths.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    const titleCounts = new Map<string, { title: string; count: number }>();
    for (const p of plays) {
      const key = `${p.chatId}:${p.messageId}`;
      const prev = titleCounts.get(key);
      titleCounts.set(key, { title: p.title, count: (prev?.count ?? 0) + 1 });
    }
    const topPlays = [...titleCounts.values()].sort((a, b) => b.count - a.count).slice(0, 8);

    // Visits per day for the last 7 days
    const days: { label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const start = now - (i + 1) * DAY;
      const end = now - i * DAY;
      const count = visits.filter((v) => v.ts >= start && v.ts < end).length;
      const label = new Date(end - DAY / 2).toLocaleDateString(undefined, { weekday: "short" });
      days.push({ label, count });
    }
    const maxDay = Math.max(1, ...days.map((d) => d.count));

    return { last24Visits, last7Visits, sessions, topPaths, topPlays, days, maxDay };
  }, [visits, plays]);

  return (
    <div className="px-4 py-6 md:px-8">
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <Link
          to="/home"
          className="rounded-full border border-white/10 bg-white/5 p-2 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-display text-3xl font-bold md:text-4xl">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visitor activity and playback statistics</p>
        </div>
        <button
          onClick={() => { clearAnalytics(); setTick((t) => t + 1); }}
          className="ml-auto flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
        >
          <Trash2 className="h-4 w-4" /> Reset data
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Eye className="h-5 w-5" />} label="Visits (24h)" value={stats.last24Visits} />
        <StatCard icon={<Activity className="h-5 w-5" />} label="Visits (7d)" value={stats.last7Visits} />
        <StatCard icon={<Users className="h-5 w-5" />} label="Sessions" value={stats.sessions} />
        <StatCard icon={<Play className="h-5 w-5" />} label="Plays" value={plays.length} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="glass rounded-3xl p-6">
          <h2 className="font-display text-lg font-bold">Visits — last 7 days</h2>
          <div className="mt-6 flex h-48 items-end justify-between gap-3">
            {stats.days.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-full w-full items-end">
                  <div
                    className="gradient-primary w-full rounded-t-md transition-all"
                    style={{ height: `${(d.count / stats.maxDay) * 100}%`, minHeight: d.count ? 4 : 0 }}
                    title={`${d.count} visits`}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{d.label}</span>
                <span className="text-xs font-medium">{d.count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="glass rounded-3xl p-6">
          <h2 className="font-display text-lg font-bold">Top pages</h2>
          <ul className="mt-4 space-y-2">
            {stats.topPaths.length === 0 && (
              <li className="text-sm text-muted-foreground">No visits recorded yet.</li>
            )}
            {stats.topPaths.map(([path, count]) => (
              <li key={path} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm">
                <span className="truncate font-mono text-xs text-muted-foreground">{path}</span>
                <span className="font-semibold">{count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="glass rounded-3xl p-6 lg:col-span-2">
          <h2 className="font-display text-lg font-bold">Most played</h2>
          <ul className="mt-4 space-y-2">
            {stats.topPlays.length === 0 && (
              <li className="text-sm text-muted-foreground">No playback recorded yet.</li>
            )}
            {stats.topPlays.map((p, i) => (
              <li key={i} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm">
                <span className="truncate">{p.title}</span>
                <span className="font-semibold">{p.count} plays</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex items-center gap-3 text-muted-foreground">
        <div className="gradient-primary flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-lg shadow-primary/30">
          {icon}
        </div>
        <span className="text-sm">{label}</span>
      </div>
      <p className="mt-3 font-display text-3xl font-bold">{value.toLocaleString()}</p>
    </div>
  );
}
