import { describe, expect, it } from 'vitest'
import { realityColorFragmentShader } from './renderer'
import { realityCameraUniforms, realityCoverCrop, realityGpuCameraVertexShader, realityGpuColorFragmentShader, realityMaskNeedsAllocation } from './reality-camera-gpu'
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
  it('preserves camera Y-down projection without double-flipping the UV',()=>{
    // THREE.OrthographicCamera(0,W,0,H) maps world y=0 to screen TOP.
    // THREE.PlaneGeometry local -Y has uv.y=0; plane centered at world H/2:
    // local -H/2 maps to y=0 and uv.y=0. Flipping uv again would invert video.
    expect(realityGpuCameraVertexShader).toContain('vUv=uv;')
    expect(realityGpuCameraVertexShader).not.toContain('1.0-uv.y')
    const projectedUvY=(screenY:number,height:number)=>
      ((screenY-height/2)/height)+.5
    expect(projectedUvY(0,960)).toBe(0)
    expect(projectedUvY(480,960)).toBe(.5)
    expect(projectedUvY(960,960)).toBe(1)
  })
  it('preserves sRGB legacy grading but correctly encodes the 3D output',()=>{
    expect(realityGpuColorFragmentShader).toContain('spaktokSrgbToLinear')
    expect(realityGpuColorFragmentShader).toContain('#include <colorspace_fragment>')
    expect(realityColorFragmentShader).not.toContain('#include <colorspace_fragment>')
    expect(realityGpuColorFragmentShader).not.toContain(
      'gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);'
    )
    // End-of-pipeline only: do not convert every texture sample.
    expect(realityGpuColorFragmentShader).toContain('vec3 color = tex(src)')
    const linear=(c:number)=>c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4)
    const srgb=(c:number)=>c<=.0031308?12.92*c:1.055*Math.pow(c,1/2.4)-.055
    for(const v of [0,.01,.04,.18,.5,.75,1])
      expect(srgb(linear(v))).toBeCloseTo(v,5)
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
  it('reuses GPU segmentation textures while resolution is constant',()=>{
    expect(realityMaskNeedsAllocation({width:256,height:256},{width:256,height:256})).toBe(false)
    expect(realityMaskNeedsAllocation({width:256,height:256},{width:128,height:256})).toBe(true)
    expect(realityMaskNeedsAllocation({width:256,height:256},{width:256,height:128})).toBe(true)
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
