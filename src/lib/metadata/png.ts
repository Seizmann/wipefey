import type { PngTextChunk } from './unified'

/**
 * Custom PNG chunk reader (plan §3).
 *
 * Walks the PNG chunk stream (signature + length/type/data/crc), decodes the
 * text chunks exifr does not cover:
 *   - tEXt: latin-1 (ISO 8859-1) key + value
 *   - zTXt: latin-1 key, zlib-compressed value
 *   - iTXt: UTF-8 key, optional compression flag, optional language/translated
 *           keyword, UTF-8 value
 *
 * Every decodable chunk is surfaced — nothing is filtered here (filtering is
 * Phase 2's job). Failures are recorded per-chunk with `failed:true` rather
 * than aborting the read.
 */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

const DecompressionStreamCtor =
  typeof DecompressionStream !== 'undefined' ? DecompressionStream : undefined

/** Inflate a zlib stream to raw bytes via native DecompressionStream.
 *  Modern browsers all ship it; if unavailable we fail per-chunk instead of
 *  crashing the batch. */
async function inflateToBytes(bytes: Uint8Array): Promise<Uint8Array> {
  if (!DecompressionStreamCtor) {
    throw new Error('zlib decompression unavailable in this browser')
  }
  const ds = new DecompressionStreamCtor('deflate')
  const readable = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(ds)
  const reader = readable.getReader()
  const out: number[] = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    for (let i = 0; i < value.length; i++) out.push(value[i]!)
  }
  return new Uint8Array(out)
}

function latin1(bytes: Uint8Array): string {
  // ISO 8859-1: one byte per code unit, identity mapping.
  return new TextDecoder('iso-8859-1').decode(bytes)
}

export function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) return false
  }
  return true
}

function readU32(data: Uint8Array, o: number): number {
  return (
    (data[o]! << 24) |
    (data[o + 1]! << 16) |
    (data[o + 2]! << 8) |
    data[o + 3]!
  )
}

/**
 * Extract PNG text chunks. Returns null when the buffer is not a PNG or the
 * stream is corrupt past recovery. Always an array (possibly empty) for PNGs.
 */
export async function extractPngTextChunks(
  bytes: Uint8Array,
): Promise<PngTextChunk[] | null> {
  if (!isPng(bytes)) return null

  const chunks: PngTextChunk[] = []
  let offset = 8 // past the 8-byte signature

  // Guard against absurd loop counts on corrupt input: PNG max chunk len is
  // 2^31-1 and total file can't exceed buffer length.
  while (offset + 8 <= bytes.length) {
    const length = readU32(bytes, offset)
    const type = String.fromCharCode(
      bytes[offset + 4]!,
      bytes[offset + 5]!,
      bytes[offset + 6]!,
      bytes[offset + 7]!,
    )
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    // length bounds check
    if (length < 0 || dataEnd + 4 > bytes.length) {
      // corrupt trailing chunk — stop, keep what we have
      break
    }
    const chunkData = bytes.subarray(dataStart, dataEnd)

    try {
      if (type === 'tEXt') {
        chunks.push(parseTExt(chunkData))
      } else if (type === 'zTXt') {
        chunks.push(await parseZTxt(chunkData))
      } else if (type === 'iTXt') {
        chunks.push(await parseITxt(chunkData))
      }
      // Other chunks (IDAT, IHDR, IEND, tIME, pHYs...) are ignored here —
      // text-only reader.
    } catch {
      chunks.push({
        type: type as PngTextChunk['type'],
        key: '',
        value: '',
        compressed: type === 'zTXt',
        failed: true,
      })
    }

    // advance past data + 4-byte CRC
    offset = dataEnd + 4
  }

  return chunks
}

function parseTExt(data: Uint8Array): PngTextChunk {
  const nul = data.indexOf(0)
  const key = latin1(data.subarray(0, nul === -1 ? data.length : nul))
  const value = latin1(data.subarray(nul === -1 ? data.length : nul + 1))
  return { type: 'tEXt', key, value, compressed: false }
}

async function parseZTxt(data: Uint8Array): Promise<PngTextChunk> {
  const nul = data.indexOf(0)
  if (nul === -1) {
    return { type: 'zTXt', key: '', value: '', compressed: true, failed: true }
  }
  const key = latin1(data.subarray(0, nul))
  // byte after nul is the compression method — must be 0 (deflate)
  const method = data[nul + 1]
  const compressed = data.subarray(nul + 2)
  if (method !== 0) {
    return { type: 'zTXt', key, value: '', compressed: true, failed: true }
  }
  try {
    // zTXt value is ISO 8859-1 text, compressed. Latin-1 decode via iso-8859-1.
    const value = latin1(await inflateToBytes(compressed))
    return { type: 'zTXt', key, value, compressed: true }
  } catch {
    return { type: 'zTXt', key, value: '', compressed: true, failed: true }
  }
}

async function parseITxt(data: Uint8Array): Promise<PngTextChunk> {
  // iTXt layout:
  //   keyword (latin-1, 0-terminated)
  //   compression flag (1 byte)
  //   compression method (1 byte)
  //   language tag (latin-1, 0-terminated)
  //   translated keyword (UTF-8, 0-terminated)
  //   text (UTF-8, rest)
  const k0 = data.indexOf(0)
  if (k0 === -1) return { type: 'iTXt', key: '', value: '', compressed: false, failed: true }
  const key = latin1(data.subarray(0, k0))
  const compFlag = data[k0 + 1]
  const compMethod = data[k0 + 2]
  // language tag + translated keyword (both 0-terminated)
  let p = k0 + 3
  // skip language tag
  while (p < data.length && data[p] !== 0) p++
  if (p >= data.length) return { type: 'iTXt', key, value: '', compressed: false, failed: true }
  p++ // past language nul
  // skip translated keyword
  while (p < data.length && data[p] !== 0) p++
  if (p >= data.length) return { type: 'iTXt', key, value: '', compressed: false, failed: true }
  p++ // past translated-keyword nul

  const textBytes = data.subarray(p)
  let value: string
  let compressed = false
  if (compFlag === 1 && compMethod === 0) {
    compressed = true
    try {
      // iTXt compressed payload is UTF-8 text wrapped in zlib.
      value = new TextDecoder('utf-8').decode(await inflateToBytes(textBytes))
    } catch {
      return { type: 'iTXt', key, value: '', compressed: true, failed: true }
    }
  } else {
    value = new TextDecoder('utf-8').decode(textBytes)
  }
  return { type: 'iTXt', key, value, compressed }
}
