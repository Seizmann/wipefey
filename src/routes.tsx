import { lazy, Suspense } from 'react'
import type { ReactElement } from 'react'
import { Navigate, createBrowserRouter } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/Home'

// The Tool page pulls in the heavy parsing/transform/zip libs (exifr,
// piexifjs, fflate). Route-level code splitting keeps them out of the initial
// bundle so landing/content pages stay light (Phase 6 Lighthouse pass).
const ToolPage = lazy(() =>
  import('./pages/Tool').then((m) => ({ default: m.ToolPage })),
)

// Content pages are static prose most visitors never open. Home stays eager —
// it is the landing route and first paint matters there.
const HowItWorksPage = lazy(() =>
  import('./pages/HowItWorks').then((m) => ({ default: m.HowItWorksPage })),
)
const AboutPage = lazy(() =>
  import('./pages/About').then((m) => ({ default: m.AboutPage })),
)
const PrivacyPage = lazy(() =>
  import('./pages/Privacy').then((m) => ({ default: m.PrivacyPage })),
)

/** Chunks are small and local; a spinner would flash. Render nothing instead. */
function deferred(element: ReactElement): ReactElement {
  return <Suspense fallback={null}>{element}</Suspense>
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'tool', element: deferred(<ToolPage />) },
      { path: 'how-it-works', element: deferred(<HowItWorksPage />) },
      { path: 'about', element: deferred(<AboutPage />) },
      { path: 'privacy', element: deferred(<PrivacyPage />) },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
