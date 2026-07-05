import { useEffect, useRef } from "react";
import videojs from "video.js";
import type Player from "video.js/dist/types/player";
import "video.js/dist/video-js.css";

interface Props {
  src: string;
  poster?: string;
  startTime?: number;
  onProgress?: (position: number, duration: number) => void;
}

export function VideoPlayer({ src, poster, startTime = 0, onProgress }: Props) {
  const videoRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<Player | null>(null);

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

    player.on("loadedmetadata", () => {
      if (startTime > 0 && startTime < (player.duration() ?? 0) - 5) {
        player.currentTime(startTime);
      }
    });

    player.on("volumechange", () => {
      localStorage.setItem("surftg:volume", String(player.volume() ?? 1));
    });

    let last = 0;
    player.on("timeupdate", () => {
      const now = Date.now();
      if (now - last > 5000) {
        last = now;
        onProgress?.(player.currentTime() ?? 0, player.duration() ?? 0);
      }
    });

    return () => {
      player.dispose();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return (
    <div data-vjs-player className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
      <div ref={videoRef} />
    </div>
  );
}
