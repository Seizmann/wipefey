import { useState, useRef, useCallback, useEffect } from 'react'
import { NavLink, Outlet, Link } from 'react-router-dom'
import { Logo } from './Logo'
import { GitHubStar } from './GitHubStar'
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

function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      className={
        className ??
        'ml-1 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-wxs border border-border px-2.5 text-xs text-muted transition-colors hover:border-border-strong hover:text-foreground'
      }
    >
      <span aria-hidden>{theme === 'dark' ? '☀' : '☾'}</span>
      <span className="hidden font-mono uppercase tracking-wide sm:inline">
        {theme}
      </span>
    </button>
  )
}

function MobileMenuButton({
  open,
  onClick,
}: {
  open: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-controls="mobile-menu"
      aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
      className="inline-flex h-8 shrink-0 items-center justify-center rounded-wxs border border-border px-2 text-muted transition-colors hover:border-border-strong hover:text-foreground sm:hidden"
    >
      <svg
        aria-hidden
        width={16}
        height={16}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      >
        {open ? (
          <>
            <line x1="3" y1="3" x2="13" y2="13" />
            <line x1="13" y1="3" x2="3" y2="13" />
          </>
        ) : (
          <>
            <line x1="2" y1="4.5" x2="14" y2="4.5" />
            <line x1="2" y1="8" x2="14" y2="8" />
            <line x1="2" y1="11.5" x2="14" y2="11.5" />
          </>
        )}
      </svg>
    </button>
  )
}

function MobileMenu({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on Escape + focus trap
  useEffect(() => {
    if (!open) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !menuRef.current) return

      const focusable = Array.from(
        menuRef.current.querySelectorAll<HTMLElement>(
          'a[href]:not([tabindex="-1"]), button:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (focusable.length === 0) return

      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // Focus first link when menu opens
  useEffect(() => {
    if (!open) return
    // Small delay so the DOM is painted before focusing
    const id = requestAnimationFrame(() => {
      const first = menuRef.current?.querySelector<HTMLElement>('a[href]')
      first?.focus()
    })
    return () => cancelAnimationFrame(id)
  }, [open])

  if (!open) return null

  return (
    <div ref={menuRef} className="fixed inset-0 top-14 z-30 sm:hidden">
      {/* Backdrop as a real button: click-outside-to-close without hanging a
          click handler on a non-interactive div. tabIndex -1 keeps it out of
          the focus trap below — Escape is the keyboard route out. */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close navigation menu"
        onClick={onClose}
        className="absolute inset-0 w-full cursor-default bg-black/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className="relative"
      >
        <nav
          id="mobile-menu"
          className="border-b border-border bg-bg px-4 py-3 shadow-md"
        >
          <ul className="flex flex-col gap-1">
            {NAV.filter((n) => n.to !== '/').map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  end={n.to === '/'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `block rounded-wxs px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? 'text-foreground font-medium'
                        : 'text-muted hover:text-foreground hover:bg-surface'
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-border pt-3">
            <ThemeToggle className="inline-flex h-8 items-center gap-1.5 rounded-wxs border border-border px-2.5 text-xs text-muted transition-colors hover:border-border-strong hover:text-foreground" />
          </div>
        </nav>
      </div>
    </div>
  )
}

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const toggleMenu = useCallback(() => setMenuOpen((o) => !o), [])
  const closeMenu = useCallback(() => setMenuOpen(false), [])

  return (
    <div className="flex min-h-screen flex-col">
      {/* Keyboard users land here first — skips the header nav on every route. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-wxs focus:border focus:border-border-strong focus:bg-surface focus:px-3 focus:py-1.5 focus:font-mono focus:text-xs focus:text-foreground"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          {/* Logo — full wordmark on desktop, icon + short name on mobile */}
          <Link
            to="/"
            className="flex items-center gap-2.5 text-foreground"
          >
            <Logo size={22} />
            <span className="font-mono text-sm font-medium tracking-tight">
              Wipefey
            </span>
            <span className="hidden font-mono text-xs text-faint sm:inline">
              by RexiO
            </span>
          </Link>

          {/* Desktop nav — all links + star + theme toggle inline */}
          <nav
            aria-label="Main"
            className="hidden min-w-0 items-center gap-5 sm:flex"
          >
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={navClass}
              >
                {n.label}
              </NavLink>
            ))}
            <GitHubStar />
            <ThemeToggle />
          </nav>

          {/* Mobile: star + hamburger button (Home hidden — logo covers it) */}
          <nav aria-label="Mobile" className="flex items-center gap-2 sm:hidden">
            <GitHubStar />
            <MobileMenuButton open={menuOpen} onClick={toggleMenu} />
          </nav>
        </div>

        {/* Mobile dropdown menu */}
        <MobileMenu open={menuOpen} onClose={closeMenu} />
      </header>

      <main id="main-content" className="flex-1">
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
