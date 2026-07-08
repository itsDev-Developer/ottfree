import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { Thumbnail } from "./Thumbnail";
import type { MediaItem } from "@/types/dto";

interface Props {
  item: MediaItem;
  aspect?: "video" | "poster";
}

export function MediaCard({ item, aspect = "poster" }: Props) {
  const to =
    item.chatId && item.hash
      ? `/watch/${item.chatId}/${item.id}/${item.hash}`
      : item.chatId
        ? `/channel/${item.chatId}`
        : "#";

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.03 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="group"
    >
      <Link to={to as string} className="block">
        <div className="relative">
          <Thumbnail src={item.thumbnail} alt={item.title} aspect={aspect} />
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
            <div className="gradient-primary flex h-14 w-14 items-center justify-center rounded-full shadow-2xl shadow-primary/50">
              <Play className="ml-0.5 h-6 w-6 fill-white text-white" />
            </div>
          </div>
          {item.duration && (
            <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-0.5 text-xs font-medium backdrop-blur">
              {item.duration}
            </span>
          )}
        </div>
        <div className="mt-3 space-y-1">
          <h3 className="line-clamp-1 text-sm font-semibold text-foreground/95">{item.title}</h3>
          {item.channelName && (
            <p className="line-clamp-1 text-xs text-muted-foreground">{item.channelName}</p>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
