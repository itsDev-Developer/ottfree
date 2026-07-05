import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function Row({ title, subtitle, action, children }: Props) {
  return (
    <section className="mt-10 px-4 md:px-8">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold md:text-3xl">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </section>
  );
}
