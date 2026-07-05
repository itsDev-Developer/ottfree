const KEY = "surftg:continue-watching";
const RECENT_KEY = "surftg:recent-searches";

export interface WatchProgress {
  chatId: string;
  messageId: string;
  hash: string;
  title: string;
  thumbnail?: string;
  position: number;
  duration: number;
  updatedAt: number;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function getContinueWatching(): WatchProgress[] {
  return read<WatchProgress[]>(KEY, []).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveProgress(p: WatchProgress) {
  const list = read<WatchProgress[]>(KEY, []).filter(
    (x) => !(x.chatId === p.chatId && x.messageId === p.messageId),
  );
  list.unshift(p);
  write(KEY, list.slice(0, 30));
}

export function findProgress(chatId: string, messageId: string): WatchProgress | undefined {
  return read<WatchProgress[]>(KEY, []).find(
    (x) => x.chatId === chatId && x.messageId === messageId,
  );
}

export function getRecentSearches(): string[] {
  return read<string[]>(RECENT_KEY, []);
}

export function pushRecentSearch(q: string) {
  if (!q.trim()) return;
  const list = [q, ...read<string[]>(RECENT_KEY, []).filter((x) => x !== q)];
  write(RECENT_KEY, list.slice(0, 8));
}
