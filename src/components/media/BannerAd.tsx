import { useQuery } from "@tanstack/react-query";
import { fetchAdsBySlot, type AdRow } from "@/lib/cloudSettings";
import { trackAdEvent } from "@/store/analytics";
import { useEffect, useRef } from "react";

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

  // Render every enabled ad that has SOMETHING renderable: a script,
  // an image, or a bare link (some networks use text-only referral links).
  const ads = (data ?? []).filter(
    (a) => a.enabled !== false && (a.script_code || a.image_url || a.link_url),
  );
  if (ads.length === 0) return null;

  return (
    <div
      className={`mx-auto flex w-full max-w-5xl flex-col items-center gap-4 px-4 py-6 md:px-8 ${className}`}
    >
      {ads.map((ad, i) => (
        <AdFrame key={ad.id ?? `${slot}-${i}`} ad={ad} slot={slot}>
          {ad.script_code ? (
            <ScriptAd ad={ad} />
          ) : ad.image_url ? (
            <ImageAd ad={ad} slot={slot} />
          ) : ad.link_url ? (
            <LinkAd ad={ad} slot={slot} />
          ) : null}
        </AdFrame>
      ))}
    </div>
  );
}


/** Wrapper that centers the creative and records one impression when it becomes visible. */
function AdFrame({
  ad,
  slot,
  children,
}: {
  ad: AdRow;
  slot: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const seen = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !seen.current) {
            seen.current = true;
            trackAdEvent({
              kind: "impression",
              slot,
              network: ad.network ?? "unknown",
              adId: ad.id ?? `${slot}`,
              label: ad.label ?? undefined,
            });
            io.disconnect();
          }
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ad.id, ad.network, ad.label, slot]);

  return (
    <div ref={ref} className="relative flex w-full justify-center">
      <div className="relative w-full max-w-[970px]">
        <span className="absolute left-3 top-3 z-10 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/80">
          Ad
        </span>

        {children}
      </div>
    </div>
  );
}

function recordClick(ad: AdRow, slot: string) {
  trackAdEvent({
    kind: "click",
    slot,
    network: ad.network ?? "unknown",
    adId: ad.id ?? slot,
    label: ad.label ?? undefined,
  });
}

function ImageAd({ ad, slot }: { ad: AdRow; slot: string }) {
  if (!ad.image_url) return null;
  const img = (
    <img
      src={ad.image_url}
      alt={ad.label ?? "Sponsored"}
      loading="lazy"
      className="mx-auto h-auto w-full rounded-2xl border border-white/10 object-contain"
    />
  );
  return ad.link_url ? (
    <a
      href={ad.link_url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={() => recordClick(ad, slot)}
      className="block"
    >
      {img}
    </a>
  ) : (
    img
  );
}

function LinkAd({ ad, slot }: { ad: AdRow; slot: string }) {
  if (!ad.link_url) return null;
  return (
    <a
      href={ad.link_url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={() => recordClick(ad, slot)}
      className="flex min-h-[90px] w-full items-center justify-center rounded-2xl border border-white/10 bg-black/20 p-4 text-center text-sm font-medium text-white/90 transition hover:bg-black/30"
    >
      {ad.label ?? "Sponsored"}
    </a>
  );
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
    return () => {
      host.innerHTML = "";
    };
  }, [ad.script_code]);

  return (
    <div
      ref={ref}
      className="flex min-h-[90px] w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-2 [&_iframe]:mx-auto [&_img]:mx-auto"
    />
  );
}
