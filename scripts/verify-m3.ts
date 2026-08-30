/**
 * M3/M9 verification script (C2PA / Content Credentials detect + strip).
 *
 * Node-side, no canvas: builds byte-accurate C2PA fixtures in memory, then:
 *  1. asserts extractImageMetadata detects C2PA / DigitalSourceType per format
 *  2. asserts M3/M9 fire and the badge resolves (M9 → Yes)
 *  3. asserts the verify gate (isClean) flags C2PA as a leak
 *  4. asserts runTransform with an injected pixel-only strip succeeds and the
 *     stripped output re-reads clean (C2PA gone), format preserved
 *
 * The real canvas strip path remains browser-only (documented Phase 3 gap) —
 * here the strip function is injected via runTransform's _stripFn seam, which
 * is exactly how verify:phase3 tests the pipeline.
 */

import { extractImageMetadata } from '../src/lib/metadata'
import { runAllMarkers } from '../src/lib/ai-heuristics/markers'
import { resolveAiLikelihood } from '../src/lib/ai-heuristics/rules'
import { isClean } from '../src/lib/transform/verify'
import { runTransform } from '../src/lib/transform/run'
import type { ImageFormat } from '../src/lib/metadata/unified'
import type { BatchFile } from '../src/lib/batch/types'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const APP11_HEADER = 'urn:uuid:c2pa/f8d6-7a3c-4ba8-9f2f-1e2a3c4d5e6f'
const MANIFEST_JSON =
  '{"claim_generator":"Midjourney v6","claim_generator_info":{"name":"Midjourney"},"model":"Midjourney v6.1"}'
const DST_URI =
  'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia'

const str = (s: string): number[] => Array.from(s, (c) => c.charCodeAt(0))

const blobOf = (bytes: Uint8Array): Blob =>
  new Blob([bytes as unknown as BlobPart])

/** JUMBF box: 4-byte length + 'jumb' + manifest JSON. */
const jumbfPayload = (json: string): number[] => {
  const boxLen = 8 + json.length
  return [
    (boxLen >>> 24) & 0xff, (boxLen >>> 16) & 0xff, (boxLen >>> 8) & 0xff, boxLen & 0xff,
    ...str('jumb'), ...str(json),
  ]
}

const pngChunk = (type: string, data: number[]): number[] => {
  const len = data.length
  return [
    (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff,
    ...str(type), ...data, 0, 0, 0, 0,
  ]
}

function jpegWithApp11(payload: string): Uint8Array {
  const p = str(payload)
  const segLen = p.length + 2
  return new Uint8Array([0xff, 0xd8, 0xff, 0xeb, (segLen >> 8) & 0xff, segLen & 0xff, ...p, 0xff, 0xd9])
}

function pngWithChunks(chunks: number[][]): Uint8Array {
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...pngChunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]),
    ...chunks.flatMap((c) => c),
    ...pngChunk('IEND', []),
  ])
}

function webpWithChunk(fourcc: string, payload: number[]): Uint8Array {
  const riffSize = 4 + 8 + payload.length + (payload.length % 2)
  return new Uint8Array([
    ...str('RIFF'),
    riffSize & 0xff, (riffSize >> 8) & 0xff, (riffSize >> 16) & 0xff, (riffSize >>> 24) & 0xff,
    ...str('WEBP'),
    ...str(fourcc),
    payload.length & 0xff, (payload.length >> 8) & 0xff, (payload.length >> 16) & 0xff, (payload.length >>> 24) & 0xff,
    ...payload,
    ...(payload.length % 2 === 1 ? [0] : []),
  ])
}

let passed = 0
let failed = 0

function check(name: string, condition: boolean): void {
  if (condition) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.log(`  FAIL  ${name}`)
  }
}
/** Simulated pixel-only strip: rebuilds a clean container of the SAME format
 *  with no metadata — mirrors what canvas.toBlob does in the browser. */
function fakePixelStrip(bytes: Uint8Array, format: ImageFormat): { stripped: Blob; outputFormat: ImageFormat } {
  if (format === 'png') {
    return { stripped: blobOf(pngWithChunks([])), outputFormat: 'png' }
  }
  if (format === 'webp') {
    return { stripped: blobOf(webpWithChunk('VP8 ', [0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a])), outputFormat: 'webp' }
  }
  return { stripped: blobOf(CLEAN_JPEG), outputFormat: 'jpeg' }
}

// Reuse the existing clean fixture as the pixel-only strip output — a valid
// JPEG piexifjs accepts, equivalent to what canvas.toBlob() produces.
const CLEAN_JPEG = new Uint8Array(
  readFileSync(join(process.cwd(), 'test', 'fixtures', 'plain.jpg')),
)

