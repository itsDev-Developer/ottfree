import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { HeroBanner } from "./HeroBanner";
import type { MediaItem } from "@/types/dto";

interface Props {
  items: MediaItem[];
  intervalMs?: number;
}

export function FeaturedCarousel({ items, intervalMs = 7000 }: Props) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();

  const go = useCallback(
    (dir: 1 | -1) => setIdx((i) => (i + dir + items.length) % items.length),
    [items.length],
  );

  useEffect(() => {
    if (items.length <= 1 || paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), intervalMs);
    return () => clearInterval(t);
  }, [items.length, intervalMs, paused]);

  // Don't burn cycles (or skip slides) while the tab is hidden.
  useEffect(() => {
    const onVis = () => setPaused(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Warm the next slide's artwork so transitions never show an empty frame.
  useEffect(() => {
    const next = items[(idx + 1) % items.length];
    if (!next?.thumbnail) return;
    const img = new Image();
    img.src = next.thumbnail;
  }, [idx, items]);

  if (items.length === 0) return null;
  const current = items[idx % items.length];

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${current.chatId}-${current.id}-${idx}`}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduce ? undefined : { opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <HeroBanner item={current} priority={idx === 0} />
        </motion.div>
      </AnimatePresence>

      {items.length > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            aria-label="Previous featured item"
            className="absolute left-6 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-white/15 bg-black/40 p-2.5 backdrop-blur transition hover:bg-black/60 md:block"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => go(1)}
            aria-label="Next featured item"
            className="absolute right-6 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-white/15 bg-black/40 p-2.5 backdrop-blur transition hover:bg-black/60 md:block"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2 md:bottom-8">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`pointer-events-auto h-1.5 rounded-full transition-all ${
                  i === idx % items.length
                    ? "w-8 bg-foreground"
                    : "w-4 bg-foreground/40 hover:bg-foreground/70"
                }`}
                aria-label={`Show featured item ${i + 1}`}
                aria-current={i === idx % items.length}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
