/**
 * Functional verification of Phase 5 — IP rate limiting (backend core +
 * frontend gate).
 * Bundled with esbuild (same pattern as verify-phase1/2/3/4.ts) and run under Node.
 *
 * Usage: npm run verify:phase5
 *
 * What is tested (Node-runnable, no real Redis, no real HTTP):
 *   A. api/ratelimit-core.mjs (pure, dependency-free — imported directly):
 *      window indexing/reset math, allow/deny decision, retry-after ceil
 *      math, boundary behavior at the reset instant, IP extraction from
 *      x-forwarded-for / x-real-ip / missing, redis key shape
 *   B. Fixed-window lifecycle against a FAKE IN-MEMORY counter wired through
 *      decideRateLimit() — the exact production decision path: 10 allows,
 *      then denies with correct retryAfter, then a fresh window allows again
 *   C. transformAllSerial() batch interruption — a simulated 429 mid-batch
 *      stops the run at that file: files before it transformed, the blocked
 *      file keeps 'analyzed' status + a `rateLimit` flag (NOT
 *      'transform-error'), files after it remain completely untouched, the
 *      checker is NOT called for the remaining files, isTransformingAll is
 *      cleared, and one toast covers the whole interruption
 *   D. Single-file triggerTransform() denial — policy block keeps 'analyzed'
 *      status, sets the flag, surfaces the message, and never runs the strip
 *      pipeline; allowed path consumes exactly one check and transforms
 *   E. Frontend helpers — formatRetryAfter() human formatting and
 *      isCachedDenial() (trust cached remaining=0 until resetAt, avoid
 *      hammering the endpoint)
 *
 * Documented testing gap (also in PROGRESS.md): the live path
 * (browser → Vercel function → @upstash/redis → real Upstash) is UNTESTED
 * end-to-end because no real Upstash credentials exist yet. The production
 * code path stays real (no mock client baked in); tests inject fakes at the
 * module boundary via the same optional-parameter pattern as run.ts's
 * `_stripFn`.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { useBatchStore } from '../src/lib/batch/state'
import type { BatchFile } from '../src/lib/batch/types'
import type { ImageMetadata } from '../src/lib/metadata/unified'
import type { StripFn } from '../src/lib/transform/run'
import { formatRetryAfter, isCachedDenial } from '../src/lib/ratelimit'
import type { RateLimitChecker, RateLimitDecision } from '../src/lib/ratelimit'
import { useToastStore } from '../src/lib/toast'

// The pure backend core is plain .mjs (api functions stay .mjs per repo
// convention) — esbuild bundles it directly, no @upstash/redis involved.
import {
  RATE_LIMIT,
  RATE_LIMIT_WINDOW_MS,
  decideRateLimit,
  extractClientIp,
  redisKey,
  windowIndex,
  windowResetAt,
} from '../api/ratelimit-core.mjs'

let pass = 0
let fail = 0

function check(label: string, cond: boolean | undefined | null, extra?: unknown) {
  if (cond) {
    pass++
    console.log(`  PASS  ${label}`)
  } else {
    fail++
    console.log(`  FAIL  ${label}`, extra !== undefined ? extra : '')
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const pngMeta = (): ImageMetadata => ({ format: 'png', parsedAt: Date.now() })

/** Analyzed BatchFile holding real fixture bytes (like verify-phase4). */
function analyzedFile(id: string, size: number): BatchFile {
  return {
    id,
    file: new File([fixturePngBytes(size)], `${id}.png`, { type: 'image/png' }),
    thumbUrl: null,
    status: 'analyzed',
    metadata: pngMeta(),
  }
}

// Real fixture PNG (with tEXt/iTXt markers) — same as verify-phase4. The mock
// strip below removes all text chunks so the real verify gate + PNG rewrite
// stages run for real against honest bytes.
let rawFixtureBytes: Uint8Array | undefined
function rawFixture(): Uint8Array {
  return (rawFixtureBytes ??= new Uint8Array(
    readFileSync(join(process.cwd(), 'test', 'fixtures', 'ai-pipeline.png')),
  ))
}

