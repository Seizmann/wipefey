import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useToastStore } from './toast'

beforeEach(() => {
  vi.useFakeTimers()
  useToastStore.setState({ toast: null })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useToastStore', () => {
  it('starts with no toast', () => {
    expect(useToastStore.getState().toast).toBeNull()
  })

  it('showToast sets the toast', () => {
    useToastStore.getState().showToast('Hello', 'info')
    const { toast } = useToastStore.getState()
    expect(toast).not.toBeNull()
    expect(toast!.message).toBe('Hello')
    expect(toast!.tone).toBe('info')
  })

  it('showToast defaults to info tone', () => {
    useToastStore.getState().showToast('Test')
    expect(useToastStore.getState().toast!.tone).toBe('info')
  })

  it('showToast accepts warn tone', () => {
    useToastStore.getState().showToast('Warning!', 'warn')
    expect(useToastStore.getState().toast!.tone).toBe('warn')
  })

  it('dismiss clears the toast', () => {
    useToastStore.getState().showToast('Hello')
    expect(useToastStore.getState().toast).not.toBeNull()
    useToastStore.getState().dismiss()
    expect(useToastStore.getState().toast).toBeNull()
  })

  it('auto-dismisses after default duration (8s)', () => {
    useToastStore.getState().showToast('Auto')
    expect(useToastStore.getState().toast).not.toBeNull()
    vi.advanceTimersByTime(8000)
    expect(useToastStore.getState().toast).toBeNull()
  })

  it('auto-dismisses after custom duration', () => {
    useToastStore.getState().showToast('Quick', 'info', 2000)
    vi.advanceTimersByTime(1999)
    expect(useToastStore.getState().toast).not.toBeNull()
    vi.advanceTimersByTime(1)
    expect(useToastStore.getState().toast).toBeNull()
  })

  it('replaces existing toast (no queue)', () => {
    useToastStore.getState().showToast('First')
    useToastStore.getState().showToast('Second')
    expect(useToastStore.getState().toast!.message).toBe('Second')
  })

  it('new toast resets the timer', () => {
    useToastStore.getState().showToast('First')
    vi.advanceTimersByTime(6000) // 6s of 8s
    useToastStore.getState().showToast('Second')
    vi.advanceTimersByTime(6000) // 6s more = 12s total, but only 6s since second
    expect(useToastStore.getState().toast!.message).toBe('Second')
    vi.advanceTimersByTime(2000) // now 8s since second
    expect(useToastStore.getState().toast).toBeNull()
  })

  it('dismiss cancels auto-clear timer', () => {
    useToastStore.getState().showToast('Hello')
    useToastStore.getState().dismiss()
    vi.advanceTimersByTime(10000)
    expect(useToastStore.getState().toast).toBeNull() // still null from dismiss
  })
})
