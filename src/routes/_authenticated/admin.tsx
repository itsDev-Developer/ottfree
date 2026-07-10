import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { fetchSession } from "@/services/backend";
import { getVisits, getPlays, clearAnalytics, type VisitEvent, type PlayEvent } from "@/store/analytics";
import {
  fetchAllAds,
  fetchSiteSettings,
  fetchMaintenanceSettings,
  type AdRow,
  type SiteSettings,
  type MaintenanceSettings,
} from "@/lib/cloudSettings";
import { upsertAd, deleteAd, upsertSiteSetting } from "@/lib/adminSettings.functions";
import {
  Activity, Eye, Play, Users, Trash2, ChevronLeft, Megaphone, Plus,
  BarChart3, Palette, Wrench, LayoutDashboard, Save, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

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

type Tab = "overview" | "ads" | "site" | "maintenance";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, description: "Visits and playback statistics" },
  { id: "ads", label: "Ads", icon: Megaphone, description: "Manage ad slots & networks" },
  { id: "site", label: "Site", icon: Palette, description: "Branding, header & footer" },
  { id: "maintenance", label: "Maintenance", icon: Wrench, description: "Take the site offline for viewers" },
];

function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const current = TABS.find((t) => t.id === tab)!;

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
          <h1 className="font-display text-3xl font-bold md:text-4xl">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">{current.description}</p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-white/5 pb-3">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                active
                  ? "gradient-primary text-white shadow-lg shadow-primary/30"
                  : "border border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" && <OverviewSection />}
      {tab === "ads" && <AdsSection />}
      {tab === "site" && <SiteSection />}
      {tab === "maintenance" && <MaintenanceSection />}
    </div>
  );
}

/* -------------------- Overview -------------------- */

const DAY = 24 * 60 * 60 * 1000;

function OverviewSection() {
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
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => { clearAnalytics(); setTick((t) => t + 1); }}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
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
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-bold">Visits — last 7 days</h2>
          </div>
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

/* -------------------- Ads -------------------- */

const SLOTS: { value: string; label: string; description: string }[] = [
  { value: "preroll", label: "Video pre-roll (VAST)", description: "Shown before video playback starts" },
  { value: "home_top", label: "Home — top banner", description: "Under the featured carousel" },
  { value: "watch_banner", label: "Watch — under player", description: "Below the video player" },
  { value: "sidebar", label: "Sidebar / Related", description: "Beside related content" },
];

type AdType = "vast" | "image" | "script";

const NETWORKS: { value: string; label: string; type: AdType; hint: string }[] = [
  { value: "adsterra", label: "Adsterra", type: "script", hint: "Paste the script snippet from your Adsterra ad zone." },
  { value: "hilltopads", label: "Hilltopads", type: "script", hint: "Paste the ad tag JavaScript from your Hilltopads zone." },
  { value: "propellerads", label: "PropellerAds", type: "script", hint: "Paste the tag script from PropellerAds." },
  { value: "custom_script", label: "Custom script / HTML", type: "script", hint: "Paste any HTML+JS ad snippet." },
  { value: "image", label: "Image banner", type: "image", hint: "Upload/host your own creative and paste the image URL." },
  { value: "vast", label: "VAST tag", type: "vast", hint: "Paste the VAST XML endpoint URL." },
];

interface AdDraft {
  id?: string;
  slot: string;
  network: string;
  label: string;
  enabled: boolean;
  image_url: string;
  link_url: string;
  vast_tag_url: string;
  script_code: string;
  position: number;
}

const emptyDraft: AdDraft = {
  slot: "home_top",
  network: "adsterra",
  label: "",
  enabled: true,
  image_url: "",
  link_url: "",
  vast_tag_url: "",
  script_code: "",
  position: 0,
};

function typeForNetwork(network: string): AdType {
  return NETWORKS.find((n) => n.value === network)?.type ?? "script";
}

