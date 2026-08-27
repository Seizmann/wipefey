// Diagnostic: trace the exact failure point in the bundled pipeline
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import exifr from 'exifr'
import { extractPngTextChunks, isPng } from '../src/lib/metadata/png'

const dir = join(process.cwd(), 'test', 'fixtures')

async function main() {
  // 1. read raw buffer
  const buf = readFileSync(join(dir, 'camera-with-exif.jpg'))
  console.log('raw buffer len:', buf.length, 'sig:', buf.subarray(0, 4).toString('hex'))

  // 2. wrap in File, take arrayBuffer
  const arr = new Uint8Array(buf)
  const f = new File([arr], 'cam.jpg', { type: 'image/jpeg' })
  const ab = await f.arrayBuffer()
  console.log('arrayBuffer len:', ab.byteLength, 'first4:', new Uint8Array(ab).subarray(0,4).toString('hex'))

  // 3. exifr on that raw buffer
  const ex = await exifr.parse(buf, ['exif', 'ifd0'])
  console.log('exifr(arrayBuffer passed directly) Make:', ex?.Make)

  // 4. exifr on the File
  const ex2 = await exifr.parse(f, ['exif', 'ifd0'])
  console.log('exifr(File) Make:', ex2?.Make)

  // 5. png reader
  const pbuf = readFileSync(join(dir, 'ai-pipeline.png'))
  const ispng = isPng(new Uint8Array(pbuf))
  console.log('isPng:', ispng)
  const chunks = await extractPngTextChunks(new Uint8Array(pbuf))
  console.log('png chunks:', JSON.stringify(chunks))
}

void main()