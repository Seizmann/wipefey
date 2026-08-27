import { create } from 'zustand'

/**
 * Wipefey — minimal toast store (Phase 5).
 *
 * Built for exactly one need: surfacing rate-limit blocks (single-file and
 * batch-interruption messages) without inventing a generic notification
 * system. One toast at a time, auto-dismiss, no queue. If a future phase
 * needs more, extend here — don't bolt on a library.
 */

export type ToastTone = 'info' | 'warn'

export interface Toast {
  id: number
  message: string
  tone: ToastTone
}

interface ToastState {
  toast: Toast | null
  showToast: (message: string, tone?: ToastTone, durationMs?: number) => void
  dismiss: () => void
}

const DEFAULT_DURATION_MS = 8000

let timer: ReturnType<typeof setTimeout> | null = null
let nextId = 1

function clearTimer() {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
}

export const useToastStore = create<ToastState>((set) => ({
  toast: null,

  showToast: (message, tone = 'info', durationMs = DEFAULT_DURATION_MS) => {
    clearTimer()
    const id = nextId++
    set({ toast: { id, message, tone } })
    timer = setTimeout(() => {
      timer = null
      set((s) => (s.toast?.id === id ? { toast: null } : s))
    }, durationMs)
  },

  dismiss: () => {
    clearTimer()
    set({ toast: null })
  },
}))

/** Imperative helper so non-component code (stores/libs) can raise a toast. */
export function showToast(
  message: string,
  tone: ToastTone = 'info',
  durationMs?: number,
): void {
  useToastStore.getState().showToast(message, tone, durationMs)
}
