// Lightweight client-side analytics stored in localStorage.
// Used by the admin panel to render visit / play statistics.

const VISITS_KEY = "surftg:analytics:visits";
const PLAYS_KEY = "surftg:analytics:plays";
const SESSION_KEY = "surftg:analytics:session";

export interface VisitEvent {
  path: string;
  ts: number;
  session: string;
}

export interface PlayEvent {
  chatId: string;
  messageId: string;
  title: string;
  ts: number;
}

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]") as T[];
  } catch {
    return [];
  }
}

function write<T>(key: string, value: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value.slice(-500)));
  } catch {
    /* ignore quota */
  }
}

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function trackVisit(path: string) {
  if (typeof window === "undefined") return;
  const visits = read<VisitEvent>(VISITS_KEY);
  const last = visits[visits.length - 1];
  if (last && last.path === path && Date.now() - last.ts < 1500) return;
  visits.push({ path, ts: Date.now(), session: getSessionId() });
  write(VISITS_KEY, visits);
}

export function trackPlay(e: Omit<PlayEvent, "ts">) {
  const plays = read<PlayEvent>(PLAYS_KEY);
  plays.push({ ...e, ts: Date.now() });
  write(PLAYS_KEY, plays);
}

export function getVisits(): VisitEvent[] {
  return read<VisitEvent>(VISITS_KEY);
}

export function getPlays(): PlayEvent[] {
  return read<PlayEvent>(PLAYS_KEY);
}

export function clearAnalytics() {
  localStorage.removeItem(VISITS_KEY);
  localStorage.removeItem(PLAYS_KEY);
}

/* -------------------- Ad analytics -------------------- */

const AD_KEY = "surftg:analytics:ads";
const CPM_KEY = "surftg:analytics:cpm";

export interface AdEvent {
  kind: "impression" | "click";
  slot: string;
  network: string;
  adId: string;
  label?: string;
  ts: number;
}

export function trackAdEvent(e: Omit<AdEvent, "ts">) {
  if (typeof window === "undefined") return;
  const events = read<AdEvent>(AD_KEY);
  events.push({ ...e, ts: Date.now() });
  write(AD_KEY, events);
}

export function getAdEvents(): AdEvent[] {
  return read<AdEvent>(AD_KEY);
}

export function clearAdEvents() {
  localStorage.removeItem(AD_KEY);
}

/** Estimated CPM (revenue per 1000 impressions) used for revenue projections. */
export function getCpm(): number {
  if (typeof window === "undefined") return 1;
  const raw = Number(localStorage.getItem(CPM_KEY));
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

export function setCpm(value: number) {
  localStorage.setItem(CPM_KEY, String(value));
}
