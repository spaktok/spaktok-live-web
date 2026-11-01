import {describe,expect,it} from 'vitest'
import {realityColorFragmentShader} from './renderer'
import {realityGpuColorFragmentShader} from './reality-camera-gpu'

function smoothingBlock(shader:string){
 const start=shader.indexOf('  if (uSmooth > 0.001 && uHasFace > 0.5) {')
 const end=shader.indexOf('  if (uWhiten > 0.001) {',start)
 if(start<0||end<0)throw Error('missing_portrait_refinement')
 return shader.slice(start,end)
}
describe('tone-neutral photographic portrait GPU pipeline',()=>{
 it('uses tracked face shape rather than excluding darker or cool-lit skin',()=>{
  const s=smoothingBlock(realityColorFragmentShader)
  expect(s).toContain('float safeFace=faceRegion*')
  expect(s).not.toContain('skinMask(color)')
  expect(s).toContain('uHasFace > 0.5')
 })
 it('protects eyes, lips, contrast boundaries and small skin textures',()=>{
  const s=smoothingBlock(realityColorFragmentShader)
  expect(s).toContain('leftEyeGuard')
  expect(s).toContain('rightEyeGuard')
  expect(s).toContain('lipGuard')
  expect(s).toContain('delta*delta/0.0025')
  expect(s).toContain('min(0.65,uSmooth*0.62)')
 })
 it('does not change white balance or skin hue to perform smoothing',()=>{
  const s=smoothingBlock(realityColorFragmentShader)
  expect(s).toContain('color+vec3(corrected-referenceY)')
  expect(s).not.toContain('uWhiten')
  expect(s).not.toContain('vec3(1.0)')
 })
 it('uses same refinement in recording and integrated Three camera',()=>{
  const legacy=smoothingBlock(realityColorFragmentShader)
  const gpu=smoothingBlock(realityGpuColorFragmentShader)
  expect(gpu).toBe(legacy)
 })
})
