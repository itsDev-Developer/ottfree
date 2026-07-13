import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RotateCcw, RotateCw, ShieldCheck } from "lucide-react";
import videojs from "video.js";
import type Player from "video.js/dist/types/player";
import "video.js/dist/video-js.css";
import { loadVast, fireBeacons, type VastAd } from "@/lib/vast";

interface Props {
  src: string;
  poster?: string;
  startTime?: number;
  onProgress?: (position: number, duration: number) => void;
  vastTagUrl?: string;
  vastTagUrls?: string[];
  testAds?: boolean;
}

type AdState = {
  playing: boolean;
  loading: boolean;
  index: number;
  total: number;
  remaining: number;
  clickThrough?: string;
  label?: string;
};

const emptyAdState: AdState = {
  playing: false,
  loading: false,
  index: 0,
  total: 0,
  remaining: 0,
};

const TEST_VAST_AD: VastAd = {
  mediaUrl: "https://storage.googleapis.com/interactive-media-ads/media/android.mp4",
  mimeType: "video/mp4",
  duration: 10,
  clickThrough: "https://lovable.dev",
  impressions: [],
  trackingEvents: {},
  label: "Test VAST creative",
};

function uniqueTags(tags: Array<string | undefined>) {
  return Array.from(new Set(tags.map((tag) => tag?.trim()).filter(Boolean) as string[]));
}

