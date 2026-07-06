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

export async function fetchSession(): Promise<SessionInfo> {
  try {
    const data = await getJson<HomeResp>("/");
    return { authenticated: true, isAdmin: !!data.is_admin };
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
}

export async function logout(): Promise<void> {
  await api.post("/logout", null, { validateStatus: () => true });
}

export async function fetchHome(): Promise<HomeData> {
  const data = await getJson<HomeResp>("/");
  const channels = (data.channels ?? []).map(channelToChannel);
  const folders = (data.playlists ?? []).map(playlistToFolder);

  // Warm first channel for a featured hero + "recently added" strip.
  let featured: MediaItem[] = [];
  let recent: MediaItem[] = [];
  if (channels[0]) {
    try {
      const first = await fetchChannel(channels[0].id, 1);
      recent = first.items.slice(0, 20);
      featured = first.items.slice(0, 5).map((m) => ({ ...m, channelName: channels[0].name }));
    } catch {
      /* ignore */
    }
  }

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

export async function fetchWatch(chatId: string, messageId: string, hash: string): Promise<WatchData> {
  // Backend's HTML /watch route is broken (`render_page not defined`).
  // Rebuild the watch payload from the channel listing so playback still works.
  const streamUrl = `/api/proxy/${chatId}/stream?id=${messageId}&hash=${hash}`;
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
    streamUrl,
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
