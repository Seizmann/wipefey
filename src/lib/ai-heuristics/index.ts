/**
 * Clean barrel export for the ai-heuristics module.
 * Consumers import types and functions from here.
 */
export type { AiBadge, AiHeuristicResult } from './rules'
export { resolveAiLikelihood } from './rules'
export type { MatchedMarker, ConfidenceTier, MarkerDefinition } from './markers'
export {
  MARKER_REGISTRY,
  AI_TOOL_NAMES,
  AI_SOFTWARE_NAMES,
  AI_PARAMETER_KEYS,
  AI_AMBIENT_KEYS,
  runAllMarkers,
} from './markers'
