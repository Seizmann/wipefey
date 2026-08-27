import type { BatchFile } from './types'
import {
  isSupportedFile,
  MAX_FILE_COUNT,
  MAX_FILE_SIZE,
} from './types'

/** Per-file rejection to surface inline/transiently. */
export interface Rejection {
  name: string
  reason: string
}

/**
 * Pure file-validation for the DropZone (plan §6).
 * Enforces: 50-file batch cap, 25MB/file, supported extension. Each rejected
 * file carries a specific, human message (which file + why).
 */
export function validateFiles(
  incoming: File[],
  currentCount: number,
): { accepted: File[]; rejected: Rejection[]; overflow: Rejection[] } {
  const accepted: File[] = []
  const rejected: Rejection[] = []
  const overflow: Rejection[] = []

  for (const file of incoming) {
    if (!isSupportedFile(file)) {
      rejected.push({
        name: file.name,
        reason: `Unsupported format. Wipefey accepts JPEG, PNG, WebP and HEIC.`,
      })
      continue
    }
    if (file.size > MAX_FILE_SIZE) {
      rejected.push({
        name: file.name,
        reason: `File is ${formatBytes(file.size)} — the limit is 25 MB per photo.`,
      })
      continue
    }
    // Enforce the batch cap: after filling the remaining slots, extras overflow.
    if (accepted.length + currentCount >= MAX_FILE_COUNT) {
      overflow.push({
        name: file.name,
        reason: `Batch is full (max ${MAX_FILE_COUNT} photos). Your other files were added.`,
      })
      continue
    }
    accepted.push(file)
  }

  return { accepted, rejected, overflow }
}

/** Produce a thumbnail object URL for a file (used by cards). Revoke later. */
export function createThumbUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve(url)
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Build a new BatchFile entry in `queued` state. */
export function createBatchFile(file: File, thumbUrl: string | null): BatchFile {
  return {
    id: crypto.randomUUID(),
    file,
    thumbUrl,
    status: 'queued',
  }
}
