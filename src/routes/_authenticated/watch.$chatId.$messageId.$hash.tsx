import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { fetchWatch } from "@/services/backend";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { MediaCard } from "@/components/media/MediaCard";
import { BannerAd } from "@/components/media/BannerAd";
import { findProgress, saveProgress } from "@/store/continueWatching";
import { trackPlay } from "@/store/analytics";
import { fetchAdsBySlot } from "@/lib/cloudSettings";
import { toast } from "sonner";
import { Share2, Download, Link as LinkIcon, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/watch/$chatId/$messageId/$hash")({
  component: WatchPage,
});

function WatchPage() {
  const { chatId, messageId, hash } = Route.useParams();

  const query = useQuery({
    queryKey: ["watch", chatId, messageId, hash],
    queryFn: () => fetchWatch(chatId, messageId, hash),
    staleTime: 5 * 60 * 1000,
  });

  const preroll = useQuery({
    queryKey: ["ads", "preroll"],
    queryFn: () => fetchAdsBySlot("preroll"),
    staleTime: 5 * 60 * 1000,
  });
  const vastTagUrl = preroll.data?.find((a) => a.vast_tag_url)?.vast_tag_url ?? undefined;

  const title = query.data?.title;
  useEffect(() => {
    if (title) trackPlay({ chatId, messageId, title });
  }, [chatId, messageId, title]);

  if (query.isLoading || !query.data) {
    return (
      <div className="px-4 py-6 md:px-8">
        <div className="aspect-video w-full animate-pulse rounded-2xl bg-white/5" />
        <div className="mt-6 h-8 w-2/3 animate-pulse rounded-full bg-white/5" />
      </div>
    );
  }

  const w = query.data;
  const progress = findProgress(chatId, messageId);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: w.title, url: window.location.href });
      } catch {}
    } else copyLink();
  };

  return (
    <div className="px-4 py-6 md:px-8">
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/home" className="hover:text-foreground">Home</Link>
        <ChevronLeft className="h-3 w-3 rotate-180" />
        <Link to="/channel/$channelId" params={{ channelId: chatId }} className="hover:text-foreground">
          OTT {chatId}
        </Link>
        <ChevronLeft className="h-3 w-3 rotate-180" />
        <span className="line-clamp-1 text-foreground">{w.title}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <VideoPlayer
            src={w.streamUrl}
            poster={w.thumbnail}
            startTime={progress?.position ?? 0}
            vastTagUrl={vastTagUrl}
            onProgress={(position, duration) =>
              saveProgress({
                chatId,
                messageId,
                hash,
                title: w.title,
                thumbnail: w.thumbnail,
                position,
                duration,
                updatedAt: Date.now(),
              })
            }
          />

          <BannerAd slot="watch_banner" className="!mx-0 mt-4" />

          <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold md:text-3xl">{w.title}</h1>
              {w.channelName && (
                <p className="mt-1 text-sm text-muted-foreground">{w.channelName}</p>
              )}
            </div>
            <div className="flex gap-2">
              <a
                href={w.streamUrl}
                download
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
              >
                <Download className="h-4 w-4" /> Download
              </a>
              <button
                onClick={share}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
              >
                <Share2 className="h-4 w-4" /> Share
              </button>
              <button
                onClick={copyLink}
                className="rounded-full border border-white/10 bg-white/5 p-2 hover:bg-white/10"
                aria-label="Copy link"
              >
                <LinkIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="glass mt-6 grid grid-cols-2 gap-4 rounded-2xl p-5 sm:grid-cols-4">
            <Info label="File" value={w.filename} />
            <Info label="Size" value={w.size ?? "—"} />
            <Info label="Resolution" value={w.resolution ?? "—"} />
            <Info label="OTT" value={w.channelName ?? chatId} />
          </div>
        </div>

        <aside className="space-y-4">
          <h2 className="font-display text-lg font-bold">More from this channel</h2>
          <div className="space-y-3">
            {w.related.slice(0, 8).map((m, i) => (
              <MediaCard key={`${m.id}-${i}`} item={{ ...m, chatId: m.chatId ?? chatId }} />
            ))}
            {w.related.length === 0 && (
              <p className="text-sm text-muted-foreground">No related items.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 line-clamp-1 text-sm font-medium">{value}</p>
    </div>
  );
}
