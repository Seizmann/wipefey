/**
 * AI-generation marker registry.
 *
 * Each MarkerDefinition describes *what to check* and *where* — the resolution
 * logic lives in rules.ts. Check functions take an ImageMetadata object and
 * return either null (no match) or a MatchedMarker with the literal evidence.
 *
 * Design goals:
 *  - Data-driven: adding a new tool = appending to AI_TOOL_NAMES or
 *    AI_SOFTWARE_NAMES and optionally adding one MarkerDefinition.
 *  - Honest: returned values are literal tag keys/values — never synthesised.
 *  - No fabrication: if a detection path isn't backed by real extracted data,
 *    it stubs to null and is documented as deferred.
 */
import type { ImageMetadata } from '../metadata/unified'

// ─── Confidence tiers ────────────────────────────────────────────────────────

export type ConfidenceTier = 'weak' | 'strong' | 'definite'

// ─── Known AI tool / software name lists ─────────────────────────────────────
// Keep these as plain exported arrays so callers can inspect/extend them.

/** Display names / dc:creator values used by known AI generation tools. */
export const AI_TOOL_NAMES: string[] = [
  'Stable Diffusion',
  'StableDiffusion',
  'Midjourney',
  'NovelAI',
  'ComfyUI',
  'InvokeAI',
  'AUTOMATIC1111',
  'A1111',
  'DreamStudio',
  'NightCafe',
  'Runway',
  'Pika',
  'Leonardo.Ai',
  'Adobe Firefly',
  'DALL-E',
  'DALL·E',
  'Generator',
]

/**
 * Software field values / fragments that indicate AI pipeline tools.
 * Used for EXIF Software, XMP xmp:CreatorTool, and PNG Software chunks.
 */
export const AI_SOFTWARE_NAMES: string[] = [
  'Stable Diffusion',
  'StableDiffusion',
  'ComfyUI',
  'InvokeAI',
  'AUTOMATIC1111',
  'A1111',
  'Midjourney',
  'NightCafe',
  'NovelAI',
  'DreamStudio',
  'Runway',
  'Pika',
  'Leonardo.Ai',
  'Adobe Firefly',
  'DALL-E',
  'DALL·E',
]

/**
 * PNG tEXt/iTXt key names that are A1111/SD-style pipeline parameters.
 * Presence of any of these keys is a strong marker (M4).
 */
export const AI_PARAMETER_KEYS: string[] = [
  'parameters',
  'workflow',
  'prompt',
  'negative_prompt',
  'Steps',
  'Sampler',
  'CFG scale',
  'Seed',
  'Size',
  'Model hash',
  'Model',
  'Lora hashes',
  'Version',
  'TI hashes',
  'Hires upscaler',
  'Denoising strength',
]

/**
 * PNG tEXt/iTXt key names that are common AI-pipeline ambient markers (M5).
 * Less specific than parameter keys — require additional corroborating evidence.
 */
export const AI_AMBIENT_KEYS: string[] = [
  'prompt',
  'negative_prompt',
  'description',
  'Description',
  'Comment',
]

// ─── Result types ─────────────────────────────────────────────────────────────

