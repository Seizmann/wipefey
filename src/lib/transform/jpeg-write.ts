/**
 * JPEG metadata rewrite via piexifjs (Phase 3).
 *
 * Injects a minimal, intentional EXIF block into a canvas-stripped JPEG:
 *   0th IFD  → Software         = "Wipefey by RexiO"
 *   Exif IFD → DateTimeOriginal = "YYYY:MM:DD HH:MM:SS"  (local time, EXIF spec)
 *
 * Nothing else is written. No Make, Model, Artist, Copyright, GPS, or any
 * other field. The canvas-stripped input carries no prior EXIF, so piexifjs
 * creates a clean EXIF block from scratch — no carry-over risk.
 *
 * piexifjs operates on base64-encoded JPEG strings (pre-ArrayBuffer era API).
 * The round-trip is:
 *   ArrayBuffer → Uint8Array → binary string → btoa → piexif.insert → atob → Uint8Array → Blob
 *
 * Footgun: btoa() requires valid latin-1 input. We use String.fromCharCode
 * in chunks (to avoid call-stack overflow on large buffers) — NOT TextDecoder.
 */

import piexif from 'piexifjs'

export class JpegWriteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'JpegWriteError'
  }
}

/**
 * Format a Date as the EXIF datetime string "YYYY:MM:DD HH:MM:SS" in local time.
 * EXIF spec (JEITA CP-3451C §4.6.4) specifies local time with no timezone.
 */
function formatExifDate(date: Date): string {
  const yyyy = date.getFullYear().toString().padStart(4, '0')
  const mm = (date.getMonth() + 1).toString().padStart(2, '0')
  const dd = date.getDate().toString().padStart(2, '0')
  const hh = date.getHours().toString().padStart(2, '0')
  const min = date.getMinutes().toString().padStart(2, '0')
  const ss = date.getSeconds().toString().padStart(2, '0')
  return `${yyyy}:${mm}:${dd} ${hh}:${min}:${ss}`
}

/**
 * Convert a Uint8Array to a binary string without blowing the call stack.
 * btoa() requires a binary string where each char code ≤ 255.
 * Using spread (...arr) into String.fromCharCode fails for large arrays
 * because it exceeds the maximum argument count. We chunk instead.
 */
function uint8ToBinaryString(bytes: Uint8Array): string {
  const CHUNK = 8192
  let result = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    result += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return result
}

/**
 * Rewrite the supplied canvas-stripped JPEG buffer with minimal Wipefey metadata.
 *
 * @param buf  Uint8Array of a valid JPEG (no existing EXIF expected, but harmless if present).
 * @returns    A new Blob (image/jpeg) containing Software + DateTimeOriginal EXIF.
 */
export function rewriteJpeg(buf: Uint8Array): Blob {
  const now = new Date()

  // Build a clean EXIF object — only the two fields we want.
  const exifObj: piexif.ExifDict = {
    '0th': {
      [piexif.ImageIFD.Software]: 'Wipefey by RexiO',
    },
    Exif: {
      [piexif.ExifIFD.DateTimeOriginal]: formatExifDate(now),
    },
    GPS: {},
    '1st': {},
  }

  let exifBytes: string
  try {
    exifBytes = piexif.dump(exifObj)
  } catch (err) {
    throw new JpegWriteError(
      `piexifjs dump failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  // piexifjs works on base64-encoded JPEG data strings.
  const binaryStr = uint8ToBinaryString(buf)
  const b64 = btoa(binaryStr)
  const dataUrl = `data:image/jpeg;base64,${b64}`

  let inserted: string
  try {
    inserted = piexif.insert(exifBytes, dataUrl)
  } catch (err) {
    throw new JpegWriteError(
      `piexifjs insert failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  // Strip the data URL prefix and decode back to bytes.
  const base64Data = inserted.replace(/^data:[^;]+;base64,/, '')
  const binaryOut = atob(base64Data)
  const outBytes = new Uint8Array(binaryOut.length)
  for (let i = 0; i < binaryOut.length; i++) {
    outBytes[i] = binaryOut.charCodeAt(i)
  }

  return new Blob([outBytes], { type: 'image/jpeg' })
}
