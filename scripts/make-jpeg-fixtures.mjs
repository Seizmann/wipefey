/**
 * Builds the camera-style JPEG fixture by embedding EXIF (Make/Model/Software,
 * DateTimeOriginal, GPS) into a base JPEG using the pinned piexifjs@1.0.4 —
 * this simultaneously smoke-tests the EXIF-writing dependency we'll use in
 * Phase 3/4 (strip path Normal write).
 *
 * Usage: node scripts/make-jpeg-fixtures.mjs
 * Writes test/fixtures/camera-with-exif.jpg
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import piexif from 'piexifjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'test', 'fixtures')
const SRC = join(OUT, 'plain.jpg')

mkdirSync(OUT, { recursive: true })

const exifObj = {
  '0th': {
    [piexif.ImageIFD.Make]: 'Canon',
    [piexif.ImageIFD.Model]: 'Canon EOS R5',
    [piexif.ImageIFD.Software]: 'Adobe Lightroom Classic',
    [piexif.ImageIFD.Artist]: 'A. Photographer',
    [piexif.ImageIFD.Copyright]: '(c) 2024 Test',
  },
  Exif: {
    [piexif.ExifIFD.DateTimeOriginal]: '2024:03:15 10:30:00',
        [piexif.ExifIFD.DateTimeDigitized]: '2024:03:15 10:30:00',
    [piexif.ExifIFD.LensMake]: 'Canon',
    [piexif.ExifIFD.LensModel]: 'RF 24-70mm F2.8',
    [piexif.ExifIFD.ExposureTime]: [1, 250],
    [piexif.ExifIFD.FNumber]: [2, 8],
    [piexif.ExifIFD.ISOSpeedRatings]: [100],
  },
  GPS: {
    [piexif.GPSIFD.GPSLatitudeRef]: 'N',
    [piexif.GPSIFD.GPSLatitude]: [[23, 1], [45, 1], [10, 1]],
    [piexif.GPSIFD.GPSLongitudeRef]: 'E',
    [piexif.GPSIFD.GPSLongitude]: [[90, 1], [22, 1], [0, 1]],
    [piexif.GPSIFD.GPSAltitudeRef]: 0,
    [piexif.GPSIFD.GPSAltitude]: [5, 1],
  },
}

const exifStr = piexif.dump(exifObj)
const jpeg = readFileSync(SRC)
const out = piexif.insert(exifStr, jpeg.toString('binary'))

writeFileSync(join(OUT, 'camera-with-exif.jpg'), Buffer.from(out, 'binary'))
console.log('wrote test/fixtures/camera-with-exif.jpg')

// sanity: dump back the EXIF we wrote
const readBmp = readFileSync(join(OUT, 'camera-with-exif.jpg'))
const readback = piexif.load(readBmp.toString('binary'))
console.log('readback Make:', readback['0th'][piexif.ImageIFD.Make])
console.log('readback GPSLat:', JSON.stringify(readback.GPS[piexif.GPSIFD.GPSLatitude]))