import {describe,expect,it} from 'vitest'
import {
 createStudioProductionPackage,reviewStudioProduction,
 validateStudioProductionPackage,withStudioProductionSource,
 type StudioProductionPackage,
} from './reality-production-pipeline'
import {auditStudioGlbBytes} from './reality-production-glb-audit'
import {validLocalHandoffName} from './reality-local-asset-handoff'
function buildGlb(patch:(obj:Record<string,unknown>)=>void=()=>{}){
 const json:Record<string,unknown>={
  asset:{version:'2.0'},buffers:[{byteLength:44}],
  bufferViews:[{buffer:0,byteOffset:0,byteLength:36},
   {buffer:0,byteOffset:36,byteLength:6}],
  accessors:[
   {count:3,type:'VEC3',componentType:5126,bufferView:0},
   {count:3,type:'SCALAR',componentType:5123,bufferView:1},
   {count:3,type:'VEC3',componentType:5126,bufferView:0},
   {count:3,type:'VEC2',componentType:5126,bufferView:0},
  ],materials:[{pbrMetallicRoughness:{metallicFactor:0,roughnessFactor:.6}}],
  meshes:[{primitives:[{mode:4,indices:1,
   attributes:{POSITION:0,NORMAL:2,TEXCOORD_0:3},material:0}]}],
 }
 patch(json)
 const enc=new TextEncoder().encode(JSON.stringify(json))
 const jsonSize=Math.ceil(enc.length/4)*4
 const len=20+jsonSize+8+44
 const buffer=new ArrayBuffer(len),dv=new DataView(buffer)
 dv.setUint32(0,0x46546c67,true);dv.setUint32(4,2,true)
 dv.setUint32(8,len,true);dv.setUint32(12,jsonSize,true)
 dv.setUint32(16,0x4e4f534a,true)
 const target=new Uint8Array(buffer,20,jsonSize)
 target.fill(32);target.set(enc)
 dv.setUint32(20+jsonSize,44,true)
 dv.setUint32(20+jsonSize+4,0x004e4942,true)
 return buffer
}
describe('Production director reviews',()=>{
 it('does not allow rights-laundering or publish via authoring package',()=>{
  let p=createStudioProductionPackage()
  expect(reviewStudioProduction(p).mayExportCandidate).toBe(false)
  p=withStudioProductionSource(p,'my-portrait.png',2048,'image')
  expect(reviewStudioProduction(p).mayExportCandidate).toBe(false)
  p={...p,rights:'original',tests:{...p.tests,sourceReviewed:true}}
  const draft=reviewStudioProduction(p)
  expect(draft.mayExportCandidate).toBe(true)
  expect(draft.mayRequestReview).toBe(false)
  expect(draft.mayPublish).toBe(false)
  const next=withStudioProductionSource(p,'someone-else.png',1000,'image')
  expect(next.rights).toBe('unverified')
  expect(next.tests.sourceReviewed).toBe(false)
  expect(reviewStudioProduction(next).mayExportCandidate).toBe(false)
 })
 it('requires license evidence and forbids forged publish values',()=>{
  const base=withStudioProductionSource(createStudioProductionPackage(),'licensed.glb',2200,'glb')
  let p={...base,rights:'licensed' as const,
   tests:{...base.tests,sourceReviewed:true}}
  expect(reviewStudioProduction(p).mayExportCandidate).toBe(false)
  p={...p,rightsEvidence:'Commercial license XYZ-12345'}
  expect(reviewStudioProduction(p).mayExportCandidate).toBe(true)
  expect(()=>validateStudioProductionPackage({...p,published:true} as unknown as StudioProductionPackage))
   .toThrow('studio_production_invalid_manifest')
 })
 it('keeps body attachment blocked without actual body tracking',()=>{
  const p=createStudioProductionPackage()
  expect(reviewStudioProduction({...p,mount:'body',anchor:null}).mayRequestReview).toBe(false)
  expect(()=>reviewStudioProduction({...p,mount:'screen',anchor:'nose_tip'}))
   .toThrow('studio_production_invalid_manifest')
 })
})
describe('Non-executing GLB production audit',()=>{
 it('counts embedded indexed triangles and PBR, not image quality',()=>{
  const audit=auditStudioGlbBytes(buildGlb())
  expect(audit.triangles).toBe(1)
  expect(audit.materials).toBe(1)
  expect(audit.hasUV).toBe(true)
  expect(audit.hasNormals).toBe(true)
  expect(audit.hasPBR).toBe(true)
  expect(audit.valid).toBe(true)
  expect(audit.rigTargets).toBe(0)
  expect(audit.warnings).toContain('morph_targets_missing')
 })
 it('rejects external textures and unbacked geometry declarations',()=>{
  const remote=auditStudioGlbBytes(buildGlb(json=>{
   json.images=[{uri:'https://example.org/photo.png'}]
  }))
  expect(remote.valid).toBe(false)
  expect(remote.warnings).toContain('external_buffers_or_images')
  const unbacked=auditStudioGlbBytes(buildGlb(json=>{
   json.bufferViews=[]
  }))
  expect(unbacked.valid).toBe(false)
  const noBin=new Uint8Array(buildGlb()).slice(0,-52)
  new DataView(noBin.buffer).setUint32(8,noBin.length,true)
  expect(auditStudioGlbBytes(noBin.buffer).valid).toBe(false)
 })
 it('rejects lying GLB length and invalid mode rather than guessing',()=>{
  const bytes=buildGlb(),view=new DataView(bytes)
  view.setUint32(8,bytes.byteLength-4,true)
  expect(()=>auditStudioGlbBytes(bytes)).toThrow('studio_glb_invalid_header')
  const lines=auditStudioGlbBytes(buildGlb(json=>{
   json.meshes=[{primitives:[{mode:1,attributes:{POSITION:0}}]}]
  }))
  expect(lines.valid).toBe(false)
  expect(lines.warnings).toContain('non_triangle_primitives')
 })
 it('prevents local draft handoff path injection',()=>{
  expect(validLocalHandoffName('portrait-canonical-preview.glb')).toBe(true)
  expect(validLocalHandoffName('../../my.glb')).toBe(false)
  expect(validLocalHandoffName('X.GLB')).toBe(true)
  expect(validLocalHandoffName('avatar.html')).toBe(false)
 })
})
