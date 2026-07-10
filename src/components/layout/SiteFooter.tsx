import { useQuery } from "@tanstack/react-query";
import { fetchSiteSettings } from "@/lib/cloudSettings";

export function SiteFooter() {
  const { data } = useQuery({
    queryKey: ["site-settings"],
    queryFn: fetchSiteSettings,
    staleTime: 5 * 60 * 1000,
  });

  const siteName = data?.site_name || "OttFree";
  const footerText = data?.footer_text;
  const footerHtml = data?.footer_html;
  const socials = data?.social_links ?? [];

  return (
    <footer className="mt-16 border-t border-white/10 bg-black/30 px-4 py-10 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-display text-lg font-bold">{siteName}</p>
          {footerText && (
            <p className="mt-1 text-sm text-muted-foreground">{footerText}</p>
          )}
        </div>
        {socials.length > 0 && (
          <ul className="flex flex-wrap gap-3 text-sm">
            {socials.map((s, i) => (
              <li key={i}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-muted-foreground hover:text-foreground"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
      {footerHtml && (
        <div
          className="mx-auto mt-6 max-w-6xl text-xs text-muted-foreground [&_a]:text-primary"
          // Admin-provided HTML.
          dangerouslySetInnerHTML={{ __html: footerHtml }}
        />
      )}
      <p className="mx-auto mt-6 max-w-6xl text-xs text-muted-foreground/70">
        © {new Date().getFullYear()} {siteName}. All rights reserved.
      </p>
    </footer>
  );
}
