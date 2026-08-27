import { lazy, Suspense } from 'react'
import { Navigate, createBrowserRouter } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/Home'
import { HowItWorksPage } from './pages/HowItWorks'
import { AboutPage } from './pages/About'
import { PrivacyPage } from './pages/Privacy'

// The Tool page pulls in the heavy parsing/transform/zip libs (exifr,
// piexifjs, fflate). Route-level code splitting keeps them out of the initial
// bundle so landing/content pages stay light (Phase 6 Lighthouse pass).
const ToolPage = lazy(() =>
  import('./pages/Tool').then((m) => ({ default: m.ToolPage })),
)

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: 'tool',
        element: (
          <Suspense fallback={null}>
            <ToolPage />
          </Suspense>
        ),
      },
      { path: 'how-it-works', element: <HowItWorksPage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
