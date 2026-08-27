import type { ImageMetadata } from '../metadata/unified'

/**
 * Per-file state machine:
 *   queued → analyzing → analyzed → transforming → transformed
 *                      ↘ error             ↘ transform-error
 */
export type FileStatus =
  | 'queued'
  | 'analyzing'
  | 'analyzed'
  | 'error'
  | 'transforming'      // canvas strip in progress
  | 'transformed'       // strip + verify + rewrite complete
  | 'transform-error'   // strip / verify / rewrite failed

export interface BatchFile {
  /** Stable id (not the File name) so cards/labels survive re-renders. */
  id: string
  /**
   * Original File object. After a successful transform this is replaced with a
   * zero-byte sentinel (same name/type) so the underlying ArrayBuffer can be
   * GC'd. Do not read file.size or file.arrayBuffer() after status=transformed.
   */
  file: File
  /** Client-generated thumbnail object URL (revoked on removal/reset). */
  thumbUrl: string | null
  status: FileStatus
  metadata?: ImageMetadata
  /** Populated when analysis or decoding failed; shown inline on the card. */
  error?: string
  /** Human-readable accept/validation message (e.g. oversized file). */
  note?: string

  // ── Phase 3 additions ──────────────────────────────────────────────────────
  /** Final output Blob (available in transformed state). Used for preview and
   *  future Phase 4 per-file + ZIP download. */
  transformedBlob?: Blob
  /** Object URL for the transformed preview thumbnail. Revoked on reset/remove. */
  transformedThumbUrl?: string
  /** Human message surfaced when status = 'transform-error'. */
  transformError?: string
  /**
   * Informational note for non-error edge cases shown below the Cleaned label.
   * E.g. "WebP: Software/DateTime tags were not written (no WebP EXIF writer in v1)."
   * Or "HEIC was converted to JPEG for compatibility."
   */
  transformNote?: string
}

export const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB
export const MAX_FILE_COUNT = 50
export const ANALYZE_CONCURRENCY = 4

export const SUPPORTED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.heif',
]

export function isSupportedFile(file: File): boolean {
  const lower = file.name.toLowerCase()
  return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}
