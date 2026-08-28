import { describe, it, expect } from 'vitest'
import { runAllMarkers } from './markers'
import type { ImageMetadata } from '../metadata/unified'

// Shared mock — empty metadata, each test overrides what's needed
function meta(overrides: Partial<ImageMetadata> = {}): ImageMetadata {
  return {
    format: 'png',
    parsedAt: Date.now(),
    ...overrides,
  }
}

describe('runAllMarkers', () => {
  it('returns empty array for clean metadata', () => {
    expect(runAllMarkers(meta())).toEqual([])
  })

  // ── M1: XMP dc:creator ────────────────────────────────────────────────────
  describe('M1 — XMP dc:creator', () => {
    it('matches a known AI tool name (string)', () => {
      const result = runAllMarkers(
        meta({ xmp: { 'dc:creator': 'Stable Diffusion' } }),
      )
      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe('M1')
      expect(result[0]!.matchedKey).toBe('dc:creator')
    })

    it('matches when dc:creator is an array', () => {
      const result = runAllMarkers(
        meta({ xmp: { 'dc:creator': ['Midjourney', 'other'] } }),
      )
      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe('M1')
    })

    it('does not match a non-AI creator', () => {
      const result = runAllMarkers(
        meta({ xmp: { 'dc:creator': 'Adobe Photoshop' } }),
      )
      expect(result.filter((m) => m.id === 'M1')).toHaveLength(0)
    })
  })

  // ── M2: XMP xmp:CreatorTool ──────────────────────────────────────────────
  describe('M2 — XMP xmp:CreatorTool', () => {
    it('matches ComfyUI', () => {
      const result = runAllMarkers(
        meta({ xmp: { 'xmp:CreatorTool': 'ComfyUI' } }),
      )
      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe('M2')
      expect(result[0]!.matchedKey).toBe('xmp:CreatorTool')
    })

    it('matches fallback CreatorTool key', () => {
      const result = runAllMarkers(
        meta({ xmp: { CreatorTool: 'DALL·E' } }),
      )
      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe('M2')
    })

    it('does not match non-AI tool', () => {
      const result = runAllMarkers(
        meta({ xmp: { 'xmp:CreatorTool': 'GIMP' } }),
      )
      expect(result.filter((m) => m.id === 'M2')).toHaveLength(0)
    })
  })

  // ── M3: C2PA (deferred) ─────────────────────────────────────────────────
  describe('M3 — C2PA (deferred)', () => {
    it('always returns null', () => {
      const result = runAllMarkers(meta())
      expect(result.filter((m) => m.id === 'M3')).toHaveLength(0)
    })
  })

  // ── M4: PNG parameter keys ──────────────────────────────────────────────
  describe('M4 — PNG parameter keys', () => {
    it('matches a well-known parameter key', () => {
      const result = runAllMarkers(
        meta({
          pngChunks: [
            {
              type: 'tEXt',
              key: 'parameters',
              value: 'prompt: a cat\nSteps: 20',
              compressed: false,
            },
          ],
        }),
      )
      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe('M4')
      expect(result[0]!.matchedKey).toBe('parameters')
    })

    it('matches "Steps" key directly', () => {
      const result = runAllMarkers(
        meta({
          pngChunks: [
            { type: 'tEXt', key: 'Steps', value: '30', compressed: false },
          ],
        }),
      )
      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe('M4')
      expect(result[0]!.matchedKey).toBe('Steps')
    })

    it('skips failed chunks', () => {
      const result = runAllMarkers(
        meta({
          pngChunks: [
            {
              type: 'tEXt',
              key: 'Steps',
              value: 'bad',
              compressed: false,
              failed: true,
            },
          ],
        }),
      )
      expect(result.filter((m) => m.id === 'M4')).toHaveLength(0)
    })
  })

  // ── M5: PNG ambient keys ────────────────────────────────────────────────
  describe('M5 — PNG ambient keys', () => {
    it('matches prompt key', () => {
      const result = runAllMarkers(
        meta({
          pngChunks: [
            {
              type: 'iTXt',
              key: 'prompt',
              value: 'a beautiful sunset',
              compressed: false,
            },
          ],
        }),
      )
      // 'prompt' is in both AI_PARAMETER_KEYS (M4) and the M5 ambient list,
      // so both markers fire on the same chunk.
      const m5 = result.filter((m) => m.id === 'M5')
      expect(m5).toHaveLength(1)
      expect(m5[0]!.matchedKey).toBe('prompt')
    })

    it('matches negative_prompt key', () => {
      const result = runAllMarkers(
        meta({
          pngChunks: [
            {
              type: 'tEXt',
              key: 'negative_prompt',
              value: 'blurry, bad',
              compressed: false,
            },
          ],
        }),
      )
      // 'negative_prompt' is also an AI_PARAMETER_KEY, so M4 fires too.
      expect(result.filter((m) => m.id === 'M5')).toHaveLength(1)
    })

    it('does not match Comment (too common in non-AI PNGs)', () => {
      const result = runAllMarkers(
        meta({
          pngChunks: [
            {
              type: 'tEXt',
              key: 'Comment',
              value: 'Edited with Lightroom',
              compressed: false,
            },
          ],
        }),
      )
      expect(result.filter((m) => m.id === 'M5')).toHaveLength(0)
    })
  })

  // ── M6: PNG Software — A1111/SD/ComfyUI ─────────────────────────────────
  describe('M6 — PNG Software (SD variants)', () => {
    it('matches Stable Diffusion', () => {
      const result = runAllMarkers(
        meta({
          pngChunks: [
            {
              type: 'tEXt',
              key: 'Software',
              value: 'Stable Diffusion',
              compressed: false,
            },
          ],
        }),
      )
      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe('M6')
    })

    it('matches AUTOMATIC1111', () => {
      const result = runAllMarkers(
        meta({
          pngChunks: [
            {
              type: 'tEXt',
              key: 'Software',
              value: 'A1111 v1.5',
              compressed: false,
            },
          ],
        }),
      )
      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe('M6')
    })

    it('does not match generic software', () => {
      const result = runAllMarkers(
        meta({
          pngChunks: [
            {
              type: 'tEXt',
              key: 'Software',
              value: 'Adobe Photoshop',
              compressed: false,
            },
          ],
        }),
      )
      expect(result.filter((m) => m.id === 'M6')).toHaveLength(0)
    })
  })

  // ── M7: PNG Software — Midjourney/NightCafe ─────────────────────────────
  describe('M7 — PNG Software (MJ variants)', () => {
    it('matches Midjourney', () => {
      const result = runAllMarkers(
        meta({
          pngChunks: [
            {
              type: 'tEXt',
              key: 'Software',
              value: 'Midjourney',
              compressed: false,
            },
          ],
        }),
      )
      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe('M7')
    })

    it('matches NightCafe', () => {
      const result = runAllMarkers(
        meta({
          pngChunks: [
            {
              type: 'tEXt',
              key: 'Software',
              value: 'NightCafe Creator',
              compressed: false,
            },
          ],
        }),
      )
      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe('M7')
    })
  })

  // ── M8: EXIF Software ───────────────────────────────────────────────────
  describe('M8 — EXIF Software', () => {
    it('matches via camera.software', () => {
      const result = runAllMarkers(
        meta({
          camera: { make: null, model: null, software: 'ComfyUI' },
        }),
      )
      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe('M8')
    })

    it('matches via raw exif Software tag', () => {
      const result = runAllMarkers(
        meta({
          exif: { Software: 'NovelAI' },
        }),
      )
      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe('M8')
    })

    it('does not match generic EXIF Software', () => {
      const result = runAllMarkers(
        meta({
          camera: { make: 'Canon', model: 'EOS R5', software: 'Adobe Lightroom' },
        }),
      )
      expect(result.filter((m) => m.id === 'M8')).toHaveLength(0)
    })
  })

  // ── M9: C2PA + dc:creator combo (deferred) ──────────────────────────────
  describe('M9 — combo marker (deferred)', () => {
    it('always returns null (M3 is deferred)', () => {
      const result = runAllMarkers(
        meta({ xmp: { 'dc:creator': 'Stable Diffusion' } }),
      )
      expect(result.filter((m) => m.id === 'M9')).toHaveLength(0)
    })
  })

  // ── M10: ICC profile description ─────────────────────────────────────────
  describe('M10 — ICC description', () => {
    it('matches AI ICC description', () => {
      const result = runAllMarkers(
        meta({ icc: { description: 'Stable Diffusion' } }),
      )
      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe('M10')
      expect(result[0]!.confidence).toBe('weak')
    })

    it('does not match generic ICC description', () => {
      const result = runAllMarkers(
        meta({ icc: { description: 'sRGB IEC61966-2.1' } }),
      )
      expect(result.filter((m) => m.id === 'M10')).toHaveLength(0)
    })
  })

  // ── Multiple markers ─────────────────────────────────────────────────────
  describe('multiple markers', () => {
    it('detects M1 + M2 together', () => {
      const result = runAllMarkers(
        meta({
          xmp: {
            'dc:creator': 'Stable Diffusion',
            'xmp:CreatorTool': 'ComfyUI',
          },
        }),
      )
      const ids = result.map((m) => m.id)
      expect(ids).toContain('M1')
      expect(ids).toContain('M2')
    })
  })

  // ── Truncation ───────────────────────────────────────────────────────────
  describe('truncation', () => {
    it('truncates matchedValue to 512 chars', () => {
      const longValue = 'x'.repeat(600)
      const result = runAllMarkers(
        meta({
          pngChunks: [
            { type: 'tEXt', key: 'prompt', value: longValue, compressed: false },
          ],
        }),
      )
      expect(result.length).toBeGreaterThan(0)
      for (const marker of result) {
        expect(marker.matchedValue.length).toBeLessThanOrEqual(513) // 512 + ellipsis
      }
    })
  })
})
