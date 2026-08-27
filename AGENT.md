# Wipefey — Agent Notes

This file is the working memory for AI coding agents (and humans) building Wipefey.
It records architectural decisions, conventions, and how the pieces fit together.
When a decision changes, update this file.

## Project purpose

Wipefey is a free, open-source, fully client-side photo metadata tool:
inspect all hidden metadata → get a heuristic AI-generation signal → strip and
rewrite metadata → download. See `REQUIREMENT.md` (authoritative scope) and
`DESIGN.md` (design system).

## Stack (locked)

- **Frontend:** React 19 + Vite 8 + TypeScript **strict** (`tsconfig.app.json`).
- **Routing:** react-router v7 (`createBrowserRouter`/`RouterProvider` in `src/main.tsx`).
- **Styling:** Tailwind CSS v4 (CSS-first via `@import "tailwindcss"`; tokens in `src/design/tokens.css`).
- **State:** Zustand (batch/file state machine in `src/lib/batch/`).
- **Metadata read:** [exifr](https://github.com/MikeKovarik/exifr) + custom PNG chunk reader (`src/lib/metadata/`).
- **Metadata write:** [piexifjs](https://github.com/hMatoba/piexifjs) **pinned exactly `1.0.4`** (JPEG EXIF) + custom PNG chunk writer.
- **ZIP:** [fflate](https://github.com/101arrowz/fflate).
- **Fonts:** `@fontsource/geist` + `@fontsource/geist-mono` (self-hosted, OFL).
- **Rate limiting:** Vercel serverless `api/check-limit.mjs` + Upstash Redis (`@upstash/ratelimit`).
- **Meta/per-route head:** react-helmet-async.

## Non-negotiables

- **TypeScript strict. No `any`.** `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `noImplicitReturns`, `noUnusedLocals`, `noUnusedParameters` are all on.
- **No traditional backend.** Only `api/check-limit.mjs` (rate limiting). No server-side file storage.
- **No undo / discard original.** After a transform, the original file and its metadata are
  dropped from state and object URLs revoked. The transformed blob is final.
- **AI-marker honesty.** Never use certainty language anywhere in the UI (badge, descriptor,
  tooltip, help copy). Even the strongest marker combo renders as *"Strong indicators of AI
  generation"* — always framed as heuristic, never proof. Cross-check this on every Phase-2 review.
- **Status colors are indicator dots only.** Emerald (clean), red (AI marker), amber (unsure) are
  small dots/badges — never full-surface background fills.

## Architecture decisions & rationale

### D1 — vite-ssg rejected; use client-side meta + custom prerender script

The original plan proposed [vite-ssg](https://github.com/antfu-collective/vite-ssg) for
static pre-rendering of the routes for SEO. **Rejected.** Investigation showed vite-ssg is
**Vue-only**: its peerDependencies are `vue` + `vue-router` and it imports `@unhead/vue` /
`@unhead/dom`; there is no React entry. It is actively maintained, but wrong for this React
stack.

**Chosen approach (client-side + prerender):**
1. **Per-route meta/head** via `react-helmet-async` (title, description, OG/Twitter, canonical).
2. **Static prerender** via `scripts/prerender.mjs` — a Node script that imports the built
   client bundle, uses React's `renderToString` for each static route, and emits static
   `dist/<route>/index.html` files with the rendered HTML + head/meta/JSON-LD inlined.
   Invoked by `npm run build:static` after `vite build`.

This keeps the SPA live for interactivity while giving crawlers/answer-engines real static
HTML per route. Documented here because it departs from the original plan.

### D2 — Upstash Redis chosen over Vercel KV for rate limiting

Free tier: 256MB storage, 500K commands/month (≈16K/day), 10GB bandwidth. Tenant per-IP
counters at 10 req/hr are far under this. Vercel KV has been folded into Vercel's paid
storage platform with a less predictable free tier. Backing via `@upstash/ratelimit`.

### D3 — fflate replaces JSZip

JSZip is unmaintained (no npm release in 12+ months, Snyk "Inactive", open issue #915).
[fflate](https://github.com/101arrowz/fflate) is actively maintained, zero-dependency,
~8KB, with first-class zip output. Chosen for batch ZIP export.

### D4 — piexifjs pinned exactly 1.0.4

piexifjs README carries a warning pinning `1.0.4`; the project is dormant. It's functionally
fine for our single narrow need (write `Software` + `DateTimeOriginal` into a canvas
re-encoded JPEG, no EXIF removal needed since canvas already strips). Backed by
`@types/piexifjs@^1.0.0`. If it ever fails, `exif-writer` is the drop-in replacement.

### D5 — Fonts self-hosted via @fontsource

Geist Sans + Geist Mono are SIL OFL 1.1 (free). No open alternative needed; self-hosted for
privacy + performance (no external font CDN).

## AI-marker heuristic (Phase 2)

The marker registry lives in `src/lib/ai-heuristics/markers.ts` and must be **data-driven and
easy to extend** — adding a tool is appending one entry. Badge/confidence rules in `rules.ts`.
Raw markers view in the UI lists the literal matched tag/key/value pairs. See that module for
the current registry. Keep the confidence tiers: `weak` / `strong` / `definite`, and keep the
display copy non-certainty in all cases.

## Metadata pipeline (Phase 1)

- Unified result shape defined in `src/lib/metadata/unified.ts` (format, exif, iptc, xmp, icc,
  pngChunks, gps, camera, dates). All formats normalize into this one shape.
- PNG text chunks (`tEXt`/`iTXt`/`zTXt`) are parsed by a custom reader because exifr does not
  fully cover them — and these are the primary channel for AI markers on PNG.
- HEIC is best-effort via exifr; on parse failure degrade gracefully with a clear message.

## Transform pipeline (Phase 3)

`src/lib/transform/run.ts`: canvas re-encode to strip → **verify** the strip by re-reading the
new blob (abort on any metadata leak) → rewrite (piexifjs for JPEG, custom writer for PNG)
→ return the final blob. The original is discarded from state (no undo).

## Conventions

- One component per file in `src/components/`, PascalCase filenames.
- Library modules in `src/lib/<domain>/`, each exposing a clean index.
- Hooks in `src/hooks/`, `use*` naming.
- Design tokens come from `src/design/tokens.css`; consume semantic utilities
  (`bg-bg`, `text-muted`, `border-border`, `bg-accent`, `text-clean`, `text-ai`), not raw hex.
- Run `npm run lint` (oxlint) and `npm run build` (tsc strict) before committing.

## Rate-limit contract (Phase 5)

`POST /api/check-limit`:
- `200` → `{ allowed:true, ip, limit:10, remaining, resetAt }`
- `429` → `{ allowed:false, limit:10, remaining:0, resetAt }`
- IP from Vercel `x-forwarded-for`. Fixed-window 10/hr per IP via `@upstash/ratelimit`.

Frontend calls this before allowing a transform; on 429 show a toast + inline retry countdown
and disable Transform until `resetAt`. Cache the last response in-memory.

## Environment variables

See `.env.example`. Only `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are used
(rate limiting). Real values live in Vercel project settings / local `.env`, never committed.

## Build / deploy

- `npm run build` — type-check + `vite build` (static SPA).
- `npm run build:static` — also runs `scripts/prerender.mjs` to emit static route HTML.
- Vercel: framework `vite`, output `dist`, plus the `api/` serverless function. See `vercel.json`.
