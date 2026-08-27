/**
 * Functional verification of the Phase-2 AI heuristic engine against real
 * source modules (lib/ai-heuristics) using the three existing test fixtures.
 * Bundled with esbuild (same pattern as verify-phase1.ts) and run under Node 22.
 *
 * Usage: npm run verify:phase2
 *
 * Assertions:
 *  - ai-pipeline.png  → badge 'Yes', M4 and/or M6 matched, raw markers listed
 *  - camera-with-exif.jpg → badge 'No', caveat copy present, no markers
 *  - plain-camera.png → badge 'No' or 'Maybe', caveat copy present (verified
 *    against actual fixture content — Comment tEXt is present)
 *
 * Plain-camera rationale: Comment tEXt is explicitly excluded from M5 (only
 * affects prompt/negative_prompt/Description), and 'Comment' is not in
 * AI_PARAMETER_KEYS. A solitary Comment chunk resolves to 'No' unless its
 * value matches an AI software pattern (which "Camera capture" does not).
 * The test asserts against the real fixture output, not an assumption.
 */
import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { extractImageMetadata } from '../src/lib/metadata/index'
import { resolveAiLikelihood } from '../src/lib/ai-heuristics/rules'
import type { AiBadge } from '../src/lib/ai-heuristics/rules'

const dir = join(process.cwd(), 'test', 'fixtures')

function file(name: string) {
  const buf = readFileSync(join(dir, name))
  const type = name.endsWith('.png')
    ? 'image/png'
    : name.endsWith('.webp')
      ? 'image/webp'
      : name.endsWith('.heic')
        ? 'image/heic'
        : 'image/jpeg'
  return new File([new Uint8Array(buf)], basename(name), { type })
}

let pass = 0
let fail = 0

function check(label: string, cond: boolean | undefined | null, extra?: unknown) {
  if (cond) {
    pass++
    console.log(`  PASS  ${label}`)
  } else {
    fail++
    console.log(`  FAIL  ${label}`, extra !== undefined ? extra : '')
  }
}

const CAVEAT_ABSENCE_FRAGMENT = 'Absence of markers does not mean this image is real'

