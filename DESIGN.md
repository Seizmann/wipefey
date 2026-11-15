# Wipefey — Design System

Wipefey is a serious, open-source developer tool. Its visual language follows the
**Vercel / Geist** school — verified against the current Geist documentation
(vercel.com/geist, 2026): stark, minimal, achromatic, one interactive accent,
a 4px spacing rhythm, and small sharp radii (6/8/12px). This document is the
single source of truth for how Wipefey looks and feels. The implementation
lives in `src/design/tokens.css` — **if the two ever disagree, this file wins;
fix the tokens in the same change.**

---

## 1. Research basis (2026 Geist review)

Checked against the live Geist docs before finalizing:

- **Color** — Geist organizes every scale as a 100→1000 ladder with fixed
  *roles*: steps 1–3 are component backgrounds (default/hover/active), 4–6 are
  borders (default/hover/active), 7–8 are high-contrast backgrounds, 9–10 are
  secondary/primary text. Wipefey adopts this role mapping on its semantic
  tokens (`surface → surface-2 → surface-3`, `border → border-strong`,
  `muted → foreground`).
- **Materials** — Geist presets use **6px radius for everyday surfaces**
  (buttons, inputs, base cards) and **12px for floating elements** (menus,
  modals, drop zone, toasts). Wipefey's radii scale mirrors this: 6/8/12 + pill.
- **Typography** — Geist typesets with Geist Sans for UI/headings and Geist
  Mono for labels, code, and data, with tabular numerals wherever numbers align
  in columns. Wipefey keeps both fonts self-hosted via `@fontsource` (decision
  D5 in `AGENT.md`; Geist is SIL OFL 1.1, free — no replacement needed).
- **Status color discipline** — green/red/amber exist only as small indicators
  (dots, pills), never surface fills. Retained from Phase 2 and made explicit
  below.

## 2. Design principles

1. **Achromatic by default.** The interface is black, white, and gray. Color
   appears only where it has a job: interactive accent, focus, and status dots.
2. **Dark is canonical.** Dark is the default theme; light is a first-class but
   secondary surface (both are hand-tuned, never inverted).
3. **Surfaces, not decoration.** Hierarchy comes from surface-color steps and
   hairline borders — not shadows, gradients, or color.
4. **Accent as punctuation.** `#0066f3` is used only for primary CTAs, links,
   drag-over state, and focus rings. Never as a full-surface fill.
5. **Data discipline.** Metadata, filenames, labels, and statuses are Geist Mono
   with tabular numerals (`.tnum`). It reads as engineering-grade.
6. **Status as dots.** Clean / AI-marker / unsure states are 8px dots + mono
   labels — never large color fills.
7. **Honesty in copy.** The UI never overclaims — the AI signal is always
   "heuristic, not proof" (see §12).

---

## 3. Color tokens

### 3.1 Raw grayscale ramp (`--w-*`, theme-invariant)

| Token | Value | Notes |
|---|---|---|
| `--w-black` | `#000000` | pure black |
| `--w-gray-900` | `#0a0a0a` | |
| `--w-gray-800` | `#171717` | |
| `--w-gray-700` | `#262626` | |
| `--w-gray-600` | `#404040` | decorative only — fails AA as text |
| `--w-gray-500` | `#525252` | 7.4:1 on white |
| `--w-gray-400` | `#8b8b8b` | 7.9:1 on black |
| `--w-gray-300` | `#a8a8a8` | |
| `--w-gray-200` | `#d4d4d4` | |
| `--w-gray-100` | `#e6e6e6` | |
| `--w-white` | `#ffffff` | |

### 3.2 Semantic tokens (flip with the `.light` class on `<html>`)

