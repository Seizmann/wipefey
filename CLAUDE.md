# CLAUDE.md — Wipefey working instructions

Instructions for AI coding agents (Claude Code, Codex, and similar) working in this repo.
The spirit of this file: think before editing, keep the project's guardrails, and never
guess in ways that break its core promises.

## Repo map

- `REQUIREMENT.md` — **authoritative product scope.** Do not edit without explicit instruction.
- `DESIGN.md` — design system (colors, type, spacing, components). Follow when building UI.
- `AGENT.md` — architecture decisions (D1–D5) and conventions. Read before structural changes.
- `ROADMAP.md` — scope tracker. Update as phases complete.
- `PROGRESS.md` — private agent log, gitignored, never commit.

## Stack

React 19 + Vite 8 + TypeScript **strict** (no `any`). Tailwind v4 (CSS-first tokens in
`src/design/tokens.css`). react-router v7. Zustand. exifr + custom PNG reader for metadata.
piexifjs@1.0.4 + custom PNG writer for rewrite. fflate for ZIP. react-helmet-async for head.

## Hard rules

1. **TypeScript strict.** `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
   `noImplicitReturns`, no `any`. Run `npm run build` (tsc) before committing.
2. **100% client-side.** Only `api/check-limit.mjs` exists server-side (rate limiting).
   Never add server-side file storage or processing.
3. **No undo / discard original.** Transforming drops the original file + metadata from
   state and revokes object URLs. The transformed blob is final.
4. **AI-marker honesty.** NEVER ship certainty language ("Confirmed AI", "100% AI").
   Even the strongest marker renders as "Strong indicators of AI generation". Heuristic,
   never proof. Cross-check badge text, descriptor, and tooltips.
5. **Status colors = dots only.** Emerald/red/amber are small indicator dots/pills, never
   full-surface fills.
6. **Semantic tokens.** Use design tokens (`bg-bg`, `text-muted`, `border-border`, `bg-accent`),
   not raw hex, in real UI.

## Workflow conventions

- One component per file, PascalCase, in `src/components/`.
- Library logic in `src/lib/<domain>/`, clean index export.
- Hooks in `src/hooks/`, `use*` naming.
- Keep AI-marker logic data-driven (`markers.ts` registry) so adding a tool = one entry.
- Run `npm run lint` (oxlint) then `npm run build` before committing.
- Update `ROADMAP.md` and `PROGRESS.md` as phases complete. Never commit `PROGRESS.md`.

## Communication

- Ask before big architectural changes or anything that breaches the hard rules.
- Prefer minimal, focused diffs over sprawling rewrites.
- When in doubt about scope, check `REQUIREMENT.md` first — it's the source of truth.
