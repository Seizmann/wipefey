/**
 * Wipefey — pure fixed-window rate-limit core (Phase 5).
 *
 * This module is intentionally PURE and dependency-free (no imports, no I/O,
 * no clock access — `now` is always a parameter) so that:
 *   - `api/check-limit.mjs` (the Vercel serverless wrapper) stays a thin
 *     adapter over Upstash Redis, and
 *   - `scripts/verify-phase5.ts` can unit-test the window math, allow/deny
 *     decision and retry-after calculation in Node against fake counters
 *     WITHOUT touching the real `@upstash/redis` client or credentials.
 *
 * Algorithm: FIXED WINDOW counter per IP.
 *   Choice + tradeoff (documented in AGENT.md "Rate-limit contract"): a fixed
 *   window is one INCR (+ one EXPIRE) per request — simplest possible on the
 *   free Upstash tier and trivially testable. Tradeoff: a client can burst up
 *   to 2× limit across a window boundary (10 at 09:59 + 10 at 10:00). For a
 *   free client-side metadata tool that burst is harmless; a sliding-window
 * log/zset would double the Redis commands per request for precision we do
 *   not need here.
 */

/** Requests allowed per IP per window (REQUIREMENT.md §5.5: ~10/hour). */
export const RATE_LIMIT = 10

/** Window length: 1 hour. */
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000

/**
 * Index of the fixed window containing `now` (epoch ms).
 * Windows tile time: [0, W), [W, 2W), …  A key is scoped to one index, so
 * counters reset automatically when the index rolls over.
 */
export function windowIndex(now, windowMs = RATE_LIMIT_WINDOW_MS) {
  return Math.floor(now / windowMs)
}

/** Epoch ms at which the window containing `now` ends (the reset instant). */
export function windowResetAt(now, windowMs = RATE_LIMIT_WINDOW_MS) {
  return (windowIndex(now, windowMs) + 1) * windowMs
}

/**
 * Allow/deny decision from a post-increment counter.
 *
 * @param {object} p
 * @param {number} p.count     Counter value AFTER the INCR (1 = first hit).
 * @param {number} p.resetAt   Epoch ms when the current window ends.
 * @param {number} p.now       Epoch ms of the request.
 * @param {number} [p.limit]   Defaults to RATE_LIMIT.
 * @returns {{ allowed: boolean, limit: number, remaining: number,
 *             resetAt: number, retryAfterSeconds: number }}
 *   `remaining` is what the caller may still use (0 when denied).
 *   `retryAfterSeconds` is 0 when allowed; otherwise ceil((resetAt - now)/1000),
 *   floored at 0 so a request landing exactly on the reset instant is told
 *   "0 seconds" rather than a negative number.
 */
export function decideRateLimit({ count, resetAt, now, limit = RATE_LIMIT }) {
  const allowed = count <= limit
  const remaining = Math.max(0, limit - count)
  const retryAfterSeconds = allowed
    ? 0
    : Math.max(0, Math.ceil((resetAt - now) / 1000))
  return { allowed, limit, remaining, resetAt, retryAfterSeconds }
}

/**
 * Extract the client IP from request headers.
 *
 * On Vercel Functions the platform sets `x-forwarded-for` to the client IP
 * (verified against vercel.com/docs/headers/request-headers, 2025-12):
 * when chained proxies append to it, the LEFTMOST address is the original
 * client. `x-real-ip` is the documented fallback. If nothing is present
 * (local dev / exotic proxy setups) we fall back to a shared "unknown"
 * bucket so that unidentifiable clients still share one fair counter
 * instead of bypassing the limit entirely.
 *
 * @param {(name: string) => string | null | undefined} getHeader
 * @returns {string}
 */
export function extractClientIp(getHeader) {
  const xff = getHeader('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = getHeader('x-real-ip')
  if (realIp?.trim()) return realIp.trim()
  return 'unknown'
}

/** Redis key for one IP inside one window. Kept here so tests can assert it. */
export function redisKey(ip, now, windowMs = RATE_LIMIT_WINDOW_MS) {
  return `wipefey:ratelimit:${windowIndex(now, windowMs)}:${ip}`
}
