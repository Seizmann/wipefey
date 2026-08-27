import { create } from 'zustand'
import type { ImageFormat, ImageMetadata } from '../metadata/unified'
import { extractImageMetadata } from '../metadata'
import type { BatchFile, FileStatus } from './types'
import { ANALYZE_CONCURRENCY } from './types'
import {
  createBatchFile,
  createThumbUrl,
  validateFiles,
  type Rejection,
} from './reducer'
import { runTransform } from '../transform'
import type { StripFn } from '../transform'

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

  /**
   * Trigger the Phase 3 transform pipeline for a single file.
   * The file must be in 'analyzed' status. Runs strip → verify → rewrite
   * and commits the result to state atomically. No-ops if already transforming.
   */
  triggerTransform: (id: string) => Promise<void>

  /**
   * Phase 4: transform every file currently in 'analyzed' status — serially,
   * one file at a time, in array order (intentional: transform is heavier
   * than analysis, and predictable sequential execution is easier to follow
   * in the UI and debug). Each file's status updates live as it completes.
   * A failure marks that one file 'transform-error' and the run continues.
   * No-ops while a run is already in flight. `_stripFn` is the run.ts
   * test/verify-only override — the UI always calls this with no arguments.
   */
  transformAllSerial: (_stripFn?: StripFn) => Promise<void>

  /** True while a transformAllSerial() run is in flight (drives UI disable). */
  isTransformingAll: boolean

  _setStatus: (id: string, status: FileStatus) => void
  _setMetadata: (id: string, metadata: ImageMetadata) => void
  _setError: (id: string, error: string) => void
  _setThumb: (id: string, thumbUrl: string | null) => void
  _startTransform: (id: string) => void
  _finishTransform: (
    id: string,
    blob: Blob,
    outputFormat: ImageFormat,
    thumbUrl: string,
    note?: string,
  ) => void
  _failTransform: (id: string, error: string) => void
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

  /**
   * Shared Phase 3/4 transform core for one file: guard on 'analyzed' status,
   * run strip → verify → rewrite, commit atomically (or fail atomically).
   * Used by both triggerTransform() (single card button) and
   * transformAllSerial() (batch run). `stripFn` is the test-only override.
   */
  const transformOne = async (id: string, stripFn?: StripFn) => {
    const batchFile = useBatchStore.getState().files.find((f) => f.id === id)
    // Guard: only transform from analyzed status (also no-ops when the file
    // was removed mid-run).
    if (!batchFile || batchFile.status !== 'analyzed') return

    useBatchStore.getState()._startTransform(id)
    const result = await runTransform(batchFile, stripFn)

    if (!result.ok) {
      useBatchStore.getState()._failTransform(id, result.error)
      return
    }

    // Create a preview object URL for the transformed blob.
    const transformedThumbUrl = URL.createObjectURL(result.blob)
    useBatchStore
      .getState()
      ._finishTransform(
        id,
        result.blob,
        result.outputFormat,
        transformedThumbUrl,
        result.note,
      )
  }

  return {
    files: [],
    rejections: [],
    selectedId: null,
    analyzeSeq: 0,
    isTransformingAll: false,

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
        if (target?.transformedThumbUrl)
          URL.revokeObjectURL(target.transformedThumbUrl)
        return {
          files: s.files.filter((f) => f.id !== id),
          selectedId: s.selectedId === id ? null : s.selectedId,
        }
      }),

    reset: () =>
      set((s) => {
        s.files.forEach((f) => {
          if (f.thumbUrl) URL.revokeObjectURL(f.thumbUrl)
          if (f.transformedThumbUrl) URL.revokeObjectURL(f.transformedThumbUrl)
        })
        return { files: [], selectedId: null, rejections: [] }
      }),

    dismissRejections: () => set({ rejections: [] }),

    // ── Phase 3 transform actions ──────────────────────────────────────────────

    triggerTransform: async (id) => transformOne(id),

    // ── Phase 4 batch orchestration ────────────────────────────────────────────

    transformAllSerial: async (_stripFn) => {
      // Re-entrancy guard: one batch run at a time.
      if (get().isTransformingAll) return
      set({ isTransformingAll: true })
      try {
        // Snapshot the ids once — files added mid-run are picked up by the
        // next button press, not this run. The per-file core re-reads live
        // state, so a file removed mid-run simply no-ops.
        const ids = get()
          .files.filter((f) => f.status === 'analyzed')
          .map((f) => f.id)

        // Serial, in array order — no Promise.all / worker pool here on
        // purpose (see interface doc). One file failing does not stop the
        // rest: transformOne marks it 'transform-error' and we continue.
        for (const id of ids) {
          await transformOne(id, _stripFn)
        }
      } finally {
        set({ isTransformingAll: false })
      }
    },

    _startTransform: (id) => patchFile(id, { status: 'transforming' }),

    _finishTransform: (id, blob, outputFormat, thumbUrl, note) => {
      // Atomically: replace original file with a zero-byte sentinel (frees
      // the underlying ArrayBuffer for GC), revoke the original thumbnail
      // object URL, and commit the transformed result.
      set((s) => {
        const target = s.files.find((f) => f.id === id)
        if (!target) return s
        if (target.thumbUrl) URL.revokeObjectURL(target.thumbUrl)
        const sentinel = new File([], target.file.name, {
          type: target.file.type,
        })
        return {
          files: s.files.map((f) =>
            f.id === id
              ? {
                  ...f,
                  file: sentinel,
                  thumbUrl: null,
                  status: 'transformed' as FileStatus,
                  transformedBlob: blob,
                  outputFormat,
                  transformedThumbUrl: thumbUrl,
                  transformNote: note,
                }
              : f,
          ),
        }
      })
    },

    _failTransform: (id, error) =>
      patchFile(id, { status: 'transform-error', transformError: error }),

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
