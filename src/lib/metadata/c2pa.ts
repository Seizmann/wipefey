/**
 * C2PA / Content Credentials (JUMBF) detection — binary, client-side only.
 *
 * Detects manifest PRESENCE per container format and does a bounded,
 * best-effort read of a few manifest JSON fields. This is deliberately NOT
 * a C2PA validator (no signature checks, no trust model) — Wipefey is a
 * heuristic inspector, so only literal strings found in the manifest are
 * surfaced, never synthesised.
 *
 * Embedding carriers handled (C2PA spec, "Embedding manifests"):
 *  - JPEG: APP11 (0xFFEB) segments whose payload carries the C2PA marker
 *    header ("urn:uuid:c2pa/…") followed by JUMBF superboxes ("jumb").
 *    Segmented APP11 series are tolerated — any matching segment flips
 *    detection; field extraction is best-effort across concatenated payloads.
 *  - PNG: ancillary chunks "caBX" (current spec) plus legacy "caMs" and
 *    "caSt" (older/deprecated drafts) — all detected, all stripped downstream.
 *  - WebP: RIFF chunk carrying the JUMBF payload. Real-world support is
 *    newer/less standardized than JPEG/PNG, so detection is defensive: any
 *    chunk whose FourCC is c2pa/caBX/jumb OR whose payload begins with the
 *    JUMBF box signature ("jumb") or contains "urn:c2pa" counts.
 *
 * No new library — plain signature/parsing work, same pattern as png.ts.
 * Failures never throw into the caller: extractC2pa returns null on any
 * malformed container (detection is best-effort by design).
 */

import type {
  C2paContainer,
  C2paField,
  C2paInfo,
  ImageFormat,
  PngTextChunk,
} from './unified'
import { isPng } from './png'

/** ASCII header every C2PA-carrying JPEG APP11 payload begins with. */
const C2PA_APP11_HEADER = 'urn:uuid:c2pa'

/** IPTC Digital Source Type value used by AI generators (Midjourney et al.). */
const TRAINED_ALGO_MARKER = 'trainedAlgorithmicMedia'

/** Upper bound on manifest bytes decoded for field extraction. */
const MAX_DECODE_BYTES = 2_000_000

// ─── Byte helpers ─────────────────────────────────────────────────────────────

function latin1(bytes: Uint8Array): string {
  return new TextDecoder('iso-8859-1').decode(bytes)
}

function asciiAt(bytes: Uint8Array, offset: number, length: number): string {
  let out = ''
  for (let i = 0; i < length && offset + i < bytes.length; i++) {
    out += String.fromCharCode(bytes[offset + i]!)
  }
  return out
}

function u32be(bytes: Uint8Array, o: number): number {
  return (
    ((bytes[o]! << 24) |
      (bytes[o + 1]! << 16) |
      (bytes[o + 2]! << 8) |
      bytes[o + 3]!) >>>
    0
  )
}

function u32le(bytes: Uint8Array, o: number): number {
  return (
    ((bytes[o + 3]! << 24) |
      (bytes[o + 2]! << 16) |
      (bytes[o + 1]! << 8) |
      bytes[o]!) >>>
    0
  )
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

/**
 * Payload heuristics: does this byte range plausibly carry a C2PA/JUMBF
 * manifest? Accepts either the exact APP11 header prefix or a JUMBF box
 * signature, so detection works across spec revisions and producers.
 */
function looksLikeC2paPayload(data: Uint8Array): boolean {
  const head = asciiAt(data, 0, Math.min(64, data.length))
  if (head.startsWith(C2PA_APP11_HEADER)) return true
  // JUMBF superbox: 4-byte length + 'jumb' box type
  if (data.length >= 8 && asciiAt(data, 4, 4) === 'jumb') return true
  const text = asciiAt(data, 0, Math.min(MAX_DECODE_BYTES, data.length))
  return text.includes('jumb') && text.includes('c2pa')
}

// ─── Manifest field extraction (best-effort, literal-only) ───────────────────

function grabJsonString(text: string, key: string): string | null {
  const m = text.match(new RegExp('"' + key + '"\\s*:\\s*"([^"]{0,300})"'))
  return m && m[1] ? m[1] : null
}

function buildInfo(
  container: C2paContainer,
  containerLabel: string,
  payload: Uint8Array,
): C2paInfo {
  const text = latin1(
    payload.subarray(0, Math.min(MAX_DECODE_BYTES, payload.length)),
  )
  const fields: C2paField[] = []

  const claimGenerator = grabJsonString(text, 'claim_generator')
  const softwareAgent = grabJsonString(text, 'softwareAgent')
  const model = grabJsonString(text, 'model')

  if (claimGenerator) fields.push({ key: 'claim_generator', value: claimGenerator })
  if (softwareAgent) fields.push({ key: 'softwareAgent', value: softwareAgent })
  if (model) fields.push({ key: 'model', value: model })

  return {
    container,
    containerLabel,
    creationTool: claimGenerator ?? softwareAgent ?? undefined,
    modelHint: model ?? undefined,
    fields,
  }
}

// ─── Per-format detectors ─────────────────────────────────────────────────────

/** JPEG: walk the segment stream collecting APP11 (0xFFEB) payloads. */
function extractC2paFromJpeg(bytes: Uint8Array): C2paInfo | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null

  const payloads: Uint8Array[] = []
  let off = 2
  while (off + 4 <= bytes.length) {
    if (bytes[off] !== 0xff) break
    const marker = bytes[off + 1]!
    // Standalone markers without a length field
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      off += 2
      continue
    }
    // EOI or start of scan — the header region is over
    if (marker === 0xd9 || marker === 0xda) break
    const len = (bytes[off + 2]! << 8) | bytes[off + 3]!
    if (len < 2) break
    const dataStart = off + 4
    const dataEnd = Math.min(off + 2 + len, bytes.length)
    if (marker === 0xeb && dataEnd > dataStart) {
      payloads.push(bytes.subarray(dataStart, dataEnd))
    }
    off = off + 2 + len
  }

  const c2paPayloads = payloads.filter(looksLikeC2paPayload)
  if (c2paPayloads.length === 0) return null
  return buildInfo('app11-jumbf', 'APP11 JUMBF', concatBytes(c2paPayloads))
}

