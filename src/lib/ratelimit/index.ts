/**
 * Wipefey — Phase 5 client for the /api/check-limit rate-limit gate.
 *
 * The transform pipeline is fully client-side; this module is the ONLY thing
 * standing between a user and unlimited transforms, so its failure semantics
 * are explicit:
 *
 *   - Well-formed 200  → allowed (cache remaining/resetAt).
 *   - Well-formed 429  → DENIED (cache 0/resetAt, skip future calls until
 *     resetAt instead of hammering the endpoint).
 *   - Anything else (network error, 5xx, malformed body) → FAIL OPEN,
 *     returned as `{ allowed: true, degraded: true }`. A policy gate must
 *     never hard-block a fully client-side tool when its own infrastructure
 *     is down. The caller (batch store) treats degraded exactly like allowed;
 *     the flag exists for logging/tests.
 *
 * In tests the store never calls `checkRateLimit()` directly — it accepts an
 * injected `RateLimitChecker` (same pattern as run.ts's `_stripFn`), so this
 * module's network path is exercised only in a browser against the real
 * function. Documented as a known Phase-5 gap in PROGRESS.md.
 */

/** Body of a well-formed 200 response from /api/check-limit. */
export interface RateLimitAllowedResponse {
  allowed: true
  ip?: string
  limit: number
  remaining: number
  /** Epoch ms when the current fixed window ends. */
  resetAt: number
  retryAfter: number
}

/** Body of a well-formed 429 response. */
export interface RateLimitDeniedResponse {
  allowed: false
  ip?: string
  limit: number
  remaining: number
  resetAt: number
  /** Seconds until the window resets (also in the Retry-After header). */
  retryAfter: number
  message: string
}

/**
 * Result of a rate-limit check. `degraded` is true when the endpoint could
 * not be reached / mis-answered and the check failed OPEN.
 */
export type RateLimitDecision =
  | { allowed: true; degraded?: boolean }
  | {
      allowed: false
      /** Seconds until the limit resets (from the 429). */
      retryAfterSeconds: number
      /** Epoch ms when the limit resets (best-effort fallback computed). */
      resetAt: number
      /** Human message including the formatted retry-after time. */
      message: string
    }

/** Injectable check function (production: `checkRateLimit`). */
export type RateLimitChecker = () => Promise<RateLimitDecision>

const ENDPOINT = '/api/check-limit'

// ── Last-known-status cache (avoid hammering the endpoint) ───────────────────
// When the server has told us remaining === 0, we trust it until resetAt and
// deny locally without another network call.
let cachedRemaining: number | null = null
let cachedResetAt = 0

/** Pure predicate for "the cache says this IP is still blocked". */
export function isCachedDenial(
  remaining: number | null,
  resetAtMs: number,
  nowMs: number,
): boolean {
  return remaining === 0 && nowMs < resetAtMs
}

/** Test/verify-only cache reset (module state survives across tests). */
export function _resetRateLimitCacheForTests(): void {
  cachedRemaining = null
  cachedResetAt = 0
}

/**
 * Format a retry-after duration for human copy, e.g. "42 minutes",
 * "1 hour 5 minutes", "30 seconds". Pure + unit-tested.
 */
export function formatRetryAfter(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  if (seconds < 60) {
    return seconds === 1 ? '1 second' : `${seconds} seconds`
  }
  const minutesTotal = Math.floor(seconds / 60)
  const hours = Math.floor(minutesTotal / 60)
  const minutes = minutesTotal % 60
  if (hours === 0) {
    return minutes === 1 ? '1 minute' : `${minutes} minutes`
  }
  const hourPart = hours === 1 ? '1 hour' : `${hours} hours`
  const minutePart =
    minutes === 0 ? '' : minutes === 1 ? ' 1 minute' : ` ${minutes} minutes`
  return `${hourPart}${minutePart}`
}

function deniedFromResponse(body: RateLimitDeniedResponse): RateLimitDecision {
  const retryAfterSeconds = Math.max(0, Math.floor(body.retryAfter ?? 0))
  const resetAt =
    typeof body.resetAt === 'number' && body.resetAt > 0
      ? body.resetAt
      : Date.now() + retryAfterSeconds * 1000
  return {
    allowed: false,
    retryAfterSeconds,
    resetAt,
    message: `Rate limit reached — try again in ${formatRetryAfter(retryAfterSeconds)}.`,
  }
}

/**
 * Ask the server whether a transform may proceed. Check-and-increment: a
 * successful check CONSUMES one slot of the per-IP hourly quota, so callers
 * must invoke it exactly once per intended transform (per file in a batch).
 */
export async function checkRateLimit(): Promise<RateLimitDecision> {
  // Trust the last-known zero until the window resets — no network call.
  if (isCachedDenial(cachedRemaining, cachedResetAt, Date.now())) {
    const retryAfterSeconds = Math.max(
      0,
      Math.ceil((cachedResetAt - Date.now()) / 1000),
    )
    return {
      allowed: false,
      retryAfterSeconds,
      resetAt: cachedResetAt,
      message: `Rate limit reached — try again in ${formatRetryAfter(retryAfterSeconds)}.`,
    }
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    })

    if (res.status === 200) {
      const body = (await res.json()) as RateLimitAllowedResponse
      cachedRemaining = typeof body.remaining === 'number' ? body.remaining : null
      cachedResetAt = typeof body.resetAt === 'number' ? body.resetAt : 0
      return { allowed: true }
    }

    if (res.status === 429) {
      const body = (await res.json()) as RateLimitDeniedResponse
      const decision = deniedFromResponse(body)
      if (!decision.allowed) {
        cachedRemaining = 0
        cachedResetAt = decision.resetAt
      }
      return decision
    }

    // 5xx (misconfigured / upstream error) or anything unexpected → fail open.
    console.error(`[ratelimit] unexpected status ${res.status} — failing open`)
    return { allowed: true, degraded: true }
  } catch (err) {
    console.error('[ratelimit] check failed — failing open:', err)
    return { allowed: true, degraded: true }
  }
}
