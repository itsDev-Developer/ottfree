# Surf-TG Frontend — Polished Core Build

Premium OTT-style streaming UI (Netflix/Plex/Stremio vibe) wired to the Surf-TG backend at `https://varying-orsa-komi106-7ef913ad.koyeb.app`. First pass focuses on a fully polished core; admin panel and advanced extras are deferred to a follow-up.

## Scope (this pass)

Included: design system, auth + protected routes, Home, Channel, Folder, Search, Watch (Video.js), same-origin proxy, caching, mobile nav.
Deferred: Admin dashboard/CRUD, favorites, offline sync, subtitles, download manager, PiP auto-next, charts.

## Architecture

- Router: TanStack Router (file-based, template default). No React Router DOM.
- Data: TanStack Query with `channel-{id}-page-1` stale-while-revalidate cache (10 min stale, background refresh, localStorage persistence via `@tanstack/query-sync-storage-persister`).
- HTTP: Axios instance with `withCredentials: true`, response interceptor that redirects to `/login` on 401/redirect.
- Proxy: TanStack server routes at `src/routes/api/proxy/$.ts` forward every request to the Koyeb backend, relaying cookies both ways so the browser sees same-origin. This sidesteps CORS + third-party cookie blocks. Streaming endpoint proxied with `Range` header pass-through and streamed `Response` body.
- Adapter layer: `src/services/adapters/*` normalizes backend responses (HTML today, JSON later) into typed DTOs. UI only ever sees DTOs.

## Design system

- Palette (oklch tokens in `src/styles.css`): near-black background `oklch(0.14 0.02 275)`, elevated surface `oklch(0.19 0.03 280)`, primary purple `oklch(0.62 0.24 300)`, accent blue `oklch(0.7 0.18 240)`, gradient `linear-gradient(135deg, primary, accent)`.
- Glass card utility (`bg-white/5 backdrop-blur-xl border border-white/10`), soft shadows, `rounded-2xl`.
- Fonts via `@fontsource` (Outfit for display, Inter for body). Loaded in `src/routes/__root.tsx` head links.
- Framer Motion for hero fade, card hover scale, page transitions.
- shadcn primitives themed to dark; existing tokens overridden in `:root` + `.dark` (default `.dark` on `<html>`).

## File plan

```text
src/
  routes/
    __root.tsx                (updated: dark theme, fonts, metadata)
    index.tsx                 (redirects to /home if auth, else /login)
    login.tsx
    _authenticated.tsx        (guard: checks session, redirects to /login)
    _authenticated/
      home.tsx
      channel.$channelId.tsx
      folder.$folderId.tsx
      search.tsx
      watch.$chatId.tsx       (query: id, hash)
    api/proxy/$.ts            (catch-all backend proxy, all methods, Range support)
  services/
    api.ts                    (axios instance -> /api/proxy)
    auth.ts, home.ts, channel.ts, folder.ts, search.ts, watch.ts
    adapters/                 (html/json -> DTO)
  hooks/
    useAuth.ts, useChannel.ts, useHome.ts, useDebouncedSearch.ts, useContinueWatching.ts
  components/
    layout/AppShell.tsx, TopNav.tsx, MobileBottomNav.tsx
    media/MediaCard.tsx, HeroBanner.tsx, Carousel.tsx, Thumbnail.tsx (lazy)
    player/VideoPlayer.tsx    (Video.js wrapper)
    ui/Skeleton variants
  store/
    continueWatching.ts       (localStorage-backed zustand-lite, no new dep — plain module)
  types/dto.ts
  lib/queryClient.ts          (persister + defaults)
```

## Auth flow

- `/login`: react-hook-form + zod, POST via proxy, animated error (Framer Motion shake).
- Session probe: `GET /` through proxy; if it returns login HTML/redirect, treat as unauthenticated. Cached in query key `["session"]`.
- `_authenticated.tsx` uses `beforeLoad` to call session probe; redirects to `/login?redirect=<from>` when missing.
- `Logout` button POSTs `/logout`, clears query cache, navigates to `/login` (replace).

## Pages

- Home: hero (first featured), Continue Watching row (from localStorage), Channels row, Folders grid, Recently Added.
- Channel: filter chips (Videos/Movies/Series/Anime/Docs), sort dropdown, infinite scroll after page 1 (page 1 served from cache instantly, revalidated in background), large hover-scaled cards.
- Folder: similar grid, breadcrumb, in-folder search box.
- Search: global page with debounced (300ms) input, recent searches in localStorage, tabs for channel vs folder scope.
- Watch: Video.js player pointing at `/api/proxy/{chatId}/{encodedName}?id&hash`, related sidebar, media info, share/copy link, breadcrumb, saves progress every 5s to Continue Watching store.

## Video.js

- Installed via bun. Wrapper component sets `sources: [{ src: proxyUrl, type: 'video/mp4' }]`, controls, playback rates, PiP, fullscreen, keyboard shortcuts, volume persistence in localStorage, resume from stored timestamp, retry-on-error toast.

## Caching

- Query defaults: `staleTime: 10 * 60_000` for channel page 1, `gcTime: 30 * 60_000`, `refetchOnMount: 'always'` for background refresh.
- Persister: `createSyncStoragePersister({ storage: localStorage })` scoped to keys prefixed `channel-*-page-1` and `home`.
- Thumbnails: `<img loading="lazy" decoding="async">` + browser HTTP cache; wrapper handles fallback to channel thumb.

## Dependencies to add

`axios`, `video.js`, `@types/video.js`, `framer-motion`, `@tanstack/react-query-persist-client`, `@tanstack/query-sync-storage-persister`, `react-hook-form`, `@hookform/resolvers`, `zod`, `@fontsource/outfit`, `@fontsource/inter`.

## Verification

- Typecheck via harness build.
- Playwright: load `/login`, submit dummy creds, capture 401 UI; then simulate auth by seeding a cookie and hit `/home`, screenshot hero + rows; open a channel page and confirm cached page 1 renders before network completes; open `/watch/...` and confirm Video.js mounts (poster + controls).
- `invoke-server-function` sanity-check `/api/proxy/` returns backend HTML.

## Follow-up (not in this pass)

Admin dashboard (`/admin/*`, CRUD forms, charts, cache reload UI), favorites, offline caching, subtitle upload, auto-play next, PiP mini-player across routes.
