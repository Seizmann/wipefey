/**
 * Builds PNG test fixtures by hand — signature + IHDR + tEXt + iTXt (+
 * zlib-compressed iTXt) + IDAT + IEND. This is the primary channel Phase 2's
 * AI markers read, so fixtures exercise every text-chunk variant our reader
 * supports: plain tEXt, iTXt (UTF-8), iTXt zlib-compressed, and a multi-line
 * parameters-style value.
 *
 * Usage: node scripts/make-png-fixtures.mjs
 * Writes to test/fixtures/.
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'test', 'fixtures')
mkdirSync(OUT, { recursive: true })

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let k = 0; k < 8; k++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** Encode a single PNG chunk (length + type + data + crc). */
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

/** Minimal gray-scale pixel data so IDAT is valid. */
function idat(width, height) {
  const raw = Buffer.alloc((width + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0 // filter: none
    for (let x = 0; x < width; x++) raw[y * (width + 1) + 1 + x] = 0x88
  }
  return deflateSync(raw)
}

function makePng({ width = 8, height = 8, textChunks = [] }) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 0 // color type: grayscale
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const parts = [PNG_SIG]
  parts.push(chunk('IHDR', ihdr))
  for (const c of textChunks) {
    const name = c[0]
    const data = c[1]
    parts.push(chunk(name, data))
  }
  parts.push(chunk('IDAT', idat(width, height)))
  parts.push(chunk('IEND', Buffer.alloc(0)))
  return Buffer.concat(parts)
}

/** tEXt: keyword \0 latin1 value. */
function tEXt(key, value) {
  return ['tEXt', Buffer.concat([Buffer.from(key, 'latin1'), Buffer.from([0]), Buffer.from(value, 'latin1')])]
}

/** iTXt: keyword \0 flag method [lang\0 translated\0] + utf8 value. */
function iTXt(key, value, { compressed = false } = {}) {
  const data = Buffer.concat([
    Buffer.from(key, 'latin1'),
    Buffer.from([0]),
    Buffer.from([compressed ? 1 : 0]), // compression flag
    Buffer.from([0]), // compression method (deflate)
    Buffer.from([0]), // language tag (empty)
    Buffer.from([0]), // translated keyword (empty)
    compressed ? deflateSync(Buffer.from(value, 'utf8')) : Buffer.from(value, 'utf8'),
  ])
  return ['iTXt', data]
}

/* fixture 1: ai-pipeline.png — SD Software tEXt + multi-line parameters iTXt + zlib Description */
const ai = makePng({
  textChunks: [
    tEXt('Software', 'Stable Diffusion 3.5'),
    iTXt(
      'parameters',
      [
        'masterpiece, cinematic lighting, a woman sitting by a window',
        'Steps: 28, Sampler: Euler-a, CFG scale: 7, Seed: 123456789',
        'Model: sd_xl_base_1.0, DPM++ 2M Karras',
        'Size: 512x512, RNG: 1337',
      ].join('\n'),
    ),
    iTXt('Description', 'Rendered by an AI pipeline - test marker.', { compressed: true }),
  ],
})

/* fixture 2: plain-camera.png — a normal Comment tEXt, no AI markers */
const plain = makePng({
  textChunks: [tEXt('Comment', 'Shot on a regular camera.')],
})

writeFileSync(join(OUT, 'ai-pipeline.png'), ai)
writeFileSync(join(OUT, 'plain-camera.png'), plain)

console.log('wrote test/fixtures/ai-pipeline.png (', ai.length, 'bytes )')
console.log('wrote test/fixtures/plain-camera.png (', plain.length, 'bytes )')