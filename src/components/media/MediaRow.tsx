import { Row } from "./Row";
import { MediaCard } from "./MediaCard";
import type { MediaItem } from "@/types/dto";

interface Props {
  title: string;
  subtitle?: string;
  items: MediaItem[];
  aspect?: "poster" | "video";
  numbered?: boolean;
  limit?: number;
}

/** Horizontal, snap-scrolling row of media cards. Sizes scale from phone to TV. */
export function MediaRow({
  title,
  subtitle,
  items,
  aspect = "poster",
  numbered,
  limit = 20,
}: Props) {
  const list = items.slice(0, limit);
  if (list.length === 0) return null;

  const width =
    aspect === "video"
      ? "w-[70vw] max-w-[420px] sm:w-64 md:w-72 lg:w-80 2xl:w-96"
      : "w-[38vw] max-w-[220px] sm:w-40 md:w-44 lg:w-48 2xl:w-56";

  return (
    <Row title={title} subtitle={subtitle}>
      {list.map((m, i) => (
        <div key={`${m.chatId}-${m.id}-${i}`} className={`${width} shrink-0 snap-start`}>
          {numbered ? (
            <div className="relative">
              <span className="pointer-events-none absolute -left-1 top-0 z-10 select-none font-display text-5xl font-black leading-none text-white/15 drop-shadow lg:text-6xl">
                {i + 1}
              </span>
              <MediaCard item={m} aspect={aspect} />
            </div>
          ) : (
            <MediaCard item={m} aspect={aspect} />
          )}
        </div>
      ))}
    </Row>
  );
}
