import { useEffect, useState } from 'react'

/**
 * GitHub star widget (Phase 6b) — live stargazer count for the Wipefey repo,
 * fetched client-side from GitHub's public unauthenticated REST API (no token,
 * no SDK — a single GET is enough at this traffic level).
 *
 * Caching: localStorage (`wipefey:theme` naming convention) with a 15-minute
 * TTL, so navigations/re-renders never refetch more than ~4×/hour.
 *
 * Failure behavior: this is a nice-to-have. If the API fails, rate-limits, or
 * returns a malformed body, the widget degrades to a static GitHub icon
 * linking to the repo — never an error state, spinner, or a fake "0". A stale
 * cached count (real data, merely old) may remain visible while a refresh
 * fails; an absence of any real count is shown as icon-only.
 */

const REPO_URL = 'https://github.com/Seizmann/wipefey'
const STARS_API = 'https://api.github.com/repos/Seizmann/wipefey'
const CACHE_KEY = 'wipefey:gh-stars'
const CACHE_TTL_MS = 15 * 60 * 1000

interface StarsCache {
  count: number
  fetchedAt: number
}

function readCache(): StarsCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StarsCache>
    if (
      typeof parsed.count !== 'number' ||
      parsed.count < 0 ||
      typeof parsed.fetchedAt !== 'number'
    ) {
      return null
    }
    return { count: parsed.count, fetchedAt: parsed.fetchedAt }
  } catch {
    return null
  }
}

function writeCache(count: number): void {
  try {
    const cache: StarsCache = { count, fetchedAt: Date.now() }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Private mode / quota — caching is best-effort only.
  }
}

function GitHubIcon() {
  return (
    <svg
      aria-hidden
      width={14}
      height={14}
      viewBox="0 0 16 16"
      fill="currentColor"
      className="shrink-0"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  )
}

export function GitHubStar() {
  // null = no real count known (fetch pending, failed, or unavailable).
  // Seeded synchronously from the cache (fresh OR stale — a stale count is
  // still real data and is shown while the background refresh runs); the
  // effect below only performs the async refresh.
  const [count, setCount] = useState<number | null>(() => readCache()?.count ?? null)

  useEffect(() => {
    let cancelled = false

    // Fresh cache → no network call until the TTL lapses.
    const cached = readCache()
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return

    async function refresh() {
      try {
        const res = await fetch(STARS_API, {
          headers: { Accept: 'application/vnd.github+json' },
        })
        if (!res.ok) return // rate-limited / offline → keep fallback
        const body = (await res.json()) as { stargazers_count?: unknown }
        const stars = body.stargazers_count
        if (
          !cancelled &&
          typeof stars === 'number' &&
          Number.isFinite(stars) &&
          stars >= 0
        ) {
          writeCache(stars)
          setCount(stars)
        }
      } catch {
        // Network error → keep the icon-only / stale fallback silently.
      }
    }

    void refresh()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={
        count === null
          ? 'Wipefey on GitHub'
          : `Wipefey on GitHub — ${count} stars`
      }
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-wxs border border-border px-2 font-mono text-xs text-muted transition-colors hover:border-border-strong hover:text-foreground sm:px-2.5"
    >
      <GitHubIcon />
      {/* Count hidden on the narrowest screens so the navbar always fits. */}
      {count !== null && (
        <span className="hidden tabular-nums sm:inline">{count}</span>
      )}
    </a>
  )
}
