// HTML → DTO adapters. Backend currently returns HTML pages.
// These parsers are intentionally forgiving: they detect common patterns
// and fall back to placeholder data so the UI keeps rendering.

import type { Channel, Folder, HomeData, MediaItem, Page, WatchData } from "@/types/dto";

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

function abs(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  if (url.startsWith("/api/thumb") || url.startsWith("/api/")) return `/api/proxy${url.replace(/^\/api/, "")}`;
  if (url.startsWith("/")) return `/api/proxy${url}`;
  return url;
}

function collectMedia(doc: Document): MediaItem[] {
  const items: MediaItem[] = [];
  // Try common shapes: <a class="card"> / <div data-id>
  doc.querySelectorAll("[data-id], a.card, .file, .video-item").forEach((el, i) => {
    const a = el.tagName === "A" ? (el as HTMLAnchorElement) : el.querySelector("a");
    const href = a?.getAttribute("href") ?? "";
    const img = el.querySelector("img");
    const title =
      el.getAttribute("data-title") ||
      el.querySelector(".title, .name, h3, h4")?.textContent?.trim() ||
      a?.textContent?.trim() ||
      `Item ${i + 1}`;
    const idAttr = el.getAttribute("data-id") || "";
    const chatMatch = href.match(/\/(?:watch|channel)\/(-?\d+)/);
    const msgMatch = href.match(/[?&]id=(\d+)/);
    const hashMatch = href.match(/[?&]hash=([^&]+)/);
    items.push({
      id: idAttr || msgMatch?.[1] || `${i}`,
      chatId: chatMatch?.[1],
      hash: hashMatch?.[1],
      title,
      kind: "video",
      thumbnail: abs(img?.getAttribute("src") || img?.getAttribute("data-src")),
    });
  });
  return items;
}

export function adaptHome(html: string): HomeData {
  const doc = parse(html);
  const isAdmin = !!doc.querySelector("[data-admin], .admin-controls, #admin");
  const channels: Channel[] = [];
  doc.querySelectorAll("[data-channel], .channel-card, a[href^='/channel/']").forEach((el, i) => {
    const href = el.getAttribute("href") || el.querySelector("a")?.getAttribute("href") || "";
    const id = el.getAttribute("data-channel") || href.match(/\/channel\/(-?\d+)/)?.[1] || `${i}`;
    const img = el.querySelector("img");
    const name =
      el.getAttribute("data-name") ||
      el.querySelector(".name, .title, h3")?.textContent?.trim() ||
      el.textContent?.trim() ||
      `Channel ${i + 1}`;
    channels.push({ id, name, thumbnail: abs(img?.getAttribute("src")) });
  });
  const folders: Folder[] = [];
  doc.querySelectorAll("[data-folder], .folder-card, a[href^='/playlist']").forEach((el, i) => {
    const href = el.getAttribute("href") || el.querySelector("a")?.getAttribute("href") || "";
    const id = el.getAttribute("data-folder") || href.match(/[?&]db=([^&]+)/)?.[1] || `${i}`;
    const img = el.querySelector("img");
    const name =
      el.getAttribute("data-name") ||
      el.querySelector(".name, .title, h3")?.textContent?.trim() ||
      `Folder ${i + 1}`;
    folders.push({ id, name, thumbnail: abs(img?.getAttribute("src")) });
  });
  const recent = collectMedia(doc).slice(0, 20);
  const featured = recent.slice(0, 5);
  return { featured, channels, folders, recent, isAdmin };
}

export function adaptChannel(html: string, page: number): Page<MediaItem> {
  const doc = parse(html);
  const items = collectMedia(doc);
  const hasMore =
    !!doc.querySelector("a[rel='next'], .pagination .next:not(.disabled)") || items.length >= 20;
  return { items, page, hasMore };
}

export function adaptFolder(html: string, page: number): Page<MediaItem | Folder> {
  const doc = parse(html);
  const folders: Folder[] = [];
  doc.querySelectorAll("[data-folder], .folder-card").forEach((el, i) => {
    const id = el.getAttribute("data-folder") || `${i}`;
    const img = el.querySelector("img");
    const name = el.querySelector(".name, h3")?.textContent?.trim() || `Folder ${i + 1}`;
    folders.push({ id, name, thumbnail: abs(img?.getAttribute("src")) });
  });
  const files = collectMedia(doc);
  const hasMore = !!doc.querySelector("a[rel='next'], .pagination .next:not(.disabled)");
  return { items: [...folders, ...files], page, hasMore };
}

export function adaptWatch(html: string, chatId: string, messageId: string, hash: string): WatchData {
  const doc = parse(html);
  const title =
    doc.querySelector("h1, .title")?.textContent?.trim() || `Video ${messageId}`;
  const video = doc.querySelector("video source, video");
  const src = video?.getAttribute("src") || "";
  const filename =
    src.split("/").pop()?.split("?")[0] ||
    doc.querySelector("[data-filename]")?.getAttribute("data-filename") ||
    "video.mp4";
  const streamUrl = abs(src) || `/api/proxy/${chatId}/${encodeURIComponent(filename)}?id=${messageId}&hash=${hash}`;
  const thumbnail = abs(doc.querySelector("video")?.getAttribute("poster") || undefined);
  const size = doc.querySelector("[data-size], .size")?.textContent?.trim();
  const resolution = doc.querySelector("[data-resolution], .resolution")?.textContent?.trim();
  const channelName = doc.querySelector("[data-channel-name], .channel-name")?.textContent?.trim();
  const related = collectMedia(doc);
  return {
    chatId,
    messageId,
    hash,
    title,
    filename,
    streamUrl,
    thumbnail,
    size,
    resolution,
    channelName,
    related,
  };
}

export function isLoginPage(html: string): boolean {
  return /name=["']password["']/i.test(html) && /login/i.test(html);
}
