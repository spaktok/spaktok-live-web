import {
  needsFaceFxTracking,
  needsFaceTracking,
  needsSegmentation,
  type StudioState,
} from './params'
import {getFaceRealityEffect} from './reality-effect-manifest'

/** Centralized resource/feature decisions for the camera, inferencer and
 * recorder. A face lens must never disable the independent beauty/color pass.
 */
export type RealityExecutionPlan = Readonly<{
  trackFace: boolean
  trackPerson: boolean
  faceOverlay: boolean
  threeDimensional: boolean
  twoDimensional: boolean
  gpuColorAndBeauty: true
}>

export function createRealityExecutionPlan(
  state: Pick<StudioState, 'face' | 'beauty' | 'effects'>,
): RealityExecutionPlan {
  const faceSelected=needsFaceFxTracking(state.face)
  const faceOverlay=faceSelected&&state.face.id!=='face-morph'
  const manifest = faceOverlay ? getFaceRealityEffect(state.face.id) : null
  // The runtime contract owns the type of effect; string prefixes are no
  // longer used for the central camera execution plan.
  const threeDimensional = Boolean(manifest &&
    (manifest.kind==='wearable-3d'||manifest.kind==='expression-3d'||
     manifest.kind==='face-surface'))
  return {
    trackFace: faceSelected || needsFaceTracking(state.beauty),
    trackPerson: needsSegmentation(state.effects),
    faceOverlay,
    threeDimensional,
    twoDimensional: faceOverlay && !threeDimensional,
    gpuColorAndBeauty: true,
  }
}

/** GPU v2 requires an explicit QA opt-in and a real 3D lens. Rendering and
 * capture use the same canvas only while this predicate is true.
 */
export function shouldUseRealityGpu2(
  requested:boolean,
  has3dEngine:boolean,
  state:Pick<StudioState,'face'|'beauty'|'effects'>,
):boolean {
  return requested && has3dEngine && createRealityExecutionPlan(state).threeDimensional
}
