import {describe,expect,it} from 'vitest'
import {faceFxCatalog} from './params'
import {getFaceRealityEffect} from './reality-effect-manifest'
import {photographicStage} from './reality-effect-audit'
import {
 PUBLIC_PHOTOGRAPHIC_FACE_FX,
 PHOTOGRAPHIC_CAMERA_LOOKS,
 isPublicPhotographicFaceFx,
} from './photographic-filter-policy'

describe('camera photographic filter catalogue',()=>{
 it('removes geometric procedural previews and flat 2D stickers',()=>{
  for(const face of PUBLIC_PHOTOGRAPHIC_FACE_FX){
   if(face.id==='none')continue
   const manifest=getFaceRealityEffect(face.id)
   expect(manifest).not.toBeNull()
   expect(['geometric-prototype','illustrated-2d','disabled'])
    .not.toContain(photographicStage(manifest!))
  }
  expect(isPublicPhotographicFaceFx('cat-ears')).toBe(false)
  expect(isPublicPhotographicFaceFx('3d-lux-glasses')).toBe(false)
  expect(isPublicPhotographicFaceFx('3d-metal-cap')).toBe(false)
  expect(isPublicPhotographicFaceFx('3d-photo-face')).toBe(false)
 })
 it('keeps owner-only crowns out of the public face catalogue',()=>{
  expect(isPublicPhotographicFaceFx('3d-royal-crown-v2')).toBe(false)
  expect(isPublicPhotographicFaceFx('3d-first-gpu-pilot')).toBe(false)
  expect(isPublicPhotographicFaceFx('3d-gold-crown')).toBe(true)
 })
 it('preserves authentic face tracking, cosmetics and an original no-effect mode',()=>{
  expect(isPublicPhotographicFaceFx('none')).toBe(true)
  expect(isPublicPhotographicFaceFx('3d-makeup-soft')).toBe(true)
  expect(isPublicPhotographicFaceFx('face-morph')).toBe(true)
  expect(PUBLIC_PHOTOGRAPHIC_FACE_FX.length).toBeLessThan(faceFxCatalog.length)
 })
 it('offers a small unique and real-pixel photographic preset set',()=>{
  expect(PHOTOGRAPHIC_CAMERA_LOOKS.length).toBeGreaterThanOrEqual(8)
  expect(new Set(PHOTOGRAPHIC_CAMERA_LOOKS.map(x=>x.id)).size).toBe(PHOTOGRAPHIC_CAMERA_LOOKS.length)
  expect(PHOTOGRAPHIC_CAMERA_LOOKS[0].id).toBe('original')
  expect(PHOTOGRAPHIC_CAMERA_LOOKS.every(x=>x.color&&x.swatch)).toBe(true)
 })
})