/** Fixture bytes padded with `pad` trailing zero bytes (unique file sizes). */
function fixturePngBytes(pad: number): Uint8Array {
  const base = rawFixture()
  const out = new Uint8Array(base.length + pad)
  out.set(base, 0)
  return out
}



/** Denial decision shaped exactly like checkRateLimit()'s 429 branch. */
function denied(retryAfterSeconds: number): RateLimitDecision {
  return {
    allowed: false,
    retryAfterSeconds,
    resetAt: Date.now() + retryAfterSeconds * 1000,
    message: `Rate limit reached — try again in ${formatRetryAfter(retryAfterSeconds)}.`,
  }
}

/**
 * Fake RateLimitChecker with an in-memory quota: allows the first `quota`
 * calls, then denies with `retryAfterSeconds` (as the real 429 would).
 * Records every call.
 */
function fakeChecker(quota: number, retryAfterSeconds = 2520) {
  const state = { calls: 0 }
  const checker: RateLimitChecker = async () => {
    state.calls++
    return state.calls <= quota ? { allowed: true } : denied(retryAfterSeconds)
  }
  return { checker, state }
}

function resetStore() {
  useBatchStore.getState().reset()
  useBatchStore.setState({ isTransformingAll: false, analyzeSeq: 0 })
  useToastStore.getState().dismiss()
}

/**
 * Mock strip: strips all tEXt/zTXt/iTXt chunks from the fixture PNG (same
 * walker as verify-phase3/4) so the real verify gate + PNG rewrite run.
 */
function buildStrippedPng(source: Uint8Array): Uint8Array {
  const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  const TEXT_TYPES = new Set(['tEXt', 'zTXt', 'iTXt'])

  const parts: Uint8Array[] = [new Uint8Array(PNG_SIG)]
  let offset = 8
  while (offset + 8 <= source.length) {
    const len =
      ((source[offset]! << 24) |
        (source[offset + 1]! << 16) |
        (source[offset + 2]! << 8) |
        source[offset + 3]!) >>>
      0
    const type = String.fromCharCode(
      source[offset + 4]!,
      source[offset + 5]!,
      source[offset + 6]!,
      source[offset + 7]!,
    )
    const total = 4 + 4 + len + 4
    if (offset + total > source.length) break
    if (!TEXT_TYPES.has(type)) {
      parts.push(source.subarray(offset, offset + total))
    }
    offset += total
    if (type === 'IEND') break
  }
  const totalLen = parts.reduce((s, p) => s + p.length, 0)
  const out = new Uint8Array(totalLen)
  let pos = 0
  for (const p of parts) {
    out.set(p, pos)
    pos += p.length
  }
  return out
}

const mockStrip: StripFn = async (_blob, format) => ({
  stripped: new Blob([buildStrippedPng(rawFixture())], { type: 'image/png' }),
  outputFormat: format === 'heic' ? 'jpeg' : format,
})


// ── A. Pure core: window math, decision, IP extraction ───────────────────────