export function VideoPlayer({
  src,
  poster,
  startTime = 0,
  onProgress,
  vastTagUrl,
  vastTagUrls = [],
  testAds = false,
}: Props) {
  const videoRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<Player | null>(null);
  const isAdPlayingRef = useRef(false);
  const [adState, setAdState] = useState<AdState>(emptyAdState);

  const tags = useMemo(() => uniqueTags([vastTagUrl, ...vastTagUrls]), [vastTagUrl, vastTagUrls]);
  const tagKey = tags.join("\n");

  useEffect(() => {
    if (!videoRef.current) return;

    const videoEl = document.createElement("video-js");
    videoEl.classList.add("vjs-big-play-centered", "vjs-fluid", "ott-video-player");
    videoRef.current.appendChild(videoEl);

    const player = videojs(videoEl, {
      autoplay: false,
      controls: true,
      responsive: true,
      fluid: true,
      preload: "metadata",
      playbackRates: [0.5, 1, 1.25, 1.5, 2],
      poster,
      controlBar: {
        pictureInPictureToggle: true,
        remainingTimeDisplay: true,
        volumePanel: { inline: false },
      },
      sources: [{ src, type: "video/mp4" }],
    });

    playerRef.current = player;

    const savedVol = Number(localStorage.getItem("surftg:volume") ?? "1");
    if (!Number.isNaN(savedVol)) player.volume(savedVol);

    let adStarted = false;
    let currentAd: VastAd | null = null;
    let quartileFired = new Set<string>();
    let disposed = false;
    const activeTags = tagKey ? tagKey.split("\n") : [];

    const setContentSource = (autoplay = false) => {
      currentAd = null;
      isAdPlayingRef.current = false;
      setAdState(emptyAdState);
      player.controls(true);
      player.src({ src, type: "video/mp4" });
      player.one("loadedmetadata", () => {
        if (startTime > 0 && startTime < (player.duration() ?? 0) - 5) {
          player.currentTime(startTime);
        }
        if (autoplay) player.play()?.catch(() => {});
      });
    };

    const playOneAd = (ad: VastAd, index: number, total: number, onDone: () => void) => {
      currentAd = ad;
      quartileFired = new Set();
      isAdPlayingRef.current = true;
      player.controls(false);
      player.src({ src: ad.mediaUrl, type: ad.mimeType || "video/mp4" });
      fireBeacons(ad.impressions);
      fireBeacons(ad.trackingEvents.creativeView);
      fireBeacons(ad.trackingEvents.start);

      const cleanup = () => {
        player.off("timeupdate", onAdTime);
        player.off("ended", onAdEnded);
        player.off("error", onAdError);
      };

      const onAdTime = () => {
        const t = player.currentTime() ?? 0;
        const d = player.duration() || currentAd?.duration || 0;
        setAdState({
          playing: true,
          loading: false,
          index,
          total,
          remaining: d > 0 ? Math.max(0, Math.ceil(d - t)) : 0,
          clickThrough: ad.clickThrough,
          label: ad.label,
        });
        if (d > 0) {
          const pct = t / d;
          const marks: [number, string][] = [
            [0.25, "firstQuartile"],
            [0.5, "midpoint"],
            [0.75, "thirdQuartile"],
          ];
          for (const [p, name] of marks) {
            if (pct >= p && !quartileFired.has(name)) {
              quartileFired.add(name);
              fireBeacons(ad.trackingEvents[name]);
            }
          }
        }
      };

      const onAdEnded = () => {
        fireBeacons(ad.trackingEvents.complete);
        cleanup();
        onDone();
      };

      const onAdError = () => {
        fireBeacons(ad.trackingEvents.error);
        cleanup();
        onDone();
      };

      player.on("timeupdate", onAdTime);
      player.one("ended", onAdEnded);
      player.one("error", onAdError);
      setAdState({
        playing: true,
        loading: false,
        index,
        total,
        remaining: ad.duration ?? 0,
        clickThrough: ad.clickThrough,
        label: ad.label,
      });
      player.play()?.catch(() => {});
    };

    const playAdsThenContent = async () => {
      if (adStarted) return;
      adStarted = true;
      setAdState({ ...emptyAdState, loading: true });
      player.controls(false);

      const loadedAds: VastAd[] = testAds ? [TEST_VAST_AD] : [];
      for (const tag of activeTags) {
        try {
          const ad = await loadVast(tag);
          if (ad) loadedAds.push(ad);
        } catch {
          // Continue to the next configured tag so one bad network cannot block all ads.
        }
      }

      if (disposed || loadedAds.length === 0) {
        setContentSource(true);
        return;
      }

      const playAt = (i: number) => {
        if (i >= loadedAds.length) {
          setContentSource(true);
          return;
        }
        playOneAd(loadedAds[i], i + 1, loadedAds.length, () => playAt(i + 1));
      };
      playAt(0);
    };

    if (activeTags.length || testAds) {
      player.one("play", () => {
        player.pause();
        void playAdsThenContent();
      });
    } else {
      setContentSource(false);
    }

    player.on("volumechange", () => {
      localStorage.setItem("surftg:volume", String(player.volume() ?? 1));
    });

    let last = 0;
    player.on("timeupdate", () => {
      if (isAdPlayingRef.current) return;
      const now = Date.now();
      if (now - last > 5000) {
        last = now;
        onProgress?.(player.currentTime() ?? 0, player.duration() ?? 0);
      }
    });

    return () => {
      disposed = true;
      player.dispose();
      playerRef.current = null;
      isAdPlayingRef.current = false;
    };
  }, [src, poster, startTime, onProgress, tagKey, testAds]);

  const seekBy = (seconds: number) => {
    const p = playerRef.current;
    if (!p || isAdPlayingRef.current) return;
    const duration = p.duration() ?? 0;
    p.currentTime(
      Math.min(Math.max((p.currentTime() ?? 0) + seconds, 0), duration || Number.MAX_SAFE_INTEGER),
    );
  };

  return (
    <div className="group relative overflow-hidden rounded-[1.75rem] bg-black/90 p-1 shadow-2xl shadow-black/50 ring-1 ring-white/10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(168,85,247,.28),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(56,189,248,.18),transparent_30%)]" />
      <div
        data-vjs-player
        className="relative overflow-hidden rounded-[1.45rem] border border-white/10 bg-black"
      >
        <div ref={videoRef} />
      </div>

      {!adState.playing && !adState.loading && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center gap-5 opacity-0 transition duration-200 group-hover:flex group-hover:opacity-100">
          <button
            type="button"
            onClick={() => seekBy(-10)}
            className="pointer-events-auto grid h-16 w-16 place-items-center rounded-full border border-white/15 bg-black/65 text-white shadow-xl backdrop-blur transition hover:scale-105 hover:bg-black/90"
            aria-label="Back 10 seconds"
          >
            <RotateCcw className="h-7 w-7" />
            <span className="text-[10px] font-black">10</span>
          </button>
          <button
            type="button"
            onClick={() => seekBy(10)}
            className="pointer-events-auto grid h-16 w-16 place-items-center rounded-full border border-white/15 bg-black/65 text-white shadow-xl backdrop-blur transition hover:scale-105 hover:bg-black/90"
            aria-label="Forward 10 seconds"
          >
            <RotateCw className="h-7 w-7" />
            <span className="text-[10px] font-black">10</span>
          </button>
        </div>
      )}

      {(adState.playing || adState.loading) && (
        <div className="absolute inset-1 z-20 flex flex-col justify-between rounded-[1.45rem] bg-gradient-to-b from-black/80 via-black/15 to-black/85 p-4 text-white backdrop-blur-[1px]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400 px-3 py-1 text-xs font-black uppercase tracking-wide text-black shadow-lg shadow-yellow-500/20">
                <ShieldCheck className="h-3.5 w-3.5" /> Ad
              </span>
              <span className="rounded-full bg-black/70 px-3 py-1 text-xs font-semibold ring-1 ring-white/10">
                {adState.loading
                  ? "Loading sponsored video…"
                  : `Sponsored video ${adState.index} of ${adState.total}`}
              </span>
              {adState.label && (
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
                  {adState.label}
                </span>
              )}
            </div>
            {adState.clickThrough && (
              <a
                href={adState.clickThrough}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="rounded-full bg-white px-4 py-2 text-xs font-black text-black shadow-lg transition hover:scale-105 hover:bg-white/90"
              >
                Visit advertiser
              </a>
            )}
          </div>
          <div className="ml-auto inline-flex items-center gap-2 rounded-full bg-black/75 px-4 py-2 text-xs font-bold ring-1 ring-white/10">
            {adState.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {adState.loading
              ? "Preparing ad"
              : `Content starts after ad${adState.total > 1 ? "s" : ""} • ${adState.remaining}s`}
          </div>
        </div>
      )}
    </div>
  );
}
