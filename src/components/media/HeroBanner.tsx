import { motion, useReducedMotion } from "framer-motion";
import { Play, Info } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { MediaItem } from "@/types/dto";

interface Props {
  item: MediaItem;
  /** First slide / above the fold — load the artwork eagerly (LCP). */
  priority?: boolean;
}

export function HeroBanner({ item, priority = true }: Props) {
  const reduce = useReducedMotion();
  const to = item.chatId && item.hash ? `/watch/${item.chatId}/${item.id}/${item.hash}` : "/home";

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="relative mx-4 mt-6 overflow-hidden rounded-3xl md:mx-8"
    >
      <div className="relative aspect-[21/9] w-full min-h-[320px] md:min-h-[460px]">
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt=""
            aria-hidden="true"
            sizes="100vw"
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "low"}
            decoding="async"
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="gradient-primary absolute inset-0 opacity-70" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent" />
        <div className="relative flex h-full flex-col justify-end p-6 pb-14 md:p-12 md:pb-16">
          <span className="mb-3 w-fit rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-widest text-foreground/80 backdrop-blur">
            Featured
          </span>
          <h1 className="max-w-2xl font-display text-3xl font-bold leading-tight sm:text-4xl md:text-6xl">
            {item.title}
          </h1>
          {item.channelName && (
            <p className="mt-3 max-w-xl truncate text-sm text-muted-foreground md:text-base">
              From {item.channelName}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to={to as string}
              className="gradient-primary flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-2xl shadow-primary/40 transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Play className="h-4 w-4 fill-white" />
              Watch now
            </Link>
            <Link
              to={to as string}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold backdrop-blur transition hover:bg-white/10"
            >
              <Info className="h-4 w-4" />
              More info
            </Link>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
