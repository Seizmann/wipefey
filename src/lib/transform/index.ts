/**
 * Transform pipeline — public barrel export (Phase 3).
 *
 * Consumers (store, verify script) import from here, not from sub-modules
 * directly — consistent with the metadata/ and ai-heuristics/ pattern.
 */

export { runTransform } from './run'
export type { TransformResult, StripFn } from './run'
export { isClean } from './verify'
export { rewriteJpeg, JpegWriteError } from './jpeg-write'
export { rewritePng, PngWriteError, computeChunkCrc } from './png-write'
export { stripImage, StripError } from './strip'
