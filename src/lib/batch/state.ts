import { create } from 'zustand'
import type { ImageMetadata } from '../metadata/unified'
import { extractImageMetadata } from '../metadata'
import type { BatchFile, FileStatus } from './types'
import { ANALYZE_CONCURRENCY } from './types'
import {
  createBatchFile,
  createThumbUrl,
  validateFiles,
  type Rejection,
} from './reducer'

interface BatchState {
  files: BatchFile[]
  /** Transient rejections from the last add (which file + why). */
  rejections: Rejection[]
  selectedId: string | null
  /** A pending analysis run token to avoid races on rapid adds. */
  analyzeSeq: number

  addFiles: (incoming: File[]) => void
  selectFile: (id: string | null) => void
  removeFile: (id: string) => void
  reset: () => void
  dismissRejections: () => void

  _setStatus: (id: string, status: FileStatus) => void
  _setMetadata: (id: string, metadata: ImageMetadata) => void
  _setError: (id: string, error: string) => void
  _setThumb: (id: string, thumbUrl: string | null) => void
}

/**
 * Batch store (plan §6 FSM). Analyze runs in parallel with a fixed
 * concurrency cap; state transitions are idempotent + keyed by a run token so
 * a stale addFiles cannot clobber newer analysis results.
 */
export const useBatchStore = create<BatchState>((set, get) => {
  const patchFile = (id: string, patch: Partial<BatchFile>) =>
    set((s) => ({
      files: s.files.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }))

  const setStatus = (id: string, status: FileStatus) => patchFile(id, { status })
  const setMetadata = (id: string, metadata: ImageMetadata) =>
    patchFile(id, { metadata, status: 'analyzed' })
  const setError = (id: string, error: string) =>
    patchFile(id, { status: 'error', error })

  return {
    files: [],
    rejections: [],
    selectedId: null,
    analyzeSeq: 0,

    addFiles: (incoming) => {
      const state = get()
      const { accepted, rejected, overflow } = validateFiles(
        incoming,
        state.files.length,
      )
      const allRejected = [...rejected, ...overflow]

      if (accepted.length === 0) {
        set((s) => ({
          rejections: [...s.rejections, ...allRejected],
        }))
        return
      }

      const seq = get().analyzeSeq + 1
      set((s) => ({
        analyzeSeq: seq,
        files: [
          ...s.files,
          ...accepted.map((f) => createBatchFile(f, null)),
        ],
        rejections: [...s.rejections, ...allRejected],
      }))

      // Generate thumbnails async, then kick off analysis.
      void (async () => {
        for (const file of accepted) {
          const id = useBatchStore.getState().files.find(
            (f) => f.file === file,
          )?.id
          if (!id) continue
          const thumbUrl = await createThumbUrl(file)
          useBatchStore.getState()._setThumb(id, thumbUrl)
        }
      })()
      void runAnalysis(accepted, seq)
    },

    selectFile: (id) => set({ selectedId: id }),

    removeFile: (id) =>
      set((s) => {
        const target = s.files.find((f) => f.id === id)
        if (target?.thumbUrl) URL.revokeObjectURL(target.thumbUrl)
        return {
          files: s.files.filter((f) => f.id !== id),
          selectedId: s.selectedId === id ? null : s.selectedId,
        }
      }),

    reset: () =>
      set((s) => {
        s.files.forEach((f) => f.thumbUrl && URL.revokeObjectURL(f.thumbUrl))
        return { files: [], selectedId: null, rejections: [] }
      }),

    dismissRejections: () => set({ rejections: [] }),

    _setStatus: setStatus,
    _setMetadata: setMetadata,
    _setError: setError,
    _setThumb: (id, thumbUrl) => patchFile(id, { thumbUrl }),
  }
})

/**
 * Analyze `files` with a fixed concurrency cap. Only commits results when the
 * run token still matches (avoids stale writes when a new batch supersedes).
 */
async function runAnalysis(files: File[], seq: number) {
  const results = new Map<string, { metadata?: ImageMetadata; error?: string }>()

  // Worker pool over the list of files; look up each file's id from the live
  // store (ids were assigned synchronously in addFiles).
  let cursor = 0
  const workers = Array.from({ length: Math.min(ANALYZE_CONCURRENCY, files.length) }, async () => {
    for (;;) {
      const idx = cursor++
      if (idx >= files.length) break
      const file = files[idx]
      if (!file) continue
      const fileId = useBatchStore.getState().files.find(
        (f) => f.file === file,
      )?.id
      if (!fileId) continue

      useBatchStore.getState()._setStatus(fileId, 'analyzing')

      try {
        const metadata = await extractImageMetadata(file)
        results.set(fileId, { metadata })
      } catch {
        results.set(fileId, {
          error:
            'Could not analyze this file — it may be corrupt or unsupported.',
        })
      }
    }
  })
  await Promise.all(workers)

  // Commit, but only if this run is still authoritative.
  if (useBatchStore.getState().analyzeSeq !== seq) return

  for (const [id, r] of results) {
    const current = useBatchStore.getState().files.find((f) => f.id === id)
    if (!current) continue
    if (r.error) {
      useBatchStore.getState()._setError(id, r.error)
    } else if (r.metadata) {
      useBatchStore.getState()._setMetadata(id, r.metadata)
    }
  }
}

export { useBatchStore as useBatch }
