/**
 * Builds non-image fixtures for error-path tests:
 *  - corrupt.jpg — JPEG magic bytes then garbage (fails exifr parse)
 *  - fake.heic — ISO-BMFF container with ftyp brand "heic" (detector classifies
 *                it as HEIC; browser decode/parse is best-effort)
 *
 * Usage: node scripts/make-error-fixtures.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'test', 'fixtures')
mkdirSync(OUT, { recursive: true })

// corrupt.jpg — JPEG SOI marker then random bytes (no valid JPEG structure)
const jpegSoi = Buffer.from([0xff, 0xd8, 0xff, 0xe0])
const garbage = Buffer.alloc(700, 0x5a)
writeFileSync(join(OUT, 'corrupt.jpg'), Buffer.concat([jpegSoi, garbage]))

// fake.heic — minimal ISO-BMFF ftyp box with major brand "heic"
const makeBox = (type, payload) => {
  const t = Buffer.from(type, 'latin1')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(payload.length + 8, 0)
  return Buffer.concat([len, t, payload])
}
const ftyp = makeBox('ftyp', Buffer.concat([
  Buffer.from('heic', 'latin1'), // major brand
  Buffer.from([0, 0, 0, 0]), // minor version
  Buffer.from('heicmif1', 'latin1'), // compatible brands
]))
writeFileSync(join(OUT, 'photo.heic'), ftyp)

console.log('wrote test/fixtures/corrupt.jpg')
console.log('wrote test/fixtures/photo.heic')