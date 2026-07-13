import { useQuery } from "@tanstack/react-query";
import { fetchAdsBySlot, type AdRow } from "@/lib/cloudSettings";
import { useMemo } from "react";

interface Props {
  slot: string;
  className?: string;
}

export function BannerAd({ slot, className = "" }: Props) {
  const { data } = useQuery({
    queryKey: ["ads", slot],
    queryFn: () => fetchAdsBySlot(slot),
    staleTime: 5 * 60 * 1000,
  });

  // Render every enabled display ad for the slot. Do not provide a dismiss
  // control: paid placements should remain visible to viewers.
  const ads = (data ?? []).filter(
    (a) => a.enabled !== false && (a.script_code || a.image_url || a.link_url),
  );
  if (ads.length === 0) return null;

  return (
    <section
      className={`mx-4 mt-6 flex flex-col gap-4 md:mx-8 ${className}`}
      aria-label="Sponsored ads"
    >
      {ads.map((ad, i) => (
        <div
          key={ad.id ?? `${slot}-${i}`}
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/20 shadow-lg shadow-black/20"
        >
          <span className="absolute left-3 top-3 z-10 rounded-md bg-black/75 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/80">
            Ad
          </span>
          {ad.script_code ? (
            <ScriptAd ad={ad} />
          ) : ad.image_url ? (
            <ImageAd ad={ad} />
          ) : (
            <LinkAd ad={ad} />
          )}
        </div>
      ))}
    </section>
  );
}

function ImageAd({ ad }: { ad: AdRow }) {
  if (!ad.image_url) return null;
  const img = (
    <img
      src={ad.image_url}
      alt={ad.label ?? "Sponsored"}
      className="h-auto min-h-[90px] w-full object-cover"
    />
  );
  return ad.link_url ? (
    <a href={ad.link_url} target="_blank" rel="noopener noreferrer sponsored" className="block">
      {img}
    </a>
  ) : (
    img
  );
}

function LinkAd({ ad }: { ad: AdRow }) {
  if (!ad.link_url) return null;
  return (
    <a
      href={ad.link_url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="flex min-h-[90px] w-full items-center justify-center p-4 text-center text-sm font-semibold text-white/90 transition hover:bg-white/5"
    >
      {ad.label ?? "Sponsored"}
    </a>
  );
}

/**
 * Renders network HTML/JS in an iframe so external ad tags can use their normal
 * document.write lifecycle without being made inert by React or blocked by the
 * parent document. This keeps the host page stable while still loading every
 * configured banner/script placement.
 */
function ScriptAd({ ad }: { ad: AdRow }) {
  const srcDoc = useMemo(() => {
    const code = ad.script_code ?? "";
    return `<!doctype html><html><head><base target="_blank"><style>html,body{margin:0;padding:0;background:transparent;min-height:90px;display:flex;align-items:center;justify-content:center;overflow:hidden}a,img,iframe{max-width:100%}</style></head><body>${code}</body></html>`;
  }, [ad.script_code]);

  return (
    <iframe
      title={ad.label ?? "Sponsored ad"}
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-same-origin"
      referrerPolicy="no-referrer-when-downgrade"
      className="block min-h-[110px] w-full bg-transparent"
      loading="lazy"
    />
  );
}