/**
 * PNG: walk the chunk stream for C2PA ancillary chunks (caBX current;
 * caMs / caSt legacy-deprecated). CRCs are not validated (detection only).
 */
function extractC2paFromPng(bytes: Uint8Array): C2paInfo | null {
  if (!isPng(bytes)) return null
  const c2paChunks = new Set(['caBX', 'caMs', 'caSt'])
  let offset = 8
  while (offset + 8 <= bytes.length) {
    const length = u32be(bytes, offset)
    const type = asciiAt(bytes, offset + 4, 4)
    const dataStart = offset + 8
    // Bounds check — corrupt trailing chunk stops the walk
    if (dataStart + length + 4 > bytes.length) break
    if (c2paChunks.has(type)) {
      const data = bytes.subarray(dataStart, dataStart + length)
      if (looksLikeC2paPayload(data)) {
        return buildInfo('png-chunk', `PNG ${type}`, data)
      }
    }
    offset = dataStart + length + 4
  }
  return null
}

/**
 * WebP: walk the RIFF chunk list. The spec's C2PA WebP embedding uses a
 * dedicated chunk carrying the JUMBF payload; because support is newer and
 * FourCCs vary across producers/spec drafts, any chunk whose FourCC or
 * payload signature matches counts (FourCC recorded as the carrier label).
 */
function extractC2paFromWebp(bytes: Uint8Array): C2paInfo | null {
  if (
    bytes.length < 12 ||
    asciiAt(bytes, 0, 4) !== 'RIFF' ||
    asciiAt(bytes, 8, 4) !== 'WEBP'
  ) {
    return null
  }
  const knownFourCCs = new Set(['c2pa', 'caBX', 'jumb'])
  let off = 12
  while (off + 8 <= bytes.length) {
    const fourcc = asciiAt(bytes, off, 4)
    const size = u32le(bytes, off + 4)
    const dataStart = off + 8
    const dataEnd = Math.min(dataStart + size, bytes.length)
    const data = bytes.subarray(dataStart, dataEnd)
    if (knownFourCCs.has(fourcc) || looksLikeC2paPayload(data)) {
      return buildInfo('riff-chunk', `RIFF ${fourcc}`, data)
    }
    // RIFF chunks are word-aligned — odd sizes carry one pad byte
    off = dataStart + size + (size % 2)
  }
  return null
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Detect a C2PA/JUMBF manifest in a raw file buffer.
 * Returns null when absent or when the container is malformed — never throws.
 */
export function extractC2pa(
  bytes: Uint8Array,
  format: ImageFormat,
): C2paInfo | null {
  try {
    switch (format) {
      case 'jpeg':
        return extractC2paFromJpeg(bytes)
      case 'png':
        return extractC2paFromPng(bytes)
      case 'webp':
        return extractC2paFromWebp(bytes)
      default:
        return null
    }
  } catch {
    return null
  }
}

/**
 * Find an IPTC Digital Source Type value indicating trained-algorithmic
 * (AI-generated) media. Checked in the XMP tag map (JPEG/WebP via exifr) and,
 * for PNG, inside decoded text chunks (XMP lives in an iTXt there).
 * Returns the literal value matched, or null.
 */
export function findDigitalSourceType(
  xmp?: Record<string, unknown> | null,
  pngChunks?: PngTextChunk[] | null,
): string | null {
  if (xmp) {
    for (const value of Object.values(xmp)) {
      if (typeof value === 'string' && value.includes(TRAINED_ALGO_MARKER)) {
        return value
      }
    }
  }
  if (pngChunks) {
    for (const chunk of pngChunks) {
      if (chunk.failed) continue
      if (chunk.value.includes(TRAINED_ALGO_MARKER)) {
        // Prefer the canonical URI when the chunk embeds full XMP
        const uri = chunk.value.match(
          new RegExp('https?://[^\\s"\']*' + TRAINED_ALGO_MARKER),
        )
        return uri ? (uri[0] ?? null) : chunk.value.slice(0, 300)
      }
    }
  }
  return null
}