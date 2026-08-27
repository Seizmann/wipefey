/**
 * Unified metadata shape across JPEG / PNG / WebP / HEIC.
 * All extractors normalize into this single interface (plan §3).
 */

export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'heic' | 'other'

/** One parsed PNG text chunk: tEXt / iTXt / zTXt.
 *  We keep the source so Phase 2 can weight markers by how they arrived
 *  (e.g. an iTXt `parameters` key is a stronger signal than a tEXt one). */
export interface PngTextChunk {
  /** Original chunk type as written on disk: 'tEXt' | 'iTXt' | 'zTXt' */
  type: 'tEXt' | 'iTXt' | 'zTXt'
  key: string
  value: string
  /** true when this chunk was zlib-compressed on disk (zTXt or iTXt/compression) */
  compressed: boolean
  /** true when the stream warned/declined to decode (e.g. bad UTF-8, deflate fail) */
  failed?: boolean
}

export interface ExifData {
  /** EXIF IFD tags that are meaningful to show. */
  [tag: string]: unknown
}

export interface IptcData {
  title?: string
  description?: string
  keywords?: string[]
  creator?: string[]
  copyright?: string
  [other: string]: unknown
}

export interface IccData {
  /** ICC profile description or null when absent. */
  description?: string | null
  /** Free-form ICC tags surfaced by exifr. */
  [other: string]: unknown
}

export interface GpsData {
  latitude: number | null
  longitude: number | null
  altitude?: number | null
}

export interface CameraData {
  make: string | null
  model: string | null
  software: string | null
}

export interface DatesData {
  /** DateTimeOriginal (EXIF) — when the photo was taken. */
  taken?: string | null
  /** CreateDate — when digitized. */
  digitized?: string | null
  /** ModifyDate — last saved. */
  modified?: string | null
}

export interface ImageMetadata {
  format: ImageFormat
  /** Width/height in pixels when the decoder provides them. */
  width?: number
  height?: number
  exif?: ExifData
  iptc?: IptcData
  /** XMP as a flat-ish record; keys like 'dc:creator'. */
  xmp?: Record<string, unknown>
  icc?: IccData
  /** Decoded text chunks. Primary AI-marker channel for PNG. */
  pngChunks?: PngTextChunk[]
  gps?: GpsData | null
  camera?: CameraData | null
  dates?: DatesData | null
  /** Unix ms when this object was produced. */
  parsedAt: number
  /** Populated when the extractor hit a per-format problem but the batch
   *  must not crash. Also used for HEIC-unsupported-browser messaging. */
  warning?: string
}

/** Fields that are safe to render in the raw display. */
export type MetadataCategory =
  | 'EXIF'
  | 'IPTC'
  | 'XMP'
  | 'GPS'
  | 'Camera'
  | 'Dates'
  | 'PNG text chunks'
  | 'ICC'
