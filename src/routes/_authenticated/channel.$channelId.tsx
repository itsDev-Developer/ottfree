import { createFileRoute, useSearch, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchChannel, searchChannel } from "@/services/backend";
import { MediaCard } from "@/components/media/MediaCard";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/channel/$channelId")({
  validateSearch: (s: Record<string, unknown>) => ({
    page: Number(s.page) || 1,
    q: typeof s.q === "string" ? s.q : "",
  }),
  component: ChannelPage,
});

function ChannelPage() {
  const { channelId } = Route.useParams();
  const { page, q } = useSearch({ from: "/_authenticated/channel/$channelId" });
  const nav = useNavigate({ from: "/_authenticated/channel/$channelId" });
  const [term, setTerm] = useState(q);

  const query = useQuery({
    queryKey: q ? ["channel-search", channelId, q, page] : [`channel-${channelId}-page-${page}`],
    queryFn: () => (q ? searchChannel(channelId, q, page) : fetchChannel(channelId, page)),
    staleTime: page === 1 ? 10 * 60 * 1000 : 60 * 1000,
    placeholderData: keepPreviousData,
    refetchOnMount: "always",
  });

  const items = query.data?.items ?? [];

  return (
    <div className="px-4 py-6 md:px-8">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link
          to="/home"
          className="rounded-full border border-white/10 bg-white/5 p-2 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-display text-3xl font-bold md:text-4xl">Channel {channelId}</h1>
          <p className="text-sm text-muted-foreground">Browse and stream</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            nav({ search: { q: term, page: 1 } });
          }}
          className="ml-auto flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2"
        >
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search in channel…"
            className="w-56 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </form>
      </div>


      {query.isLoading ? (
        <SkeletonGrid />
      ) : items.length === 0 ? (
        <div className="glass mt-10 rounded-3xl p-12 text-center">
          <p className="text-muted-foreground">No media found for this view.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((m) => (
            <MediaCard key={m.id} item={{ ...m, chatId: m.chatId ?? channelId }} aspect="poster" />
          ))}
        </div>
      )}

      <div className="mt-10 flex items-center justify-center gap-3">
        <button
          disabled={page <= 1}
          onClick={() => nav({ search: ((p: { page: number; q: string }) => ({ ...p, page: page - 1 })) })}
          className="rounded-full border border-white/10 bg-white/5 p-2 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm text-muted-foreground">Page {page}</span>
        <button
          disabled={!query.data?.hasMore}
          onClick={() => nav({ search: ((p: { page: number; q: string }) => ({ ...p, page: page + 1 })) })}
          className="rounded-full border border-white/10 bg-white/5 p-2 disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="aspect-[2/3] animate-pulse rounded-2xl bg-white/5" />
      ))}
    </div>
  );
}
