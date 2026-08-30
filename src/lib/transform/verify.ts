/**
 * Verify-strip gate (Phase 3).
 *
 * After canvas.toBlob() produces a stripped blob, and before any rewrite,
 * we re-run extractImageMetadata() against that blob and assert no prior
 * metadata survived. This is a hard gate — leaks abort the transform.
 *
 * isClean() returns true when the metadata shape carries nothing meaningful,
 * or returns the name of the first leaked field so callers can surface a
 * specific error and the verify script can assert on it.
 */

import type { ImageMetadata } from '../metadata/unified'

/**
 * Returns `true` when no prior metadata is detectable, or a string naming
 * the first leaked field (e.g. `'camera.make'`, `'gps.latitude'`, `'exif'`).
 *
 * The `warning` field is explicitly allowed — it is set by extractImageMetadata
 * when NOTHING was found, which is the correct outcome post-strip. A warning
 * of "No metadata found…" is the expected signal, not a leak.
 */
export function isClean(meta: ImageMetadata): true | string {
  // Camera fields
  if (meta.camera != null) {
    if (meta.camera.make != null) return 'camera.make'
    if (meta.camera.model != null) return 'camera.model'
    if (meta.camera.software != null) return 'camera.software'
  }

  // GPS
  if (meta.gps != null) {
    if (meta.gps.latitude != null) return 'gps.latitude'
    if (meta.gps.longitude != null) return 'gps.longitude'
    if (meta.gps.altitude != null) return 'gps.altitude'
  }

  // Date fields
  if (meta.dates != null) {
    if (meta.dates.taken != null) return 'dates.taken'
    if (meta.dates.digitized != null) return 'dates.digitized'
    if (meta.dates.modified != null) return 'dates.modified'
  }

  // Raw EXIF object — any key = leak
  if (meta.exif != null && Object.keys(meta.exif).length > 0) return 'exif'

  // IPTC — check known fields + any extra keys
  if (meta.iptc != null) {
    const { title, description, keywords, creator, copyright, ...rest } =
      meta.iptc
    if (
      title != null ||
      description != null ||
      (keywords != null && keywords.length > 0) ||
      (creator != null && creator.length > 0) ||
      copyright != null ||
      Object.keys(rest).length > 0
    ) {
      return 'iptc'
    }
  }

  // XMP — any key = leak
  if (meta.xmp != null && Object.keys(meta.xmp).length > 0) return 'xmp'

  // PNG text chunks — any chunk = leak
  if (meta.pngChunks != null && meta.pngChunks.length > 0) return 'pngChunks'

  // C2PA / Content Credentials manifest — any detection = leak
  if (meta.c2pa != null) return 'c2pa'

  // IPTC Digital Source Type (trainedAlgorithmicMedia) — presence = leak
  if (meta.digitalSourceType != null) return 'digitalSourceType'

  // ICC description
  if (meta.icc?.description != null) return 'icc.description'

  return true
}
