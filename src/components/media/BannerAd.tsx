import { useQuery } from "@tanstack/react-query";
import { fetchAdsBySlot, type AdRow } from "@/lib/cloudSettings";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
  const ad = data?.find((a) => a.script_code || a.image_url);
  if (!ad) return null;

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
      {ad.script_code ? (
        <ScriptAd ad={ad} />
      ) : (
        <ImageAd ad={ad} />
      )}
    </div>
  );
}

function ImageAd({ ad }: { ad: AdRow }) {
  if (!ad.image_url) return null;
  const img = (
    <img
      src={ad.image_url}
      alt={ad.label ?? "Sponsored"}
      className="h-auto w-full rounded-2xl border border-white/10 object-cover"
    />
  );
  return ad.link_url ? (
    <a href={ad.link_url} target="_blank" rel="noopener noreferrer sponsored" className="block">
      {img}
    </a>
  ) : img;
}

/**
 * Renders arbitrary <script>/HTML snippets from ad networks such as
 * Adsterra, Hilltopads, PropellerAds. Scripts injected via innerHTML are
 * inert, so we re-create each <script> node so the browser actually
 * evaluates it. This is scoped to admin-provided content only.
 */
function ScriptAd({ ad }: { ad: AdRow }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host || !ad.script_code) return;
    host.innerHTML = "";
    const tpl = document.createElement("template");
    tpl.innerHTML = ad.script_code;
    const frag = tpl.content;
    // Re-create scripts so they execute.
    frag.querySelectorAll("script").forEach((old) => {
      const s = document.createElement("script");
      for (const { name, value } of Array.from(old.attributes)) s.setAttribute(name, value);
      if (old.textContent) s.textContent = old.textContent;
      old.replaceWith(s);
    });
    host.appendChild(frag);
    return () => { host.innerHTML = ""; };
  }, [ad.script_code]);

  return (
    <div
      ref={ref}
      className="min-h-[90px] w-full overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-2"
    />
  );
}
