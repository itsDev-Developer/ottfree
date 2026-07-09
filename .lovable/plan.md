# Build plan

Scope is large — shipping in 3 phases so each phase leaves the app fully working. All admin config moves to Lovable Cloud (Supabase) so settings are shared across devices.

## Phase 1 — Foundation (this round)

1. **Enable Lovable Cloud** and create schema:
   - `site_settings` (single-row: brand, colors, header/footer, SEO, custom CSS/JS, maintenance).
   - `ads` (id, name, network, placement enum, priority, html, script, vast_url, frequency, device, geo, start/end, enabled, test_mode).
   - `user_roles` + `has_role()` function (admin gate — not on profile).
   - Public SELECT policies (anon can read enabled ads + site settings); admin-only write policies.
2. **Rename Channel → OTT across UI** (nav, headings, breadcrumbs, empty states, page titles). Backend routes untouched. Remove visible "Telegram" strings.
3. **Home page sections** (client-fetched from existing backend):
   - `Featured` — auto-slider of latest items pulled from the 5 configured OTT IDs, max N (admin-configurable), glass cards, framer-motion.
   - `Recently Added` — merged latest across all OTTs, sorted by message id desc, infinite scroll with skeletons.
4. Migrate existing localStorage `AdsSettings` to Cloud `ads` table (legacy VAST + banner become one ad row each on first admin visit).

## Phase 2 — Admin panel v2

1. **Ads Manager**: full CRUD, per-placement lists, enable/disable toggle, priority sort, preview modal, test mode, device/geo/date filters honored at render time. Placement components: `<AdSlot placement="top-banner" />`, `<AdSlot placement="sidebar" />`, etc. Popup/interstitial/exit-popup wired via portal.
2. **Site Customization**: form editing `site_settings`; live preview; theme color injected via CSS variables at root; custom CSS/JS injected in `__root.tsx` head.
3. **Maintenance Mode**: middleware in root route — if enabled and user is not admin, render maintenance page.
4. **Dashboard stats**: keep existing visits/plays localStorage aggregation, add totals cards (OTT count, video count, cache size placeholders).

## Phase 3 — Player + polish

1. **VideoPlayer v2** (Video.js based):
   - Quality selector (manual + auto), speed, PiP, theater/mini modes.
   - Keyboard shortcuts (space, ←/→, ↑/↓, f, m, t, i).
   - Mobile gesture layer: left-half brightness, right-half volume, double-tap seek ±10s, long-press 2x, lock button.
   - Multi-ad support: pre-roll (VAST), mid-roll (time-based from admin), post-roll, pause overlay, banner overlay — driven by `ads` table filtered by placement.
   - Continue-watching resume already exists; add auto-next when playlist context available.
2. Persist playback position server-side (optional table `playback_progress`).

## Explicit non-goals (need backend work you'd do separately)

- MongoDB connection settings, backend cache manager, base API URL swap, backend rate limiting — the Python backend at koyeb is out of my reach.
- Subtitle/audio-track switching — requires backend to serve HLS or VTT.
- Real ad revenue metrics — no network API integrated.

## Technical notes

- Admin gate via `user_roles` table + `has_role(auth.uid(), 'admin')`; the current backend `admin/admin` login stays for streaming, but the Cloud admin UI requires a Cloud-authenticated admin user (I'll add a first-admin bootstrap).
- `AdSlot` component reads ads via TanStack Query with 5-min stale time; ad rotation by weighted priority.
- Site settings loaded in `__root.tsx` loader and provided via context.

## This round delivers Phase 1

Reply "go" to start Phase 1, or tell me to reorder/drop items.
