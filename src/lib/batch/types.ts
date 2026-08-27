import type { ImageMetadata } from '../metadata/unified'

/** Per-file state machine (plan §6): queued → analyzing → analyzed (+ error). */
export type FileStatus = 'queued' | 'analyzing' | 'analyzed' | 'error'

export interface BatchFile {
  /** Stable id (not the File name) so cards/labels survive re-renders. */
  id: string
  file: File
  /** Client-generated thumbnail object URL (revoked on removal/reset). */
  thumbUrl: string | null
  status: FileStatus
  metadata?: ImageMetadata
  /** Populated when analysis or decoding failed; shown inline on the card. */
  error?: string
  /** Human-readable accept/validation message (e.g. oversized file). */
  note?: string
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
