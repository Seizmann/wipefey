import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import { RouterProvider } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { router } from './routes'
import { showToast } from './lib/toast'
import './index.css'

// Async failures (metadata parse, transform, ZIP) can escape their call site.
// The boundary only catches render errors, so surface these through the toast
// host instead of letting them vanish into the console.
window.addEventListener('unhandledrejection', (e) => {
  console.error('[unhandledrejection]', e.reason)
  showToast('Something went wrong — that step did not finish.', 'warn')
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </HelmetProvider>
  </StrictMode>,
)
