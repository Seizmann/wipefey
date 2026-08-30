import { describe, it, expect } from 'vitest'
import { extractC2pa, findDigitalSourceType } from './c2pa'
import { extractImageMetadata } from './index'
import { isClean } from '../transform/verify'
import { runAllMarkers } from '../ai-heuristics/markers'
import { resolveAiLikelihood } from '../ai-heuristics/rules'

// ─── Synthetic fixture builders ───────────────────────────────────────────────
// Byte-accurate minimal containers with C2PA-carrying payloads. These mirror
// the real embedding structures (C2PA spec §"Embedding manifests") closely
// enough for presence detection and field extraction.

const APP11_HEADER = 'urn:uuid:c2pa/f8d6-7a3c-4ba8-9f2f-1e2a3c4d5e6f'

const MANIFEST_JSON =
  '{"claim_generator":"Midjourney v6","claim_generator_info":{"name":"Midjourney"},"signature":"xxx","model":"Midjourney v6.1"}'

function str(s: string): number[] {
  return Array.from(s, (c) => c.charCodeAt(0))
}

/** Blob constructor typing workaround for Uint8Array<ArrayBufferLike>. */
function blobOf(bytes: Uint8Array): Blob {
  return new Blob([bytes as unknown as BlobPart])
}

/** Minimal JPEG: SOI + one APP11 segment + EOI. */
function jpegWithApp11(payload: string): Uint8Array {
  const payloadBytes = str(payload)
  const segLen = payloadBytes.length + 2
  const bytes = [
    0xff, 0xd8, // SOI
    0xff, 0xeb, // APP11
    (segLen >> 8) & 0xff, segLen & 0xff,
    ...payloadBytes,
    0xff, 0xd9, // EOI
  ]
  return new Uint8Array(bytes)
}

function pngChunk(type: string, data: number[]): number[] {
  const len = data.length
  return [
    (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff,
    ...str(type),
    ...data,
    0, 0, 0, 0, // CRC (not validated by the detector)
  ]
}

/** Minimal PNG: signature + IHDR + C2PA chunk + IEND. */
function pngWithC2pa(chunkType: string, payload: number[]): Uint8Array {
  const ihdr = pngChunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0])
  const c2pa = pngChunk(chunkType, payload)
  const iend = pngChunk('IEND', [])
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...ihdr, ...c2pa, ...iend,
  ])
}

/** Minimal WebP: RIFF header + one chunk. */
function webpWithChunk(fourcc: string, payload: string): Uint8Array {
  const payloadBytes = str(payload)
  const riffSize = 4 + 8 + payloadBytes.length + (payloadBytes.length % 2)
  const bytes = [
    ...str('RIFF'),
    riffSize & 0xff, (riffSize >> 8) & 0xff, (riffSize >> 16) & 0xff, (riffSize >>> 24) & 0xff,
    ...str('WEBP'),
    ...str(fourcc),
    payloadBytes.length & 0xff, (payloadBytes.length >> 8) & 0xff,
      (payloadBytes.length >> 16) & 0xff, (payloadBytes.length >>> 24) & 0xff,
    ...payloadBytes,
  ]
  if (payloadBytes.length % 2 === 1) bytes.push(0) // pad byte
  return new Uint8Array(bytes)
}

/** JUMBF-style payload: 4-byte length + 'jumb' box type + manifest JSON. */
function jumbfPayload(json: string): number[] {
  const boxLen = 8 + json.length
  return [
    (boxLen >>> 24) & 0xff, (boxLen >>> 16) & 0xff, (boxLen >>> 8) & 0xff, boxLen & 0xff,
    ...str('jumb'),
    ...str(json),
  ]
}

// ─── Detection per format ─────────────────────────────────────────────────────

