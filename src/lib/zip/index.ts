/**
 * ZIP export + download helpers (Phase 4).
 *
 * ZIP packaging uses fflate (decision D3 in AGENT.md — fflate replaces the
 * unmaintained JSZip). All zip-building logic lives here, not in components:
 * components call buildTransformedZip() + downloadBlob() (or the per-file
 * downloadTransformedFile() convenience) and never touch fflate directly.
 *
 * The zip-building functions are Node-safe (no DOM at module scope) so the
 * verify:phase4 script can exercise them; the DOM anchor-click download is
 * isolated in downloadBlob().
 */

import { zip } from 'fflate'
import type { BatchFile } from '../batch/types'
import type { ImageFormat } from '../metadata/unified'

/** Archive name used by the "Download all as ZIP" batch action. */
export const ZIP_FILENAME = 'wipefey-transformed.zip'

/**
 * File extension for a given output format, per the Phase 3 format contract:
 * JPEG→JPEG, PNG→PNG, WebP→WebP (JPEG fallback), HEIC→JPEG only.
 * 'heic' never occurs as an output but maps to .jpg defensively; 'other' is
 * never emitted by runTransform and falls back to .jpg as the safe default.
 */
export function extensionForFormat(format: ImageFormat): string {
  switch (format) {
    case 'png':
      return '.png'
    case 'webp':
      return '.webp'
    case 'jpeg':
    case 'heic':
    case 'other':
      return '.jpg'
  }
}

/**
 * Output filename for a transformed file: original stem + the extension
 * matching the actual output format. E.g. `photo.heic` (outputFormat 'jpeg')
 * → `photo.jpg`; `IMG_0001.PNG` (outputFormat 'png') → `IMG_0001.png`.
 */
export function outputFileName(name: string, format: ImageFormat): string {
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  return `${stem}${extensionForFormat(format)}`
}

/** Best-effort format recovery from a Blob MIME type (defensive only — the
 *  store normally persists outputFormat alongside the blob). */
function formatFromBlobType(type: string): ImageFormat {
  if (type.includes('png')) return 'png'
  if (type.includes('webp')) return 'webp'
  return 'jpeg'
}

/** Read a Blob's bytes as Uint8Array for fflate. */
async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

/**
 * Build the fflate entry map for every file in 'transformed' status:
 * deduped output filenames (photo.jpg, photo-2.jpg, …) → raw bytes.
 * Skips anything not transformed — callers get exactly the cleaned set.
 */
export async function collectZipEntries(
  files: BatchFile[],
): Promise<Record<string, Uint8Array>> {
  const entries: Record<string, Uint8Array> = {}
  const used = new Set<string>()

  for (const file of files) {
    if (file.status !== 'transformed' || !file.transformedBlob) continue
    const format =
      file.outputFormat ?? formatFromBlobType(file.transformedBlob.type)
    let name = outputFileName(file.file.name, format)
    let n = 2
    while (used.has(name)) {
      const dot = name.lastIndexOf('.')
      name = `${name.slice(0, dot)}-${n}${name.slice(dot)}`
      n++
    }
    used.add(name)
    entries[name] = await blobBytes(file.transformedBlob)
  }

  return entries
}

/**
 * Bundle every transformed file into a single ZIP Blob. Stored (level 0) —
 * JPEG/PNG/WebP payloads are already compressed, so deflate would only burn
 * CPU for ~0% gain. Rejects with a human message on packaging failure.
 */
export function buildTransformedZip(files: BatchFile[]): Promise<Blob> {
  return collectZipEntries(files).then(
    (entries) =>
      new Promise<Blob>((resolve, reject) => {
        zip(entries, { level: 0 }, (err, data) => {
          if (err) {
            reject(new Error(`ZIP packaging failed: ${err.message}`))
          } else {
            resolve(new Blob([data], { type: 'application/zip' }))
          }
        })
      }),
  )
}

/**
 * Trigger a real browser download (Content-Disposition via the `download`
 * attribute — not a new tab) for the given blob. Browser-only; isolated here
 * so the rest of the module stays Node-testable.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke on a later tick — revoking synchronously can abort the download
  // in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * Download one transformed file using the blob already held in store, named
 * per the format contract (original stem + output-format extension).
 * No-op unless the file is in 'transformed' status with a blob present.
 */
export function downloadTransformedFile(file: BatchFile): void {
  if (file.status !== 'transformed' || !file.transformedBlob) return
  const format =
    file.outputFormat ?? formatFromBlobType(file.transformedBlob.type)
  downloadBlob(file.transformedBlob, outputFileName(file.file.name, format))
}
