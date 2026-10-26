import { describe, expect, it } from 'vitest'
import { createStudioState } from './params'
import { createRealityExecutionPlan } from './reality-pipeline'

describe('Reality execution plan', () => {
  it('keeps GPU beauty and color enabled alongside 3D crowns and segmentation', () => {
    const s = createStudioState()
    s.face = { id: '3d-gold-crown', strength: 1 }
    s.beauty.smooth = .4
    s.effects.background = 'blur'
    s.effects.backgroundBlur = .5
    expect(createRealityExecutionPlan(s)).toEqual({
      trackFace: true,
      trackPerson: true,
      faceOverlay: true,
      threeDimensional: true,
      twoDimensional: false,
      gpuColorAndBeauty: true,
    })
  })

  it('does not require inference for a neutral effect', () => {
    const p = createRealityExecutionPlan(createStudioState())
    expect(p.trackFace).toBe(false)
    expect(p.trackPerson).toBe(false)
    expect(p.faceOverlay).toBe(false)
    expect(p.gpuColorAndBeauty).toBe(true)
  })
})