function AdsSection() {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertAd);
  const deleteFn = useServerFn(deleteAd);

  const ads = useQuery<AdRow[]>({ queryKey: ["ads", "all"], queryFn: fetchAllAds });
  const [draft, setDraft] = useState<AdDraft>(emptyDraft);

  const type = typeForNetwork(draft.network);
  const hint = NETWORKS.find((n) => n.value === draft.network)?.hint ?? "";
  const editing = !!draft.id;

  const save = useMutation({
    mutationFn: async (d: AdDraft) => {
      // If network is VAST, force slot to preroll for correctness
      const slot = d.network === "vast" ? "preroll" : d.slot;
      const t = typeForNetwork(d.network);
      return upsertFn({
        data: {
          id: d.id,
          slot,
          network: d.network,
          label: d.label || null,
          enabled: d.enabled,
          image_url: t === "image" ? d.image_url || null : null,
          link_url: t === "image" ? d.link_url || null : null,
          vast_tag_url: t === "vast" ? d.vast_tag_url || null : null,
          script_code: t === "script" ? d.script_code || null : null,
          position: d.position,
        },
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Ad updated" : "Ad added");
      setDraft(emptyDraft);
      qc.invalidateQueries({ queryKey: ["ads"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to save ad"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Ad removed");
      qc.invalidateQueries({ queryKey: ["ads"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to delete"),
  });

  function startEdit(a: AdRow) {
    setDraft({
      id: a.id,
      slot: a.slot,
      network: a.network ?? (a.script_code ? "custom_script" : a.vast_tag_url ? "vast" : "image"),
      label: a.label ?? "",
      enabled: a.enabled,
      image_url: a.image_url ?? "",
      link_url: a.link_url ?? "",
      vast_tag_url: a.vast_tag_url ?? "",
      script_code: a.script_code ?? "",
      position: a.position,
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <section className="glass rounded-3xl p-6 lg:col-span-3">
        <div className="flex items-center gap-3">
          <div className="gradient-primary flex h-9 w-9 items-center justify-center rounded-xl text-white">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold">
              {editing ? "Edit ad" : "New ad"}
            </h2>
            <p className="text-xs text-muted-foreground">
              Supports Adsterra, Hilltopads, PropellerAds, custom scripts, image banners and VAST pre-roll.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="Network">
            <select
              value={draft.network}
              onChange={(e) => setDraft({ ...draft, network: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary/60"
            >
              {NETWORKS.map((n) => (
                <option key={n.value} value={n.value} className="bg-background">{n.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Slot">
            <select
              value={draft.network === "vast" ? "preroll" : draft.slot}
              disabled={draft.network === "vast"}
              onChange={(e) => setDraft({ ...draft, slot: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary/60 disabled:opacity-70"
            >
              {SLOTS.map((s) => (
                <option key={s.value} value={s.value} className="bg-background">{s.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Label (admin only)">
            <input
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              placeholder="e.g. Adsterra 300x250 – Home"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary/60"
            />
          </Field>

          <Field label="Position">
            <input
              type="number"
              value={draft.position}
              onChange={(e) => setDraft({ ...draft, position: Number(e.target.value) || 0 })}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary/60"
            />
          </Field>

          {type === "script" && (
            <Field label="Script / HTML snippet" span={2} hint={hint}>
              <textarea
                value={draft.script_code}
                onChange={(e) => setDraft({ ...draft, script_code: e.target.value })}
                placeholder={`<script type="text/javascript">\n  atOptions = { ... };\n</script>\n<script src="//..."></script>`}
                rows={8}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-xs outline-none focus:border-primary/60"
              />
            </Field>
          )}

          {type === "vast" && (
            <Field label="VAST Tag URL" span={2} hint={hint}>
              <input
                value={draft.vast_tag_url}
                onChange={(e) => setDraft({ ...draft, vast_tag_url: e.target.value })}
                placeholder="https://example.com/vast.xml"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary/60"
              />
            </Field>
          )}

          {type === "image" && (
            <>
              <Field label="Banner image URL" hint={hint}>
                <input
                  value={draft.image_url}
                  onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
                  placeholder="https://example.com/banner.jpg"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary/60"
                />
              </Field>
              <Field label="Click-through URL">
                <input
                  value={draft.link_url}
                  onChange={(e) => setDraft({ ...draft, link_url: e.target.value })}
                  placeholder="https://advertiser.com"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary/60"
                />
              </Field>
            </>
          )}

          <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
            <span>Enabled — show this ad to viewers</span>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          {editing && (
            <button
              onClick={() => setDraft(emptyDraft)}
              className="rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold hover:bg-white/10"
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => save.mutate(draft)}
            disabled={save.isPending}
            className="gradient-primary flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {editing ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {save.isPending ? "Saving…" : editing ? "Save changes" : "Add ad"}
          </button>
        </div>
      </section>

      <section className="glass rounded-3xl p-6 lg:col-span-2">
        <h3 className="font-display text-lg font-bold">Existing ads</h3>
        <p className="text-xs text-muted-foreground">Click any ad to edit it.</p>
        {ads.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : (ads.data ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No ads configured yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {(ads.data ?? []).map((a) => {
              const slotLabel = SLOTS.find((s) => s.value === a.slot)?.label ?? a.slot;
              const networkLabel = NETWORKS.find((n) => n.value === a.network)?.label ?? a.network ?? "Custom";
              return (
                <li
                  key={a.id}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-sm transition ${
                    draft.id === a.id
                      ? "border-primary/60 bg-primary/10"
                      : "border-white/5 bg-white/5 hover:border-white/20"
                  }`}
                >
                  <button
                    onClick={() => startEdit(a)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                        {networkLabel}
                      </span>
                      {!a.enabled && (
                        <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                          off
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-medium">{a.label || slotLabel}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {slotLabel} · pos {a.position}
                    </p>
                  </button>
                  <button
                    onClick={() => { if (confirm("Delete this ad?")) remove.mutate(a.id); }}
                    className="rounded-full border border-white/10 bg-white/5 p-2 text-muted-foreground hover:text-destructive"
                    aria-label="Delete ad"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-muted-foreground">
          <p className="mb-2 font-semibold uppercase tracking-wider text-foreground">Where do these appear?</p>
          <ul className="space-y-1">
            {SLOTS.map((s) => (
              <li key={s.value} className="flex gap-2">
                <span className="text-primary">•</span>
                <span><b className="text-foreground">{s.label}:</b> {s.description}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

/* -------------------- Site -------------------- */

function SiteSection() {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertSiteSetting);
  const site = useQuery({ queryKey: ["site-settings"], queryFn: fetchSiteSettings });
  const [draft, setDraft] = useState<SiteSettings>({});
  const [socialsRaw, setSocialsRaw] = useState("");

  useEffect(() => {
    if (site.data) {
      setDraft(site.data);
      setSocialsRaw(
        (site.data.social_links ?? [])
          .map((s) => `${s.label} | ${s.url}`)
          .join("\n"),
      );
    }
  }, [site.data]);

  const save = useMutation({
    mutationFn: async () => {
      const social_links = socialsRaw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [label, url] = line.split("|").map((s) => s.trim());
          return { label: label || url, url: url || "" };
        })
        .filter((s) => s.url);
      return upsertFn({
        data: {
          key: "site",
          value: { ...draft, social_links } as Record<string, unknown>,
        },
      });
    },
    onSuccess: () => {
      toast.success("Site settings saved");
      qc.invalidateQueries({ queryKey: ["site-settings"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to save"),
  });

  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) =>
    setDraft({ ...draft, [k]: v });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="glass rounded-3xl p-6 lg:col-span-2">
        <div className="flex items-center gap-3">
          <div className="gradient-primary flex h-9 w-9 items-center justify-center rounded-xl text-white">
            <Palette className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold">Branding & customization</h2>
            <p className="text-xs text-muted-foreground">
              These settings apply to every visitor across the site.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="Site name">
            <input
              value={draft.site_name ?? ""}
              onChange={(e) => set("site_name", e.target.value)}
              placeholder="OttFree"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary/60"
            />
          </Field>
          <Field label="Tagline">
            <input
              value={draft.tagline ?? ""}
              onChange={(e) => set("tagline", e.target.value)}
              placeholder="Your favourite shows, everywhere."
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary/60"
            />
          </Field>
          <Field label="Logo URL">
            <input
              value={draft.logo_url ?? ""}
              onChange={(e) => set("logo_url", e.target.value)}
              placeholder="https://example.com/logo.png"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary/60"
            />
          </Field>
          <Field label="Hero fallback image URL">
            <input
              value={draft.hero_image_url ?? ""}
              onChange={(e) => set("hero_image_url", e.target.value)}
              placeholder="https://example.com/hero.jpg"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary/60"
            />
          </Field>

          <Field label="Header HTML (optional banner)" span={2} hint="Rendered above the site header. Leave blank to hide.">
            <textarea
              value={draft.header_html ?? ""}
              onChange={(e) => set("header_html", e.target.value)}
              rows={3}
              placeholder="<div>🎉 Welcome to our new UI!</div>"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-xs outline-none focus:border-primary/60"
            />
          </Field>

          <Field label="Footer tagline" span={2}>
            <input
              value={draft.footer_text ?? ""}
              onChange={(e) => set("footer_text", e.target.value)}
              placeholder="Streaming for everyone."
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary/60"
            />
          </Field>

          <Field label="Footer HTML" span={2} hint="Rendered in the footer, above the copyright.">
            <textarea
              value={draft.footer_html ?? ""}
              onChange={(e) => set("footer_html", e.target.value)}
              rows={4}
              placeholder='<p>Powered by Lovable · <a href="/terms">Terms</a></p>'
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-xs outline-none focus:border-primary/60"
            />
          </Field>

          <Field label="Social links" span={2} hint="One per line, in the form `Label | https://url`">
            <textarea
              value={socialsRaw}
              onChange={(e) => setSocialsRaw(e.target.value)}
              rows={4}
              placeholder={"Twitter | https://twitter.com/you\nTelegram | https://t.me/you"}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-xs outline-none focus:border-primary/60"
            />
          </Field>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="gradient-primary flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {save.isPending ? "Saving…" : "Save site settings"}
          </button>
        </div>
      </section>

      <section className="glass rounded-3xl p-6">
        <h3 className="font-display text-lg font-bold">Live preview</h3>
        <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-black/40 p-4">
          <div className="flex items-center gap-2">
            {draft.logo_url ? (
              <img src={draft.logo_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <div className="gradient-primary h-8 w-8 rounded-lg" />
            )}
            <span className="font-display text-lg font-bold">
              {draft.site_name || "OttFree"}
            </span>
          </div>
          {draft.tagline && (
            <p className="text-sm text-muted-foreground">{draft.tagline}</p>
          )}
          {draft.hero_image_url && (
            <img
              src={draft.hero_image_url}
              alt=""
              className="aspect-video w-full rounded-xl border border-white/10 object-cover"
            />
          )}
          <div className="border-t border-white/10 pt-3 text-xs text-muted-foreground">
            {draft.footer_text || "Footer tagline"}
          </div>
        </div>
        <a
          href="/home"
          className="mt-4 inline-flex items-center gap-2 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Open homepage
        </a>
      </section>
    </div>
  );
}

/* -------------------- Maintenance -------------------- */

function MaintenanceSection() {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertSiteSetting);
  const current = useQuery({ queryKey: ["site-settings", "maintenance"], queryFn: fetchMaintenanceSettings });
  const [draft, setDraft] = useState<MaintenanceSettings>({});

  useEffect(() => { if (current.data) setDraft(current.data); }, [current.data]);

  const save = useMutation({
    mutationFn: async (value: MaintenanceSettings) =>
      upsertFn({ data: { key: "maintenance", value: value as Record<string, unknown> } }),
    onSuccess: (_d, vars) => {
      toast.success(vars.enabled ? "Maintenance mode is ON" : "Maintenance mode is OFF");
      qc.invalidateQueries({ queryKey: ["site-settings", "maintenance"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to save"),
  });

  const enabled = !!draft.enabled;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="glass rounded-3xl p-6 lg:col-span-2">
        <div className="flex items-center gap-3">
          <div className="gradient-primary flex h-9 w-9 items-center justify-center rounded-xl text-white">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold">Maintenance mode</h2>
            <p className="text-xs text-muted-foreground">
              When ON, non-admin viewers see a maintenance page instead of the site. Admins still have full access.
            </p>
          </div>
        </div>

        <div
          className={`mt-6 flex items-center justify-between rounded-2xl border p-4 ${
            enabled ? "border-amber-500/60 bg-amber-500/10" : "border-white/10 bg-white/5"
          }`}
        >
          <div>
            <p className="font-semibold">
              {enabled ? "Site is offline for viewers" : "Site is live"}
            </p>
            <p className="text-xs text-muted-foreground">
              {enabled
                ? "Only administrators can browse the site right now."
                : "Everyone can access the site normally."}
            </p>
          </div>
          <button
            onClick={() => {
              const next = { ...draft, enabled: !enabled };
              setDraft(next);
              save.mutate(next);
            }}
            className={`relative h-8 w-14 rounded-full transition ${
              enabled ? "bg-amber-500" : "bg-white/20"
            }`}
            aria-pressed={enabled}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${
                enabled ? "left-7" : "left-1"
              }`}
            />
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          <Field label="Title">
            <input
              value={draft.title ?? ""}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="We'll be right back"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary/60"
            />
          </Field>
          <Field label="Message">
            <textarea
              value={draft.message ?? ""}
              onChange={(e) => setDraft({ ...draft, message: e.target.value })}
              rows={3}
              placeholder="The site is temporarily down for maintenance."
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary/60"
            />
          </Field>
          <Field label="Estimated back at (optional)">
            <input
              value={draft.eta ?? ""}
              onChange={(e) => setDraft({ ...draft, eta: e.target.value })}
              placeholder="in ~30 minutes"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary/60"
            />
          </Field>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => save.mutate(draft)}
            disabled={save.isPending}
            className="gradient-primary flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {save.isPending ? "Saving…" : "Save message"}
          </button>
        </div>
      </section>

      <section className="glass rounded-3xl p-6">
        <h3 className="font-display text-lg font-bold">Preview</h3>
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-6 text-center">
          <div className="gradient-primary mx-auto flex h-12 w-12 items-center justify-center rounded-2xl text-white">
            <Wrench className="h-5 w-5" />
          </div>
          <p className="mt-4 font-display text-lg font-bold">
            {draft.title || "We'll be right back"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {draft.message || "The site is temporarily down for maintenance."}
          </p>
          {draft.eta && (
            <p className="mt-3 inline-block rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground">
              Back: {draft.eta}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

/* -------------------- Shared -------------------- */

function Field({
  label, hint, span = 1, children,
}: { label: string; hint?: string; span?: 1 | 2; children: React.ReactNode }) {
  return (
    <label className={`block ${span === 2 ? "md:col-span-2" : ""}`}>
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted-foreground/80">{hint}</span>}
    </label>
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
