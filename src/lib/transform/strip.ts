/**
 * Canvas-based metadata strip (Phase 3).
 *
 * Draws the image onto an HTMLCanvasElement and re-encodes via toBlob().
 * The re-encode constructs the output stream from raw pixel data only —
 * EXIF, XMP, IPTC, ICC profiles, and PNG text chunks are all discarded.
 *
 * Output format contract (per REQUIREMENT.md §5.3):
 *   JPEG  → JPEG  (quality 0.92)
 *   PNG   → PNG   (always — never promoted to JPEG regardless of alpha)
 *   WebP  → WebP  (quality 0.92; falls back to JPEG if browser returns null)
 *   HEIC  → JPEG  (the only format exception; HEIC cannot be canvas-encoded)
 *
 * This module is browser-only. It cannot run in Node (no HTMLCanvasElement).
 * The canvas-strip step is manually verified in-browser after Vercel deploy;
 * see PROGRESS.md (Phase 3) for the documented testing gap.
 */

import type { ImageFormat } from '../metadata/unified'

export class StripError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StripError'
  }
}

/**
 * Strip all metadata from `blob` by re-encoding through an HTMLCanvasElement.
 *
 * @param blob   The source image blob.
 * @param format The detected format (from detectFormat).
 * @returns      A new Blob with identical pixel content but zero metadata.
 *               The mime type and format of the returned blob are documented
 *               in the output format contract above.
 */
export async function stripImage(
  blob: Blob,
  format: ImageFormat,
): Promise<{ stripped: Blob; outputFormat: ImageFormat; note?: string }> {
  // HEIC: createImageBitmap is only supported in Safari on Apple platforms.
  // We attempt it and fall back gracefully to a JPEG output; if decoding
  // itself fails, StripError is thrown so run.ts surfaces a clear message.
  //
  // For all other unsupported formats (ImageFormat = 'other') we refuse early.
  if (format === 'other') {
    throw new StripError(
      'Unsupported format — Wipefey cannot strip this file type.',
    )
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(blob)
  } catch {
    if (format === 'heic') {
      throw new StripError(
        'Could not decode this HEIC — your browser may not support it. Try converting to JPEG or PNG first.',
      )
    }
    throw new StripError(
      'Could not decode this image — it may be corrupt or an unsupported variant.',
    )
  }

  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new StripError('Could not acquire a 2D canvas context.')
  }
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()

  // Determine output mime type per format contract.
  const { mime, outputFormat, note } = resolveOutput(format)

  const stripped = await blobFromCanvas(canvas, mime)
  if (!stripped) {
    if (format === 'webp') {
      // Browser returned null for WebP — fall back to JPEG.
      const jpegBlob = await blobFromCanvas(canvas, 'image/jpeg')
      if (!jpegBlob) {
        throw new StripError('Canvas refused to encode this image as JPEG.')
      }
      return {
        stripped: jpegBlob,
        outputFormat: 'jpeg',
        note: 'WebP encoding not available in this browser — output saved as JPEG.',
      }
    }
    throw new StripError(`Canvas refused to encode this image as ${mime}.`)
  }

  return { stripped, outputFormat, note }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveOutput(format: ImageFormat): {
  mime: string
  outputFormat: ImageFormat
  note?: string
} {
  switch (format) {
    case 'jpeg':
      return { mime: 'image/jpeg', outputFormat: 'jpeg' }
    case 'png':
      return { mime: 'image/png', outputFormat: 'png' }
    case 'webp':
      return { mime: 'image/webp', outputFormat: 'webp' }
    case 'heic':
      // HEIC cannot be canvas-encoded by any browser; output JPEG.
      return {
        mime: 'image/jpeg',
        outputFormat: 'jpeg',
        note: 'HEIC was converted to JPEG — HEIC encoding is not supported in any browser.',
      }
    default:
      // 'other' is guarded above; this branch satisfies exhaustiveness.
      return { mime: 'image/jpeg', outputFormat: 'jpeg' }
  }
}

function blobFromCanvas(
  canvas: HTMLCanvasElement,
  mime: string,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    const quality = mime === 'image/png' ? undefined : 0.92
    canvas.toBlob((b) => resolve(b), mime, quality)
  })
}
