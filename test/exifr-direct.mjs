// Direct exifr test (no bundling) — is the JPEG actually parseable?
import { readFileSync } from 'node:fs'
import exifr from 'exifr'
import piexif from 'piexifjs'

const jpg = readFileSync('test/fixtures/camera-with-exif.jpg')

// 1. our injected EXIF, via piexif (proves the file has it)
const p = piexif.load(jpg.toString('binary'))
console.log('piexif Make:', p['0th'][piexif.ImageIFD.Make])
console.log('piexif Model:', p['0th'][piexif.ImageIFD.Model])
console.log('piexif GPS lat:', JSON.stringify(p.GPS[piexif.GPSIFD.GPSLatitude]))

// 2. exifr parse
const exif = await exifr.parse(jpg, { parse: true, gps: true, icc: true, xmp: true })
console.log('\nexifr.parse keys:', Object.keys(exif ?? {}).slice(0, 30))
console.log('Make:', exif?.Make, '| Model:', exif?.Model)
console.log('Software:', exif?.Software)
console.log('DateTimeOriginal:', exif?.DateTimeOriginal)
console.log('latitude/longitude:', exif?.latitude, exif?.longitude)