export function CardSkeleton({ aspect = "poster" }: { aspect?: "poster" | "video" | "square" }) {
  const ratio =
    aspect === "poster" ? "aspect-[2/3]" : aspect === "video" ? "aspect-video" : "aspect-square";
  return (
    <div className="animate-pulse">
      <div className={`w-full rounded-2xl bg-white/5 ${ratio}`} />
      <div className="mt-3 h-3 w-4/5 rounded bg-white/5" />
      <div className="mt-2 h-3 w-2/5 rounded bg-white/5" />
    </div>
  );
}

export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <div>
      <div className="mx-4 mt-6 aspect-[21/9] min-h-[360px] animate-pulse rounded-3xl bg-white/5 md:mx-8 md:min-h-[460px]" />
      <section className="mt-10 px-4 md:px-8">
        <div className="mb-4 h-7 w-52 animate-pulse rounded bg-white/5" />
        <GridSkeleton count={12} />
      </section>
    </div>
  );
}
