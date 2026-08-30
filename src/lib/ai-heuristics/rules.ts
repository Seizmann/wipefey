/**
 * Badge resolution logic for the AI-generation heuristic.
 *
 * Consumes the MatchedMarker array from markers.ts and produces an
 * AiHeuristicResult with:
 *  - badge: 'Yes' | 'Maybe' | 'No'
 *  - descriptor: honest prose — what actually matched, no fabricated percentages
 *  - caveat: "not proof" copy, always present for No/Maybe badges
 *  - rawMarkers: the literal matched evidence (unmodified)
 *
 * Badge rules:
 *   Yes   = ≥1 definite marker OR ≥2 strong markers
 *   Maybe = exactly 1 strong marker OR ≥2 weak markers
 *   No    = no markers matched
 *
 * Copy rule (CLAUDE.md / REQUIREMENT.md §5.2):
 *   When badge is No or Maybe, the copy MUST explicitly state that absence of
 *   markers is not evidence the image is real — most AI tools strip metadata
 *   before export. This caveat is baked into the returned object, never left
 *   to the component to remember.
 */
import type { ImageMetadata } from '../metadata/unified'
import { runAllMarkers } from './markers'
import type { MatchedMarker } from './markers'

export type AiBadge = 'Yes' | 'Maybe' | 'No'

export interface AiHeuristicResult {
  /** Simple verdict for the badge indicator. */
  badge: AiBadge
  /**
   * Honest, human-readable prose describing what the engine found.
   * Never contains fabricated percentages or certainty language.
   */
  descriptor: string
  /**
   * "Not proof" copy. Always present for No/Maybe badges.
   * Explicitly states that absence of markers does not mean the image is real.
   * Present (and softer) for Yes badges too — still heuristic, not proof.
   */
  caveat: string
  /** The literal matched evidence — unmodified key/value pairs. */
  rawMarkers: MatchedMarker[]
}

// ─── Caveat copy ──────────────────────────────────────────────────────────────

const CAVEAT_ABSENCE =
  'Absence of markers does not mean this image is real — most AI tools strip ' +
  'metadata before export, and provenance data such as C2PA Content ' +
  'Credentials is frequently absent, unsigned, or removable. This result is ' +
  'heuristic, not forensic proof.'

const CAVEAT_PRESENCE =
  'These are heuristic indicators only — not forensic proof. A human could have ' +
  'manually written these tags, and a sophisticated pipeline could strip them.'

// ─── Badge resolution ─────────────────────────────────────────────────────────

function resolveBadge(markers: MatchedMarker[]): AiBadge {
  const definiteCount = markers.filter((m) => m.confidence === 'definite').length
  const strongCount = markers.filter((m) => m.confidence === 'strong').length
  const weakCount = markers.filter((m) => m.confidence === 'weak').length

  if (definiteCount >= 1 || strongCount >= 2) return 'Yes'
  if (strongCount === 1 || weakCount >= 2) return 'Maybe'
  return 'No'
}

// ─── Descriptor prose ─────────────────────────────────────────────────────────

function buildDescriptor(badge: AiBadge, markers: MatchedMarker[]): string {
  if (markers.length === 0) {
    return 'No machine-generation markers found in this file.'
  }

  const definiteCount = markers.filter((m) => m.confidence === 'definite').length
  const strongCount = markers.filter((m) => m.confidence === 'strong').length
  const weakCount = markers.filter((m) => m.confidence === 'weak').length

  const parts: string[] = []

  if (definiteCount > 0) {
    parts.push(
      `${definiteCount} definite machine-generation ${definiteCount === 1 ? 'marker' : 'markers'} found`,
    )
  }
  if (strongCount > 0) {
    parts.push(
      `${strongCount} strong machine-generation ${strongCount === 1 ? 'marker' : 'markers'} found`,
    )
  }
  if (weakCount > 0) {
    parts.push(
      `${weakCount} ambient ${weakCount === 1 ? 'marker' : 'markers'} found (inconclusive on ${weakCount === 1 ? 'its' : 'their'} own)`,
    )
  }

  const summary = parts.join('; ')

  if (badge === 'Yes') {
    return `Strong indicators of AI generation — ${summary}.`
  }
  if (badge === 'Maybe') {
    // 1 strong or 2+ weak
    if (strongCount === 1 && definiteCount === 0) {
      return `1 strong machine-generation marker found — inconclusive on its own. ${summary}.`
    }
    return `Ambient markers present — inconclusive. ${summary}.`
  }
  // Should not reach here if markers.length > 0 but be safe
  return summary + '.'
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the full marker registry against an extracted ImageMetadata object and
 * resolve a badge + human-readable result.
 *
 * This does NOT re-extract metadata — it operates purely on what was already
 * produced by extractImageMetadata() in Phase 1.
 */
export function resolveAiLikelihood(metadata: ImageMetadata): AiHeuristicResult {
  const rawMarkers = runAllMarkers(metadata)
  const badge = resolveBadge(rawMarkers)
  const descriptor = buildDescriptor(badge, rawMarkers)
  const caveat = badge === 'No' || badge === 'Maybe' ? CAVEAT_ABSENCE : CAVEAT_PRESENCE

  return { badge, descriptor, caveat, rawMarkers }
}
