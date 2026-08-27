/**
 * PNG tEXt chunk writer (Phase 3).
 *
 * Appends two tEXt chunks before the IEND chunk of a canvas-stripped PNG:
 *   Software = "Wipefey by RexiO"
 *   DateTime = "YYYY:MM:DD HH:MM:SS"   (local time, matches EXIF convention)
 *
 * Both keys/values are pure ASCII — tEXt (not iTXt) is correct and simpler.
 * Existing chunks (IHDR, IDAT, pHYs, etc.) pass through byte-for-byte.
 *
 * PNG CRC is ISO 3309 CRC-32 (polynomial 0xEDB88320, precomputed table,
 * seed 0xFFFFFFFF, final XOR 0xFFFFFFFF). Matches libpng's implementation
 * exactly. The verify script checks CRC correctness independently (§6D).
 *
 * This module is pure TypeScript — no browser APIs, fully testable in Node.
 */

export class PngWriteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PngWriteError'
  }
}

// ── CRC-32 (PNG spec, ISO 3309) ───────────────────────────────────────────────

/** Precomputed CRC table for the PNG polynomial 0xEDB88320. */
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c
  }
  return table
})()

/**
 * Compute CRC-32 over `data` (optionally continuing from a prior `crc`).
 * Pass `0xffffffff` as the initial crc for a fresh computation.
 */
function crc32Update(crc: number, data: Uint8Array): number {
  let c = crc
  for (let i = 0; i < data.length; i++) {
    c = (CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8)) >>> 0
  }
  return c
}

/** Compute the final PNG CRC over the chunk type bytes + chunk data. */
function pngCrc(type: Uint8Array, data: Uint8Array): number {
  let c = 0xffffffff
  c = crc32Update(c, type)
  c = crc32Update(c, data)
  return (c ^ 0xffffffff) >>> 0
}

// ── Encoding helpers ──────────────────────────────────────────────────────────

const PNG_SIGNATURE = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
])

const encoder = new TextEncoder()

function writeU32(value: number): Uint8Array {
  const buf = new Uint8Array(4)
  const view = new DataView(buf.buffer)
  view.setUint32(0, value >>> 0, false) // big-endian
  return buf
}

/**
 * Build a raw PNG chunk:
 *   length (4 bytes, big-endian) | type (4 ASCII bytes) | data | CRC (4 bytes)
 */
function buildChunk(typeStr: string, data: Uint8Array): Uint8Array {
  const typeBytes = encoder.encode(typeStr)
  const crc = pngCrc(typeBytes, data)
  const chunk = new Uint8Array(4 + 4 + data.length + 4)
  chunk.set(writeU32(data.length), 0)          // length
  chunk.set(typeBytes, 4)                       // type
  chunk.set(data, 8)                            // data
  chunk.set(writeU32(crc), 8 + data.length)    // CRC
  return chunk
}

/**
 * Build a tEXt chunk data section: `key\0value` in latin-1 (ASCII subset).
 * Keys and values here are guaranteed ASCII so latin-1 encoding is identical.
 */
function buildTextData(key: string, value: string): Uint8Array {
  // tEXt: keyword (latin-1) + null byte + text (latin-1)
  const keyBytes = encoder.encode(key)   // ASCII = latin-1
  const valBytes = encoder.encode(value) // ASCII = latin-1
  const data = new Uint8Array(keyBytes.length + 1 + valBytes.length)
  data.set(keyBytes, 0)
  data[keyBytes.length] = 0 // null separator
  data.set(valBytes, keyBytes.length + 1)
  return data
}

// ── Format helpers ────────────────────────────────────────────────────────────

/** Format a Date as the EXIF/PNG timestamp string "YYYY:MM:DD HH:MM:SS" (local time). */
function formatDateTime(date: Date): string {
  const yyyy = date.getFullYear().toString().padStart(4, '0')
  const mm = (date.getMonth() + 1).toString().padStart(2, '0')
  const dd = date.getDate().toString().padStart(2, '0')
  const hh = date.getHours().toString().padStart(2, '0')
  const min = date.getMinutes().toString().padStart(2, '0')
  const ss = date.getSeconds().toString().padStart(2, '0')
  return `${yyyy}:${mm}:${dd} ${hh}:${min}:${ss}`
}

