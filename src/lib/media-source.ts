// VLC-style source handling: guess a MIME type from the URL so Video.js can
// pick the right playback engine (progressive, HLS, DASH, …) and provide
// fallback sources when the primary type is rejected by the browser.

export interface PlayableSource {
  src: string;
  type: string;
}

const EXT_TYPES: Record<string, string> = {
  m3u8: "application/x-mpegURL",
  m3u: "application/x-mpegURL",
  mpd: "application/dash+xml",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/mp4",
  webm: "video/webm",
  ogv: "video/ogg",
  ogg: "video/ogg",
  mkv: "video/webm",
  avi: "video/x-msvideo",
  ts: "video/mp2t",
  m2ts: "video/mp2t",
  flv: "video/x-flv",
  wmv: "video/x-ms-wmv",
  "3gp": "video/3gpp",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  wav: "audio/wav",
  opus: "audio/ogg",
};

export function extensionOf(url: string): string {
  try {
    const clean = url.split("#")[0].split("?")[0];
    const name = clean.substring(clean.lastIndexOf("/") + 1);
    const dot = name.lastIndexOf(".");
    return dot > -1 ? name.slice(dot + 1).toLowerCase() : "";
  } catch {
    return "";
  }
}

/** Extension may also live in a `?...name.mkv` style query (proxy stream urls). */
function extensionFromAnywhere(url: string): string {
  const direct = extensionOf(url);
  if (direct) return direct;
  const m = decodeURIComponent(url).match(/\.([a-z0-9]{2,5})(?:[?&#]|$)/i);
  return m ? m[1].toLowerCase() : "";
}

export function guessType(url: string): string {
  const ext = extensionFromAnywhere(url);
  return EXT_TYPES[ext] ?? "video/mp4";
}

export function isStreamingManifest(url: string): boolean {
  const t = guessType(url);
  return t === "application/x-mpegURL" || t === "application/dash+xml";
}

/**
 * Ordered candidate sources. Video.js walks the list until one plays, which
 * lets containers the browser mislabels (mkv, avi, ts…) still get a shot at
 * native playback.
 */
export function buildSources(url: string): PlayableSource[] {
  const primary = guessType(url);
  const fallbacks = ["video/mp4", "video/webm", "video/x-matroska", "video/ogg"];
  const list: PlayableSource[] = [{ src: url, type: primary }];
  if (!isStreamingManifest(url)) {
    for (const type of fallbacks) {
      if (type !== primary) list.push({ src: url, type });
    }
  }
  return list;
}

export function containerLabel(url: string): string {
  const ext = extensionFromAnywhere(url);
  return ext ? ext.toUpperCase() : "Unknown";
}
