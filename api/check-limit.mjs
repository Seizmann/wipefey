/**
 * Wipefey — Vercel serverless function: IP-based rate limiting.
 *
 * Phase 5 implementation. Contract (see plan §7):
 *   POST /api/check-limit
 *   200 → { allowed:true, ip, limit, remaining, resetAt }
 *   429 → { allowed:false, limit, remaining:0, resetAt }
 *
 * Backing store: Upstash Redis free tier (@upstash/ratelimit), env:
 *   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 *
 * Placeholder returns 501 so the route exists; wired in Phase 5.
 */
export default function handler() {
  return new Response(
    JSON.stringify({ allowed: false, error: 'not implemented' }),
    {
      status: 501,
      headers: { 'content-type': 'application/json' },
    },
  )
}
