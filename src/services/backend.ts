import { api } from "./api";
import type { HomeData, Page, MediaItem, Folder, WatchData, SessionInfo, Channel } from "@/types/dto";

// Backend now returns JSON on every route. We keep withCredentials cookie flow
// via /api/proxy so AIOHTTP_SESSION is stored on this origin and sent back.

function proxyPath(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  if (url.startsWith("/api/proxy/")) return url;
  return `/api/proxy${url.startsWith("/") ? "" : "/"}${url}`;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await api.get(path, {
    headers: { Accept: "application/json" },
    validateStatus: (s) => s >= 200 && s < 300,
  });
  return res.data as T;
}

interface RawChannel {
  id: number;
  chat_id: number;
  public_id: string;
  title: string;
  thumbnail?: string;
  url?: string;
}

interface RawFile {
  id: number;
  msg_id: number;
  chat_id: string;
  public_chat_id: string;
  title: string;
  size?: string;
  thumbnail?: string;
  poster_url?: string;
  hash: string;
  stream_url?: string;
  watch_url?: string;
  mime_type?: string;
  parent_folder?: string | null;
}

interface RawPlaylist {
  id: number | string;
  title?: string;
  name?: string;
  thumbnail?: string;
  url?: string;
}

interface HomeResp {
  channels: RawChannel[];
  playlists: RawPlaylist[];
  is_admin: boolean;
}

interface ChannelResp {
  chat_id: string;
  public_chat_id: string;
  title: string;
  files: RawFile[];
  playlists?: RawPlaylist[];
  has_next?: boolean;
  next_page?: number | null;
  is_admin?: boolean;
}

interface PlaylistResp {
  parent_id: string | null;
  message?: string | null;
  playlists: RawPlaylist[];
  files: RawFile[];
  has_next?: boolean;
  is_admin?: boolean;
}

function fileToItem(f: RawFile): MediaItem {
  return {
    id: String(f.id ?? f.msg_id),
    chatId: String(f.public_chat_id ?? f.chat_id).replace(/^-100/, ""),
    hash: f.hash,
    title: f.title,
    kind: "video",
    thumbnail: f.thumbnail ?? f.poster_url,
    size: f.size,
  };
}

function channelToChannel(c: RawChannel): Channel {
  return {
    id: c.public_id ?? String(c.chat_id).replace(/^-100/, ""),
    name: c.title,
    thumbnail: proxyPath(c.thumbnail),
  };
}

function playlistToFolder(p: RawPlaylist): Folder {
  return {
    id: String(p.id),
    name: p.title ?? p.name ?? "Folder",
    thumbnail: proxyPath(p.thumbnail),
  };
}

const ADMIN_FLAG_KEY = "surftg:is-admin";

export async function fetchSession(): Promise<SessionInfo> {
  try {
    const data = await getJson<HomeResp>("/");
    const localAdmin =
      typeof window !== "undefined" && localStorage.getItem(ADMIN_FLAG_KEY) === "1";
    return { authenticated: true, isAdmin: !!data.is_admin || localAdmin };
  } catch {
    return { authenticated: false, isAdmin: false };
  }
}

export async function login(username: string, password: string): Promise<void> {
  const form = new URLSearchParams({ username, password });
  await api.post("/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    validateStatus: (s) => s >= 200 && s < 300,
  });
  if (typeof window !== "undefined") {
    if (username.toLowerCase() === "admin") localStorage.setItem(ADMIN_FLAG_KEY, "1");
    else localStorage.removeItem(ADMIN_FLAG_KEY);
  }
}

export async function logout(): Promise<void> {
  await api.post("/logout", null, { validateStatus: () => true });
  if (typeof window !== "undefined") localStorage.removeItem(ADMIN_FLAG_KEY);
}