| Semantic | Dark | Light | Usage |
|---|---|---|---|
| `--color-bg` | `#000000` | `#ffffff` | page background |
| `--color-surface` | `#0a0a0a` | `#fafafa` | cards, panels, drop zone |
| `--color-surface-2` | `#171717` | `#f2f2f2` | nested surfaces, secondary buttons |
| `--color-surface-3` | `#262626` | `#ededed` | hover/active surfaces |
| `--color-border` | `#171717` | `#e5e5e5` | default hairline |
| `--color-border-strong` | `#262626` | `#d4d4d4` | hover border |
| `--color-foreground` | `#ffffff` | `#171717` | primary text (21:1 / 15.4:1) |
| `--color-muted` | `#8b8b8b` | `#525252` | secondary text (7.9:1 / 7.4:1) |
| `--color-faint` | `#767676` | `#6f6f6f` | tertiary text (4.6:1 / 5.0:1 — AA) |

> Contrast note: `faint` is deliberately `#767676` (dark) / `#6f6f6f` (light) —
> both clear the 4.5:1 WCAG AA bar for small text. The decorative `--w-gray-600`
> stop is never used as text.

### 3.3 Accent & status

| Token | Dark | Light | Usage |
|---|---|---|---|
| `--color-accent` | `#0066f3` | `#0066f3` | primary button, links, drag-over, focus ring |
| `--color-accent-hover` | `#0052c4` | `#0052c4` | primary button hover (darker stop, not opacity) |
| `--color-accent-muted` | `rgba(0,102,243,.12)` | `rgba(0,102,243,.08)` | drag-over wash |
| `--color-clean` | `#3fb950` | `#3fb950` | **dot/badge only** — cleaned / no-markers / success |
| `--color-ai` | `#f85149` | `#f85149` | **dot/badge only** — AI markers found / errors |
| `--color-unsure` | `#d29922` | `#d29922` | **dot/badge only** — inconclusive / rate-limit notices |

Status colors are reserved for 8px dots and small pills. The dot carries the
status color; the 11px mono label beside it stays in muted text, so status is
never color alone and the label keeps AA contrast in both themes.

---

## 4. Typography

- **Geist Sans** (`--font-sans`) — all UI, body, headings. Weights 400/500/600/700.
- **Geist Mono** (`--font-mono`) — filenames, metadata keys/values, badges,
  workbench buttons, footer/legal, technical labels. Weight 400 (+500 wordmark).

### Scale (Tailwind utilities)

| Role | Classes | Usage |
|---|---|---|
| Display / hero | `text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]` | Home hero only |
| Page title | `text-3xl md:text-4xl font-semibold tracking-tight` | About / Privacy / How-it-works `h1` |
| Workbench title | `font-mono text-2xl font-semibold` | Tool `h1` |
| Section heading | `text-xl md:text-2xl font-semibold tracking-tight` | feature/section `h2` |
| Card heading | `text-base font-medium` | feature cards |
| Body | `text-sm md:text-base text-muted leading-relaxed` | paragraphs |
| Small / meta | `text-xs text-muted` | helper text |
| Label / badge | `font-mono text-[11px]` | status badges, section headers |
| Data | `font-mono text-xs` + `.tnum` | metadata rows, sizes, counts |

Rules: one `h1` per page; sentence case in prose, lowercase for workbench
buttons (mono, terminal-flavored). Labels are mono one step smaller, sentence
case, untracked — never uppercase, never letter-spaced.

## 5. Spacing

Base unit **4px**. Standard steps: 4, 8, 12, 16, 24, 32, 40, 64, 96, 128, 192.

- Component internal gap: `gap-2` / `gap-3` (8/12px)
- Between cards/sections: `gap-4` to `gap-8`
- Card padding: `p-3` (file cards) / `p-5`–`p-6` (panels)
- Page rhythm: `py-10` (workbench), `py-20 md:py-28` (content pages)
- Hero: `py-24 md:py-36`
- Content measure: prose `max-w-2xl`, pages `max-w-3xl`, app `max-w-6xl`

## 6. Radii

| Token | Value | Usage |
|---|---|---|
| `--radius-wxs` | 6px | buttons, inputs, small controls (Geist `material-base`) |
| `--radius-wsm` | 8px | cards, panels, toast body |
| `--radius-wmd` | 12px | drop zone, menus, modals (Geist floating preset) |
| pill | 9999px | status pills, tags |

Keep corners sharp — the dev-tool feel. No radius above 12px anywhere.

## 7. Shadows & elevation

Elevation is surface-color first; shadows are accents:

