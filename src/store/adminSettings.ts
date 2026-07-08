// Client-side admin-managed settings (ads).
const KEY = "surftg:ads-settings";

export interface AdsSettings {
  vastTagUrl: string;
  bannerImageUrl: string;
  bannerLink: string;
}

const DEFAULTS: AdsSettings = { vastTagUrl: "", bannerImageUrl: "", bannerLink: "" };

export function getAdsSettings(): AdsSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AdsSettings>) };
  } catch {
    return DEFAULTS;
  }
}

export function setAdsSettings(s: AdsSettings) {
  localStorage.setItem(KEY, JSON.stringify(s));
}
