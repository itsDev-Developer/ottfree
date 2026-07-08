import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { fetchHome } from "@/services/backend";
import { HeroBanner } from "@/components/media/HeroBanner";
import { MediaCard } from "@/components/media/MediaCard";
import { Row } from "@/components/media/Row";
import { Link } from "@tanstack/react-router";
import { Thumbnail } from "@/components/media/Thumbnail";
import { getContinueWatching } from "@/store/continueWatching";
import { useEffect, useState } from "react";
import type { WatchProgress } from "@/store/continueWatching";

const homeOptions = queryOptions({
  queryKey: ["home"],
  queryFn: fetchHome,
  staleTime: 10 * 60 * 1000,
});

export const Route = createFileRoute("/_authenticated/home")({
  loader: ({ context }) => context.queryClient.ensureQueryData(homeOptions),
  component: HomePage,
});

function HomePage() {
  const { data } = useSuspenseQuery(homeOptions);
  const [cw, setCw] = useState<WatchProgress[]>([]);
  useEffect(() => setCw(getContinueWatching()), []);

  const featured = data.featured[0] ?? data.recent[0];

  return (
    <div>
      {featured ? (
        <HeroBanner item={featured} />
      ) : (
        <div className="mx-4 mt-6 md:mx-8">
          <div className="glass rounded-3xl p-10 text-center">
            <h1 className="font-display text-3xl font-bold">Welcome to SurfTG</h1>
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
        <Row title="Telegram Channels" subtitle="Browse your linked sources">
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
        <Row title="Recently Added">
          {data.recent.map((m) => (
            <div key={m.id} className="w-52 shrink-0 snap-start md:w-60">
              <MediaCard item={m} aspect="poster" />
            </div>
          ))}
        </Row>
      )}
    </div>
  );
}
