import { createFileRoute } from "@tanstack/react-router";

const BACKEND = "https://varying-orsa-komi106-7ef913ad.koyeb.app";

// Hop-by-hop headers that should not be forwarded
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

async function proxy(request: Request, splat: string): Promise<Response> {
  const url = new URL(request.url);
  const target = `${BACKEND}/${splat}${url.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });
  headers.set("host", new URL(BACKEND).host);

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
    // @ts-expect-error cloudflare worker option
    duplex: "half",
  };
  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = request.body;
  }

  const upstream = await fetch(target, init);

  const respHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (HOP_BY_HOP.has(k)) return;
    if (k === "set-cookie") {
      const rewritten = value
        .replace(/;\s*Domain=[^;]+/gi, "")
        .replace(/;\s*Secure/gi, "");
      respHeaders.append("set-cookie", rewritten);
      return;
    }
    // Keep redirects within the proxy so the browser doesn't leave for the SPA
    if (k === "location" && value.startsWith("/") && !value.startsWith("/api/proxy/")) {
      respHeaders.set(key, `/api/proxy${value}`);
      return;
    }
    respHeaders.set(key, value);
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}

const handler = async ({ request, params }: { request: Request; params: { _splat?: string } }) => {
  return proxy(request, params._splat ?? "");
};

export const Route = createFileRoute("/api/proxy/$")({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
      PUT: handler,
      DELETE: handler,
      PATCH: handler,
      HEAD: handler,
      OPTIONS: handler,
    },
  },
});
