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
