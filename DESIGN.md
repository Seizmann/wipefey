# Wipefey — Design System

Wipefey is a serious, open-source developer tool. Its visual language follows the
**Vercel / Geist** school: stark, minimal, achromatic, with a single interactive
accent and a 4px spacing rhythm. This document is the single source of truth for
how Wipefey looks and feels. Tokens are implemented in `src/design/tokens.css`.

---

## 1. Design principles

1. **Achromatic by default.** The interface is black, white, and gray. Color appears
   only where it has a job: interactive state, links, focus, and status indicators.
2. **Dark is canonical.** Dark mode is the default and primary surface; light is the
   alternate theme. Most effort goes into the dark surface.
3. **Spacing, not dividers.** Separate content with the spacing scale and subtle
   surface-color changes, not `<hr>` or border lines.
4. **Accent as punctuation.** The single accent (`#0066f3`) is used sparingly — buttons,
   links, focus rings, active states. It is never splashed as a full-surface background.
5. **Data discipline.** Metadata is rendered in Geist Mono with tabular numerals. It
   reads as engineering-grade, not decorative.
6. **Status as dots.** Clean / AI-marker / uncertain states are small indicator dots
   and pills — never large color fills.

---

## 2. Color tokens

### 2.1 Monochrome scale

| Token | Dark | Light | Role |
|---|---|---|---|
| `--w-black` | `#000000` | `#000000` | pure black (highest contrast) |
| `--w-gray-900` | `#0a0a0a` | — | near-black surfaces |
| `--w-gray-800` | `#171717` | — | elevated surface |
| `--w-gray-700` | `#262626` | — | strong border / hover |
| `--w-gray-600` | `#404040` | — | faint accent |
| `--w-gray-500` | `#525252` | `#525252` | muted text (light) |
| `--w-gray-400` | `#8b8b8b` | `#6b6b6b` | muted text / faint |
| `--w-gray-200` | `#d4d4d4` | `#d4d4d4` | light borders |
| `--w-gray-100` | `#e6e6e6` | — | light text |
| `--w-white` | `#ffffff` | `#ffffff` | white |

### 2.2 Semantic tokens (both themes)

| Semantic | Dark | Light | Usage |
|---|---|---|---|
| `--color-bg` | `#000000` | `#ffffff` | page background |
| `--color-surface` | `#0a0a0a` | `#fafafa` | cards, panels |
| `--color-surface-2` | `#171717` | `#f2f2f2` | nested surfaces |
| `--color-surface-3` | `#262626` | `#ededed` | hover / active surfaces |
| `--color-border` | `#171717` | `#e5e5e5` | default hairline border |
| `--color-border-strong` | `#262626` | `#d4d4d4` | hover border |
| `--color-foreground` | `#ffffff` | `#171717` | primary text |
| `--color-muted` | `#8b8b8b` | `#6b6b6b` | secondary text |
| `--color-faint` | `#525252` | `#a3a3a3` | tertiary / decorative text |

### 2.3 Accent & status

| Token | Value | Usage |
|---|---|---|
| `--color-accent` | `#0066f3` | **The only interactive color.** Links, primary button, focus ring, active nav. |
| `--color-clean` | `#3fb950` | **Dot only.** Clean / transformed / success status. |
| `--color-ai` | `#f85149` | **Dot only.** AI-marker-found status. |
| `--color-unsure` | `#d29922` | **Dot only.** Uncertain / inconclusive status. |

> Status colors (`clean`/`ai`/`unsure`) are reserved for **small indicator dots and
> badges only** (≈10px dots, small pills). Never use them as backgrounds or large fills.

---

## 3. Typography

- **Geist Sans** (`--font-sans`) — all UI, body, and headings. Self-hosted via `@fontsource/geist` (400/500/600/700).
- **Geist Mono** (`--font-mono`) — metadata values, labels, filenames, technical data, tabular numbers. Self-hosted via `@fontsource/geist-mono` (400).

### Type scale