- `--w-shadow-sm` — `0 1px 2px rgba(0,0,0,.4)` dark / `rgba(0,0,0,.06)` light
- `--w-shadow-md` — `0 4px 12px rgba(0,0,0,.45)` dark / `rgba(0,0,0,.08)` light (toast only)

## 8. Component states

### Buttons

| Variant | Default | Hover / Active | Focus | Disabled |
|---|---|---|---|---|
| Primary | `bg-accent text-white rounded-wxs px-5 py-2.5 text-sm font-medium` | `bg-accent-hover` (darker stop, never opacity) | global ring | `opacity-50 cursor-not-allowed` |
| Secondary | `border border-border text-foreground bg-surface-2 rounded-wxs` | `border-border-strong bg-surface-3` | ring | `opacity-50 cursor-not-allowed` |
| Quiet | `border border-border text-muted` | `border-border-strong text-foreground` | ring | `opacity-50 cursor-not-allowed` |
| Ghost/icon | transparent `text-muted` | `text-foreground` | ring | `opacity-50` |

All transitions: `transition-colors`, 150ms.

### Inputs / drop zone

- Drop zone: `border-2 border-dashed border-border bg-surface rounded-wmd`,
  min-height 220px. **Drag-over:** `border-accent bg-accent-muted`.
  It is `role="button"` + `tabIndex={0}`; keyboard focus gets the global ring.
- Text inputs (none in v1 UI): `bg-surface border border-border rounded-wxs`,
  focus `border-accent` + ring, error `border-ai` + `text-ai` message below.

### Cards

`bg-surface border border-border rounded-wsm`. Hover (selectable):
`border-border-strong`. Selected: `border-accent`. Error surfaces: `border-ai/30`.

### Badges / status dots

`inline-flex items-center gap-1.5 font-mono text-[11px]`
+ `size-2 rounded-full` dot: `bg-clean` / `bg-ai` / `bg-unsure` / `bg-faint`
(idle) / `bg-accent` (in-flight). Color + label, never color alone.

### Pills / tags

`rounded-full border border-border px-2 py-0.5 font-mono text-[11px] text-muted`.

### Toast

`rounded-wsm border border-border bg-surface shadow-md`, fixed bottom-center,
tone dot (`unsure` = warn, `clean` = info), `role="status" aria-live="polite"`.

### Logo / icon usage

The mark is the sensor-frame + wipe-slice + terminal-caret SVG in
`src/components/Logo.tsx` (renders with `currentColor`; same artwork as
`public/favicon.svg`). **Do not create a second variant.**

- **Clear space:** ≥ 25% of the mark's size on all sides (e.g. `gap-2` at size 22).
- **Minimum size:** 16px on screen (header 22px, footer 16px).
- **Color:** `currentColor` only — theme foreground on surfaces.
- **Don't:** recolor, rotate, animate, outline on busy photos, or place it on
  non-token backgrounds.

## 9. Motion

- 150ms `ease` color/border transitions (`transition-colors`).
- One looping animation exists: the cleaning spinner (`animate-spin`).
- `prefers-reduced-motion: reduce` kills all animation/transition duration and
  smooth-scroll globally (`index.css`) — new motion must be plain CSS
  transitions/animations so the global override covers it.
- No entrance animations, no parallax, no autoplay.

## 10. Theme switching

- Dark canonical; light opt-in. Toggle persists to `localStorage`
  (`wipefey:theme`); first visit falls back to `prefers-color-scheme`.
- `.light` on `<html>` flips only the semantic `--color-*` tokens
  (`tokens.css`); raw `--w-*` values never change. `color-scheme` set per theme.
  Utilities reference `var(--color-*)` via plain `@theme` — **never
  `@theme inline`**, which would inline dark values and break the flip.
- Both themes are designed, not derived: every page is checked in dark *and*
  light. Surfaces, borders and status colors all have explicit light values.

## 11. Accessibility

- Semantic HTML, one `h1` per page, landmarks (`header`/`main`/`footer`/`nav`).
- Global `:focus-visible` ring: 2px accent outline + 2px offset (never removed).
- Contrast: foreground/muted/faint all ≥ 4.5:1 in **both** themes; status text
  always paired with a dot or label.
