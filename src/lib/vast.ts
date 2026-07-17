// Minimal VAST 2/3/4 linear preroll parser — extracts the first playable
// MediaFile and click-through URL. Best-effort, no VPAID.

export interface VastAd {
  mediaUrl: string;
  /** Ordered fallbacks for the creative. A VAST response can contain several encodes. */
  mediaUrls: Array<{ url: string; mimeType?: string }>;
  mimeType?: string;
  duration?: number;
  clickThrough?: string;
  label?: string;
  impressions: string[];
  trackingEvents: Record<string, string[]>;
  skipOffset?: number; // seconds
}

function parseTime(t?: string | null): number | undefined {
  if (!t) return;
  const m = t.match(/^(\d+):(\d+):(\d+)(?:\.(\d+))?$/);
  if (!m) return;
  return +m[1] * 3600 + +m[2] * 60 + +m[3];
}

async function fetchXml(url: string): Promise<Document> {
  // Most VAST endpoints do not send CORS headers. Fetching through our same-
  // origin server route makes configured third-party tags usable in browsers.
  const target = new URL(url, window.location.href).href;
  const res = await fetch(`/api/vast?url=${encodeURIComponent(target)}`, { credentials: "omit" });
  if (!res.ok) throw new Error(`VAST request failed with ${res.status}`);
  const text = await res.text();
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("VAST response is not valid XML");
  return doc;
}

function absoluteUrl(value: string, baseUrl: string): string {
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return value;
  }
}

export async function loadVast(tagUrl: string, depth = 0): Promise<VastAd | null> {
  if (depth > 4) return null;
  const doc = await fetchXml(tagUrl);
  // Wrapper — follow VASTAdTagURI
  const wrapperUri = doc.querySelector("Wrapper VASTAdTagURI")?.textContent?.trim();
  if (wrapperUri) {
    const inner = await loadVast(absoluteUrl(wrapperUri, tagUrl), depth + 1);
    if (inner) {
      // merge trackers/impressions from wrapper
      const impressions = [
        ...Array.from(doc.querySelectorAll("Impression")).map((n) => n.textContent?.trim() ?? ""),
        ...inner.impressions,
      ].filter(Boolean);
      return { ...inner, impressions };
    }
    return null;
  }

  const linear = doc.querySelector("InLine Linear, Linear");
  if (!linear) return null;

  const mediaFiles = Array.from(linear.querySelectorAll("MediaFile"))
    .map((n) => ({
      url: absoluteUrl(n.textContent?.trim() ?? "", tagUrl),
      type: n.getAttribute("type") ?? "",
      width: Number(n.getAttribute("width") ?? 0),
      bitrate: Number(n.getAttribute("bitrate") ?? 0),
    }))
    // Do not reject a valid creative solely because an ad server omitted type.
    .filter((m) => m.url && (!m.type || /video\/(mp4|webm|ogg)/i.test(m.type)));
  if (!mediaFiles.length) return null;
  // Prefer broadly-supported MP4 files and modest bitrates. Keep every option as
  // a fallback because an individual encode may not be playable on a device.
  mediaFiles.sort(
    (a, b) =>
      Number(/mp4/i.test(b.type)) - Number(/mp4/i.test(a.type)) ||
      a.bitrate - b.bitrate ||
      a.width - b.width,
  );
  const mediaUrls = mediaFiles.map((media) => ({
    url: media.url,
    mimeType: media.type || undefined,
  }));

  const impressions = Array.from(doc.querySelectorAll("Impression"))
    .map((n) => n.textContent?.trim() ?? "")
    .filter(Boolean);

  const clickThrough =
    doc.querySelector("VideoClicks ClickThrough")?.textContent?.trim() || undefined;

  const trackingEvents: Record<string, string[]> = {};
  linear.querySelectorAll("Tracking").forEach((n) => {
    const ev = n.getAttribute("event");
    const url = n.textContent?.trim();
    if (ev && url) (trackingEvents[ev] ??= []).push(url);
  });

  const skipOffset = parseTime(linear.getAttribute("skipoffset"));
  const duration = parseTime(linear.querySelector("Duration")?.textContent?.trim());

  return {
    mediaUrl: mediaUrls[0].url,
    mediaUrls,
    mimeType: mediaUrls[0].mimeType,
    duration,
    clickThrough,
    impressions,
    trackingEvents,
    skipOffset,
  };
}

export function fireBeacons(urls: string[] | undefined) {
  if (!urls) return;
  for (const u of urls) {
    try {
      new Image().src = u;
    } catch {
      /* ignore */
    }
  }
}
