import { createFileRoute, useSearch, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchFolder, searchFolder } from "@/services/backend";
import { MediaCard } from "@/components/media/MediaCard";
import { Thumbnail } from "@/components/media/Thumbnail";
import { ChevronLeft, ChevronRight, Folder as FolderIcon } from "lucide-react";
import type { Folder as FolderT } from "@/types/dto";

export const Route = createFileRoute("/_authenticated/folder/$folderId")({
  validateSearch: (s: Record<string, unknown>) => ({
    page: Number(s.page) || 1,
    q: typeof s.q === "string" ? s.q : "",
  }),
  component: FolderPage,
});

function isFolder(x: unknown): x is FolderT {
  return !!x && typeof x === "object" && !("kind" in (x as object));
}

function FolderPage() {
  const { folderId } = Route.useParams();
  const { page, q } = useSearch({ from: "/_authenticated/folder/$folderId" });
  const nav = useNavigate({ from: "/_authenticated/folder/$folderId" });

  const query = useQuery({
    queryKey: q ? ["folder-search", folderId, q, page] : [`folder-${folderId}-page-${page}`],
    queryFn: () => (q ? searchFolder(folderId, q, page) : fetchFolder(folderId, page)),
    staleTime: page === 1 ? 10 * 60 * 1000 : 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const items = query.data?.items ?? [];

  return (
    <div className="px-4 py-6 md:px-8">
      <div className="mb-6 flex items-center gap-3">
        <Link to="/home" className="rounded-full border border-white/10 bg-white/5 p-2">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <FolderIcon className="h-5 w-5 text-primary" />
        <h1 className="font-display text-3xl font-bold">Folder</h1>
        <span className="text-sm text-muted-foreground">/ {folderId}</span>
      </div>

      {query.isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center text-muted-foreground">Empty folder.</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((it, i) =>
            isFolder(it) ? (
              <Link
                key={`f-${it.id}-${i}`}
                to="/folder/$folderId"
                params={{ folderId: it.id }}
                className="block"
              >
                <Thumbnail src={it.thumbnail} alt={it.name} aspect="video" />
                <h3 className="mt-3 line-clamp-1 flex items-center gap-1.5 text-sm font-semibold">
                  <FolderIcon className="h-3.5 w-3.5 text-primary" />
                  {it.name}
                </h3>
              </Link>
            ) : (
              <MediaCard key={`m-${it.id}-${i}`} item={it} />
            ),
          )}
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
