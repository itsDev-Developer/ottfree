/** A small, dependency-free VAST 2/3/4 linear-ad loader.
 *
 * The player deliberately owns playback. This module only resolves a tag into a
 * playable creative, including wrapper chains, so content can never race an ad.
 */
export interface VastAd {
  mediaUrl: string;
  mimeType?: string;
  duration?: number;
  clickThrough?: string;
  label?: string;
  impressions: string[];
  trackingEvents: Record<string, string[]>;
  skipOffset?: number;
}

export class VastError extends Error {
  constructor(
    message: string,
    readonly code: "timeout" | "network" | "empty" | "xml" | "wrapper",
  ) {
    super(message);
    this.name = "VastError";
  }
}

export interface VastLoadOptions {
  timeoutMs?: number;
  retries?: number;
  maxWrapperDepth?: number;
  signal?: AbortSignal;
}

const DEFAULT_OPTIONS: Required<Omit<VastLoadOptions, "signal">> = {
  timeoutMs: 8_000,
  retries: 1,
  maxWrapperDepth: 5,
};

function parseTime(value?: string | null): number | undefined {
  if (!value) return undefined;
  const match = value.trim().match(/^(\d+):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (!match) return undefined;
  return (
    Number(match[1]) * 3600 +
    Number(match[2]) * 60 +
    Number(match[3]) +
    Number(`0.${match[4] ?? 0}`)
  );
}

function urls(nodes: Iterable<Element>) {
  return Array.from(nodes, (node) => node.textContent?.trim() ?? "").filter(Boolean);
}

function resolveUrl(value: string, base: string) {
  try {
    return new URL(value, base).href;
  } catch {
    return value;
  }
}

async function fetchXml(url: string, options: Required<VastLoadOptions>): Promise<Document> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), options.timeoutMs);
    const onAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onAbort, { once: true });
    try {
      const response = await fetch(url, {
        credentials: "omit",
        redirect: "follow",
        signal: controller.signal,
      });
      if (!response.ok) throw new VastError(`VAST returned HTTP ${response.status}`, "network");
      const xml = await response.text();
      if (!xml.trim()) throw new VastError("VAST response was empty", "empty");
      const document = new DOMParser().parseFromString(xml, "application/xml");
      if (document.querySelector("parsererror"))
        throw new VastError("VAST response was not valid XML", "xml");
      return document;
    } catch (error) {
      lastError = controller.signal.aborted
        ? new VastError("VAST request timed out", "timeout")
        : error;
      if (attempt < options.retries && !options.signal?.aborted) {
        await new Promise((resolve) => window.setTimeout(resolve, 250 * (attempt + 1)));
      }
    } finally {
      window.clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
    }
  }
  throw lastError instanceof VastError
    ? lastError
    : new VastError("VAST request failed", "network");
}

function collectTracking(root: ParentNode) {
  const tracking: Record<string, string[]> = {};
  root.querySelectorAll("Tracking").forEach((node) => {
    const event = node.getAttribute("event");
    const url = node.textContent?.trim();
    if (event && url) (tracking[event] ??= []).push(url);
  });
  return tracking;
}

function mergeTracking(outer: Record<string, string[]>, inner: Record<string, string[]>) {
  const merged = { ...outer };
  for (const [event, urlsForEvent] of Object.entries(inner)) {
    merged[event] = [...(merged[event] ?? []), ...urlsForEvent];
  }
  return merged;
}

export async function loadVast(
  tagUrl: string,
  provided: VastLoadOptions = {},
  depth = 0,
): Promise<VastAd | null> {
  const options = { ...DEFAULT_OPTIONS, ...provided };
  if (depth > options.maxWrapperDepth)
    throw new VastError("VAST wrapper limit exceeded", "wrapper");
  const doc = await fetchXml(tagUrl, options);
  const wrapper = doc.querySelector("Wrapper");
  const wrapperUri = wrapper?.querySelector("VASTAdTagURI")?.textContent?.trim();
  if (wrapper && wrapperUri) {
    const inner = await loadVast(resolveUrl(wrapperUri, tagUrl), options, depth + 1);
    if (!inner) return null;
    const wrapperLinear = wrapper.querySelector("Linear");
    return {
      ...inner,
      impressions: [...urls(wrapper.querySelectorAll("Impression")), ...inner.impressions],
      trackingEvents: mergeTracking(
        collectTracking(wrapperLinear ?? wrapper),
        inner.trackingEvents,
      ),
    };
  }

  const inline = doc.querySelector("InLine");
  const linear = inline?.querySelector("Linear");
  if (!inline || !linear) return null;
  const mediaFiles = Array.from(linear.querySelectorAll("MediaFile"))
    .map((node) => ({
      url: resolveUrl(node.textContent?.trim() ?? "", tagUrl),
      type: node.getAttribute("type") ?? "",
      width: Number(node.getAttribute("width") ?? 0),
    }))
    .filter(
      (media) => media.url && /^(video\/mp4|video\/webm|application\/x-mpegurl)/i.test(media.type),
    )
    .sort((a, b) => b.width - a.width);
  if (!mediaFiles.length) return null; // VPAID/non-linear only: safely fall through to content.

  const media = mediaFiles[0];
  return {
    mediaUrl: media.url,
    mimeType: media.type || undefined,
    duration: parseTime(linear.querySelector("Duration")?.textContent),
    clickThrough:
      linear.querySelector("VideoClicks ClickThrough")?.textContent?.trim() || undefined,
    label: inline.querySelector("AdTitle")?.textContent?.trim() || undefined,
    impressions: urls(inline.querySelectorAll("Impression")),
    trackingEvents: collectTracking(linear),
    skipOffset: parseTime(linear.getAttribute("skipoffset")),
  };
}

export function fireBeacons(urlList: string[] | undefined) {
  for (const url of urlList ?? []) {
    try {
      fetch(url, { credentials: "omit", keepalive: true, mode: "no-cors" }).catch(() => undefined);
    } catch {
      // Tracking must never affect playback.
    }
  }
}
