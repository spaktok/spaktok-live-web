import { describe, expect, it } from 'vitest'
import { realityColorFragmentShader } from './renderer'
import { realityCameraUniforms, realityCoverCrop } from './reality-camera-gpu'
import { createStudioState } from './params'
import { shouldUseRealityGpu2 } from './reality-pipeline'

describe('SpakTok Reality GPU v2',()=>{
  it('retains the exact existing color shader, without separate look approximations',()=>{
    expect(realityColorFragmentShader).toContain('uniform sampler2D uVideo;')
    expect(realityColorFragmentShader).toContain('uSmooth')
    expect(realityColorFragmentShader).toContain('uBgMode')
    expect(realityColorFragmentShader).toContain('gl_FragColor')
    for(const name of realityCameraUniforms.floats)
      expect(realityColorFragmentShader).toContain(name)
    for(const name of realityCameraUniforms.vectors2)
      expect(realityColorFragmentShader).toContain(name)
  })
  it('preserves object-fit cover crop parity for portrait video',()=>{
    const result=realityCoverCrop(1920,1080,540,960)
    expect(result.scaleX).toBeCloseTo(0.31640625)
    expect(result.scaleY).toBe(1)
    expect(result.offsetX).toBeCloseTo((1-0.31640625)/2)
    expect(result.offsetY).toBe(0)
  })
  it('preserves object-fit cover crop parity for portrait camera',()=>{
    const result=realityCoverCrop(1080,1920,540,960)
    expect(result).toEqual({scaleX:1,scaleY:1,offsetX:0,offsetY:0})
  })
  it('rejects invalid dimensions instead of producing NaN GPU coordinates',()=>{
    expect(()=>realityCoverCrop(0,1080,540,960)).toThrow('reality_invalid_video_dimensions')
  })
  it('remains opt-in and never activates for 2D lenses',()=>{
    const state=createStudioState()
    expect(shouldUseRealityGpu2(true,true,state)).toBe(false)
    state.face={id:'3d-gold-crown',strength:1}
    expect(shouldUseRealityGpu2(false,true,state)).toBe(false)
    expect(shouldUseRealityGpu2(true,false,state)).toBe(false)
    expect(shouldUseRealityGpu2(true,true,state)).toBe(true)
  })
})
