import { createFileRoute } from "@tanstack/react-router";

const MAX_VAST_RESPONSE_BYTES = 2 * 1024 * 1024;

function isAllowedVastUrl(value: string | null): value is string {
  if (!value) return false;

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;

    const host = url.hostname.toLowerCase();
    // This endpoint exists to work around browser CORS restrictions on ad
    // servers. Do not turn it into a route to local worker infrastructure.
    return !(
      host === "localhost" ||
      host === "::1" ||
      host.endsWith(".localhost") ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    );
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/vast")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const target = new URL(request.url).searchParams.get("url");
        if (!isAllowedVastUrl(target)) return new Response("Invalid VAST URL", { status: 400 });

        const upstream = await fetch(target, {
          headers: { Accept: "application/xml,text/xml;q=0.9,*/*;q=0.1" },
          redirect: "follow",
        });
        if (!upstream.ok) return new Response("Unable to load VAST", { status: upstream.status });

        const body = await upstream.text();
        if (body.length > MAX_VAST_RESPONSE_BYTES) {
          return new Response("VAST response is too large", { status: 413 });
        }

        return new Response(body, {
          headers: {
            "cache-control": "no-store",
            "content-type": "application/xml; charset=utf-8",
          },
        });
      },
    },
  },
});
