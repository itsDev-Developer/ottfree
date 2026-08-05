import { useEffect, useRef, useState } from "react";
import videojs from "video.js";
import type Player from "video.js/dist/types/player";
import "video.js/dist/video-js.css";
import { loadVast, fireBeacons, type VastAd } from "@/lib/vast";
import { buildSources, containerLabel, guessType } from "@/lib/media-source";

interface Props {
  src: string;
  poster?: string;
  startTime?: number;
  onProgress?: (position: number, duration: number) => void;
  vastTagUrl?: string;
}

export function VideoPlayer({ src, poster, startTime = 0, onProgress, vastTagUrl }: Props) {
  const videoRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<Player | null>(null);
  const [error, setError] = useState<string | null>(null);
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

    const contentSources = buildSources(src);

    const player = videojs(videoEl, {
      autoplay: false,
      controls: true,
      responsive: true,
      fluid: true,
      preload: "metadata",
      playbackRates: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3],
      poster,
      // Cross-container/codec playback: let VHS handle HLS/DASH and allow
      // native engines to take over anything they can decode themselves.
      html5: {
        vhs: { overrideNative: !videojs.browser.IS_SAFARI, withCredentials: true },
        nativeAudioTracks: videojs.browser.IS_SAFARI,
        nativeVideoTracks: videojs.browser.IS_SAFARI,
        nativeTextTracks: false,
      },
      controlBar: { pictureInPictureToggle: true },
      sources: contentSources,
    });

    playerRef.current = player;

    const savedVol = Number(localStorage.getItem("surftg:volume") ?? "1");
    if (!Number.isNaN(savedVol)) player.volume(savedVol);
    const savedRate = Number(localStorage.getItem("surftg:rate") ?? "1");
    if (savedRate > 0) player.playbackRate(savedRate);

    let adPlayed = false;
    let ad: VastAd | null = null;
    let quartileFired = new Set<string>();

    const seekToStart = () => {
      if (startTime > 0 && startTime < (player.duration() ?? 0) - 5) {
        player.currentTime(startTime);
      }
    };

    const startContent = () => {
      setAdState({ playing: false, canSkip: false, remaining: 0 });
      player.src(contentSources);
      player.one("loadedmetadata", seekToStart);
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

      player.src({ src: ad.mediaUrl, type: guessType(ad.mediaUrl) });
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
      player.on("loadedmetadata", seekToStart);
    }

    player.on("volumechange", () => {
      localStorage.setItem("surftg:volume", String(player.volume() ?? 1));
    });
    player.on("ratechange", () => {
      localStorage.setItem("surftg:rate", String(player.playbackRate() ?? 1));
    });

    player.on("error", () => {
      if (adPlayed && adState.playing) return;
      setError(
        `This ${containerLabel(src)} file uses a codec your browser can't decode. Try downloading it and playing in VLC.`,
      );
    });
    player.on("loadeddata", () => setError(null));

    // --- TV remote / D-pad navigation inside the player -------------------
    const shell = shellRef.current;

    const controlButtons = (): HTMLElement[] => {
      const bar = shell?.querySelector<HTMLElement>(".vjs-control-bar");
      if (!bar) return [];
      const nodes = Array.from(
        bar.querySelectorAll<HTMLElement>(
          'button, [role="button"], [tabindex]:not([tabindex="-1"]), .vjs-progress-control',
        ),
      ) as HTMLElement[];
      return nodes.filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
    };

    const showControls = () => {
      player.userActive(true);
      // keep the bar up while the remote is being used
      player.addClass("vjs-tv-focus");
    };

    const focusControl = (index: number) => {
      const list = controlButtons();
      if (!list.length) return;
      const el = list[Math.max(0, Math.min(list.length - 1, index))];
      showControls();
      el.setAttribute("tabindex", "0");
      el.focus();
    };

    const onDpad = (e: KeyboardEvent) => {
      const p = playerRef.current;
      if (!p || !shell) return;
      const target = e.target as HTMLElement | null;
      if (target && /input|textarea|select/i.test(target.tagName)) return;

      const bar = shell.querySelector<HTMLElement>(".vjs-control-bar");
      const inBar = !!(target && bar && bar.contains(target));
      const list = controlButtons();
      const idx = target ? list.indexOf(target) : -1;

      switch (e.key) {
        case "ArrowDown":
          if (!inBar) {
            e.preventDefault();
            e.stopPropagation();
            focusControl(0);
          }
          return;
        case "ArrowUp":
          if (inBar) {
            e.preventDefault();
            e.stopPropagation();
            player.removeClass("vjs-tv-focus");
            shell.focus();
          }
          return;
        case "ArrowLeft":
        case "ArrowRight":
          if (inBar) {
            e.preventDefault();
            e.stopPropagation();
            focusControl(idx + (e.key === "ArrowRight" ? 1 : -1));
          }
          return;
        case "Enter":
          if (inBar) {
            e.stopPropagation();
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          p.paused() ? p.play()?.catch(() => {}) : p.pause();
          return;
        case "Escape":
        case "Backspace":
          if (inBar) {
            e.preventDefault();
            e.stopPropagation();
            player.removeClass("vjs-tv-focus");
            shell.focus();
          }
          return;
        default:
          return;
      }
    };
    shell?.addEventListener("keydown", onDpad);

    const onShellFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget as Node | null;
      if (!next || !shell?.contains(next)) player.removeClass("vjs-tv-focus");
    };
    shell?.addEventListener("focusout", onShellFocusOut);

    // VLC-style keyboard shortcuts
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /input|textarea|select/i.test(target.tagName)) return;
      // control-bar focus is handled by the D-pad handler above
      if (target && shell?.querySelector(".vjs-control-bar")?.contains(target)) return;
      const p = playerRef.current;
      if (!p) return;
      const cur = p.currentTime() ?? 0;
      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          p.paused() ? p.play()?.catch(() => {}) : p.pause();
          break;
        case "arrowright":
          p.currentTime(cur + (e.shiftKey ? 60 : 10));
          break;
        case "arrowleft":
          p.currentTime(Math.max(0, cur - (e.shiftKey ? 60 : 10)));
          break;
        case "arrowup":
          p.volume(Math.min(1, (p.volume() ?? 1) + 0.05));
          break;
        case "arrowdown":
          p.volume(Math.max(0, (p.volume() ?? 1) - 0.05));
          break;
        case "m":
          p.muted(!p.muted());
          break;
        case "f":
          p.isFullscreen() ? p.exitFullscreen() : p.requestFullscreen();
          break;
        case "]":
          p.playbackRate(Math.min(3, (p.playbackRate() ?? 1) + 0.25));
          break;
        case "[":
          p.playbackRate(Math.max(0.25, (p.playbackRate() ?? 1) - 0.25));
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);

    let last = 0;
    player.on("timeupdate", () => {
      if (adState.playing) return;
      const now = Date.now();
      if (now - last > 5000) {
        last = now;
        const t = player.currentTime() ?? 0;
        const d = player.duration() ?? 0;
        if (d > 0) onProgress?.(t, d);
      }
    });

    return () => {
      window.removeEventListener("keydown", onKey);
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
      {error && !adState.playing && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
          <span>{error}</span>
          <a
            href={src}
            download
            className="rounded-md bg-yellow-500 px-3 py-1 text-xs font-semibold text-black"
          >
            Download file
          </a>
        </div>
      )}
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