- Icon-only controls carry `aria-label` (theme toggle, file remove, toast dismiss).
- Interactive non-native elements (`role="button"` + `tabIndex` + key handlers)
  on the drop zone and file cards.
- `prefers-reduced-motion` respected globally.

## 12. Copy tone

- Honest, plain, technical. No marketing superlatives, no fabricated stats.
- The AI-generation signal is always described as **heuristic, not proof** —
  mirror the Phase-2 caveat language (`rules.ts`), never certainty wording.
- Privacy claims must match reality: client-side processing, no file storage,
  one rate-limit endpoint storing an IP-keyed counter, theme preference in
  `localStorage`.

---

## 4. Typography

- **Geist Sans** (`--font-sans`) — all UI, body, headings. Weights 400/500/600/700.
- **Geist Mono** (`--font-mono`) — filenames, metadata keys/values, badges,
  workbench buttons, footer/legal, technical labels. Weight 400 (+500 for the
  logo wordmark).

### Scale (Tailwind utilities)

| Role | Classes | Usage |
|---|---|---|
| Display / hero | `text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]` | Home hero only |
| Page title | `text-3xl md:text-4xl font-semibold tracking-tight` | About / Privacy / How-it-works `h1` |
| Workbench title | `font-mono text-2xl font-semibold` | Tool `h1` |
| Section heading | `text-xl md:text-2xl font-semibold tracking-tight` | feature/section `h2` |
| Card heading | `text-base font-medium` | feature cards |
| Body | `text-sm md:text-base text-muted leading-relaxed` | paragraphs |
| Small / meta | `text-xs text-muted` | helper text |
| Label / badge | `font-mono text-[11px]` | status badges, section headers |
| Data | `font-mono text-xs` + `.tnum` | metadata rows, sizes, counts |

Rules: one `h1` per page; sentence case for prose, lowercase for workbench
buttons (mono, terminal-flavored), uppercase only for 11px mono labels.

---

## 5. Spacing

Base unit **4px**. Standard steps: 4, 8, 12, 16, 24, 32, 40, 64, 96, 128, 192.

- Component internal gap: `gap-2` / `gap-3` (8/12px)
- Between cards/sections: `gap-4` to `gap-8`
- Card padding: `p-3` (file cards) / `p-5`–`p-6` (panels)
- Page rhythm: `py-10` (workbench), `py-20 md:py-28` (content pages)
- Hero: `py-24 md:py-36`
- Content measure: prose `max-w-2xl`, content pages `max-w-3xl`, app `max-w-6xl`

## 6. Radii

| Token | Value | Usage |
|---|---|---|
| `--radius-wxs` | 6px | buttons, inputs, small controls (Geist `material-base`) |
| `--radius-wsm` | 8px | cards, panels, toast body |
| `--radius-wmd` | 12px | drop zone, menus, modals (Geist floating preset) |
| pill | 9999px | status pills, tags |

Keep corners sharp — the dev-tool feel. No radius above 12px anywhere.

## 7. Shadows & elevation

Elevation is surface-color first; shadows are accents:

- `--w-shadow-sm` — `0 1px 2px rgba(0,0,0,.4)` dark / `rgba(0,0,0,.06)` light
- `--w-shadow-md` — `0 4px 12px rgba(0,0,0,.45)` dark / `rgba(0,0,0,.08)` light
  (toast only)

## 8. Component states

### Buttons

| Variant | Default | Hover | Focus | Disabled |
|---|---|---|---|---|
| Primary | `bg-accent text-white rounded-wxs px-5 py-2.5 text-sm font-medium` | `bg-accent-hover` (darker stop, **not** opacity) | global `:focus-visible` ring | `opacity-50 cursor-not-allowed` |
| Secondary | `border border-border text-foreground bg-surface-2 rounded-wxs` | `border-border-strong bg-surface-3` | ring | `opacity-50 cursor-not-allowed` |
| Quiet | `border border-border text-muted` | `border-border-strong text-foreground` | ring | `opacity-50 cursor-not-allowed` |
| Ghost/icon | transparent, `text-muted` | `text-foreground` | ring | `opacity-50` |

