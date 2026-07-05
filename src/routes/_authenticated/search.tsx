import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search as SearchIcon, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchHome, searchChannel } from "@/services/backend";
import { MediaCard } from "@/components/media/MediaCard";
import { getRecentSearches, pushRecentSearch } from "@/store/continueWatching";
import type { MediaItem } from "@/types/dto";

export const Route = createFileRoute("/_authenticated/search")({
  component: SearchPage,
});

function useDebounced<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function SearchPage() {
  const [term, setTerm] = useState("");
  const q = useDebounced(term, 300);
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => setRecent(getRecentSearches()), [q]);

  const home = useQuery({ queryKey: ["home"], queryFn: fetchHome, staleTime: 10 * 60 * 1000 });
  const channels = home.data?.channels ?? [];

  const results = useQuery({
    queryKey: ["global-search", q, channels.map((c) => c.id).join(",")],
    queryFn: async () => {
      if (!q || channels.length === 0) return [] as MediaItem[];
      pushRecentSearch(q);
      const perChannel = await Promise.all(
        channels.slice(0, 5).map((c) =>
          searchChannel(c.id, q, 1)
            .then((r) => r.items.map((i) => ({ ...i, chatId: i.chatId ?? c.id, channelName: c.name })))
            .catch(() => [] as MediaItem[]),
        ),
      );
      return perChannel.flat();
    },
    enabled: !!q,
    staleTime: 60 * 1000,
  });

  const popular = useMemo(
    () => ["movies", "series", "anime", "documentary", "hd", "2024"],
    [],
  );

  return (
    <div className="px-4 py-8 md:px-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-4xl font-bold md:text-5xl">
          Find something <span className="text-gradient">to watch</span>
        </h1>
        <div className="glass mt-6 flex items-center gap-3 rounded-2xl px-4 py-3">
          <SearchIcon className="h-5 w-5 text-muted-foreground" />
          <input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Titles, keywords, channels…"
            className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          {term && (
            <button onClick={() => setTerm("")} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {!q && (
          <div className="mt-8 space-y-6">
            {recent.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent</h2>
                <div className="flex flex-wrap gap-2">
                  {recent.map((r) => (
                    <button
                      key={r}
                      onClick={() => setTerm(r)}
                      className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm hover:bg-white/10"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Popular</h2>
              <div className="flex flex-wrap gap-2">
                {popular.map((r) => (
                  <button
                    key={r}
                    onClick={() => setTerm(r)}
                    className="gradient-primary rounded-full px-4 py-1.5 text-sm font-medium text-white shadow-md shadow-primary/30"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {q && (
        <div className="mt-10">
          <p className="mb-4 text-sm text-muted-foreground">
            {results.isLoading ? "Searching…" : `${results.data?.length ?? 0} results for "${q}"`}
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {(results.data ?? []).map((m, i) => (
              <MediaCard key={`${m.id}-${i}`} item={m} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
