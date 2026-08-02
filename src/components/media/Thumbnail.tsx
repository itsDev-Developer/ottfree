import { useState } from "react";
import { Film } from "lucide-react";

interface Props {
  src?: string;
  alt: string;
  className?: string;
  aspect?: "video" | "poster" | "square";
  /** Set on above-the-fold imagery so the browser fetches it immediately. */
  priority?: boolean;
  sizes?: string;
}

export function Thumbnail({
  src,
  alt,
  className = "",
  aspect = "video",
  priority = false,
  sizes = "(min-width: 1280px) 16vw, (min-width: 768px) 25vw, 45vw",
}: Props) {
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const ratio =
    aspect === "video" ? "aspect-video" : aspect === "poster" ? "aspect-[2/3]" : "aspect-square";

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-muted ${ratio} ${className}`}>
      {!errored && src ? (
        <img
          src={src}
          alt={alt}
          sizes={sizes}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "low"}
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={`h-full w-full object-cover transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      ) : (
        <div className="gradient-primary flex h-full w-full items-center justify-center opacity-40">
          <Film className="h-10 w-10 text-white/70" />
        </div>
      )}
      {!loaded && !errored && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/8 to-transparent" />
      )}
    </div>
  );
}
