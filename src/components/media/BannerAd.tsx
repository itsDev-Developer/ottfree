import { useQuery } from "@tanstack/react-query";
import { fetchAdsBySlot, type AdRow } from "@/lib/cloudSettings";
import { useEffect, useMemo, useState } from "react";

interface Props {
  slot: string;
  className?: string;
  testMode?: boolean;
}

const TEST_DISPLAY_ADS: Record<string, AdRow[]> = {
  home_top: [makeTestAd("home_top", "OTTFree test leaderboard", "Test leaderboard ad — 970×90")],
  home_mid: [
    makeTestAd("home_mid", "OTTFree test mid-page", "Test mid-page ad — responsive banner"),
  ],
  home_feed: [makeTestAd("home_feed", "OTTFree test feed", "Test in-feed sponsored card")],
  watch_top: [makeTestAd("watch_top", "OTTFree test watch top", "Test watch-top ad")],
  watch_banner: [makeTestAd("watch_banner", "OTTFree test watch banner", "Test under-player ad")],
  watch_sidebar: [makeTestAd("watch_sidebar", "OTTFree test sidebar", "Test related-sidebar ad")],
  sidebar: [makeTestAd("sidebar", "OTTFree test sidebar", "Test sidebar ad")],
};

function makeTestAd(slot: string, label: string, text: string): AdRow {
  return {
    id: `test-${slot}`,
    slot,
    enabled: true,
    network: "test_display",
    label,
    image_url: null,
    link_url: "https://lovable.dev",
    vast_tag_url: null,
    script_code: `<a href="https://lovable.dev" rel="sponsored" style="box-sizing:border-box;width:100%;min-height:110px;padding:18px;border-radius:18px;background:linear-gradient(135deg,#facc15,#a855f7 55%,#38bdf8);display:flex;align-items:center;justify-content:center;color:#09090b;font-family:Inter,system-ui,sans-serif;font-weight:900;text-align:center;text-decoration:none;letter-spacing:.01em">${text}</a>`,
    position: 0,
  };
}

function useQueryTestAds(explicit?: boolean) {
  const [enabled, setEnabled] = useState(!!explicit);

  useEffect(() => {
    if (explicit !== undefined) {
      setEnabled(explicit);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    setEnabled(params.get("testAds") === "1");
  }, [explicit]);

  return enabled;
}

export function BannerAd({ slot, className = "", testMode }: Props) {
  const showTestAds = useQueryTestAds(testMode);
  const { data } = useQuery({
    queryKey: ["ads", slot],
    queryFn: () => fetchAdsBySlot(slot),
    staleTime: 5 * 60 * 1000,
  });

  const liveAds = (data ?? []).filter(
    (a) => a.enabled !== false && (a.script_code || a.image_url || a.link_url),
  );
  const ads = showTestAds ? [...(TEST_DISPLAY_ADS[slot] ?? []), ...liveAds] : liveAds;
  if (ads.length === 0) return null;

  return (
    <section
      className={`mx-4 mt-6 flex flex-col gap-4 md:mx-8 ${className}`}
      aria-label="Sponsored ads"
      data-ad-slot={slot}
    >
      {ads.map((ad, i) => (
        <div
          key={ad.id ?? `${slot}-${i}`}
          className="group/ad relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-lg shadow-black/20 ring-1 ring-white/5"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-primary/10 opacity-70" />
          <span className="absolute left-3 top-3 z-10 rounded-md bg-black/75 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/80 backdrop-blur">
            {ad.network === "test_display" ? "Test ad" : "Ad"}
          </span>
          <div className="relative z-[1]">
            {ad.script_code ? (
              <ScriptAd ad={ad} />
            ) : ad.image_url ? (
              <ImageAd ad={ad} />
            ) : (
              <LinkAd ad={ad} />
            )}
          </div>
        </div>
      ))}
    </section>
  );
}

function ImageAd({ ad }: { ad: AdRow }) {
  if (!ad.image_url) return null;
  const img = (
    <img
      src={ad.image_url}
      alt={ad.label ?? "Sponsored"}
      className="h-auto min-h-[90px] w-full object-cover transition duration-300 group-hover/ad:scale-[1.01]"
      loading="lazy"
    />
  );
  return ad.link_url ? (
    <a href={ad.link_url} target="_blank" rel="noopener noreferrer sponsored" className="block">
      {img}
    </a>
  ) : (
    img
  );
}

function LinkAd({ ad }: { ad: AdRow }) {
  if (!ad.link_url) return null;
  return (
    <a
      href={ad.link_url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="flex min-h-[110px] w-full items-center justify-center p-4 text-center text-sm font-semibold text-white/90 transition hover:bg-white/5"
    >
      {ad.label ?? "Sponsored"}
    </a>
  );
}

function ScriptAd({ ad }: { ad: AdRow }) {
  const srcDoc = useMemo(() => {
    const code = ad.script_code ?? "";
    return `<!doctype html><html><head><base target="_blank"><style>html,body{box-sizing:border-box;margin:0;padding:0;background:transparent;min-height:110px;width:100%;display:flex;align-items:center;justify-content:center;overflow:hidden}body>*{max-width:100%}a,img,iframe,ins{max-width:100%}</style></head><body>${code}</body></html>`;
  }, [ad.script_code]);

  return (
    <iframe
      title={ad.label ?? "Sponsored ad"}
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-same-origin"
      referrerPolicy="no-referrer-when-downgrade"
      className="block min-h-[120px] w-full bg-transparent"
      loading="lazy"
    />
  );
}