async function transformFixture(bytes: Uint8Array, format: ImageFormat, expectC2pa: boolean): Promise<void> {
  const meta = await extractImageMetadata(blobOf(bytes))
  check(`${format}: C2PA detected = ${expectC2pa}`, (meta.c2pa != null) === expectC2pa)

  const file = new File([bytes as unknown as BlobPart], `fixture.${format}`, { type: `image/${format}` })
  const batchFile: BatchFile = {
    id: 'fixture',
    file,
    thumbUrl: null,
    status: 'analyzed',
    metadata: meta,
  }

  const result = await runTransform(batchFile, async (blob, fmt) =>
    fakePixelStrip(new Uint8Array(await blob.arrayBuffer()), fmt))
  if (!result.ok) console.log(`   ERROR: ${result.error}`)
  check(`${format}: transform ok`, result.ok)
  if (!result.ok) return
  check(`${format}: output format preserved`, result.outputFormat === format)

  // Note: the FINAL blob legitimately contains Wipefey's own rewrite metadata
  // (tEXt chunk on PNG, EXIF on JPEG). Only assert no C2PA/DST survived;
  // full isClean gating happens pre-rewrite inside runTransform.
  const outMeta = await extractImageMetadata(result.blob)
  check(`${format}: no C2PA survives the strip`, outMeta.c2pa == null && outMeta.digitalSourceType == null)
}

async function main(): Promise<void> {
  console.log('=== M3/M9 (C2PA) verification ===')

  // 1. Detection per format
  const jpeg = jpegWithApp11(APP11_HEADER + MANIFEST_JSON)
  const metaJpeg = await extractImageMetadata(blobOf(jpeg))
  check('JPEG APP11: C2PA detected', metaJpeg.c2pa != null)
  check('JPEG APP11: creation tool extracted', metaJpeg.c2pa?.creationTool === 'Midjourney v6')

  const png = pngWithChunks([pngChunk('caBX', jumbfPayload(MANIFEST_JSON))])
  const metaPng = await extractImageMetadata(blobOf(png))
  check('PNG caBX: C2PA detected', metaPng.c2pa?.containerLabel === 'PNG caBX')

  const pngLegacy = pngWithChunks([pngChunk('caSt', jumbfPayload(MANIFEST_JSON))])
  check('PNG caSt (legacy): C2PA detected',
    (await extractImageMetadata(blobOf(pngLegacy))).c2pa?.containerLabel === 'PNG caSt')

  const webp = webpWithChunk('c2pa', jumbfPayload(MANIFEST_JSON))
  check('WebP RIFF c2pa: C2PA detected',
    (await extractImageMetadata(blobOf(webp))).c2pa != null)

  const pngDst = pngWithChunks([
    pngChunk('iTXt', [
      ...str('XML:com.adobe.xmp\0\0\0\0\0'),
      ...str(`<rdf:Description Iptc4xmpExt:DigitalSourceType="${DST_URI}"/>`),
    ]),
  ])
  const metaDst = await extractImageMetadata(blobOf(pngDst))
  check('PNG iTXt: DigitalSourceType detected', metaDst.digitalSourceType === DST_URI)
  check('PNG iTXt-only: no C2PA manifest false positive', metaDst.c2pa == null)

  // 2. Markers + badge
  const markers = runAllMarkers({ ...metaJpeg, xmp: { 'dc:creator': 'Midjourney' } })
  check('M3 fires on C2PA', markers.some((m) => m.id === 'M3' && m.confidence === 'strong'))
  check('M9 fires (definite) on C2PA + dc:creator', markers.some((m) => m.id === 'M9' && m.confidence === 'definite'))
  check('Badge = Yes with M9', resolveAiLikelihood({ ...metaJpeg, xmp: { 'dc:creator': 'Midjourney' } }).badge === 'Yes')

  const dstMarkers = runAllMarkers(metaDst)
  check('M3 fires on DigitalSourceType alone', dstMarkers.some((m) => m.id === 'M3'))
  check('M9 does NOT fire on DigitalSourceType alone', !dstMarkers.some((m) => m.id === 'M9'))

  const noMarkers = runAllMarkers(await extractImageMetadata(blobOf(jpegWithApp11('JFIF clean'))))
  check('No M3/M9 on clean file', !noMarkers.some((m) => m.id === 'M3' || m.id === 'M9'))

  // 3. Verify gate
  check('isClean flags C2PA leak', isClean(metaJpeg) === 'c2pa')
  // The XMP iTXt chunk itself is a pngChunks leak caught first by design
  check('isClean flags DigitalSourceType-carrying file as leak', isClean(metaDst) !== true)

  // 4. Full transform (injected strip), format-preserving
  await transformFixture(jpeg, 'jpeg', true)
  await transformFixture(png, 'png', true)
  await transformFixture(webp, 'webp', true)

  console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`)
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error('verify:m3 crashed:', err)
  process.exit(1)
})