All transitions: `transition-colors` 150ms.

### Inputs / drop zone

- Drop zone: `border-2 border-dashed border-border bg-surface rounded-wmd`,
  min-height 220px. **Drag-over:** `border-accent bg-accent-muted`. It is
  `role="button"` + `tabIndex={0}`; keyboard focus gets the global ring.
- Text inputs (none in v1 UI): `bg-surface border border-border rounded-wxs`,
  focus `border-accent` + ring, error `border-ai` + `text-ai` message below.

### Cards

`bg-surface border border-border rounded-wsm`. Hover (selectable):
`border-border-strong`. Selected: `border-accent`. Error surfaces:
`border-ai/30` wash.

### Badges / status dots

`inline-flex items-center gap-1.5 font-mono text-[11px]`
+ `size-2 rounded-full` dot: `bg-faint` (idle), `bg-accent` (in-flight),
`bg-clean` (done / no markers), `bg-ai` (markers found / errors),
`bg-unsure` (inconclusive / rate-limit). Color + label, never color alone.

### Pills / tags

`rounded-full border border-border px-2 py-0.5 font-mono text-[11px] text-muted`.

### Toast

`rounded-wsm border border-border bg-surface` + `--w-shadow-md`, fixed
bottom-center, tone dot (`unsure`=warn, `clean`=info), `role="status"`
`aria-live="polite"`.

### Logo / icon usage

The mark is the sensor-frame + wipe-slice + terminal-caret SVG in
`src/components/Logo.tsx` (renders with `currentColor`; same artwork as
`public/favicon.svg`). **Do not create a second variant.**

- **Clear space:** ≥ 25% of the mark's size on all sides (e.g. `gap-2` at
  `size={22}`).
- **Minimum size:** 16px on screen (header 22px, footer 16px, favicon any).
- **Color:** `currentColor` only — theme foreground on surfaces, white on accent.
- **Don't:** recolor, rotate, outline over busy photos, place on non-token
  backgrounds, or animate.

---

## 9. Motion

- 150ms `ease` color/border transitions (`transition-colors`).
- One looping animation exists: the cleaning spinner (`animate-spin`).
- `prefers-reduced-motion: reduce` kills all animation/transition duration and
  smooth-scroll globally (`index.css`) — new motion must be plain CSS
  transitions/animations so the global override covers it.
- No entrance animations, no parallax, no auto-playing carousels.

## 10. Theme switching

- Dark canonical; light opt-in. Toggle persists to `localStorage`
  (`wipefey:theme`); first visit falls back to `prefers-color-scheme`.
- `.light` on `<html>` flips only the semantic `--color-*` tokens
  (`tokens.css`); raw `--w-*` values never change. `color-scheme` set per theme.
- Implementation note (Phase 6 fix): the `@theme` block must stay **non-`inline`**
  so utilities reference `var(--color-*)` and the `.light` overrides actually
  apply.
- Both themes are designed, not derived: every page is checked in dark *and*
  light. Surfaces, borders and status colors all have explicit light values.

## 11. Accessibility

- Semantic HTML, one `h1` per page, landmarks (`header`/`main`/`footer`/`nav`).
- Global `:focus-visible` ring: 2px accent outline + 2px offset (never removed).
- Contrast: foreground/muted/faint all ≥4.5:1 in **both** themes; status text
  always paired with a dot or label.
- Icon-only controls carry `aria-label` (theme toggle, file remove, toast
  dismiss).
- Interactive non-native elements (`role="button"` + `tabIndex` + key handlers)
  on the drop zone and file cards.
- `prefers-reduced-motion` respected globally.

## 12. Copy tone

- Honest, plain, technical. No marketing superlatives, no fabricated stats.
- The AI-generation signal is always described as **heuristic, not proof** —
  mirror the Phase-2 caveat language (`rules.ts`), never certainty wording.
- Privacy claims must match reality: client-side processing, no file storage,
  one rate-limit endpoint storing an IP-keyed counter, theme preference in
  `localStorage`.
