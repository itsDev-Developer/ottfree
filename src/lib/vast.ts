// Minimal VAST 2/3/4 linear preroll parser — extracts the first playable
// MediaFile and click-through URL. Best-effort, no VPAID.

export interface VastAd {
  mediaUrl: string;
  mimeType?: string;
  duration?: number;
  clickThrough?: string;
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
  const res = await fetch(url, { credentials: "omit" });
  const text = await res.text();
  return new DOMParser().parseFromString(text, "application/xml");
}

export async function loadVast(tagUrl: string, depth = 0): Promise<VastAd | null> {
  if (depth > 4) return null;
  const doc = await fetchXml(tagUrl);
  // Wrapper — follow VASTAdTagURI
  const wrapperUri = doc.querySelector("Wrapper VASTAdTagURI")?.textContent?.trim();
  if (wrapperUri) {
    const inner = await loadVast(wrapperUri, depth + 1);
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
      url: n.textContent?.trim() ?? "",
      type: n.getAttribute("type") ?? "",
      width: Number(n.getAttribute("width") ?? 0),
    }))
    .filter((m) => m.url && /mp4|webm/i.test(m.type));
  if (!mediaFiles.length) return null;
  mediaFiles.sort((a, b) => b.width - a.width);

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
    mediaUrl: mediaFiles[0].url,
    mimeType: mediaFiles[0].type || undefined,
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
