import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HeroBanner } from "./HeroBanner";
import type { MediaItem } from "@/types/dto";

interface Props {
  items: MediaItem[];
  intervalMs?: number;
}

export function FeaturedCarousel({ items, intervalMs = 7000 }: Props) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), intervalMs);
    return () => clearInterval(t);
  }, [items.length, intervalMs]);

  if (items.length === 0) return null;
  const current = items[idx % items.length];

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${current.chatId}-${current.id}-${idx}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <HeroBanner item={current} />
        </motion.div>
      </AnimatePresence>
      {items.length > 1 && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2 md:bottom-8">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`pointer-events-auto h-1.5 rounded-full transition-all ${
                i === idx % items.length ? "w-8 bg-white" : "w-4 bg-white/40 hover:bg-white/70"
              }`}
              aria-label={`Show featured item ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
