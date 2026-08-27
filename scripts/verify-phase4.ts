/**
 * Functional verification of Phase 4 — batch orchestration + ZIP export.
 * Bundled with esbuild (same pattern as verify-phase1/2/3.ts) and run under Node 22.
 *
 * Usage: npm run verify:phase4
 *
 * What is tested (Node-runnable, no canvas shim):
 *   A. extensionForFormat() / outputFileName() — format-contract filename
 *      mapping (JPEG→.jpg, PNG→.png, WebP→.webp, HEIC→.jpg)
 *   B. transformAllSerial() — serial execution: strip calls never overlap
 *      (max in-flight == 1), input order respected, per-file live status
 *      transitions committed to the store as each file completes
 *   C. transformAllSerial() failure isolation — a strip failure marks only
 *      that file 'transform-error' (same error shape as Phase 3) and the
 *      remaining files still transform
 *   D. buildTransformedZip() — entry count + names/extensions per format
 *      contract, duplicate-name dedupe, ZIP local-header/EOCD signature
 *      sanity, and a full fflate unzipSync round-trip (fflate validates the
 *      CRC-32 of every entry on inflate, so a successful byte-identical
 *      round-trip IS the CRC check)
 *
 * Documented testing gaps (mirrors Phase 3's canvas gap):
 *   - The real canvas.toBlob() strip path is browser-only; the serial
 *     orchestration tests use the run.ts `_stripFn` override with real
 *     fixture bytes so the verify/rewrite stages run for real.
 *   - downloadBlob()/downloadTransformedFile() trigger a DOM anchor click
 *     and cannot execute in Node — covered by manual browser verification
 *     (the naming logic they depend on IS covered in test A).
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { unzipSync } from 'fflate'
import { useBatchStore } from '../src/lib/batch/state'
import type { BatchFile } from '../src/lib/batch/types'
import type { ImageMetadata } from '../src/lib/metadata/unified'
import type { StripFn } from '../src/lib/transform/run'
import {
  buildTransformedZip,
  collectZipEntries,
  extensionForFormat,
  outputFileName,
  ZIP_FILENAME,
} from '../src/lib/zip'

const dir = join(process.cwd(), 'test', 'fixtures')

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

// Same walker as verify-phase3: strips all tEXt/zTXt/iTXt chunks so the
// result passes the isClean() verify gate after the mocked strip.
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

const pngMeta = (): ImageMetadata => ({ format: 'png', parsedAt: Date.now() })

/** Analyzed BatchFile whose File is sized `size` bytes (used as a strip tag). */
function analyzedFile(id: string, size: number): BatchFile {
  return {
    id,
    file: new File([new Uint8Array(size)], `${id}.png`, { type: 'image/png' }),
    thumbUrl: null,
    status: 'analyzed',
    metadata: pngMeta(),
  }
}

/** Transformed BatchFile with an explicit outputFormat + payload bytes. */
function transformedFile(
  id: string,
  name: string,
  outputFormat: BatchFile['outputFormat'],
  bytes: Uint8Array,
): BatchFile {
  return {
    id,
    file: new File([], name, { type: 'image/png' }),
    thumbUrl: null,
    status: 'transformed',
    metadata: pngMeta(),
    transformedBlob: new Blob([bytes]),
    outputFormat,
  }
}

function resetStore() {
  useBatchStore.getState().reset()
  useBatchStore.setState({ isTransformingAll: false, analyzeSeq: 0 })
}

// ── A. Filename mapping (format contract) ─────────────────────────────────────

function testFilenameMapping() {
  console.log('\n== A. Filename mapping (format contract) ==')

  check('extensionForFormat(jpeg) === ".jpg"', extensionForFormat('jpeg') === '.jpg')
  check('extensionForFormat(png) === ".png"', extensionForFormat('png') === '.png')
  check('extensionForFormat(webp) === ".webp"', extensionForFormat('webp') === '.webp')
  check(
    'extensionForFormat(heic) === ".jpg" (HEIC→JPEG contract)',
    extensionForFormat('heic') === '.jpg',
  )

  check(
    'photo.heic + jpeg → photo.jpg',
    outputFileName('photo.heic', 'jpeg') === 'photo.jpg',
    outputFileName('photo.heic', 'jpeg'),
  )
  check(
    'photo.jpeg + jpeg → photo.jpg',
    outputFileName('photo.jpeg', 'jpeg') === 'photo.jpg',
  )
  check(
    'IMG_0001.PNG + png → IMG_0001.png',
    outputFileName('IMG_0001.PNG', 'png') === 'IMG_0001.png',
    outputFileName('IMG_0001.PNG', 'png'),
  )
  check(
    'shot.webp + webp → shot.webp',
    outputFileName('shot.webp', 'webp') === 'shot.webp',
  )
  check(
    'no-extension name still gets the right suffix',
    outputFileName('noext', 'png') === 'noext.png',
    outputFileName('noext', 'png'),
  )
}

