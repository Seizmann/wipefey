import type {
  ImageFormat,
  ImageMetadata,
  PngTextChunk,
} from './unified'
import {
  extractPngTextChunks,
  isPng,
} from './png'
import { extractC2pa, findDigitalSourceType } from './c2pa'
import { extractWithExifr } from './exif'

/**
 * Dispatcher (plan §3): detects the format from the leading bytes and routes
 * to the correct extractor, returning the unified ImageMetadata shape.
 *
 * Every path is wrapped so a corrupt / unsupported file degrades to a
 * `warning` message (and a minimal shape) instead of throwing into the batch.
 */

const JPEG_SOI = [0xff, 0xd8, 0xff]
const WEBP_RIFF = [0x52, 0x49, 0x46, 0x46] // "RIFF"
const WEBP_WEBP = [0x57, 0x45, 0x42, 0x50] // "WEBP" at offset 8
const HEIC_FTYP = [0x66, 0x74, 0x79, 0x70] // "ftyp" at offset 4

export function detectFormat(bytes: Uint8Array): ImageFormat {
  if (bytes.length >= 3 && matches(bytes, 0, JPEG_SOI)) return 'jpeg'
  if (isPng(bytes)) return 'png'
  if (
    bytes.length >= 12 &&
    matches(bytes, 0, WEBP_RIFF) &&
    matches(bytes, 8, WEBP_WEBP)
  ) {
    return 'webp'
  }
  // HEIC/HEIF: ISO BMFF container with "ftyp" major brand heic/heif/mif1…
  if (
    bytes.length >= 12 &&
    matches(bytes, 4, HEIC_FTYP)
  ) {
    // Brand bytes = ftyp + 4-byte major brand (heic/heix/hevc/mif1/msf1)
    const brand = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!)
    if (/^(heic|heix|hevc|heim|heis|mif1|msf1|avif)$/.test(brand)) return 'heic'
    return 'other'
  }
  return 'other'
}

function matches(bytes: Uint8Array, offset: number, sig: number[]): boolean {
  if (offset + sig.length > bytes.length) return false
  for (let i = 0; i < sig.length; i++) {
    if (bytes[offset + i] !== sig[i]) return false
  }
  return true
}

/** Soft detection used for clear user-facing error messages. */
export function isSupportedFormat(f: ImageFormat): boolean {
  return f !== 'other'
}

async function readBytes(file: Blob): Promise<Uint8Array> {
  const buf = await file.arrayBuffer()
  return new Uint8Array(buf)
}

/** PNG width/height from IHDR (first chunk after signature). */
function pngDimensions(bytes: Uint8Array): { width?: number; height?: number } {
  if (bytes.length < 24) return {}
  // IHDR: length(4) + "IHDR"(4) + width(4) + height(4)
  const type = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!)
  if (type !== 'IHDR') return {}
  const width =
    (bytes[16]! << 24) | (bytes[17]! << 16) | (bytes[18]! << 8) | bytes[19]!
  const height =
    (bytes[20]! << 24) | (bytes[21]! << 16) | (bytes[22]! << 8) | bytes[23]!
  return { width, height }
}

/**
 * Extract unified metadata from an image File/Blob.
 * Never throws for bad input — returns a minimal shape + warning instead.
 */
export async function extractImageMetadata(file: Blob): Promise<ImageMetadata> {
  const parsedAt = Date.now()
  let bytes: Uint8Array
  try {
    bytes = await readBytes(file)
  } catch {
    return {
      format: 'other',
      parsedAt,
      warning: 'Could not read this file — it may be corrupt.',
    }
  }

  const format = detectFormat(bytes)

  if (!isSupportedFormat(format)) {
    return {
      format,
      parsedAt,
      warning:
        'Unsupported format. Wipefey supports JPEG, PNG, WebP and HEIC (HEIC needs a compatible browser).',
    }
  }

  if (format === 'png') {
    // PNG: custom chunk reader is the primary channel. exifr can carry XMP
    // (often inside an iTXt 'XML:com.adobe.xmp' chunk, already captured) so
    // we rely on png.ts here and skip exifr's PNG path entirely.
    let pngChunks: PngTextChunk[] | null = null
    let warning: string | undefined
    try {
      pngChunks = await extractPngTextChunks(bytes)
    } catch {
      warning =
        'PNG text chunks could not be fully decoded — this file may be corrupt.'
    }
    return {
      format: 'png',
      ...pngDimensions(bytes),
      pngChunks: pngChunks ?? [],
      // C2PA manifests ride in caBX/caMs/caSt ancillary chunks
      c2pa: extractC2pa(bytes, format),
      // PNG XMP (incl. IPTC DigitalSourceType) lives in text chunks
      digitalSourceType: findDigitalSourceType(null, pngChunks),
      parsedAt,
      warning,
    }
  }

  // JPEG / WebP / HEIC via exifr
  try {
    const r = await extractWithExifr(file)
    // If exifr found nothing at all (corrupt/truncated file), surface a warning
    // instead of returning a silently empty result. Note: exifr returns undefined
    // (not null) when it finds no data, so we use falsy checks here.
    const nothingFound = !r.exif && !r.camera && !r.gps && !r.iptc && !r.xmp
    const warning =
      nothingFound
        ? 'No metadata found — this file may be corrupt or have all metadata stripped.'
        : format === 'heic'
          ? 'HEIC parsing is best-effort in this browser and may be limited.'
          : undefined
    return {
      format,
      exif: r.exif ?? undefined,
      iptc: r.iptc ?? undefined,
      xmp: r.xmp ?? undefined,
      icc: r.icc ?? undefined,
      gps: r.gps,
      camera: r.camera,
      dates: r.dates,
      // C2PA manifests ride in JPEG APP11 / WebP RIFF chunks
      c2pa: extractC2pa(bytes, format),
      digitalSourceType: findDigitalSourceType(r.xmp),
      parsedAt,
      warning,
    }
  } catch {
    return {
      format,
      parsedAt,
      warning:
        format === 'heic'
          ? 'Could not parse this HEIC — your browser may not support it. Try JPEG or PNG.'
          : 'Could not parse metadata in this file — it may be corrupt.',
    }
  }
}
