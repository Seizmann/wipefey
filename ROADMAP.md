# Wipefey — Roadmap

Live scope tracker. Requirements source: `REQUIREMENT.md`.

---

## v1 (current scope)

Free, open-source, client-side photo metadata tool.

**Core flow:** Upload → inspect metadata → AI-marker heuristic badge → transform
(strip + rewrite date/software) → download (single or ZIP).

**v1 scope (in scope):**
- [x] Project scaffold (Vite + React + TS strict) — Phase 0
- [x] Design system / tokens / logo — Phase 0
- [x] Meta files (README, AGENT, CLAUDE, DESIGN, LICENSE, .env.example) — Phase 0
- [ ] Upload: drag-and-drop + browse, multi-file, 25MB/file, 50 files — Phase 1
- [ ] Metadata extraction + display (EXIF/IPTC/XMP/GPS/ICC + PNG chunks) — Phase 1
- [ ] AI-marker heuristic badge (Yes/Uncertain/No + raw markers) — Phase 2
- [ ] Transform pipeline (strip + rewrite, no undo, verify strip) — Phase 3
- [ ] Batch processing + ZIP export (fflate) — Phase 4
- [ ] Rate limiting (`api/check-limit.mjs` + Upstash Redis) — Phase 5
- [ ] Design polish (ThemeToggle live, responsive, reduced motion) — Phase 6
- [ ] SEO/AEO (prerender, meta/JSON-LD, sitemap, robots, llms.txt) — Phase 7

**Out of scope for v1 (per REQUIREMENT.md §3):**
- No user accounts / auth
- No server-side file storage
- No monetization / paid tiers
- No forensic "prove this is AI" analysis (heuristic only)

---

## v2 (future)

**"AI Interrogate"** — deeper AI-generation analysis. Scope to be defined closer
to v2. Likely candidates (not committed):
- More sophisticated marker taxonomy (model fingerprints, latent distributions)
- Optional server-side analysis for heavy workloads (waives client-side-only guarantee)
- Batch-level reports / comparison views
- Contributing a maintained PNG/JPEG metadata-write library upstream

Full v2 detail belongs here once fleshed out.

---

## Decision log

See `AGENT.md` — D1 (vite-ssg rejected → client-side + custom prerender),
D2 (Upstash Redis), D3 (fflate over JSZip), D4 (piexifjs 1.0.4), D5 (self-host fonts).