/** Verify the 8-byte PNG signature at the start of `bytes`. */
function hasPngSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) return false
  }
  return true
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Rewrite the supplied canvas-stripped PNG with minimal Wipefey tEXt chunks.
 *
 * Strategy: walk the existing chunk stream, collect all chunks except IEND,
 * then append our two tEXt chunks, then IEND. The original IEND is always
 * the last chunk so we can safely splice just before it.
 *
 * @param buf  Uint8Array of a valid PNG (canvas-stripped, so no tEXt/iTXt expected).
 * @returns    A new Blob (image/png) with Software + DateTime tEXt chunks.
 */
export function rewritePng(buf: Uint8Array): Blob {
  if (!hasPngSignature(buf)) {
    throw new PngWriteError('Input is not a valid PNG (bad signature).')
  }

  // Collect chunk byte ranges: [offset, totalSize] for every chunk except IEND.
  // We re-use the original bytes verbatim (no re-parsing, no CRC recompute for
  // existing chunks — they are byte-for-byte identical in the output).
  const chunkSegments: Array<[number, number]> = []
  let iendSegment: [number, number] | null = null

  let offset = 8 // past the 8-byte signature
  while (offset + 8 <= buf.length) {
    const length =
      (buf[offset]! << 24) |
      (buf[offset + 1]! << 16) |
      (buf[offset + 2]! << 8) |
      buf[offset + 3]!
    const chunkLen = length >>> 0 // treat as unsigned

    const typeStr = String.fromCharCode(
      buf[offset + 4]!,
      buf[offset + 5]!,
      buf[offset + 6]!,
      buf[offset + 7]!,
    )

    const totalSize = 4 + 4 + chunkLen + 4 // length + type + data + CRC
    if (offset + totalSize > buf.length) {
      // Corrupt trailing chunk — the canvas output should never produce this,
      // but guard defensively.
      break
    }

    if (typeStr === 'IEND') {
      iendSegment = [offset, totalSize]
      break // IEND must be last; stop here
    } else {
      chunkSegments.push([offset, totalSize])
    }

    offset += totalSize
  }

  if (!iendSegment) {
    throw new PngWriteError('PNG is missing IEND chunk — file may be corrupt.')
  }

  // Build the two new tEXt chunks.
  const now = new Date()
  const softwareChunk = buildChunk(
    'tEXt',
    buildTextData('Software', 'Wipefey by RexiO'),
  )
  const dateChunk = buildChunk(
    'tEXt',
    buildTextData('DateTime', formatDateTime(now)),
  )

  // Rebuild the original IEND chunk from the raw bytes (already correct CRC).
  const [iendOffset, iendSize] = iendSegment
  const iendBytes = buf.subarray(iendOffset, iendOffset + iendSize)

  // Assemble output: signature + existing chunks + Software + DateTime + IEND
  const parts: Uint8Array[] = [PNG_SIGNATURE]
  for (const [segOffset, segSize] of chunkSegments) {
    parts.push(buf.subarray(segOffset, segOffset + segSize))
  }
  parts.push(softwareChunk)
  parts.push(dateChunk)
  parts.push(iendBytes)

  // Concatenate into a single Uint8Array.
  const totalLength = parts.reduce((sum, p) => sum + p.length, 0)
  const output = new Uint8Array(totalLength)
  let pos = 0
  for (const part of parts) {
    output.set(part, pos)
    pos += part.length
  }

  return new Blob([output], { type: 'image/png' })
}

// ── Exported for testing ──────────────────────────────────────────────────────

/**
 * Compute the PNG CRC for a chunk with the given type string and data.
 * Exported so verify-phase3.ts can independently validate the CRC
 * of written chunks (R4 in the risk register).
 */
export function computeChunkCrc(typeStr: string, data: Uint8Array): number {
  return pngCrc(encoder.encode(typeStr), data)
}
