<p align="center">
  <img src="./public/favicon.svg" width="72" height="72" alt="Wipefey logo" />
</p>

<p align="center">
  <strong>Wipefey</strong> — see the hidden metadata in your photos, detect AI-generation markers, and wipe it all clean. <em>100% in your browser.</em>
</p>

<p align="center">
  <a href="https://wipefey.rexio.pro">wipefey.rexio.pro</a> ·
  <a href="https://rexio.pro">RexiO</a> ·
  <a href="https://spritexai.pro.bd">SpritexAI</a>
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-green" />
  <img alt="Build" src="https://img.shields.io/badge/build-Vite%20%2B%20React%20%2B%20TS-blue" />
</p>

---

**Wipefey** is a free, open-source, client-side tool that lets you upload one or
more photos, inspect every piece of metadata embedded in them (EXIF, IPTC, XMP,
GPS, PNG text chunks), get a best-effort signal on whether the image looks
AI-generated, and then "transform" the file — stripping all existing metadata
and writing fresh metadata (current date/time + `Software: Wipefey by RexiO`)
in its place.

No sign-up. No server-side storage. **Your photos never leave your device.**

## Features

- **Full metadata inspection** — EXIF, IPTC, XMP, ICC, GPS, and PNG `tEXt`/`iTXt`/`zTXt` text chunks, all parsed in-browser.
- **AI-generation marker heuristic** — checks known markers (XMP `dc:creator`, C2PA content-credential blocks, PNG text-chunk keys like `parameters`/`prompt`, EXIF `Software` tags, and more) and reports a **Yes / Uncertain / No** badge with honest, non-certainty framing. This is a heuristic, never proof.
- **One-click transform** — strips every piece of existing metadata via canvas re-encode, then rewrites the file with only the current timestamp and the Wipefey stamp.
- **Batch processing** — handle up to 50 files at once (25MB each), with per-file and ZIP download.
- **Private by design** — everything runs in your browser; the only server call is a single rate-limit check.

## How it works

1. **Upload** — drag-and-drop or browse (JPEG, PNG, WebP, HEIC best-effort; up to 50 files, ~25MB each).
2. **Inspect** — Wipefey reads and displays all available metadata per file.
3. **Signal** — a heuristic badge shows whether known AI-generation markers were found (clearly labeled as heuristic, not conclusive).
4. **Transform** — strip all metadata, write current date/time + `Software: Wipefey by RexiO`, verify the strip, and reveal the new file for download.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | React + Vite + TypeScript (strict mode) |
| Styling | Tailwind CSS (Geist-style design system — see `DESIGN.md`) |
| Metadata extraction | [exifr](https://github.com/MikeKovarik/exifr) + custom PNG chunk reader |
| Metadata rewriting | [piexifjs](https://github.com/hMatoba/piexifjs) (pinned 1.0.4) + custom PNG chunk writer |
| Batch ZIP | [fflate](https://github.com/101arrowz/fflate) |
| State | Zustand |
| Rate limiting | Vercel serverless function + Upstash Redis |
| Fonts | Geist Sans / Geist Mono (self-hosted, OFL) |

## Local development

```bash
npm install
npm run dev        # start the dev server
npm run build      # type-check + production build
npm run preview    # preview the production build
npm run build:static  # build + pre-render static routes (see scripts/prerender.mjs)
```

The Vite frontend is fully static. The optional `api/check-limit.mjs` serverless
function is only used for rate limiting in production.

## Project structure

```
api/                 Vercel serverless function (rate limiting)
public/              Static assets: favicon, robots, sitemap
scripts/             Pre-render helper for static SEO
src/
  components/        UI components
  design/            Design tokens (Tailwind v4 CSS-first)
  hooks/             useTheme, useDropzone, useRateLimit
  lib/
    metadata/        EXIF/IPTC/XMP extraction + PNG chunk reader
    ai-heuristics/   AI-marker registry + badge rules
    transform/       Canvas strip + metadata rewrite
    batch/           Per-file state machine
    zip/             fflate ZIP bundling
  pages/             Home, Tool, HowItWorks, About, Privacy
  seo/               Meta/JSON-LD builders
```

## Documentation

- [`REQUIREMENT.md`](./REQUIREMENT.md) — product requirements (v1 scope, authoritative)
- [`DESIGN.md`](./DESIGN.md) — full design system (colors, typography, spacing, components)
- [`AGENT.md`](./AGENT.md) — agent-facing notes: architecture decisions, conventions
- [`ROADMAP.md`](./ROADMAP.md) — current v1 scope + v2 plans
- [`CLAUDE.md`](./CLAUDE.md) — working instructions for AI coding agents

## Contributing

Contributions are welcome. Please open an issue or pull request. Keep TypeScript
strict and run `npm run lint` before submitting.

## License

MIT © [SpritexAI](https://spritexai.pro.bd). Part of the [RexiO](https://rexio.pro)
family of open-source tools by [Mohammad Sijan](https://sijan.pro.bd).