export interface MatchedMarker {
  /** Marker id from the registry, e.g. 'M4'. */
  id: string
  confidence: ConfidenceTier
  /**
   * The literal tag/key that triggered the match.
   * Never synthesised — always the actual string from the metadata.
   */
  matchedKey: string
  /**
   * The literal value that matched.
   * Truncated to 512 chars to keep UI readable, but never rewritten.
   */
  matchedValue: string
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function truncated(v: string, max = 512): string {
  return v.length > max ? v.slice(0, max) + '…' : v
}

function matchesAny(value: string, list: string[]): boolean {
  const lower = value.toLowerCase()
  return list.some((name) => lower.includes(name.toLowerCase()))
}

// ─── Individual marker check functions ───────────────────────────────────────

/**
 * M1 — XMP dc:creator matches known AI tool names.
 * Confidence: strong
 */
function checkM1(meta: ImageMetadata): MatchedMarker | null {
  const xmp = meta.xmp
  if (!xmp) return null
  const creator = xmp['dc:creator']
  const raw =
    typeof creator === 'string'
      ? creator
      : Array.isArray(creator)
        ? (creator as unknown[]).map(String).join(', ')
        : null
  if (!raw) return null
  if (matchesAny(raw, AI_TOOL_NAMES)) {
    return {
      id: 'M1',
      confidence: 'strong',
      matchedKey: 'dc:creator',
      matchedValue: truncated(raw),
    }
  }
  return null
}

/**
 * M2 — XMP xmp:CreatorTool matches known AI tool patterns.
 * Confidence: strong
 */
function checkM2(meta: ImageMetadata): MatchedMarker | null {
  const xmp = meta.xmp
  if (!xmp) return null
  const tool = xmp['xmp:CreatorTool'] ?? xmp['CreatorTool']
  if (typeof tool !== 'string' || !tool) return null
  if (matchesAny(tool, AI_SOFTWARE_NAMES)) {
    return {
      id: 'M2',
      confidence: 'strong',
      matchedKey: 'xmp:CreatorTool',
      matchedValue: truncated(tool),
    }
  }
  return null
}

/**
 * M3 — C2PA / Content Credentials manifest (JUMBF) present.
 * Confidence: strong
 *
 * Two detection channels:
 *  1. meta.c2pa — binary JUMBF manifest detected by lib/metadata/c2pa.ts
 *     (JPEG APP11, PNG caBX/caMs/caSt, WebP RIFF chunk).
 *  2. meta.digitalSourceType — IPTC Digital Source Type flagging
 *     trainedAlgorithmicMedia (the fallback signal used by tools like
 *     Midjourney that don't sign full C2PA manifests).
 *
 * IMPORTANT (badge honesty): C2PA presence confirms provenance data exists;
 * its ABSENCE means nothing — most AI tools don't embed credentials and
 * credentials are strippable. Never present absence as proof of non-AI origin.
 */
function checkM3(meta: ImageMetadata): MatchedMarker | null {
  if (meta.c2pa) {
    const value = meta.c2pa.creationTool
      ? `C2PA manifest present — creation tool: ${meta.c2pa.creationTool}`
      : 'C2PA/JUMBF manifest present'
    return {
      id: 'M3',
      confidence: 'strong',
      matchedKey: `C2PA (${meta.c2pa.containerLabel})`,
      matchedValue: truncated(value),
    }
  }
  if (meta.digitalSourceType) {
    return {
      id: 'M3',
      confidence: 'strong',
      matchedKey: 'IPTC DigitalSourceType',
      matchedValue: truncated(meta.digitalSourceType),
    }
  }
  return null
}

/**
 * M4 — PNG tEXt/iTXt: key is a known A1111-style parameter key.
 * Confidence: strong
 */
function checkM4(meta: ImageMetadata): MatchedMarker | null {
  const chunks = meta.pngChunks
  if (!chunks || chunks.length === 0) return null
  for (const chunk of chunks) {
    if (chunk.failed) continue
    // Use case-sensitive match for well-known parameter keys
    if (AI_PARAMETER_KEYS.includes(chunk.key)) {
      return {
        id: 'M4',
        confidence: 'strong',
        matchedKey: chunk.key,
        matchedValue: truncated(chunk.value),
      }
    }
    // Additional A1111 heuristic: 'parameters' key contains SD-style patterns
    if (
      chunk.key === 'parameters' &&
      (chunk.value.includes('Steps:') ||
        chunk.value.includes('Sampler:') ||
        chunk.value.includes('CFG scale:') ||
        chunk.value.includes('Seed:'))
    ) {
      return {
        id: 'M4',
        confidence: 'strong',
        matchedKey: chunk.key,
        matchedValue: truncated(chunk.value),
      }
    }
  }
  return null
}

/**
 * M5 — PNG tEXt/iTXt: key is one of prompt, negative_prompt, Description, Comment.
 * Confidence: strong (ambient marker — weaker than M4 but explicit enough to count)
 */
function checkM5(meta: ImageMetadata): MatchedMarker | null {
  const chunks = meta.pngChunks
  if (!chunks || chunks.length === 0) return null
  // Exclude 'Comment' from this marker — Comment is common in non-AI PNGs.
  // Only flag prompt/negative_prompt/Description (case-sensitive) as strong.
  const strongAmbient = ['prompt', 'negative_prompt', 'Description']
  for (const chunk of chunks) {
    if (chunk.failed) continue
    if (strongAmbient.includes(chunk.key)) {
      return {
        id: 'M5',
        confidence: 'strong',
        matchedKey: chunk.key,
        matchedValue: truncated(chunk.value),
      }
    }
  }
  return null
}

/**
 * M6 — PNG tEXt/iTXt Software value matches A1111 / Stable Diffusion / ComfyUI.
 * Confidence: strong
 */
function checkM6(meta: ImageMetadata): MatchedMarker | null {
  const chunks = meta.pngChunks
  if (!chunks || chunks.length === 0) return null
  const sdVariants = [
    'Stable Diffusion',
    'StableDiffusion',
    'AUTOMATIC1111',
    'A1111',
    'ComfyUI',
    'InvokeAI',
    'NovelAI',
  ]
  for (const chunk of chunks) {
    if (chunk.failed) continue
    if (chunk.key === 'Software' && matchesAny(chunk.value, sdVariants)) {
      return {
        id: 'M6',
        confidence: 'strong',
        matchedKey: chunk.key,
        matchedValue: truncated(chunk.value),
      }
    }
  }
  return null
}

/**
 * M7 — PNG tEXt Software value matches Midjourney / NightCafe.
 * Confidence: strong
 */
function checkM7(meta: ImageMetadata): MatchedMarker | null {
  const chunks = meta.pngChunks
  if (!chunks || chunks.length === 0) return null
  const mjVariants = ['Midjourney', 'NightCafe']
  for (const chunk of chunks) {
    if (chunk.failed) continue
    if (chunk.key === 'Software' && matchesAny(chunk.value, mjVariants)) {
      return {
        id: 'M7',
        confidence: 'strong',
        matchedKey: chunk.key,
        matchedValue: truncated(chunk.value),
      }
    }
  }
  return null
}

/**
 * M8 — EXIF Software field matches known AI software list.
 * Confidence: strong
 */
function checkM8(meta: ImageMetadata): MatchedMarker | null {
  // Check camera.software (normalized) first
  const soft = meta.camera?.software
  if (soft && matchesAny(soft, AI_SOFTWARE_NAMES)) {
    return {
      id: 'M8',
      confidence: 'strong',
      matchedKey: 'Software',
      matchedValue: truncated(soft),
    }
  }
  // Also check raw EXIF Software tag in case camera normalization missed it
  const exifSoft = meta.exif?.['Software']
  if (typeof exifSoft === 'string' && matchesAny(exifSoft, AI_SOFTWARE_NAMES)) {
    return {
      id: 'M8',
      confidence: 'strong',
      matchedKey: 'Software',
      matchedValue: truncated(exifSoft),
    }
  }
  return null
}

/**
 * M9 — C2PA block present AND dc:creator present (combo marker).
 * Confidence: definite
 *
 * Requires an actual C2PA/JUMBF manifest (meta.c2pa) — the IPTC
 * DigitalSourceType fallback alone is not enough for the definite tier —
 * combined with an XMP dc:creator matching a known AI tool name (M1).
 */
function checkM9(meta: ImageMetadata): MatchedMarker | null {
  if (!meta.c2pa) return null
  const m1 = checkM1(meta)
  if (m1 !== null) {
    return {
      id: 'M9',
      confidence: 'definite',
      matchedKey: 'C2PA + dc:creator',
      matchedValue: `C2PA segment present; dc:creator = ${m1.matchedValue}`,
    }
  }
  return null
}

/**
 * M10 — ICC profile description matches known AI exporter.
 * Confidence: weak
 *
 * exifr surfaces the ICC description via icc.description (see unified.ts
 * IccData). We can check it directly without new extraction work.
 */
function checkM10(meta: ImageMetadata): MatchedMarker | null {
  const desc = meta.icc?.description
  if (!desc) return null
  const aiIccPatterns = [
    'Stable Diffusion',
    'ComfyUI',
    'Midjourney',
    'NovelAI',
    'Adobe Firefly',
    'DALL',
  ]
  if (matchesAny(desc, aiIccPatterns)) {
    return {
      id: 'M10',
      confidence: 'weak',
      matchedKey: 'ICC description',
      matchedValue: truncated(desc),
    }
  }
  return null
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export type MarkerCheckFn = (meta: ImageMetadata) => MatchedMarker | null

export interface MarkerDefinition {
  id: string
  source: string
  description: string
  confidence: ConfidenceTier
  check: MarkerCheckFn
}

/**
 * The full marker registry. Iterate this to run all checks; the order doesn't
 * affect badge resolution (rules.ts aggregates the results).
 */
export const MARKER_REGISTRY: MarkerDefinition[] = [
  {
    id: 'M1',
    source: 'XMP',
    description: 'dc:creator matches known AI tool names',
    confidence: 'strong',
    check: checkM1,
  },
  {
    id: 'M2',
    source: 'XMP',
    description: 'xmp:CreatorTool matches known AI tool patterns',
    confidence: 'strong',
    check: checkM2,
  },
  {
    id: 'M3',
    source: 'Binary/JUMBF',
    description: 'C2PA / Content Credentials (JUMBF) manifest present — signed provenance data',
    confidence: 'strong',
    check: checkM3,
  },
  {
    id: 'M4',
    source: 'PNG tEXt/iTXt',
    description: 'A1111-style parameter keys present (parameters, Steps, Sampler, …)',
    confidence: 'strong',
    check: checkM4,
  },
  {
    id: 'M5',
    source: 'PNG tEXt/iTXt',
    description: 'Ambient AI key present (prompt, negative_prompt, Description)',
    confidence: 'strong',
    check: checkM5,
  },
  {
    id: 'M6',
    source: 'PNG tEXt/iTXt',
    description: 'Software value matches A1111 / Stable Diffusion / ComfyUI',
    confidence: 'strong',
    check: checkM6,
  },
  {
    id: 'M7',
    source: 'PNG tEXt/iTXt',
    description: 'Software value matches Midjourney / NightCafe',
    confidence: 'strong',
    check: checkM7,
  },
  {
    id: 'M8',
    source: 'EXIF',
    description: 'EXIF Software field matches known AI software list',
    confidence: 'strong',
    check: checkM8,
  },
  {
    id: 'M9',
    source: 'XMP + C2PA',
    description: 'C2PA manifest AND dc:creator both present (combo)',
    confidence: 'definite',
    check: checkM9,
  },
  {
    id: 'M10',
    source: 'ICC',
    description: 'ICC profile description matches known AI exporter',
    confidence: 'weak',
    check: checkM10,
  },
]

/**
 * Run all registered marker checks against a metadata object and return
 * every matched result.
 */
export function runAllMarkers(meta: ImageMetadata): MatchedMarker[] {
  const results: MatchedMarker[] = []
  for (const def of MARKER_REGISTRY) {
    const match = def.check(meta)
    if (match !== null) {
      results.push(match)
    }
  }
  return results
}
