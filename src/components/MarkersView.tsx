/**
 * MarkersView — AI-generation heuristic badge + raw evidence panel.
 *
 * Renders:
 *  1. Badge indicator (Yes / Maybe / No) using the same dot+label pattern
 *     as FileCard's StatusBadge — no new visual language.
 *  2. Confidence descriptor + caveat copy.
 *  3. Raw markers section — each matched marker's literal key/value pair,
 *     using the same Section/dl/grid style as MetadataPanel.tsx.
 *
 * Receives an ImageMetadata from the batch store (already extracted in Phase 1).
 * Does NOT re-extract metadata or add a new pipeline stage.
 */
import type { ReactNode } from 'react'
import { resolveAiLikelihood } from '../lib/ai-heuristics/rules'
import type { AiBadge, AiHeuristicResult } from '../lib/ai-heuristics/rules'
import type { MatchedMarker } from '../lib/ai-heuristics/markers'
import type { ImageMetadata } from '../lib/metadata/unified'

// ─── Badge dot ────────────────────────────────────────────────────────────────

function badgeDotClass(badge: AiBadge): string {
  if (badge === 'Yes') return 'bg-ai'
  if (badge === 'Maybe') return 'bg-unsure'
  return 'bg-clean'
}

function badgeTextClass(badge: AiBadge): string {
  if (badge === 'Yes') return 'text-ai'
  if (badge === 'Maybe') return 'text-unsure'
  return 'text-clean'
}

function badgeLabel(badge: AiBadge): string {
  if (badge === 'Yes') return 'AI markers found'
  if (badge === 'Maybe') return 'Inconclusive'
  return 'No markers found'
}

function BadgeIndicator({ badge }: { badge: AiBadge }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide ${badgeTextClass(badge)}`}
    >
      <span className={`size-2 rounded-full ${badgeDotClass(badge)}`} aria-hidden />
      {badgeLabel(badge)}
    </span>
  )
}

// ─── Section shell (mirrors MetadataPanel.tsx §Section) ───────────────────────

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-wsm border border-border bg-surface">
      <h4 className="border-b border-border px-4 py-2 font-mono text-xs uppercase tracking-wide text-muted">
        {title}
      </h4>
      <div className="px-4 py-2">{children}</div>
    </section>
  )
}

// ─── Raw marker row (mirrors MetadataPanel.tsx §Row) ─────────────────────────

function MarkerRow({ marker }: { marker: MatchedMarker }) {
  const confidenceColor =
    marker.confidence === 'definite'
      ? 'text-ai'
      : marker.confidence === 'strong'
        ? 'text-unsure'
        : 'text-muted'

  return (
    <div className="flex flex-col gap-1 py-2">
      {/* Header: id · confidence · key */}
      <dt className="flex flex-wrap items-center gap-2 font-mono text-xs">
        <span className="text-faint">{marker.id}</span>
        <span className={`rounded-full border border-border px-1.5 py-0.5 text-[10px] ${confidenceColor}`}>
          {marker.confidence}
        </span>
        <span className="text-foreground">{marker.matchedKey}</span>
      </dt>
      {/* Value */}
      <dd className="whitespace-pre-wrap break-words rounded-wxs bg-surface-2 px-2.5 py-1.5 font-mono text-xs text-foreground">
        {marker.matchedValue || '(empty value)'}
      </dd>
    </div>
  )
}

// ─── Raw markers section ──────────────────────────────────────────────────────

function RawMarkersSection({ markers }: { markers: MatchedMarker[] }) {
  if (markers.length === 0) {
    return (
      <p className="py-2 font-mono text-xs text-faint">
        No markers matched — nothing to display.
      </p>
    )
  }
  return (
    <dl className="divide-y divide-border/60">
      {markers.map((m) => (
        <MarkerRow key={m.id} marker={m} />
      ))}
    </dl>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface Props {
  metadata: ImageMetadata
}

/**
 * Renders the full AI-generation heuristic view for a single analyzed file.
 * Wire this into MetadataPanel.tsx (or Tool.tsx) in the per-file detail pane
 * — it receives the same ImageMetadata already in batch state.
 */
export function MarkersView({ metadata }: Props) {
  const result: AiHeuristicResult = resolveAiLikelihood(metadata)

  return (
    <div className="flex flex-col gap-3">
      {/* ── Badge + summary ── */}
      <Section title="AI Generation Indicators">
        <div className="flex flex-col gap-3 py-1">
          {/* Badge */}
          <div className="flex items-center gap-3">
            <BadgeIndicator badge={result.badge} />
            {/* Verdict label */}
            <span className="rounded-full border border-border px-2.5 py-0.5 font-mono text-[11px] text-muted">
              {result.badge}
            </span>
          </div>

          {/* Descriptor */}
          <p className="text-xs text-foreground">{result.descriptor}</p>

          {/* Caveat — always shown, mandatory per spec */}
          <p className="rounded-wxs border border-border/60 bg-surface-2 px-3 py-2 text-xs text-muted">
            {result.caveat}
          </p>
        </div>
      </Section>

      {/* ── Raw evidence ── */}
      <Section title="Raw Markers">
        <RawMarkersSection markers={result.rawMarkers} />
      </Section>
    </div>
  )
}
