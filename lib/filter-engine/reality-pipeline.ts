import {
  isFace3DSelected,
  needsFaceFxTracking,
  needsFaceTracking,
  needsSegmentation,
  type StudioState,
} from './params'

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
  const faceOverlay = needsFaceFxTracking(state.face)
  const threeDimensional = faceOverlay && isFace3DSelected(state.face.id)
  return {
    trackFace: faceOverlay || needsFaceTracking(state.beauty),
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
