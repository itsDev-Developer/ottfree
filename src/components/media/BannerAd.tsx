import { useQuery } from "@tanstack/react-query";
import { fetchAdsBySlot } from "@/lib/cloudSettings";
import { X } from "lucide-react";
import { useState } from "react";

interface Props {
  slot: string;
  className?: string;
}

export function BannerAd({ slot, className = "" }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const { data } = useQuery({
    queryKey: ["ads", slot],
    queryFn: () => fetchAdsBySlot(slot),
    staleTime: 5 * 60 * 1000,
  });

  if (dismissed) return null;
  const ad = data?.find((a) => a.image_url);
  if (!ad?.image_url) return null;

  const inner = (
    <img
      src={ad.image_url}
      alt="Sponsored"
      className="h-auto w-full rounded-2xl border border-white/10 object-cover"
    />
  );

  return (
    <div className={`relative mx-4 mt-6 md:mx-8 ${className}`}>
      <span className="absolute left-3 top-3 z-10 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/80">
        Ad
      </span>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss ad"
        className="absolute right-3 top-3 z-10 rounded-full bg-black/70 p-1 text-white/80 hover:bg-black/90 hover:text-white"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      {ad.link_url ? (
        <a href={ad.link_url} target="_blank" rel="noopener noreferrer" className="block">
          {inner}
        </a>
      ) : (
        inner
      )}
    </div>
  );
}