function testPureCore() {
  console.log('\n== A. api/ratelimit-core.mjs — pure window/decision math ==')

  const W = RATE_LIMIT_WINDOW_MS
  check('RATE_LIMIT === 10 (REQUIREMENT §5.5)', RATE_LIMIT === 10)
  check('RATE_LIMIT_WINDOW_MS === 1 hour', W === 3_600_000)

  // Window indexing + reset math.
  check('windowIndex(0) === 0', windowIndex(0) === 0)
  check('windowIndex(W - 1) === 0 (last ms of window 0)', windowIndex(W - 1) === 0)
  check('windowIndex(W) === 1 (first ms of window 1)', windowIndex(W) === 1)
  check('windowResetAt(0) === W', windowResetAt(0) === W)
  check('windowResetAt(W - 1) === W (no drift inside the window)', windowResetAt(W - 1) === W)

  // Decision: under limit → allowed with remaining countdown.
  const first = decideRateLimit({ count: 1, resetAt: W, now: 0 })
  check('count 1 → allowed', first.allowed === true)
  check('count 1 → remaining 9', first.remaining === 9)
  check('allowed → retryAfterSeconds 0', first.retryAfterSeconds === 0)

  // Decision: at limit (last slot) → still allowed, remaining 0.
  const last = decideRateLimit({ count: RATE_LIMIT, resetAt: W, now: 0 })
  check(`count ${RATE_LIMIT} (at-limit) → allowed, remaining 0`, last.allowed === true && last.remaining === 0)

  // Decision: over limit → denied with ceil retry-after.
  const over = decideRateLimit({ count: RATE_LIMIT + 1, resetAt: W, now: 0 })
  check(`count ${RATE_LIMIT + 1} → denied`, over.allowed === false)
  check('denied → remaining 0', over.remaining === 0)
  check('denied → retryAfterSeconds 3600 (ceil from 0ms left)', over.retryAfterSeconds === 3600)

  const mid = decideRateLimit({ count: 11, resetAt: W, now: 500_500 })
  check('denied mid-window → retryAfter ceil((resetAt-now)/1000)', mid.retryAfterSeconds === 3100)

  // Boundary: request landing exactly on the reset instant → 0, not negative.
  const boundary = decideRateLimit({ count: 11, resetAt: W, now: W })
  check('denied exactly at reset instant → retryAfterSeconds 0 (floored)', boundary.retryAfterSeconds === 0)

  // Window reset behavior: same over-limit count in the NEXT window allows.
  const nextWindowNow = W + 1
  const fresh = decideRateLimit({
    count: 1,
    resetAt: windowResetAt(nextWindowNow),
    now: nextWindowNow,
  })
  check('new window → count restarts at 1 → allowed, remaining 9', fresh.allowed === true && fresh.remaining === 9)

  // IP extraction.
  check(
    'x-forwarded-for list → leftmost (original client)',
    extractClientIp((n) => (n === 'x-forwarded-for' ? '203.0.113.7, 70.41.3.18' : null)) === '203.0.113.7',
  )
  check(
    'x-forwarded-for with stray spaces → trimmed',
    extractClientIp((n) => (n === 'x-forwarded-for' ? '  198.51.100.2 , 10.0.0.1' : null)) === '198.51.100.2',
  )
  check(
    'no xff → x-real-ip fallback',
    extractClientIp((n) => (n === 'x-real-ip' ? '192.0.2.9' : null)) === '192.0.2.9',
  )
  check('no headers at all → shared "unknown" bucket', extractClientIp(() => null) === 'unknown')

  // Redis key scoping: per-IP AND per-window.
  check(
    'redisKey scopes by window index and ip',
    redisKey('1.2.3.4', 0) === 'wipefey:ratelimit:0:1.2.3.4' &&
      redisKey('1.2.3.4', W) === 'wipefey:ratelimit:1:1.2.3.4' &&
      redisKey('5.6.7.8', 0) === 'wipefey:ratelimit:0:5.6.7.8',
  )
}

// ── B. Fixed-window lifecycle through a FAKE in-memory counter ───────────────