| Step | Size | Line-height | Weight | Usage |
|---|---|---|---|---|
| display | 48px (clamp) | 1.05 | 600 | hero headline |
| h1 | 30–36px | 1.1 | 600 | page titles |
| h2 | 20–24px | 1.2 | 600 | section titles |
| body | 16px | 1.65 | 400 | paragraphs |
| ui-sm | 14px | 1.5 | 500 | buttons, nav |
| label | 12px | 1.4 | 500 | mono labels, meta |
| caption | 12px | 1.5 | 400 | helper text |
| mono-data | 13px | 1.6 | 400 | metadata values (mono) |

Headings use tight tracking (`-0.02em` to `-0.04em`). Body uses relaxed line-height
(1.65). All numeric data uses `.tnum` (tabular numerals).

---

## 4. Spacing

Base unit **4px**. Scale: 4, 8, 12, 16, 24, 32, 40, 64, 96, 128, 192, 256.

Use Tailwind's built-in scale; common values:
- `gap-4` (16px) default component gap
- `gap-2` / `gap-3` (8/12px) tight gaps between inline elements
- Section padding: `py-24 md:py-36` on landing sections
- Card padding: `p-5` / `p-6`
- Max content width: `max-w-6xl`

---

## 5. Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-wxs` | 6px | buttons, inputs, small controls |
| `--radius-wsm` | 8px | cards, panels |
| `--radius-wmd` | 12px | modals, dropdowns |
| pill | 9999px | status pills, tags |

Primary buttons: 6px. Cards: 8px. Keep corners sharp-ish — the dev-tool feel.

---

## 6. Shadows / elevation

Minimal, subtle:
- `shadow-sm`: `0 1px 2px rgba(0,0,0,0.4)` (borderless elevation)
- raised cards rely more on surface color than shadow.

---

## 7. Motion

- Default transition: **150ms ease** (`transition-colors`, `transition-opacity`).
- Hover: subtle color/border change; optional `translateY(-1px)` on cards.
- Respect `prefers-reduced-motion` (already global in `index.css`).
- No heavy animation. This is a tool, not a showcase.

---

## 8. Components

### Buttons
- **Primary:** `bg-accent text-white`, radius 6px, `px-5 py-2.5 text-sm font-medium`, hover `opacity-90`.
- **Secondary:** `border border-border text-foreground`, radius 6px, hover `border-border-strong`.
- **Ghost/icon:** transparent, `text-muted hover:text-foreground`.

### Cards
- `bg-surface border border-border radius-[8px] p-5`. Hover: `border-border-strong`.

### Status dots
- `inline-flex items-center gap-1.5` with a `size-2` (`8px`) dot in `bg-clean` / `bg-ai` / `bg-unsure`, plus a mono label.

### Tags/Pills
- `inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 font-mono text-xs`.

### Drop zone (Phase 1)
- Dashed `border-2 border-dashed border-border`, `bg-surface`, radius 12px, large hit area. Drag-over state: `border-accent`.

### Nav
- Top bar, `h-14`, `border-b border-border`, sticky, `bg-bg/80 backdrop-blur`. Logo left, mono nav center/right, theme toggle right.

### Footer
- `border-t border-border`, mono text, muted.

---

## 9. Theme switching

- Dark is default & canonical. Light is an opt-in alternate.
- Toggle persists via `localStorage` (`wipefey:theme`), falls back to `prefers-color-scheme`.
- Toggle adds/removes `.light` on `<html>`; semantic `--color-*` tokens flip in CSS.
- `color-scheme` meta + CSS set per theme.

---

## 10. Logo / icon

The Wipefey mark is a **square photo/CCD sensor frame** with a horizontal
**wipe motion-slice** through it and a **terminal caret** — clean, monochrome,
engineering-forward. Two-tone via `currentColor`:

- Outer sensor frame (2px stroke)
- Inner photo frame (1.5px, 50% opacity)
- Horizontal erase-stroke
- Terminal caret (the "clean data" action)

Uses: header, favicon (`public/favicon.svg`), README, og-image. Always `currentColor`
so it adapts to theme.

---

## 11. Accessibility

- Semantic HTML, proper heading hierarchy (one `h1` per page).
- Visible focus rings using `--color-accent`.
- `aria-label` on icon-only controls (theme toggle, logo).
- Sufficient contrast: text on `#000` bg is `#fff` / `#8b8b8b` (≥4.5:1).
- Keyboard-accessible nav and controls.
- `prefers-reduced-motion` respected globally.
