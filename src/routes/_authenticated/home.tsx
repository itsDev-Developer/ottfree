import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { fetchHome } from "@/services/backend";
import { FeaturedCarousel } from "@/components/media/FeaturedCarousel";
import { MediaCard } from "@/components/media/MediaCard";
import { Row } from "@/components/media/Row";
import { BannerAd } from "@/components/media/BannerAd";
import { Link } from "@tanstack/react-router";
import { Thumbnail } from "@/components/media/Thumbnail";
import { getContinueWatching } from "@/store/continueWatching";
import { useEffect, useRef, useState } from "react";
import type { WatchProgress } from "@/store/continueWatching";

const homeOptions = queryOptions({
  queryKey: ["home"],
  queryFn: fetchHome,
  staleTime: 10 * 60 * 1000,
});

const PAGE_SIZE = 20;

export const Route = createFileRoute("/_authenticated/home")({
  loader: ({ context }) => context.queryClient.ensureQueryData(homeOptions),
  component: HomePage,
});

function HomePage() {
  const { data } = useSuspenseQuery(homeOptions);
  const [cw, setCw] = useState<WatchProgress[]>([]);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setCw(getContinueWatching()), []);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible((v) => Math.min(v + PAGE_SIZE, data.recent.length));
          }
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(sentinelRef.current);
    return () => io.disconnect();
  }, [data.recent.length]);

  const featuredItems = data.featured.length > 0 ? data.featured : data.recent.slice(0, 5);
  const recentVisible = data.recent.slice(0, visible);
  const hasMore = visible < data.recent.length;

  return (
    <div>
      {featuredItems.length > 0 ? (
        <FeaturedCarousel items={featuredItems} />
      ) : (
        <div className="mx-4 mt-6 md:mx-8">
          <div className="glass rounded-3xl p-10 text-center">
            <h1 className="font-display text-3xl font-bold">Welcome to OttFree</h1>
            <p className="mt-2 text-muted-foreground">Your library will appear here.</p>
          </div>
        </div>
      )}

      {cw.length > 0 && (
        <Row title="Continue Watching">
          {cw.map((p) => (
            <div key={`${p.chatId}-${p.messageId}`} className="w-52 shrink-0 snap-start md:w-60">
              <Link
                to="/watch/$chatId/$messageId/$hash"
                params={{ chatId: p.chatId, messageId: p.messageId, hash: p.hash }}
              >
                <div className="relative">
                  <Thumbnail src={p.thumbnail} alt={p.title} aspect="poster" />
                  <div className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-white/20">
                    <div
                      className="gradient-primary h-full"
                      style={{ width: `${Math.min(100, (p.position / (p.duration || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
                <h3 className="mt-3 line-clamp-1 text-sm font-semibold">{p.title}</h3>
              </Link>
            </div>
          ))}
        </Row>
      )}

      {data.channels.length > 0 && (
        <Row title="OTT Sources" subtitle="Browse your linked libraries">
          {data.channels.map((c) => (
            <Link
              key={c.id}
              to="/channel/$channelId"
              params={{ channelId: c.id }}
              className="w-48 shrink-0 snap-start"
            >
              <Thumbnail src={c.thumbnail} alt={c.name} aspect="square" />
              <h3 className="mt-3 line-clamp-1 text-sm font-semibold">{c.name}</h3>
            </Link>
          ))}
        </Row>
      )}

      {data.folders.length > 0 && (
        <Row title="Folders" subtitle="Curated collections">
          {data.folders.map((f) => (
            <Link
              key={f.id}
              to="/folder/$folderId"
              params={{ folderId: f.id }}
              className="w-56 shrink-0 snap-start"
            >
              <Thumbnail src={f.thumbnail} alt={f.name} aspect="video" />
              <h3 className="mt-3 line-clamp-1 text-sm font-semibold">{f.name}</h3>
            </Link>
          ))}
        </Row>
      )}

      {data.recent.length > 0 && (
        <section className="mt-10 px-4 md:px-8">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold md:text-3xl">Recently Added</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Fresh across your OTT sources
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              {recentVisible.length} of {data.recent.length}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {recentVisible.map((m, i) => (
              <MediaCard key={`${m.chatId}-${m.id}-${i}`} item={m} aspect="poster" />
            ))}
          </div>
          {hasMore && (
            <div ref={sentinelRef} className="mt-8 flex justify-center py-6">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-primary" />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
