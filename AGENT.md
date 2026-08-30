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
- **Rate limiting:** Vercel serverless `api/check-limit.mjs` + Upstash Redis (`@upstash/redis`
  REST client + own pure fixed-window core in `api/ratelimit-core.mjs`).
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
storage platform with a less predictable free tier.

**Phase 5 refinements (final shape):**
- **Client:** `@upstash/redis` (plain REST client), NOT `@upstash/ratelimit`. The window
  math is ~30 lines; owning it in `api/ratelimit-core.mjs` (pure, dependency-free) lets
  `verify:phase5` unit-test window/reset/retry-after logic in Node with a fake in-memory
  counter — no mock Redis client is baked into production code, and the production path
  stays the real REST client.
- **Algorithm: fixed-window counter**, 10 req/hour per IP, key
  `wipefey:ratelimit:<windowIndex>:<ip>`, INCR + EXPIRE-on-first-hit. **Tradeoff accepted:**
  a client can burst up to 2× limit across a window boundary (10 at 09:59 + 10 at 10:00).
  A sliding-window (zset/log) would double Redis commands per request for precision a free
  client-side metadata tool does not need. Fixed window is simpler, cheaper, trivially
  testable.
- **Batch request counting: N requests, one per file.** `transformAllSerial()` calls
  check-and-increment once per file it transforms, not once per batch. Rationale:
  REQUIREMENT.md §5.5 caps *transformations* per hour, not button presses; a 50-file
  batch counted as 1 would let one user consume 500 transforms/hour. The cost: a large
  batch can hit the limit partway — handled by stopping the run cleanly (below).
- **Batch interruption:** on a 429 mid-batch the run stops at that file (remaining files
  keep 'analyzed' status untouched — no repeated 429 hammering), the blocked file gets a
  `rateLimit` flag (policy block, NOT `transform-error`; status stays 'analyzed' so the
  Transform button remains for a post-reset retry), and one toast covers the whole
  interruption ("3 of 5 photos cleaned… retry in 42 minutes").
- **Frontend failure semantics: fail OPEN.** Anything other than a well-formed 200/429
  (network error, 5xx, malformed body) → transform proceeds (`degraded: true`). The
  pipeline is fully client-side; a policy gate must not hard-block the tool when its own
  infra is down. Documented in `src/lib/ratelimit/index.ts`. Last-known `remaining: 0`
  is cached until `resetAt` to avoid hammering the endpoint.
- **Backend failure semantics: fail LOUD.** Missing/empty `UPSTASH_REDIS_REST_URL`/`_TOKEN`
  → explicit 500 `{ code: 'misconfigured' }` with a descriptive error (never a silent
  allow-all, which would make the limit invisibly vanish in production). Upstash command
  error → 500 `{ code: 'upstream-error' }`. The frontend's fail-open turns either into a
  degraded-allow, so real users are unaffected while logs/monitoring show the failure.
- **IP extraction:** Vercel sets `x-forwarded-for` on function requests (verified against
  vercel.com/docs/headers/request-headers, 2025-12); leftmost value = original client.
  Fallback `x-real-ip`, then a shared `unknown` bucket (missing header ⇒ one shared fair
  counter, not a bypass).

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

### D6 — `@theme` must stay non-`inline` in tokens.css (Phase 6)

The Phase-0 tokens used `@theme inline`, which inlines the variable *values*
into utilities (`text-muted` → `var(--w-gray-400)`), so the `.light` overrides
of the semantic `--color-*` tokens were silent no-ops — light mode never
actually applied. Plain `@theme` makes utilities reference `var(--color-*)`,
which the `.light` block flips. **Do not switch back to `inline`.** DESIGN.md
(§10) documents this; it is the source of truth for the visual system and
`src/design/tokens.css` must stay in lockstep with it.

### D7 — Route-level code split for the Tool page (Phase 6)

`src/pages/Tool` pulls in exifr, piexifjs, and fflate — the heaviest deps in
the app, none of which landing/content pages need. `routes.tsx` lazy-loads
ToolPage inside a `<Suspense fallback={null}>` boundary. Result: main chunk
467 kB → 311 kB (99 kB gzip), Tool chunk 156 kB loads on demand. Lighthouse
(Home): perf 80 → 86; SEO 91 → 100 (after adding a minimal `public/robots.txt`
— full SEO/sitemap work is still Phase 7). Note for Phase 7: the prerender
script must be Suspense-aware when rendering the /tool route statically.

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

`POST /api/check-limit` (fixed-window 10 req/hour per IP, Upstash Redis via `@upstash/redis`):
- `200` → `{ allowed:true, ip, limit:10, remaining, resetAt, retryAfter:0 }`
- `429` → `{ allowed:false, ip, limit:10, remaining:0, resetAt, retryAfter:<seconds>, message }`
  + `Retry-After` header
- `405` → non-POST. `500` → `{ allowed:false, code:'misconfigured'|'upstream-error', error }`.
- `resetAt` is epoch MILLISECONDS; `retryAfter` is SECONDS.

Frontend gate (`src/lib/ratelimit/index.ts`): called once per intended transform
(single-file button AND each iteration of Transform-all). On 429: no transform attempt,
file keeps 'analyzed' + `rateLimit` flag, toast + inline card message with the formatted
retry-after time; mid-batch the run stops and one toast covers the interruption. Fail-open
on any non-contract response (see D2). Cached `remaining: 0` denies locally until `resetAt`.
Pure core (window math / decision / IP extraction) lives in `api/ratelimit-core.mjs` and is
unit-tested by `verify:phase5` against a fake in-memory counter — live Upstash integration
is UNTESTED end-to-end (no real credentials yet; known Phase-5 gap, see PROGRESS.md).

## Environment variables

See `.env.example`. Only `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are used
(rate limiting). Real values live in Vercel project settings / local `.env`, never committed.

## Build / deploy

- `npm run build` — type-check + `vite build` (static SPA).
- `npm run build:static` — also runs `scripts/prerender.mjs` to emit static route HTML.
- Vercel: framework `vite`, output `dist`, plus the `api/` serverless function. See `vercel.json`.


## D6: C2PA / JUMBF detection (M3/M9)

- `lib/metadata/c2pa.ts` detects presence only — NOT a C2PA validator. No signature/trust checks; heuristic tool surfaces literal manifest strings only (`claim_generator`, `softwareAgent`, `model`).
- Detection net: JPEG APP11 (`urn:uuid:c2pa` header or `jumb` box), PNG `caBX`/`caMs`/`caSt`, WebP RIFF chunk (defensive: FourCC or payload-signature match). Segment-split APP11 tolerated.
- IPTC `trainedAlgorithmicMedia` (DigitalSourceType) is a secondary M3 channel, not its own marker; it never triggers M9.
- `isClean()` treats `c2pa`/`digitalSourceType` as leaks — canvas re-encode drops the bytes, so the gate is the enforcement mechanism.
- Honesty rule: absence of C2PA is never presented as evidence of non-AI origin (baked into `CAVEAT_ABSENCE` in rules.ts).
