import { api } from "./api";
import { adaptChannel, adaptFolder, adaptHome, adaptWatch, isLoginPage } from "./adapters/html";
import type { HomeData, Page, MediaItem, Folder, WatchData, SessionInfo } from "@/types/dto";

async function getText(path: string): Promise<string> {
  const res = await api.get(path, { responseType: "text", transformResponse: (v) => v });
  return typeof res.data === "string" ? res.data : JSON.stringify(res.data);
}

export async function fetchSession(): Promise<SessionInfo> {
  try {
    const html = await getText("/");
    if (isLoginPage(html)) return { authenticated: false, isAdmin: false };
    const home = adaptHome(html);
    return { authenticated: true, isAdmin: home.isAdmin };
  } catch {
    return { authenticated: false, isAdmin: false };
  }
}

export async function login(username: string, password: string): Promise<void> {
  const form = new URLSearchParams({ username, password });
  await api.post("/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    validateStatus: (s) => s < 400 || s === 302,
  });
}

export async function logout(): Promise<void> {
  await api.post("/logout", null, { validateStatus: () => true });
}

export async function fetchHome(): Promise<HomeData> {
  const html = await getText("/");
  if (isLoginPage(html)) throw new Error("unauthenticated");
  return adaptHome(html);
}

export async function fetchChannel(channelId: string, page = 1): Promise<Page<MediaItem>> {
  const html = await getText(`/channel/${channelId}?page=${page}`);
  return adaptChannel(html, page);
}

export async function searchChannel(channelId: string, q: string, page = 1): Promise<Page<MediaItem>> {
  const html = await getText(`/search/${channelId}?q=${encodeURIComponent(q)}&page=${page}`);
  return adaptChannel(html, page);
}

export async function fetchFolder(folderId: string, page = 1): Promise<Page<MediaItem | Folder>> {
  const html = await getText(`/playlist?db=${encodeURIComponent(folderId)}&page=${page}`);
  return adaptFolder(html, page);
}

export async function searchFolder(folderId: string, q: string, page = 1): Promise<Page<MediaItem | Folder>> {
  const html = await getText(`/search/db/${encodeURIComponent(folderId)}?q=${encodeURIComponent(q)}&page=${page}`);
  return adaptFolder(html, page);
}

export async function fetchWatch(chatId: string, messageId: string, hash: string): Promise<WatchData> {
  const html = await getText(`/watch/${chatId}?id=${messageId}&hash=${hash}`);
  return adaptWatch(html, chatId, messageId, hash);
}

export function thumbUrl(chatId: string, messageId?: string): string {
  const q = messageId ? `?id=${messageId}` : "";
  return `/api/proxy/api/thumb/${chatId}${q}`;
}
