import { useEffect, useRef, useState } from "react";
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
}

export function VideoPlayer({ src, poster, startTime = 0, onProgress, vastTagUrl }: Props) {
  const videoRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<Player | null>(null);
  const [adState, setAdState] = useState<{
    playing: boolean;
    canSkip: boolean;
    remaining: number;
    clickThrough?: string;
  }>({ playing: false, canSkip: false, remaining: 0 });

  useEffect(() => {
    if (!videoRef.current) return;

    const videoEl = document.createElement("video-js");
    videoEl.classList.add("vjs-big-play-centered", "vjs-fluid");
    videoRef.current.appendChild(videoEl);

    const player = videojs(videoEl, {
      autoplay: false,
      controls: true,
      responsive: true,
      fluid: true,
      preload: "metadata",
      playbackRates: [0.5, 1, 1.25, 1.5, 2],
      poster,
      sources: [{ src, type: "video/mp4" }],
    });

    playerRef.current = player;

    const savedVol = Number(localStorage.getItem("surftg:volume") ?? "1");
    if (!Number.isNaN(savedVol)) player.volume(savedVol);

    let adPlayed = false;
    let ad: VastAd | null = null;
    let quartileFired = new Set<string>();

    const startContent = () => {
      setAdState({ playing: false, canSkip: false, remaining: 0 });
      player.src({ src, type: "video/mp4" });
      player.one("loadedmetadata", () => {
        if (startTime > 0 && startTime < (player.duration() ?? 0) - 5) {
          player.currentTime(startTime);
        }
      });
    };

    const playAd = async () => {
      if (!vastTagUrl || adPlayed) return;
      adPlayed = true;
      try {
        ad = await loadVast(vastTagUrl);
      } catch {
        ad = null;
      }
      if (!ad) return;

      player.src({ src: ad.mediaUrl, type: "video/mp4" });
      fireBeacons(ad.impressions);
      fireBeacons(ad.trackingEvents.creativeView);
      quartileFired = new Set();

      const skipAfter = ad.skipOffset ?? 5;
      setAdState({ playing: true, canSkip: false, remaining: skipAfter, clickThrough: ad.clickThrough });

      const onAdTime = () => {
        const t = player.currentTime() ?? 0;
        const d = player.duration() ?? 0;
        setAdState((s) => ({
          ...s,
          canSkip: t >= skipAfter,
          remaining: Math.max(0, Math.ceil(skipAfter - t)),
        }));
        if (d > 0 && ad) {
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
        if (ad) fireBeacons(ad.trackingEvents.complete);
        player.off("timeupdate", onAdTime);
        player.off("ended", onAdEnded);
        startContent();
        player.play()?.catch(() => {});
      };
      player.on("timeupdate", onAdTime);
      player.on("ended", onAdEnded);
      player.play()?.catch(() => {});
    };

    // Intercept first play attempt to insert the preroll
    if (vastTagUrl) {
      const onFirstPlay = () => {
        if (adPlayed) return;
        player.pause();
        playAd();
      };
      player.one("play", onFirstPlay);
    } else {
      player.on("loadedmetadata", () => {
        if (startTime > 0 && startTime < (player.duration() ?? 0) - 5) {
          player.currentTime(startTime);
        }
      });
    }

    player.on("volumechange", () => {
      localStorage.setItem("surftg:volume", String(player.volume() ?? 1));
    });

    let last = 0;
    player.on("timeupdate", () => {
      if (adState.playing) return;
      const now = Date.now();
      if (now - last > 5000) {
        last = now;
        const t = player.currentTime() ?? 0;
        const d = player.duration() ?? 0;
        // Guard against reporting ad progress
        if (!adPlayed || (ad && Math.abs((player.duration() ?? 0) - (ad?.mediaUrl ? 0 : 0)) >= 0)) {
          onProgress?.(t, d);
        }
      }
    });

    return () => {
      player.dispose();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, vastTagUrl]);

  const skipAd = () => {
    const p = playerRef.current;
    if (!p) return;
    // Trigger ended handler by seeking to end
    p.currentTime((p.duration() ?? 0) - 0.05);
  };

  return (
    <div className="relative">
      <div data-vjs-player className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
        <div ref={videoRef} />
      </div>
      {adState.playing && (
        <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2">
          <span className="pointer-events-auto rounded-md bg-yellow-500/90 px-2 py-1 text-xs font-bold text-black">
            Ad
          </span>
          {adState.clickThrough && (
            <a
              href={adState.clickThrough}
              target="_blank"
              rel="noopener noreferrer"
              className="pointer-events-auto rounded-md bg-black/70 px-2 py-1 text-xs text-white hover:bg-black/90"
            >
              Visit advertiser
            </a>
          )}
        </div>
      )}
      {adState.playing && (
        <div className="absolute bottom-16 right-3 z-10">
          <button
            disabled={!adState.canSkip}
            onClick={skipAd}
            className="rounded-md bg-black/80 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-70"
          >
            {adState.canSkip ? "Skip Ad ›" : `Skip in ${adState.remaining}s`}
          </button>
        </div>
      )}
    </div>
  );
}