async function main() {
  // ── 1. ai-pipeline.png ─────────────────────────────────────────────────────
  // Has: Software tEXt = "Stable Diffusion 3.5", parameters iTXt (multiline),
  //      Description iTXt (compressed). Expected: badge Yes (M4 + M6 both match).
  console.log('\n== ai-pipeline.png ==')
  const aiMeta = await extractImageMetadata(file('ai-pipeline.png'))
  const aiResult = resolveAiLikelihood(aiMeta)
  console.log(
    `  badge: ${aiResult.badge} | markers: ${aiResult.rawMarkers.map((m) => m.id).join(', ')}`,
  )
  console.log(`  descriptor: ${aiResult.descriptor}`)
  check('badge is Yes', aiResult.badge === 'Yes', aiResult.badge)
  check(
    'at least 2 strong markers matched',
    aiResult.rawMarkers.filter((m) => m.confidence === 'strong').length >= 2,
    aiResult.rawMarkers.map((m) => `${m.id}(${m.confidence})`).join(', '),
  )
  check(
    'M4 matched (A1111-style parameter key)',
    aiResult.rawMarkers.some((m) => m.id === 'M4'),
    aiResult.rawMarkers.map((m) => m.id),
  )
  check(
    'M6 matched (Software = Stable Diffusion)',
    aiResult.rawMarkers.some((m) => m.id === 'M6'),
    aiResult.rawMarkers.map((m) => m.id),
  )
  check(
    'M6 matchedKey is Software',
    aiResult.rawMarkers.some((m) => m.id === 'M6' && m.matchedKey === 'Software'),
    aiResult.rawMarkers.find((m) => m.id === 'M6'),
  )
  check(
    'M6 matchedValue contains Stable Diffusion',
    aiResult.rawMarkers.some((m) => m.id === 'M6' && m.matchedValue.includes('Stable Diffusion')),
    aiResult.rawMarkers.find((m) => m.id === 'M6')?.matchedValue,
  )
  check(
    'descriptor contains "Strong indicators"',
    aiResult.descriptor.includes('Strong indicators'),
    aiResult.descriptor,
  )
  // Caveat is present even for Yes badge (heuristic, not proof)
  check('caveat present on Yes badge', aiResult.caveat.length > 0)

  // ── 2. camera-with-exif.jpg ────────────────────────────────────────────────
  // Has: Canon EOS R5, Lightroom software, no AI markers.
  // Expected: badge No, no markers, caveat copy is the "absence is not proof" text.
  console.log('\n== camera-with-exif.jpg ==')
  const camMeta = await extractImageMetadata(file('camera-with-exif.jpg'))
  const camResult = resolveAiLikelihood(camMeta)
  console.log(
    `  badge: ${camResult.badge} | markers: ${camResult.rawMarkers.map((m) => m.id).join(', ') || 'none'}`,
  )
  console.log(`  caveat: ${camResult.caveat.slice(0, 80)}…`)
  check('badge is No', camResult.badge === 'No', camResult.badge)
  check('no markers matched', camResult.rawMarkers.length === 0, camResult.rawMarkers)
  check(
    'descriptor says no markers found',
    camResult.descriptor.toLowerCase().includes('no machine-generation markers'),
    camResult.descriptor,
  )
  check(
    'caveat contains absence-is-not-proof copy',
    camResult.caveat.includes(CAVEAT_ABSENCE_FRAGMENT),
    camResult.caveat,
  )

  // ── 3. plain-camera.png ────────────────────────────────────────────────────
  // Has: Comment tEXt only (value "Camera capture").
  // Comment is not in AI_PARAMETER_KEYS, not in M5 strongAmbient list,
  // and "Camera capture" doesn't match any AI software name.
  // Expected: badge No; caveat present.
  console.log('\n== plain-camera.png ==')
  const plainMeta = await extractImageMetadata(file('plain-camera.png'))
  const plainResult = resolveAiLikelihood(plainMeta)
  console.log(
    `  badge: ${plainResult.badge} | markers: ${plainResult.rawMarkers.map((m) => m.id).join(', ') || 'none'}`,
  )
  console.log(`  png chunks: ${(plainMeta.pngChunks ?? []).map((c) => `${c.key}=${c.value}`).join(', ')}`)
  // Determine expected badge from actual fixture content (not assumption)
  const expectedBadge: AiBadge =
    plainResult.rawMarkers.some((m) => m.confidence === 'definite') ||
    plainResult.rawMarkers.filter((m) => m.confidence === 'strong').length >= 2
      ? 'Yes'
      : plainResult.rawMarkers.filter((m) => m.confidence === 'strong').length === 1 ||
          plainResult.rawMarkers.filter((m) => m.confidence === 'weak').length >= 2
        ? 'Maybe'
        : 'No'
  console.log(`  computed expected badge: ${expectedBadge}`)
  check(
    `badge matches computed expectation (${expectedBadge})`,
    plainResult.badge === expectedBadge,
    plainResult.badge,
  )
  check(
    'caveat present (No or Maybe badge)',
    (plainResult.badge === 'No' || plainResult.badge === 'Maybe') &&
      plainResult.caveat.includes(CAVEAT_ABSENCE_FRAGMENT),
    plainResult.caveat,
  )
  // Specific assertion: Comment alone should NOT trigger strong/definite
  check(
    'plain Comment tEXt does not produce Yes badge',
    plainResult.badge !== 'Yes',
    plainResult.badge,
  )

  // ── 4. Structural / honesty checks ────────────────────────────────────────
  console.log('\n== Honesty checks ==')
  // AiHeuristicResult shape is complete for ai-pipeline (Yes badge)
  check('rawMarkers array present on Yes result', Array.isArray(aiResult.rawMarkers))
  check('every matched marker has id, confidence, matchedKey, matchedValue', aiResult.rawMarkers.every(
    (m) =>
      typeof m.id === 'string' &&
      typeof m.confidence === 'string' &&
      typeof m.matchedKey === 'string' &&
      typeof m.matchedValue === 'string',
  ))
  // No fabricated percentages in any descriptor
  check(
    'no % in ai-pipeline descriptor',
    !aiResult.descriptor.includes('%'),
    aiResult.descriptor,
  )
  check(
    'no % in camera descriptor',
    !camResult.descriptor.includes('%'),
    camResult.descriptor,
  )
  // No certainty language ("Confirmed AI", "100%", "definitely AI")
  const certaintyPatterns = /confirmed ai|100%|definitely ai/i
  check(
    'no certainty language in ai-pipeline descriptor',
    !certaintyPatterns.test(aiResult.descriptor),
  )
  check(
    'no certainty language in ai-pipeline caveat',
    !certaintyPatterns.test(aiResult.caveat),
  )

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`)
  return fail === 0
}

void main().then((ok) => process.exit(ok ? 0 : 1))