// ── B. transformAllSerial() — serial order + no concurrency ───────────────────

async function testSerialOrder() {
  console.log('\n== B. transformAllSerial() — serial order ==')
  resetStore()

  const ids = ['f1', 'f2', 'f3', 'f4']
  useBatchStore.setState({
    files: ids.map((id, i) => analyzedFile(id, i + 1)),
  })

  // Files are tagged by size (1–4). Deliberately reversed delays: if the
  // orchestrator ever ran these in parallel, f1 (slowest) would finish last
  // and completion order would invert — the assertions below catch it.
  const delayMs: Record<number, number> = { 1: 120, 2: 90, 3: 60, 4: 30 }
  const callOrder: number[] = []
  let active = 0
  let maxActive = 0
  let sawTransformingAllMidRun: boolean | null = null

  const strippedPngBlob = new Blob(
    [buildStrippedPng(new Uint8Array(readFileSync(join(dir, 'ai-pipeline.png'))))],
    { type: 'image/png' },
  )
  const mockStrip: StripFn = async (blob) => {
    active++
    maxActive = Math.max(maxActive, active)
    callOrder.push(blob.size)
    sawTransformingAllMidRun = useBatchStore.getState().isTransformingAll
    await new Promise((resolve) => setTimeout(resolve, delayMs[blob.size] ?? 0))
    active--
    return { stripped: strippedPngBlob, outputFormat: 'png' }
  }

  await useBatchStore.getState().transformAllSerial(mockStrip)

  check(
    'strip called exactly once per analyzed file',
    callOrder.length === ids.length,
    callOrder,
  )
  check(
    'strip calls happened in input order',
    callOrder.join(',') === '1,2,3,4',
    callOrder,
  )
  check(
    'no overlap — max concurrent strip calls == 1 (serial)',
    maxActive === 1,
    maxActive,
  )
  check(
    'isTransformingAll was true mid-run',
    sawTransformingAllMidRun === true,
    sawTransformingAllMidRun,
  )
  check(
    'isTransformingAll false after run',
    useBatchStore.getState().isTransformingAll === false,
  )

  const files = useBatchStore.getState().files
  check(
    'all files reached transformed status',
    files.every((f) => f.status === 'transformed'),
    files.map((f) => f.status),
  )
  check(
    'each file committed a transformedBlob + outputFormat',
    files.every(
      (f) => f.transformedBlob instanceof Blob && f.outputFormat === 'png',
    ),
  )
  check(
    'each file has a transformed preview object URL',
    files.every((f) => typeof f.transformedThumbUrl === 'string'),
  )

  resetStore()
}

// ── C. transformAllSerial() — failure isolation ───────────────────────────────

async function testFailureIsolation() {
  console.log('\n== C. transformAllSerial() — failure isolation ==')
  resetStore()

  const ids = ['g1', 'bad', 'g2', 'g3']
  useBatchStore.setState({
    files: ids.map((id, i) => analyzedFile(id, i + 1)),
  })

  const strippedPngBlob = new Blob(
    [buildStrippedPng(new Uint8Array(readFileSync(join(dir, 'ai-pipeline.png'))))],
    { type: 'image/png' },
  )
  // Fails deterministically for the size-2 file ('bad'); everything else
  // takes the real (mocked-strip) pipeline through verify + rewrite.
  const mockStrip: StripFn = async (blob) => {
    if (blob.size === 2) {
      throw new Error('simulated decode failure')
    }
    return { stripped: strippedPngBlob, outputFormat: 'png' }
  }

  await useBatchStore.getState().transformAllSerial(mockStrip)

  const files = useBatchStore.getState().files
  const byId = new Map(files.map((f) => [f.id, f]))

  const bad = byId.get('bad')
  check(
    'failing file marked transform-error',
    bad?.status === 'transform-error',
    bad?.status,
  )
  check(
    'failing file carries the Phase 3 error message shape',
    typeof bad?.transformError === 'string' &&
      bad.transformError.includes('simulated decode failure'),
    bad?.transformError,
  )
  check(
    'files before AND after the failure still transformed (no abort)',
    byId.get('g1')?.status === 'transformed' &&
      byId.get('g2')?.status === 'transformed' &&
      byId.get('g3')?.status === 'transformed',
    ids.map((id) => byId.get(id)?.status),
  )
  check(
    'failed file has no transformedBlob',
    bad?.transformedBlob === undefined,
  )
  check(
    'isTransformingAll false after run (finally block ran)',
    useBatchStore.getState().isTransformingAll === false,
  )

  resetStore()
}