function testFakeCounterLifecycle() {
  console.log('\n== B. Fixed-window lifecycle (fake in-memory counter + decideRateLimit) ==')

  // Minimal stand-in for the handler's INCR/EXPIRE against Upstash.
  const counters = new Map<string, number>()
  const incr = (key: string): number => {
    const next = (counters.get(key) ?? 0) + 1
    counters.set(key, next)
    return next
  }

  // Window 0: 10 requests at t=1000 → all allowed.
  const ip = '203.0.113.7'
  const t0 = 1000
  let allAllowed = true
  for (let i = 1; i <= RATE_LIMIT; i++) {
    const d = decideRateLimit({ count: incr(redisKey(ip, t0)), resetAt: windowResetAt(t0), now: t0 })
    if (!d.allowed || d.remaining !== RATE_LIMIT - i) allAllowed = false
  }
  check(`first ${RATE_LIMIT} requests in window 0 → all allowed, remaining counts down`, allAllowed)

  // 11th request → denied with correct retry-after.
  const tDenied = t0 + 42_000
  const d11 = decideRateLimit({
    count: incr(redisKey(ip, tDenied)),
    resetAt: windowResetAt(tDenied),
    now: tDenied,
  })
  check('request 11 in the same window → denied', d11.allowed === false)
  const expectedRetry = Math.ceil((windowResetAt(tDenied) - tDenied) / 1000)
  check(`denied retryAfter === ${expectedRetry}s (correct ceil math)`, d11.retryAfterSeconds === expectedRetry)

  // Repeated denied hits stay denied.
  const d12 = decideRateLimit({ count: incr(redisKey(ip, tDenied)), resetAt: windowResetAt(tDenied), now: tDenied })
  check('requests 12+ in the same window → still denied', d12.allowed === false)

  // Window rolls over → fresh counter, allowed again; old key is orphaned.
  const tNext = windowResetAt(t0) + 5_000
  const dNext = decideRateLimit({
    count: incr(redisKey(ip, tNext)),
    resetAt: windowResetAt(tNext),
    now: tNext,
  })
  check('after the window resets → allowed again (fresh counter)', dNext.allowed === true && dNext.remaining === RATE_LIMIT - 1)
  check('old window key is distinct (auto-expired via TTL in production)', redisKey(ip, t0) !== redisKey(ip, tNext))
  check(
    'another IP has an independent counter',
    decideRateLimit({ count: incr(redisKey('198.51.100.2', t0)), resetAt: windowResetAt(t0), now: t0 }).allowed === true,
  )
}

// ── C. transformAllSerial() — batch interruption on a simulated 429 ──────────

async function testBatchInterruption() {
  console.log('\n== C. transformAllSerial() — simulated 429 mid-batch ==')
  resetStore()

  const ids = ['f1', 'f2', 'f3', 'f4', 'f5']
  useBatchStore.setState({ files: ids.map((id, i) => analyzedFile(id, i + 1)) })

  // Quota 3: f1–f3 check allowed + transform, f4 hits the 429 (retry in
  // 42 min, exactly the copy from the task), f5 must never be checked.
  const { checker, state } = fakeChecker(3, 42 * 60)

  await useBatchStore.getState().transformAllSerial(mockStrip, checker)

  const files = useBatchStore.getState().files
  const byId = (id: string) => files.find((f) => f.id === id)

  check('checker called exactly 4 times (NOT once per remaining file — run stops)', state.calls === 4, state.calls)

  for (const id of ['f1', 'f2', 'f3']) {
    const f = byId(id)
    check(`${id} transformed before the block`, f?.status === 'transformed' && f.transformedBlob instanceof Blob)
    check(`${id} has no rateLimit flag`, f?.rateLimit === undefined)
  }

  const blocked = byId('f4')
  check('f4 status stays "analyzed" (policy block ≠ transform-error)', blocked?.status === 'analyzed')
  check('f4 got the rateLimit flag', blocked?.rateLimit !== undefined)
  check('f4 flag message includes "42 minutes"', blocked?.rateLimit?.message.includes('42 minutes') === true, blocked?.rateLimit?.message)
  check('f4 flag carries retryAfterSeconds 2520', blocked?.rateLimit?.retryAfterSeconds === 2520)
  check('f4 has no transformedBlob (transform never attempted)', blocked?.transformedBlob === undefined)
  check('f4 is NOT transform-error (no transformError string)', blocked?.transformError === undefined)

  const untouched = byId('f5')
  check('f5 completely untouched: analyzed, no flag, no blob', untouched?.status === 'analyzed' && untouched.rateLimit === undefined && untouched.transformedBlob === undefined)

  check('isTransformingAll cleared after interruption', useBatchStore.getState().isTransformingAll === false)

  const toast = useToastStore.getState().toast
  check(
    'one toast covers the batch interruption ("3 of 5" + retry time)',
    toast?.tone === 'warn' &&
      toast.message.includes('3 of 5') &&
      toast.message.includes('42 minutes'),
    toast?.message,
  )
}