export async function fetchHome(): Promise<HomeData> {
  const data = await getJson<HomeResp>("/");
  const channels = (data.channels ?? []).map(channelToChannel);
  const folders = (data.playlists ?? []).map(playlistToFolder);

  // Fan out across the top channels so Featured + Recently Added feel alive.
  const top = channels.slice(0, 6);
  const perChannel = await Promise.all(
    top.map((c) =>
      fetchChannel(c.id, 1)
        .then((p) => p.items.map((m) => ({ ...m, channelName: c.name })))
        .catch(() => [] as MediaItem[]),
    ),
  );

  // Recently Added: interleave one item from each channel round-robin, so the
  // grid isn't dominated by a single source.
  const recent: MediaItem[] = [];
  const seen = new Set<string>();
  const maxLen = Math.max(0, ...perChannel.map((a) => a.length));
  for (let i = 0; i < maxLen; i++) {
    for (const arr of perChannel) {
      const m = arr[i];
      if (!m) continue;
      const key = `${m.chatId}:${m.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      recent.push(m);
    }
  }

  // Featured: one item from each of the top channels (up to 6), poster-heavy.
  const featured: MediaItem[] = perChannel
    .map((arr) => arr.find((m) => !!m.thumbnail) ?? arr[0])
    .filter((m): m is MediaItem => !!m)
    .slice(0, 6);

  return { featured, channels, folders, recent, isAdmin: !!data.is_admin };
}

export async function fetchChannel(channelId: string, page = 1): Promise<Page<MediaItem>> {
  const data = await getJson<ChannelResp>(`/channel/${channelId}?page=${page}`);
  const items = (data.files ?? []).map(fileToItem).map((m) => ({ ...m, channelName: data.title }));
  return { items, page, hasMore: !!data.has_next };
}

export async function searchChannel(channelId: string, q: string, page = 1): Promise<Page<MediaItem>> {
  const data = await getJson<ChannelResp>(`/search/${channelId}?q=${encodeURIComponent(q)}&page=${page}`);
  const items = (data.files ?? []).map(fileToItem).map((m) => ({ ...m, channelName: data.title }));
  return { items, page, hasMore: !!data.has_next };
}

export async function fetchFolder(folderId: string, page = 1): Promise<Page<MediaItem | Folder>> {
  const data = await getJson<PlaylistResp>(`/playlist?db=${encodeURIComponent(folderId)}&page=${page}`);
  const folders: Folder[] = (data.playlists ?? []).map(playlistToFolder);
  const files: MediaItem[] = (data.files ?? []).map(fileToItem);
  return { items: [...folders, ...files], page, hasMore: !!data.has_next };
}

export async function searchFolder(folderId: string, q: string, page = 1): Promise<Page<MediaItem | Folder>> {
  const data = await getJson<PlaylistResp>(
    `/search/db/${encodeURIComponent(folderId)}?q=${encodeURIComponent(q)}&page=${page}`,
  );
  const folders: Folder[] = (data.playlists ?? []).map(playlistToFolder);
  const files: MediaItem[] = (data.files ?? []).map(fileToItem);
  return { items: [...folders, ...files], page, hasMore: !!data.has_next };
}

function buildStreamUrl(chatId: string, messageId: string, hash: string, filename: string): string {
  // Backend spec: GET /{chat_id}/{encoded_name}?id={message_id}&hash={hash}
  // Route through the proxy so cookies/session travel with the request.
  const safe = filename && filename.trim() ? filename : `file-${messageId}.mp4`;
  const encoded = encodeURIComponent(safe).replace(/%2F/gi, "_");
  return `/api/proxy/${chatId}/${encoded}?id=${encodeURIComponent(messageId)}&hash=${encodeURIComponent(hash)}`;
}

export async function fetchWatch(chatId: string, messageId: string, hash: string): Promise<WatchData> {
  // The backend's HTML /watch page 500s, so we rebuild the payload from the
  // channel listing and stream directly from /{chat_id}/{encoded_name}.
  let title = `Stream ${messageId}`;
  let thumbnail: string | undefined;
  let size: string | undefined;
  let channelName: string | undefined;
  let related: MediaItem[] = [];
  try {
    const ch = await fetchChannel(chatId, 1);
    const hit = ch.items.find((m) => String(m.id) === String(messageId));
    if (hit) {
      title = hit.title;
      thumbnail = hit.thumbnail;
      size = hit.size;
      channelName = hit.channelName;
    }
    related = ch.items.filter((m) => String(m.id) !== String(messageId)).slice(0, 12);
  } catch {
    /* ignore */
  }
  return {
    chatId,
    messageId,
    hash,
    title,
    filename: title,
    streamUrl: buildStreamUrl(chatId, messageId, hash, title),
    thumbnail,
    size,
    channelName,
    related,
  };
}

export function thumbUrl(chatId: string, messageId?: string): string {
  const q = messageId ? `?id=${messageId}` : "";
  return `/api/proxy/api/thumb/${chatId}${q}`;
}
