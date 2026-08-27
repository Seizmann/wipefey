/**
 * Transform orchestrator (Phase 3).
 *
 * Coordinates: strip → verify → rewrite → result, per file.
 *
 *   1. HEIC guard: surface a clear error before touching the canvas.
 *   2. Strip via canvas re-encode (browser API — see strip.ts).
 *   3. Verify the stripped blob by re-running extractImageMetadata() — hard gate.
 *   4. Rewrite: inject minimal Wipefey metadata back into the stripped blob.
 *   5. Return a TransformResult the store can commit atomically.
 *
 * Error philosophy: unlike the read side (index.ts warns instead of throws),
 * transform errors DO throw internally — they are caught here and returned as
 * a typed TransformResult so the store never has to try/catch. Every error
 * path returns { ok: false, error } with a human message. There is no partial
 * success: either the transform completes fully (ok: true) or the original
 * file is left untouched (the store does not mutate on ok: false).
 *
 * The _stripFn parameter allows the verify script to inject a pre-stripped
 * buffer without a real HTMLCanvasElement (since Node has no canvas).
 * In production the default is always used; the override is never shipped
 * to the UI.
 */

import type { ImageFormat } from '../metadata/unified'
import type { BatchFile } from '../batch/types'
import { extractImageMetadata } from '../metadata'
import { stripImage, StripError } from './strip'
import { isClean } from './verify'
import { rewriteJpeg, JpegWriteError } from './jpeg-write'
import { rewritePng, PngWriteError } from './png-write'

// ── Result type ───────────────────────────────────────────────────────────────

export type TransformResult =
  | { ok: true; blob: Blob; outputFormat: ImageFormat; note?: string }
  | { ok: false; error: string }

// ── Strip override type (for Node testing only) ───────────────────────────────

export type StripFn = (
  blob: Blob,
  format: ImageFormat,
) => Promise<{ stripped: Blob; outputFormat: ImageFormat; note?: string }>

// ── Main orchestrator ─────────────────────────────────────────────────────────

/**
 * Run the full Phase 3 transform pipeline for one file.
 *
 * @param batchFile  The BatchFile to transform (must be in 'analyzed' status).
 * @param _stripFn   Optional strip function override (test/verify only).
 *                   Defaults to the canvas-based stripImage().
 */
export async function runTransform(
  batchFile: BatchFile,
  _stripFn?: StripFn,
): Promise<TransformResult> {
  const { file, metadata } = batchFile
  if (!metadata) {
    return {
      ok: false,
      error: 'Cannot transform — metadata was not extracted yet.',
    }
  }

  const format = metadata.format

  // ── 1. HEIC guard: we allow HEIC → JPEG (the only format exception), but
  //    only if the canvas can actually decode it. If stripImage fails, we
  //    surface a clear message. We do NOT short-circuit HEIC here — the canvas
  //    attempt is the right path (Safari supports it). The StripError from
  //    strip.ts already carries a good human message.

  // ── 2. Strip ────────────────────────────────────────────────────────────────
  const stripFn = _stripFn ?? stripImage
  let stripped: Blob
  let outputFormat: ImageFormat
  let stripNote: string | undefined

  try {
    const result = await stripFn(file, format)
    stripped = result.stripped
    outputFormat = result.outputFormat
    stripNote = result.note
  } catch (err) {
    const msg =
      err instanceof StripError
        ? err.message
        : `Strip failed: ${err instanceof Error ? err.message : String(err)}`
    return { ok: false, error: msg }
  }

  // ── 3. Verify-strip gate ────────────────────────────────────────────────────
  let strippedMeta: Awaited<ReturnType<typeof extractImageMetadata>>
  try {
    strippedMeta = await extractImageMetadata(stripped)
  } catch {
    return {
      ok: false,
      error: 'Verify step failed — could not re-read the stripped file.',
    }
  }

  const cleanResult = isClean(strippedMeta)
  if (cleanResult !== true) {
    return {
      ok: false,
      error: `Metadata strip failed — field "${cleanResult}" leaked through. This file was not saved.`,
    }
  }

  // ── 4. Rewrite ──────────────────────────────────────────────────────────────
  // WebP: no rewrite (no reliable pure-JS WebP EXIF writer without new deps).
  // HEIC→JPEG: treat outputFormat as jpeg for the rewrite step.
  let finalBlob: Blob
  let rewriteNote: string | undefined

  try {
    if (outputFormat === 'jpeg') {
      const buf = await blobToUint8Array(stripped)
      finalBlob = rewriteJpeg(buf)
    } else if (outputFormat === 'png') {
      const buf = await blobToUint8Array(stripped)
      finalBlob = rewritePng(buf)
    } else {
      // WebP: return the stripped blob as-is with an informational note.
      finalBlob = stripped
      rewriteNote =
        'WebP: Software and DateTime tags were not written — no WebP EXIF writer in v1.'
    }
  } catch (err) {
    const msg =
      err instanceof JpegWriteError || err instanceof PngWriteError
        ? err.message
        : `Rewrite failed: ${err instanceof Error ? err.message : String(err)}`
    return { ok: false, error: msg }
  }

  // Combine any notes from strip + rewrite phases.
  const note = [stripNote, rewriteNote].filter(Boolean).join(' ') || undefined

  return { ok: true, blob: finalBlob, outputFormat, note }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  const buf = await blob.arrayBuffer()
  return new Uint8Array(buf)
}
