import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

function Boom(): never {
  throw new Error('metadata parse exploded')
}

afterEach(() => {
  // No vitest globals, so RTL's auto-cleanup never registers — unmount by hand
  // or each render stacks in the same document and queries match twice.
  cleanup()
  vi.restoreAllMocks()
})

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('all good')).toBeTruthy()
  })

  it('renders the fallback when a child throws', () => {
    // React logs the caught error; silence it so test output stays readable.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeTruthy()
  })

  it('shows the error message and a reload action', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByText('metadata parse exploded')).toBeTruthy()
    expect(screen.getByRole('button', { name: /reload/i })).toBeTruthy()
  })

  it('reassures that nothing was uploaded', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByText(/never left this device/i)).toBeTruthy()
  })
})
