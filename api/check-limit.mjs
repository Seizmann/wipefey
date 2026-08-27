/**
 * Wipefey — Vercel serverless function: IP-based rate limiting (Phase 5).
 *
 * Contract (documented in AGENT.md "Rate-limit contract (Phase 5)"):
 *   POST /api/check-limit
 *   200 → { allowed:true,  ip, limit, remaining, resetAt, retryAfter:0 }
 *   429 → { allowed:false, ip, limit, remaining:0, resetAt, retryAfter:<seconds>, message }
 *         plus a `Retry-After` response header (seconds).
 *   405 → non-POST requests.
 *   500 → { allowed:false, code:'misconfigured'|'upstream-error', error }
 *
 *   `resetAt` is epoch MILLISECONDS at which the current fixed window ends.
 *   `retryAfter` is SECONDS until that reset (mirrored in the Retry-After
 *   header). Clients that receive anything other than a well-formed 200/429
 *   (network error, 500, malformed body) MUST fail open — see
 *   src/lib/ratelimit/index.ts. A 500 is an infrastructure failure, not a
 *   policy denial, and must never block the fully client-side transform.
 *
 * Failure behavior (documented in AGENT.md):
 *   - Missing/empty UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN →
 *     explicit 500 with code 'misconfigured' and a descriptive error. The
 *     function NEVER silently allows all traffic through with no store —
 *     that would make the limit quietly vanish in production.
 *   - Upstash unreachable/command error → 500 with code 'upstream-error'.
 *
 * Algorithm: fixed-window 10 req/hour per IP. Window math + decision live in
 * ./ratelimit-core.mjs (pure, unit-tested by verify:phase5); this file is
 * only the thin adapter: env → Redis client → INCR → decision → response.
 *
 * Batch semantics: the frontend calls this ONCE PER FILE TRANSFORMED
 * (Transform-all on an N-file batch = N check-and-increment calls, see
 * AGENT.md "Batch request counting"). This endpoint stays per-request and
 * unaware of batches.
 */
import { Redis } from '@upstash/redis'
import {
  RATE_LIMIT_WINDOW_MS,
  decideRateLimit,
  extractClientIp,
  redisKey,
  windowResetAt,
} from './ratelimit-core.mjs'

const JSON_HEADERS = { 'content-type': 'application/json' }

function jsonResponse(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  })
}

/** Read + validate Upstash REST credentials from the environment. */
function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !token) {
    return {
      error:
        'Rate limiter is not configured: UPSTASH_REDIS_REST_URL and/or UPSTASH_REDIS_REST_TOKEN are unset or empty. Set them in Vercel project settings (or a local .env) — see .env.example.',
    }
  }
  return { redis: new Redis({ url, token }) }
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return jsonResponse(405, {
      allowed: false,
      error: 'Method not allowed — POST /api/check-limit.',
    })
  }

  const store = getRedis()
  if ('error' in store) {
    // Deliberate 500 (not fail-open): a silently-disabled limiter would be
    // invisible in production. The frontend fails open on 500s, so real
    // users are unaffected — but the failure is loud in logs/monitoring.
    console.error('[check-limit] misconfigured:', store.error)
    return jsonResponse(500, {
      allowed: false,
      code: 'misconfigured',
      error: store.error,
    })
  }

  const now = Date.now()
  const ip = extractClientIp((name) => request.headers.get(name))
  const key = redisKey(ip, now)
  const resetAt = windowResetAt(now, RATE_LIMIT_WINDOW_MS)

  try {
    // Fixed-window counter: INCR, and set the TTL only on the first hit of
    // the window (re-EXPIREing every hit would turn this into a sliding
    // window). If the process dies between INCR and EXPIRE the worst case is
    // a counter key that survives until its next window's first-hit EXPIRE —
    // acceptable at this scale.
    const count = await store.redis.incr(key)
    if (count === 1) {
      await store.redis.expire(key, Math.ceil(RATE_LIMIT_WINDOW_MS / 1000))
    }

    const decision = decideRateLimit({ count, resetAt, now })
    const body = { ip, ...decision }

    if (decision.allowed) {
      return jsonResponse(200, { allowed: true, ...body })
    }
    return jsonResponse(
      429,
      {
        allowed: false,
        ip,
        limit: decision.limit,
        remaining: 0,
        resetAt: decision.resetAt,
        retryAfter: decision.retryAfterSeconds,
        message: `Rate limit reached (${decision.limit} transformations per hour) — try again in ${decision.retryAfterSeconds} seconds.`,
      },
      { 'retry-after': String(decision.retryAfterSeconds) },
    )
  } catch (err) {
    console.error('[check-limit] upstream error:', err)
    return jsonResponse(500, {
      allowed: false,
      code: 'upstream-error',
      error: `Rate limiter upstream error: ${err instanceof Error ? err.message : String(err)}`,
    })
  }
}

