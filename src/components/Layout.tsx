import { NavLink, Outlet, Link } from 'react-router-dom'
import { Logo } from './Logo'
import { Toasts } from './Toast'
import { useTheme } from '../hooks/useTheme'

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/tool', label: 'Tool' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/about', label: 'About' },
  { to: '/privacy', label: 'Privacy' },
]

function navClass({ isActive }: { isActive: boolean }) {
  return `text-[13px] transition-colors sm:text-sm ${
    isActive
      ? 'text-foreground font-medium'
      : 'text-muted hover:text-foreground'
  }`
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      className="ml-1 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-wxs border border-border px-2.5 text-xs text-muted transition-colors hover:border-border-strong hover:text-foreground"
    >
      <span aria-hidden>{theme === 'dark' ? '☀' : '☾'}</span>
      <span className="hidden font-mono uppercase tracking-wide sm:inline">
        {theme}
      </span>
    </button>
  )
}

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 text-foreground">
            <Logo size={22} />
            <span className="font-mono text-sm font-medium tracking-tight">
              Wipefey
            </span>
            <span className="hidden font-mono text-xs text-faint sm:inline">
              by RexiO
            </span>
          </Link>
          <nav className="flex min-w-0 items-center gap-3 sm:gap-5">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={`${navClass} ${n.to === '/' ? 'hidden sm:inline' : ''}`}
              >
                {n.label}
              </NavLink>
            ))}
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      {/* Phase 5: single minimal toast host (rate-limit messages etc.). */}
      <Toasts />

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2 text-muted">
            <Logo size={16} />
            <span className="font-mono text-xs">
              Wipefey by RexiO · MIT · open source
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-xs text-muted">
            <a
              href="https://rexio.pro"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              RexiO
            </a>
            <Link to="/about" className="transition-colors hover:text-foreground">
              About
            </Link>
            <Link
              to="/privacy"
              className="transition-colors hover:text-foreground"
            >
              Privacy
            </Link>
            <span className="text-faint">100% client-side</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
