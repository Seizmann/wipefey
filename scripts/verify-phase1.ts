/**
 * Functional verification of the Phase-1 metadata pipeline against the real
 * source modules (lib/metadata + lib/batch validateFiles), using fixtures in
 * test/fixtures/. Bundled with esbuild (resolves Vite-style imports) and run
 * under Node 22 (global Blob/File/DecompressionStream).
 *
 * Usage: npm run verify:phase1
 */
import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { extractImageMetadata } from '../src/lib/metadata/index'
import { MAX_FILE_COUNT } from '../src/lib/batch/types'
import { validateFiles } from '../src/lib/batch/reducer'

const dir = join(process.cwd(), 'test', 'fixtures')

function file(path: string) {
  const buf = readFileSync(join(dir, path))
  const type = path.endsWith('.png')
    ? 'image/png'
    : path.endsWith('.webp')
      ? 'image/webp'
      : path.endsWith('.heic')
        ? 'image/heic'
        : 'image/jpeg'
  return new File([new Uint8Array(buf)], basename(path), { type })
}

let pass = 0
let fail = 0
/** check(label, condition[, extra]) — label first for readability */
function check(label: string, cond: boolean | undefined | null, extra?: unknown) {
  if (cond) {
    pass++
    console.log(`  PASS  ${label}`)
  } else {
    fail++
    console.log(`  FAIL  ${label}`, extra !== undefined ? extra : '')
  }
}

async function main() {
  // ---- 1. JPEG: EXIF/GPS/camera fields --------------------------------------
  console.log('\n== JPEG camera-with-exif ==')
  const jpeg = await extractImageMetadata(file('camera-with-exif.jpg'))
  console.log(`  format: ${jpeg.format} | warning: ${jpeg.warning ?? 'none'}`)
  check('format === jpeg', jpeg.format === 'jpeg')
  check('camera make Canon', jpeg.camera?.make === 'Canon', jpeg.camera?.make)
  check('camera model EOS R5', jpeg.camera?.model === 'Canon EOS R5', jpeg.camera?.model)
  check('software mentions Lightroom', jpeg.camera?.software?.includes('Lightroom') ?? false, jpeg.camera?.software)
  check('date taken present', !!jpeg.dates?.taken, jpeg.dates)
  const gps = jpeg.gps
  if (gps) {
    console.log(`  gps: lat=${gps.latitude} lon=${gps.longitude}`)
    check('gps lat ~ 23.75', Math.abs(gps.latitude - 23.7527) < 0.02, gps.latitude)
    check('gps lon ~ 90.3666', Math.abs(gps.longitude - 90.3666) < 0.02, gps.longitude)
  } else {
    check('gps present', false)
    check('gps lat', false)
    check('gps lon', false)
  }

  // ---- 2. PNG: text chunks (tEXt, iTXt multiline, compressed iTXt) ----------
  console.log('\n== PNG ai-pipeline ==')
  const ai = await extractImageMetadata(file('ai-pipeline.png'))
  check('format === png', ai.format === 'png', ai.format)
  const chunks = ai.pngChunks ?? []
  console.log(`  chunks: ${chunks.map((c) => `${c.type}:${c.key}`).join(', ')}`)
  check('Software tEXt chunk present', chunks.some((c) => c.key === 'Software' && c.value === 'Stable Diffusion 3.5'))
  check('parameters iTXt present', chunks.some((c) => c.key === 'parameters'))
  const params = chunks.find((c) => c.key === 'parameters')
  check('parameters multiline (>=4 lines)', !!params && params.value.split('\n').length >= 4, params?.value)
  check('compressed Description iTXt', chunks.some((c) => c.key === 'Description' && c.type === 'iTXt' && c.compressed === true))
  check('no chunk flagged failed', chunks.every((c) => c.failed !== true))

  console.log('\n== PNG plain-camera ==')
  const plain = await extractImageMetadata(file('plain-camera.png'))
  check('plain has Comment tEXt', (plain.pngChunks ?? []).some((c) => c.key === 'Comment'))

  // ---- 3. WebP (exifr path) --------------------------------------------------
  console.log('\n== WebP photo ==')
  const webp = await extractImageMetadata(file('photo.webp'))
  check('format === webp', webp.format === 'webp', webp.format)

  // ---- 4. HEIC detect --------------------------------------------------------
  console.log('\n== HEIC photo ==')
  const heic = await extractImageMetadata(file('photo.heic'))
  check('format === heic', heic.format === 'heic', heic.format)
  check('heic has graceful warning', typeof heic.warning === 'string' && heic.warning.length > 0, heic.warning)

  // ---- 5. corrupt degrades (no throw) ----------------------------------------
  console.log('\n== corrupt.jpg ==')
  const bad = await extractImageMetadata(file('corrupt.jpg'))
  check('corrupt: returns shape (no throw)', !!bad)
  check('corrupt: has warning', typeof bad.warning === 'string' && bad.warning.length > 0, bad.warning)

  // ---- 6. batch rejections (size + count + unsupported) ----------------------
  console.log('\n== batch rejection ==')
  const bigFile = new File([new Uint8Array(26 * 1024 * 1024)], 'huge.jpg', { type: 'image/jpeg' })
  const bigRes = validateFiles([bigFile], 0)
  check('26MB: rejected with "25 MB" msg', bigRes.rejected.length === 1 && /25 MB/i.test(bigRes.rejected[0]?.reason ?? ''), bigRes.rejected)

  const smallBuf = new Uint8Array(1024)
  const many = Array.from({ length: MAX_FILE_COUNT + 1 }, (_, i) =>
    new File([smallBuf], `f${i}.jpg`, { type: 'image/jpeg' }))
  const r = validateFiles(many, 0)
  check(`exactly ${MAX_FILE_COUNT} accepted from ${MAX_FILE_COUNT + 1}`, r.accepted.length === MAX_FILE_COUNT, r.accepted.length)
  check('51st file overflows (not rejected)', r.overflow.length === 1, r.overflow.length)
  check('overflow msg names 50 limit', /50 photos/i.test(r.overflow[0]?.reason ?? ''), r.overflow[0]?.reason)

  const txt = new File([new Uint8Array(10)], 'note.txt', { type: 'text/plain' })
  const rt = validateFiles([txt], 0)
  check('unsupported format rejected', rt.rejected.length === 1 && /Unsupported format/i.test(rt.rejected[0]?.reason ?? ''), rt.rejected)

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`)
  return fail === 0
}

void main().then((ok) => process.exit(ok ? 0 : 1))