describe('extractC2pa', () => {
  describe('JPEG (APP11 JUMBF)', () => {
    it('detects a standard APP11 C2PA payload and extracts claim_generator', () => {
      const bytes = jpegWithApp11(APP11_HEADER + MANIFEST_JSON)
      const info = extractC2pa(bytes, 'jpeg')
      expect(info).not.toBeNull()
      expect(info!.container).toBe('app11-jumbf')
      expect(info!.creationTool).toBe('Midjourney v6')
      expect(info!.modelHint).toBe('Midjourney v6.1')
      expect(info!.fields.map((f) => f.key)).toContain('claim_generator')
    })

    it('detects a JUMBF-signed payload without the exact header string', () => {
      const bytes = jpegWithApp11(String.fromCharCode(...jumbfPayload(MANIFEST_JSON)) + ' c2pa')
      const info = extractC2pa(bytes, 'jpeg')
      expect(info).not.toBeNull()
    })

    it('returns null for a JPEG without APP11 C2PA data', () => {
      expect(extractC2pa(jpegWithApp11('JFIF normal data'), 'jpeg')).toBeNull()
    })
  })

  describe('PNG (caBX / caMs / caSt)', () => {
    it('detects a caBX chunk carrying a JUMBF manifest', () => {
      const bytes = pngWithC2pa('caBX', jumbfPayload(MANIFEST_JSON))
      const info = extractC2pa(bytes, 'png')
      expect(info).not.toBeNull()
      expect(info!.container).toBe('png-chunk')
      expect(info!.containerLabel).toBe('PNG caBX')
      expect(info!.creationTool).toBe('Midjourney v6')
    })

    it('detects legacy caMs and caSt chunks', () => {
      for (const type of ['caMs', 'caSt']) {
        const bytes = pngWithC2pa(type, jumbfPayload(MANIFEST_JSON))
        const info = extractC2pa(bytes, 'png')
        expect(info).not.toBeNull()
        expect(info!.containerLabel).toBe(`PNG ${type}`)
      }
    })

    it('returns null for a PNG without C2PA chunks', () => {
      const bytes = pngWithC2pa('tEXt', [...str('Software\0GIMP')])
      expect(extractC2pa(bytes, 'png')).toBeNull()
    })
  })

  describe('WebP (RIFF chunk)', () => {
    it('detects a c2pa FourCC chunk carrying a JUMBF manifest', () => {
      const bytes = webpWithChunk('c2pa', String.fromCharCode(...jumbfPayload(MANIFEST_JSON)))
      const info = extractC2pa(bytes, 'webp')
      expect(info).not.toBeNull()
      expect(info!.container).toBe('riff-chunk')
      expect(info!.containerLabel).toBe('RIFF c2pa')
      expect(info!.creationTool).toBe('Midjourney v6')
    })

    it('detects any RIFF chunk whose payload starts with a JUMBF box', () => {
      const bytes = webpWithChunk('unkn', String.fromCharCode(...jumbfPayload(MANIFEST_JSON)))
      const info = extractC2pa(bytes, 'webp')
      expect(info).not.toBeNull()
      expect(info!.containerLabel).toBe('RIFF unkn')
    })

    it('returns null for a plain WebP', () => {
      const bytes = webpWithChunk('VP8 ', '\x30\x01\x00\x9d\x01\x2a')
      expect(extractC2pa(bytes, 'webp')).toBeNull()
    })

    it('returns null for non-WebP input', () => {
      expect(extractC2pa(new Uint8Array([1, 2, 3]), 'webp')).toBeNull()
    })
  })

  it('never throws on corrupt containers', () => {
    expect(extractC2pa(new Uint8Array([0xff, 0xd8, 0xff]), 'jpeg')).toBeNull()
    expect(extractC2pa(new Uint8Array(0), 'png')).toBeNull()
  })
})

describe('findDigitalSourceType', () => {
  const URI =
    'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia'

  it('finds the flag in an XMP tag map', () => {
    expect(
      findDigitalSourceType({ 'Iptc4xmpExt:DigitalSourceType': URI }),
    ).toBe(URI)
  })

  it('finds the URI inside PNG text chunks (embedded XMP)', () => {
    const chunks = [
      { type: 'iTXt' as const, key: 'XML:com.adobe.xmp', value: `<xmp>${URI}</xmp>`, compressed: false },
    ]
    expect(findDigitalSourceType(null, chunks)).toBe(URI)
  })

  it('returns null when absent', () => {
    expect(findDigitalSourceType({ 'dc:title': 'hello' })).toBeNull()
    expect(findDigitalSourceType(null, null)).toBeNull()
  })
})

// ─── Full pipeline: extraction → markers → verify gate ───────────────────────

describe('C2PA full pipeline', () => {
  it('extractImageMetadata surfaces C2PA for a JPEG with APP11 manifest', async () => {
    const bytes = jpegWithApp11(APP11_HEADER + MANIFEST_JSON)
    const meta = await extractImageMetadata(blobOf(bytes))
    expect(meta.c2pa).not.toBeNull()
    expect(meta.c2pa!.creationTool).toBe('Midjourney v6')
  })

  it('extractImageMetadata surfaces C2PA for a PNG with caBX', async () => {
    const bytes = pngWithC2pa('caBX', jumbfPayload(MANIFEST_JSON))
    const meta = await extractImageMetadata(blobOf(bytes))
    expect(meta.c2pa).not.toBeNull()
    expect(meta.c2pa!.containerLabel).toBe('PNG caBX')
  })

  it('extractImageMetadata surfaces DigitalSourceType from PNG text chunks', async () => {
    const URI =
      'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia'
    const bytes = pngWithC2pa('iTXt', [
      ...str('XML:com.adobe.xmp\0\0\0\0\0'),
      ...str(`<rdf:Description Iptc4xmpExt:DigitalSourceType="${URI}"/>`),
    ])
    const meta = await extractImageMetadata(blobOf(bytes))
    expect(meta.digitalSourceType).toBe(URI)
    expect(meta.c2pa).toBeNull()
  })

  it('M9 fires (definite) on a file with C2PA + AI dc:creator → Yes badge', async () => {
    const bytes = jpegWithApp11(APP11_HEADER + MANIFEST_JSON)
    const meta = await extractImageMetadata(blobOf(bytes))
    meta.xmp = { 'dc:creator': 'Midjourney' }
    const markers = runAllMarkers(meta)
    expect(markers.map((m) => m.id)).toContain('M9')
    const badge = resolveAiLikelihood(meta).badge
    expect(badge).toBe('Yes')
  })

  it('isClean() flags C2PA as a leak (verify gate)', async () => {
    const bytes = jpegWithApp11(APP11_HEADER + MANIFEST_JSON)
    const meta = await extractImageMetadata(blobOf(bytes))
    expect(isClean(meta)).toBe('c2pa')
  })

  it('isClean() flags DigitalSourceType as a leak (verify gate)', () => {
    expect(
      isClean({
        format: 'png',
        parsedAt: Date.now(),
        digitalSourceType: 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia',
      }),
    ).toBe('digitalSourceType')
  })

  it('clean files pass the verify gate with no false positives', async () => {
    const cleanJpeg = jpegWithApp11('JFIF plain data, no C2PA')
    const meta = await extractImageMetadata(blobOf(cleanJpeg))
    expect(meta.c2pa).toBeNull()
    expect(meta.digitalSourceType).toBeNull()
    expect(isClean(meta)).toBe(true)
  })
})