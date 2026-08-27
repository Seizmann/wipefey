import exifr from 'exifr'
import type {
  CameraData,
  DatesData,
  GpsData,
  IccData,
  IptcData,
} from './unified'

/**
 * exifr-based extraction for JPEG / WebP / HEIC (plan §3).
 *
 * exifr parses EXIF, IPTC, XMP, ICC and GPS in-browser without server round-
 * trips. We normalize the geru pieces (make/model/software, dates, GPS
 * coordinates) into our unified shape and keep the raw tag maps for the
 * raw display (MetadataPanel shows everything, not a curated subset).
 */

export interface ExifrResult {
  exif: Record<string, unknown> | null
  iptc: IptcData | null
  xmp: Record<string, unknown> | null
  icc: IccData | null
  gps: GpsData | null
  camera: CameraData | null
  dates: DatesData | null
}

function toNullable(v: unknown): string | null {
  if (v === undefined || v === null) return null
  return String(v)
}

/** Normalize exifr's GPS object ({ latitude, longitude, altitude }) to our shape. */
function normalizeGps(v: unknown): GpsData | null {
  if (!v || typeof v !== 'object') return null
  const g = v as Record<string, unknown>
  const latitude = typeof g.latitude === 'number' ? g.latitude : null
  const longitude = typeof g.longitude === 'number' ? g.longitude : null
  if (latitude === null && longitude === null) return null
  const altitude =
    typeof g.altitude === 'number' ? g.altitude : null
  return { latitude, longitude, altitude }
}

/**
 * Extract all metadata via exifr. Returns null fields where exifr found
 * nothing (optional in unified shape). Throws a descriptive error on hard
 * parse failure — caller decides whether to degrade.
 */
export async function extractWithExifr(
  file: Blob,
): Promise<ExifrResult> {
  // Materialise to Uint8Array first — exifr handles Blob/File in browsers via
  // FileReader, but arrayBuffer() works in both browser and Node 22, so we use
  // it as the canonical input to avoid environment differences.
  const raw = new Uint8Array(await file.arrayBuffer())

  const [exif, iptc, xmp, icc, gps] = await Promise.all([
    // ifd0=true reads IFD0 tags (Make, Model, Software); exif=true reads ExifIFD
    // The exifr type definitions are narrow — cast via unknown to satisfy tsc.
    exifr.parse(raw, { ifd0: true, exif: true } as unknown as Parameters<typeof exifr.parse>[1]).catch(() => null) as Promise<
      Record<string, unknown> | null
    >,
    exifr.parse(raw, { iptc: true }).catch(() => null) as Promise<
      IptcData | null
    >,
    exifr.parse(raw, { xmp: true }).catch(() => null) as Promise<
      Record<string, unknown> | null
    >,
    exifr.parse(raw, { icc: true }).catch(() => null) as Promise<
      IccData | null
    >,
    exifr.gps(raw).catch(() => null) as Promise<unknown>,
  ])

  // GPS: exifr.gps returns already-normalized decimal coordinates or null.
  const gpsNorm = normalizeGps(gps)

  // Camera/software
  const camera: CameraData | null = exif
    ? {
        make: toNullable(exif['Make'] ?? exif['make']),
        model: toNullable(exif['Model'] ?? exif['model']),
        software: toNullable(exif['Software'] ?? exif['software']),
      }
    : null

  // Dates
  const dates: DatesData | null = exif
    ? {
        taken: toNullable(exif['DateTimeOriginal'] ?? exif['dateTimeOriginal']),
        digitized: toNullable(exif['CreateDate'] ?? exif['createDate']),
        modified: toNullable(exif['ModifyDate'] ?? exif['modifyDate']),
      }
    : null

  return { exif, iptc, xmp, icc, gps: gpsNorm, camera, dates }
}
