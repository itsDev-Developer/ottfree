import { useState } from "react";
import { Film } from "lucide-react";

interface Props {
  src?: string;
  alt: string;
  className?: string;
  aspect?: "video" | "poster" | "square";
}

export function Thumbnail({ src, alt, className = "", aspect = "video" }: Props) {
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
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={`h-full w-full object-cover transition-all duration-500 ${
            loaded ? "scale-100 opacity-100" : "scale-105 opacity-0"
          }`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center gradient-primary opacity-40">
          <Film className="h-10 w-10 text-white/70" />
        </div>
      )}
      {!loaded && !errored && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/5 to-transparent" />
      )}
    </div>
  );
}
