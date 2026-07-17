import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Maximize, RotateCcw, RotateCw, ShieldCheck, SkipForward } from "lucide-react";
import videojs from "video.js";
import type Player from "video.js/dist/types/player";
import "video.js/dist/video-js.css";
import { fireBeacons, loadVast, type VastAd } from "@/lib/vast";

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
  skipIn?: number;
  clickThrough?: string;
  label?: string;
};
const emptyAdState: AdState = { playing: false, loading: false, index: 0, total: 0, remaining: 0 };
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
  const onProgressRef = useRef(onProgress);
  const isAdPlayingRef = useRef(false);
  const startGateRef = useRef<(() => void) | null>(null);
  const finishAdRef = useRef<((reason: "complete" | "skip" | "error" | "timeout") => void) | null>(
    null,
  );
  const [adState, setAdState] = useState<AdState>(emptyAdState);
  const [awaitingStart, setAwaitingStart] = useState(true);
  const [theatre, setTheatre] = useState(false);
  const tags = useMemo(() => uniqueTags([vastTagUrl, ...vastTagUrls]), [vastTagUrl, vastTagUrls]);
  const tagKey = tags.join("\n");
  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    if (!videoRef.current) return;
    setAwaitingStart(true);
    const videoEl = document.createElement("video-js");
    videoEl.classList.add("vjs-big-play-centered", "vjs-fluid", "ott-video-player");
    videoRef.current.appendChild(videoEl);
    const player = videojs(videoEl, {
      autoplay: false,
      controls: true,
      responsive: true,
      fluid: true,
      preload: "metadata",
      poster,
      playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
      controlBar: {
        pictureInPictureToggle: true,
        remainingTimeDisplay: true,
        volumePanel: { inline: false },
      },
      // Content is intentionally attached only after the preroll gate resolves.
      sources: [],
    });
    playerRef.current = player;
    const savedVolume = Number(localStorage.getItem("surftg:volume") ?? "1");
    if (!Number.isNaN(savedVolume)) player.volume(savedVolume);

    let disposed = false;
    let gateStarted = false;
    let contentReady = false;
    let currentAd: VastAd | null = null;
    let adFinish: (() => void) | undefined;
    const abortController = new AbortController();
    const activeTags = tagKey ? tagKey.split("\n") : [];
    const debug = (...args: unknown[]) => {
      if (import.meta.env.DEV) console.info("[VAST]", ...args);
    };
    const emit = (name: string) => player.trigger(name);

    const playContent = async () => {
      if (disposed || contentReady) return;
      contentReady = true;
      setAwaitingStart(false);
      currentAd = null;
      isAdPlayingRef.current = false;
      setAdState(emptyAdState);
      player.controls(true);
      player.src({ src, type: "video/mp4" });
      player.one("loadedmetadata", () => {
        if (startTime > 0 && startTime < (player.duration() ?? 0) - 5)
          player.currentTime(startTime);
        emit("contentplayback");
        player.play()?.catch(async () => {
          // A muted retry is allowed by Safari/Chrome policies; do not unmute without consent.
          player.muted(true);
          await player.play()?.catch(() => undefined);
        });
      });
    };

    const finishAd = (reason: "complete" | "skip" | "error" | "timeout") => {
      if (!adFinish) return;
      const done = adFinish;
      adFinish = undefined;
      if (reason === "skip") emit("adskip");
      if (reason === "error") emit("adserror");
      if (reason === "timeout") emit("adtimeout");
      done();
    };
    finishAdRef.current = finishAd;

    const playOneAd = (ad: VastAd, index: number, total: number) =>
      new Promise<void>((resolve) => {
        currentAd = ad;
        isAdPlayingRef.current = true;
        player.controls(false);
        emit("adstart");
        const quartiles = new Set<string>();
        const timeout = window.setTimeout(
          () => finishAd("timeout"),
          Math.max(12_000, ((ad.duration ?? 15) + 8) * 1000),
        );
        const cleanup = () => {
          window.clearTimeout(timeout);
          player.off("timeupdate", onTime);
          player.off("ended", onEnd);
          player.off("error", onError);
        };
        adFinish = () => {
          cleanup();
          emit("adend");
          resolve();
        };
        const onTime = () => {
          const time = player.currentTime() ?? 0;
          const duration = player.duration() || ad.duration || 0;
          const skipIn =
            ad.skipOffset === undefined ? undefined : Math.max(0, Math.ceil(ad.skipOffset - time));
          setAdState({
            playing: true,
            loading: false,
            index,
            total,
            remaining: duration ? Math.max(0, Math.ceil(duration - time)) : 0,
            skipIn,
            clickThrough: ad.clickThrough,
            label: ad.label,
          });
          for (const [portion, event] of [
            [0.25, "firstQuartile"],
            [0.5, "midpoint"],
            [0.75, "thirdQuartile"],
          ] as const) {
            if (duration && time / duration >= portion && !quartiles.has(event)) {
              quartiles.add(event);
              fireBeacons(ad.trackingEvents[event]);
            }
          }
        };
        const onEnd = () => {
          fireBeacons(ad.trackingEvents.complete);
          finishAd("complete");
        };
        const onError = () => {
          fireBeacons(ad.trackingEvents.error);
          finishAd("error");
        };
        player.on("timeupdate", onTime);
        player.one("ended", onEnd);
        player.one("error", onError);
        player.src({ src: ad.mediaUrl, type: ad.mimeType || "video/mp4" });
        fireBeacons(ad.impressions);
        fireBeacons(ad.trackingEvents.creativeView);
        fireBeacons(ad.trackingEvents.start);
        setAdState({
          playing: true,
          loading: false,
          index,
          total,
          remaining: ad.duration ?? 0,
          skipIn: ad.skipOffset,
          clickThrough: ad.clickThrough,
          label: ad.label,
        });
        player.play()?.catch(async () => {
          player.muted(true);
          await player.play()?.catch(() => finishAd("error"));
        });
      });

    const startGate = async () => {
      if (gateStarted || disposed) return;
      gateStarted = true;
      if (!activeTags.length && !testAds) {
        await playContent();
        return;
      }
      player.pause();
      player.controls(false);
      setAdState({ ...emptyAdState, loading: true });
      const ads: VastAd[] = testAds ? [TEST_VAST_AD] : [];
      for (const tag of activeTags) {
        try {
          const ad = await loadVast(tag, {
            retries: 1,
            timeoutMs: 8_000,
            signal: abortController.signal,
          });
          if (ad) ads.push(ad);
        } catch (error) {
          debug("tag failed", tag, error);
          emit(error instanceof Error && error.name === "VastError" ? "adtimeout" : "adserror");
        }
      }
      if (disposed) return;
      emit("adsready");
      for (let index = 0; index < ads.length && !disposed; index += 1)
        await playOneAd(ads[index], index + 1, ads.length);
      await playContent();
    };

    startGateRef.current = () => void startGate();
    player.on("volumechange", () =>
      localStorage.setItem("surftg:volume", String(player.volume() ?? 1)),
    );
    let lastProgress = 0;
    player.on("timeupdate", () => {
      if (!isAdPlayingRef.current && contentReady && Date.now() - lastProgress > 5000) {
        lastProgress = Date.now();
        onProgressRef.current?.(player.currentTime() ?? 0, player.duration() ?? 0);
      }
    });
    const onKey = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        isAdPlayingRef.current
      )
        return;
      const key = event.key.toLowerCase();
      if (
        [
          " ",
          "k",
          "j",
          "l",
          "m",
          "f",
          "t",
          "arrowleft",
          "arrowright",
          "arrowup",
          "arrowdown",
        ].includes(key)
      )
        event.preventDefault();
      if (!contentReady && (key === " " || key === "k")) {
        void startGate();
        return;
      }
      if (key === " " || key === "k") {
        if (player.paused()) void player.play();
        else player.pause();
      }
      if (key === "j" || key === "arrowleft")
        player.currentTime(Math.max(0, (player.currentTime() ?? 0) - 10));
      if (key === "l" || key === "arrowright")
        player.currentTime(
          Math.min(player.duration() || Infinity, (player.currentTime() ?? 0) + 10),
        );
      if (key === "m") player.muted(!player.muted());
      if (key === "arrowup" || key === "arrowdown")
        player.volume(Math.max(0, Math.min(1, player.volume() + (key === "arrowup" ? 0.1 : -0.1))));
      if (key === "f") {
        if (player.isFullscreen()) void player.exitFullscreen();
        else void player.requestFullscreen();
      }
      if (key === "t") setTheatre((value) => !value);
    };
    const element = player.el();
    element.addEventListener("keydown", onKey);
    element.setAttribute("tabindex", "0");
    return () => {
      disposed = true;
      abortController.abort();
      finishAdRef.current = null;
      startGateRef.current = null;
      element.removeEventListener("keydown", onKey);
      player.dispose();
      playerRef.current = null;
      isAdPlayingRef.current = false;
    };
  }, [src, poster, startTime, tagKey, testAds]);

  const seekBy = (seconds: number) => {
    const player = playerRef.current;
    if (!player || isAdPlayingRef.current) return;
    player.currentTime(
      Math.max(0, Math.min(player.duration() || Infinity, (player.currentTime() ?? 0) + seconds)),
    );
  };
  const skipAd = () => {
    if (adState.skipIn === undefined || adState.skipIn > 0) return;
    finishAdRef.current?.("skip");
  };
  const startWatching = () => startGateRef.current?.();

  return (
    <div
      className={`group relative overflow-hidden rounded-[1.75rem] bg-black/90 p-1 shadow-2xl shadow-black/50 ring-1 ring-white/10 ${theatre ? "fixed inset-3 z-50 mx-auto max-w-[calc(100vw-1.5rem)]" : ""}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(168,85,247,.28),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(56,189,248,.18),transparent_30%)]" />
      <div
        data-vjs-player
        className="relative overflow-hidden rounded-[1.45rem] border border-white/10 bg-black"
      >
        <div ref={videoRef} />
      </div>
      {awaitingStart && !adState.loading && (
        <div className="absolute inset-1 z-10 grid place-items-center rounded-[1.45rem] bg-black/30">
          <button
            type="button"
            onClick={startWatching}
            className="rounded-full bg-white px-6 py-3 text-sm font-black text-black shadow-2xl transition hover:scale-105 focus:outline-none focus:ring-4 focus:ring-white/40"
          >
            Start watching
          </button>
        </div>
      )}
      {!adState.playing && !adState.loading && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center gap-5 opacity-0 transition duration-200 group-hover:flex group-hover:opacity-100">
          <button
            type="button"
            onClick={() => seekBy(-10)}
            className="pointer-events-auto grid h-14 w-14 place-items-center rounded-full border border-white/15 bg-black/65 text-white shadow-xl backdrop-blur transition hover:scale-105"
            aria-label="Back 10 seconds"
          >
            <RotateCcw className="h-6 w-6" />
            <span className="text-[10px] font-black">10</span>
          </button>
          <button
            type="button"
            onClick={() => seekBy(10)}
            className="pointer-events-auto grid h-14 w-14 place-items-center rounded-full border border-white/15 bg-black/65 text-white shadow-xl backdrop-blur transition hover:scale-105"
            aria-label="Forward 10 seconds"
          >
            <RotateCw className="h-6 w-6" />
            <span className="text-[10px] font-black">10</span>
          </button>
          <button
            type="button"
            onClick={() => setTheatre((value) => !value)}
            className="pointer-events-auto grid h-14 w-14 place-items-center rounded-full border border-white/15 bg-black/65 text-white shadow-xl backdrop-blur"
            aria-label="Toggle theatre mode"
          >
            <Maximize className="h-6 w-6" />
          </button>
        </div>
      )}
      {(adState.playing || adState.loading) && (
        <div className="absolute inset-1 z-20 flex flex-col justify-between rounded-[1.45rem] bg-gradient-to-b from-black/80 via-black/15 to-black/85 p-4 text-white backdrop-blur-[1px]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400 px-3 py-1 text-xs font-black uppercase tracking-wide text-black">
                <ShieldCheck className="h-3.5 w-3.5" /> Ad
              </span>
              <span className="rounded-full bg-black/70 px-3 py-1 text-xs font-semibold ring-1 ring-white/10">
                {adState.loading
                  ? "Loading sponsored video…"
                  : `Sponsored video ${adState.index} of ${adState.total}`}
              </span>
            </div>
            {adState.clickThrough && (
              <a
                href={adState.clickThrough}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="rounded-full bg-white px-4 py-2 text-xs font-black text-black"
              >
                Visit advertiser
              </a>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-black/75 px-4 py-2 text-xs font-bold ring-1 ring-white/10">
              {adState.loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {adState.loading ? "Preparing ad" : `Content starts after ad • ${adState.remaining}s`}
            </div>
            {adState.skipIn !== undefined && (
              <button
                type="button"
                disabled={adState.skipIn > 0}
                onClick={skipAd}
                className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-black text-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                <SkipForward className="h-3.5 w-3.5" />
                {adState.skipIn > 0 ? `Skip in ${adState.skipIn}` : "Skip ad"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