// ── D. Single-file triggerTransform() — denial + allowed path ────────────────

async function testSingleFileGate() {
  console.log('\n== D. triggerTransform() — single-file rate-limit gate ==')
  resetStore()

  // D1. Denied: status unchanged, flag set, pipeline never runs.
  useBatchStore.setState({ files: [analyzedFile('solo', 1)] })
  const denyChecker: RateLimitChecker = async () => denied(1800)
  await useBatchStore.getState().triggerTransform('solo', undefined, denyChecker)

  const solo = useBatchStore.getState().files[0]
  check('denied → status stays "analyzed"', solo?.status === 'analyzed')
  check('denied → rateLimit flag with "30 minutes" message', solo?.rateLimit?.message.includes('30 minutes') === true)
  check('denied → no transformedBlob', solo?.transformedBlob === undefined)
  check('denied → warn toast surfaced', useToastStore.getState().toast?.tone === 'warn')

  // D2. Allowed: exactly one check consumed, transform proceeds.
  resetStore()
  useBatchStore.setState({ files: [analyzedFile('solo2', 1)] })
  const { checker, state } = fakeChecker(1, 60)
  await useBatchStore.getState().triggerTransform('solo2', mockStrip, checker)

  const done = useBatchStore.getState().files[0]
  check('allowed → checker consumed exactly one slot', state.calls === 1)
  check('allowed → file transformed', done?.status === 'transformed' && done.transformedBlob instanceof Blob)
  check('allowed → no rateLimit flag left behind', done?.rateLimit === undefined)
}

// ── E. Frontend helpers ───────────────────────────────────────────────────────

function testFrontendHelpers() {
  console.log('\n== E. formatRetryAfter() + isCachedDenial() ==')

  check('formatRetryAfter(0) → "0 seconds"', formatRetryAfter(0) === '0 seconds')
  check('formatRetryAfter(30) → "30 seconds"', formatRetryAfter(30) === '30 seconds')
  check('formatRetryAfter(60) → "1 minute"', formatRetryAfter(60) === '1 minute')
  check('formatRetryAfter(42*60) → "42 minutes"', formatRetryAfter(42 * 60) === '42 minutes')
  check('formatRetryAfter(3600) → "1 hour"', formatRetryAfter(3600) === '1 hour')
  check('formatRetryAfter(3900) → "1 hour 5 minutes"', formatRetryAfter(3900) === '1 hour 5 minutes')
  check('formatRetryAfter(-5) clamps → "0 seconds"', formatRetryAfter(-5) === '0 seconds')

  const now = 1_000_000
  check('isCachedDenial: remaining 0 + future resetAt → deny locally (no call)', isCachedDenial(0, now + 1000, now) === true)
  check('isCachedDenial: resetAt passed → call again', isCachedDenial(0, now - 1, now) === false)
  check('isCachedDenial: remaining > 0 → never cached denial', isCachedDenial(3, now + 1000, now) === false)
  check('isCachedDenial: no cache (null) → call', isCachedDenial(null, now + 1000, now) === false)
}

// ── Runner ─────────────────────────────────────────────────────────────────────

// Not top-level await: the verify scripts bundle to CJS. process.exit on both
// paths also keeps a live toast auto-dismiss timer from delaying Node's exit.
function main() {
  console.log('Phase 5 verification — IP rate limiting (backend core + frontend gate)')
  testPureCore()
  testFakeCounterLifecycle()
  void testBatchInterruption()
    .then(() => testSingleFileGate())
    .then(() => {
      testFrontendHelpers()
      console.log(`\n${pass} pass, ${fail} fail`)
      process.exit(fail > 0 ? 1 : 0)
    })
}

main()