// ── D. ZIP output — entries, names, structure, CRC round-trip ─────────────────

async function testZipOutput() {
  console.log('\n== D. buildTransformedZip() ==')

  // Distinct payloads so the round-trip byte comparison is meaningful.
  const bytes = (seed: number): Uint8Array =>
    new Uint8Array(Array.from({ length: 64 }, (_, i) => (seed + i) % 256))

  // collectZipEntries skips non-transformed entries.
  const mixed: BatchFile[] = [
    transformedFile('a', 'photo.heic', 'jpeg', bytes(1)),
    transformedFile('b', 'img.png', 'png', bytes(2)),
    analyzedFile('c', 3), // analyzed → must be skipped
    transformedFile('d', 'shot.webp', 'webp', bytes(3)),
    transformedFile('e', 'photo.heic', 'jpeg', bytes(4)), // duplicate name
  ]
  const entries = await collectZipEntries(mixed)
  const names = Object.keys(entries)
  check(
    'collectZipEntries: 4 entries (non-transformed skipped)',
    names.length === 4,
    names,
  )
  check(
    'extensions match the format contract (heic→.jpg, png, webp)',
    names.includes('photo.jpg') &&
      names.includes('img.png') &&
      names.includes('shot.webp'),
    names,
  )
  check(
    'duplicate output name deduped as photo-2.jpg',
    names.includes('photo-2.jpg'),
    names,
  )

  const empty = await collectZipEntries([])
  check('collectZipEntries: empty input → no entries', Object.keys(empty).length === 0)

  // Full archive.
  const zipBlob = await buildTransformedZip(mixed)
  check('ZIP blob has application/zip MIME type', zipBlob.type === 'application/zip', zipBlob.type)
  const zipBytes = new Uint8Array(await zipBlob.arrayBuffer())

  check(
    'local file header signature present (PK\\x03\\x04)',
    zipBytes[0] === 0x50 && zipBytes[1] === 0x4b && zipBytes[2] === 0x03 && zipBytes[3] === 0x04,
  )
  let hasEocd = false
  for (let i = zipBytes.length - 22; i >= Math.max(0, zipBytes.length - 22 - 256); i--) {
    if (
      zipBytes[i] === 0x50 && zipBytes[i + 1] === 0x4b &&
      zipBytes[i + 2] === 0x05 && zipBytes[i + 3] === 0x06
    ) {
      hasEocd = true
      break
    }
  }
  check('end-of-central-directory record present (PK\\x05\\x06)', hasEocd)

  // fflate round-trip: unzipSync validates every entry's CRC-32 and throws on
  // mismatch, so a successful byte-identical round-trip IS the CRC check.
  const unzipped = unzipSync(zipBytes)
  const unzippedNames = Object.keys(unzipped)
  check(
    'unzipSync: correct entry count + names',
    unzippedNames.length === 4 && names.every((n) => unzippedNames.includes(n)),
    unzippedNames,
  )
  let allBytesMatch = true
  for (const name of names) {
    const original = entries[name]
    const extracted = unzipped[name]
    if (
      !extracted ||
      extracted.length !== original.length ||
      !original.every((b, i) => extracted[i] === b)
    ) {
      allBytesMatch = false
    }
  }
  check(
    'unzipSync round-trip: every entry byte-identical (CRC-32 valid)',
    allBytesMatch,
  )

  check(
    'default archive name is wipefey-transformed.zip',
    ZIP_FILENAME === 'wipefey-transformed.zip',
    ZIP_FILENAME,
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  testFilenameMapping()
  await testSerialOrder()
  await testFailureIsolation()
  await testZipOutput()

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`)
  return fail === 0
}

void main().then((ok) => process.exit(ok ? 0 : 1))


