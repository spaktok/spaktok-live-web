import {describe,expect,it} from 'vitest'
import {cameraMorphForEffect,DEFAULT_FACE_MORPH,normalizeFaceMorph,faceMorphIsActive} from './reality-face-morph'
import {createStudioState,faceFxCatalog} from './params'
import {createRealityExecutionPlan} from './reality-pipeline'
import {getRealityEffect} from './reality-effect-manifest'
import {realityColorFragmentShader} from './renderer'
import {realityCameraUniforms} from './reality-camera-gpu'

describe('Face Morph P0 — real camera skin instead of foreign photo overlay',()=>{
 it('activates face-landmark tracking with no 2D/3D photo overlay',()=>{
  const state=createStudioState()
  state.face={id:'face-morph',strength:.7,morph:DEFAULT_FACE_MORPH}
  const plan=createRealityExecutionPlan(state)
  expect(plan.trackFace).toBe(true)
  expect(plan.faceOverlay).toBe(false)
  expect(plan.twoDimensional).toBe(false)
  expect(plan.threeDimensional).toBe(false)
  expect(faceFxCatalog.some(x=>x.id==='face-morph')).toBe(true)
  expect(getRealityEffect('face-morph')?.kind).toBe('face-deform')
 })
 it('only activates when selected, clamps NaN/oversized authored values',()=>{
  expect(cameraMorphForEffect('none',1,DEFAULT_FACE_MORPH)).toBeNull()
  const settings=cameraMorphForEffect('face-morph',2,{
    cheeks:Infinity,jaw:-.5,eyes:.3,
  })!
  expect(settings.strength).toBe(1)
  expect(settings.cheeks).toBe(0)
  expect(settings.jaw).toBe(0)
  expect(settings.eyes).toBe(.3)
  expect(faceMorphIsActive(settings,.22)).toBe(true)
  expect(faceMorphIsActive(settings,0)).toBe(false)
  expect(normalizeFaceMorph({strength:NaN}).strength).toBe(0)
 })
 it('inverse-warps samples of the original camera, not a face photograph',()=>{
  expect(realityColorFragmentShader).toContain('vec2 sculptFace(')
  expect(realityColorFragmentShader).toContain('src = sculptFace(src,fw)')
  expect(realityColorFragmentShader).toContain('vec3 color = tex(src)')
  expect(realityColorFragmentShader).toContain('uniform float uMorphStrength')
  expect(realityColorFragmentShader).toContain('uniform vec3 uMorphContour')
  expect(realityColorFragmentShader).toContain('uniform vec3 uMorphDetail')
  expect(realityCameraUniforms.floats).toContain('uMorphStrength')
  expect(realityCameraUniforms.vectors3).toContain('uMorphContour')
 })
})
