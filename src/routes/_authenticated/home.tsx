import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { fetchHome } from "@/services/backend";
import { FeaturedCarousel } from "@/components/media/FeaturedCarousel";
import { MediaCard } from "@/components/media/MediaCard";
import { MediaRow } from "@/components/media/MediaRow";
import { Row } from "@/components/media/Row";
import { BannerAd } from "@/components/media/BannerAd";
import { Link } from "@tanstack/react-router";
import { Thumbnail } from "@/components/media/Thumbnail";
import { GridSkeleton, HomeSkeleton } from "@/components/media/Skeletons";
import { getContinueWatching } from "@/store/continueWatching";
import { useEffect, useMemo, useRef, useState } from "react";
import type { WatchProgress } from "@/store/continueWatching";
import type { MediaItem } from "@/types/dto";

const homeOptions = queryOptions({
  queryKey: ["home"],
  queryFn: fetchHome,
  staleTime: 10 * 60 * 1000,
});

const PAGE_SIZE = 20;

export const Route = createFileRoute("/_authenticated/home")({
  loader: ({ context }) => context.queryClient.ensureQueryData(homeOptions),
  head: ({ loaderData }) => {
    const channels = loaderData?.channels ?? [];
    const names = channels
      .slice(0, 4)
      .map((c) => c.name)
      .filter(Boolean);
    const title = "Watch Free Movies, Series & Live OTT Streams — SurfTG";
    const description = names.length
      ? `Stream ${channels.length}+ OTT sources including ${names.join(", ")}. Instant playback of movies, series and more — no downloads required.`
      : "Stream movies, series and live OTT channels instantly in your browser with SurfTG.";
    const image = loaderData?.featured?.find((f) => f.thumbnail?.startsWith("http"))?.thumbnail;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: "https://ottfree.in/home" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(image
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: "https://ottfree.in/home" }],
    };
  },
  pendingComponent: HomeSkeleton,
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

  const sections = useMemo(() => {
    const all = data.recent;
    const isSeries = (m: MediaItem) =>
      /(^|[^a-z])s\d{1,2}\s?[.\-_ ]?e\d{1,3}([^a-z]|$)|season\s?\d|episode\s?\d|\bep\.?\s?\d{1,3}\b/i.test(
        m.title,
      );
    const isAnime = (m: MediaItem) => /anime|\[(sub|dub)\]|\bsubbed\b|\bdubbed\b/i.test(m.title);
    const is4k = (m: MediaItem) => /\b(4k|2160p|uhd)\b/i.test(m.title);
    const isHd = (m: MediaItem) => /\b(1080p|1440p|bluray|web-?dl)\b/i.test(m.title);

    const series = all.filter(isSeries);
    const anime = all.filter((m) => isAnime(m) && !isSeries(m));
    const movies = all.filter((m) => !isSeries(m) && !isAnime(m));
    const uhd = all.filter(is4k);
    const hd = all.filter((m) => !is4k(m) && isHd(m));
    const trending = [...all]
      .slice(0, 40)
      .filter((m) => !!m.thumbnail)
      .slice(0, 10);

    const bySource = data.channels
      .slice(0, 6)
      .map((c) => ({ channel: c, items: all.filter((m) => m.channelName === c.name) }))
      .filter((s) => s.items.length >= 4);

    return { trending, movies, series, anime, uhd, hd, bySource };
  }, [data.recent, data.channels]);

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

      <BannerAd slot="home_top" />

      {cw.length > 0 && (
        <Row title="Continue Watching" subtitle="Pick up where you left off">
          {cw.map((p) => (
            <div
              key={`${p.chatId}-${p.messageId}`}
              className="w-[38vw] max-w-[220px] shrink-0 snap-start sm:w-40 md:w-44 lg:w-48 2xl:w-56"
            >
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

      <MediaRow
        title="Trending Now"
        subtitle="Most watched across your sources"
        items={sections.trending}
        numbered
        limit={10}
      />

      {data.channels.length > 0 && (
        <Row title="OTT Sources" subtitle="Browse your linked libraries">
          {data.channels.map((c) => (
            <Link
              key={c.id}
              to="/channel/$channelId"
              params={{ channelId: c.id }}
              className="w-[34vw] max-w-[200px] shrink-0 snap-start sm:w-36 md:w-40 lg:w-44 2xl:w-52"
            >
              <Thumbnail src={c.thumbnail} alt={c.name} aspect="square" />
              <h3 className="mt-3 line-clamp-1 text-sm font-semibold">{c.name}</h3>
            </Link>
          ))}
        </Row>
      )}

      <MediaRow title="Movies" subtitle="Feature-length picks" items={sections.movies} />
      <MediaRow title="Series & Episodes" subtitle="Binge-ready titles" items={sections.series} />

      <BannerAd slot="home_mid" />

      <MediaRow title="Anime" subtitle="Subbed & dubbed" items={sections.anime} />
      <MediaRow title="4K & Ultra HD" subtitle="Highest quality available" items={sections.uhd} />
      <MediaRow title="HD Picks" subtitle="1080p and above" items={sections.hd} />


      {data.folders.length > 0 && (
        <Row title="Folders" subtitle="Curated collections">
          {data.folders.map((f) => (
            <Link
              key={f.id}
              to="/folder/$folderId"
              params={{ folderId: f.id }}
              className="w-[70vw] max-w-[420px] shrink-0 snap-start sm:w-64 md:w-72 lg:w-80 2xl:w-96"
            >
              <Thumbnail src={f.thumbnail} alt={f.name} aspect="video" />
              <h3 className="mt-3 line-clamp-1 text-sm font-semibold">{f.name}</h3>
            </Link>
          ))}
        </Row>
      )}

      {sections.bySource.map((s) => (
        <MediaRow
          key={s.channel.id}
          title={s.channel.name}
          subtitle="From this OTT source"
          items={s.items}
        />
      ))}

      <BannerAd slot="home_bottom" />


      {data.recent.length > 0 && (
        <section className="mt-10 px-4 md:px-8">
          <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
            <div className="min-w-0">
              <h2 className="font-display text-2xl font-bold md:text-3xl">Recently Added</h2>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                Fresh across your OTT sources
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {recentVisible.length} of {data.recent.length}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
            {recentVisible.map((m, i) => (
              <MediaCard key={`${m.chatId}-${m.id}-${i}`} item={m} aspect="poster" />
            ))}
          </div>
          {hasMore && (
            <div ref={sentinelRef} className="mt-8">
              <GridSkeleton count={6} />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
