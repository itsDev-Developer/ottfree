import { useEffect, useRef, useState } from "react";
import { RotateCcw, RotateCw } from "lucide-react";
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
}

type AdState = {
  playing: boolean;
  index: number;
  total: number;
  remaining: number;
  duration: number;
  clickThrough?: string;
};

const emptyAdState: AdState = { playing: false, index: 0, total: 0, remaining: 0, duration: 0 };

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
}: Props) {
  const videoRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<Player | null>(null);
  const isAdPlayingRef = useRef(false);
  const [adState, setAdState] = useState<AdState>(emptyAdState);

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
    const tags = uniqueTags([vastTagUrl, ...vastTagUrls]);

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
        const d = player.duration() ?? currentAd?.duration ?? 0;
        setAdState({
          playing: true,
          index,
          total,
          remaining: Math.max(0, Math.ceil(d - t)),
          duration: d,
          clickThrough: ad.clickThrough,
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
        index,
        total,
        remaining: ad.duration ?? 0,
        duration: ad.duration ?? 0,
        clickThrough: ad.clickThrough,
      });
      player.play()?.catch(() => {});
    };

    const playAdsThenContent = async () => {
      if (adStarted) return;
      adStarted = true;
      const loadedAds: VastAd[] = [];
      for (const tag of tags) {
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

    if (tags.length) {
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
  }, [src, poster, startTime, onProgress, vastTagUrl, vastTagUrls]);

  const seekBy = (seconds: number) => {
    const p = playerRef.current;
    if (!p || isAdPlayingRef.current) return;
    const duration = p.duration() ?? 0;
    p.currentTime(
      Math.min(Math.max((p.currentTime() ?? 0) + seconds, 0), duration || Number.MAX_SAFE_INTEGER),
    );
  };

  return (
    <div className="group relative">
      <div
        data-vjs-player
        className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/40"
      >
        <div ref={videoRef} />
      </div>

      {!adState.playing && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center gap-6 opacity-0 transition group-hover:flex group-hover:opacity-100">
          <button
            type="button"
            onClick={() => seekBy(-10)}
            className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur transition hover:scale-105 hover:bg-black/90"
            aria-label="Back 10 seconds"
          >
            <RotateCcw className="h-6 w-6" />
            <span className="sr-only">Back 10 seconds</span>
          </button>
          <button
            type="button"
            onClick={() => seekBy(10)}
            className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur transition hover:scale-105 hover:bg-black/90"
            aria-label="Forward 10 seconds"
          >
            <RotateCw className="h-6 w-6" />
            <span className="sr-only">Forward 10 seconds</span>
          </button>
        </div>
      )}

      {adState.playing && (
        <div className="absolute inset-0 z-20 flex flex-col justify-between bg-gradient-to-b from-black/70 via-transparent to-black/80 p-3 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-yellow-400 px-2 py-1 text-xs font-black uppercase tracking-wide text-black">
                Ad
              </span>
              <span className="rounded-md bg-black/70 px-2 py-1 text-xs font-semibold">
                Sponsored video {adState.index} of {adState.total}
              </span>
            </div>
            {adState.clickThrough && (
              <a
                href={adState.clickThrough}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-black hover:bg-white/90"
              >
                Visit advertiser
              </a>
            )}
          </div>
          <div className="ml-auto rounded-full bg-black/75 px-3 py-1.5 text-xs font-semibold">
            Content starts after ad{adState.total > 1 ? "s" : ""} • {adState.remaining}s
          </div>
        </div>
      )}
    </div>
  );
}
