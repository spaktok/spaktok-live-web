import {auditStudioGlbBytes} from './reality-production-glb-audit'

/** Measured from the creator-supplied Rodin mobile GLB, not assumed anatomy.
 * The source represents a man's head and neck bust, NOT a whole body.
 * Original Rodin albedo textures were not included in the uploaded OBJ.
 */
export const RODIN_HEAD_SOURCE_SHA256=
 'e006149f3b97cb2786991969f068991c070a5b1480589cc9ec58de1bc2d397a0'
export const RODIN_HEAD_CALIBRATED_SHA256=
 '0de24d21d2068d82e7419be6cd61007b3b8b835e188d83a1d613ce712cb76f6f'
export const RODIN_HEAD_CALIBRATED_FILENAME=
 'rodin_spaktok_head_avatar_calibrated.glb'
export const RODIN_HEAD_SOURCE_HEIGHT_UNITS=1.8969424434035318
export const RODIN_HEAD_PREVIEW_HEIGHT_M=.34
export const RODIN_HEAD_SCALE=RODIN_HEAD_PREVIEW_HEIGHT_M/
 RODIN_HEAD_SOURCE_HEIGHT_UNITS
export const RODIN_HEAD_PRESET={
 id:'rodin-owner-head-v1',
 category:'head-bust',
 source:'creator-uploaded-rodin-obj',
 expectedTriangles:117657,
 heightM:RODIN_HEAD_PREVIEW_HEIGHT_M,
 widthM:.20513628642972054,
 depthM:.25586237800599756,
 forwardAxis:'+Z (visual estimate; confirm with user)',
 upAxis:'+Y',
 neckBaseY:0,
 originCenterX:0,
 faceMount:{
  type:'face-mask',
  anchor:'nose_bridge',
  // Nose bridge estimate, NOT measured facial landmarks.
  estimatedPivotM:[0,.197,.10] as const,
  verified:false,
 },
 world:{
  previewCenterY:1.55,
  scale:1,
  status:'local-world-preview-only',
 },
 textureImages:0,
 morphTargets:0,
 bones:0,
 animations:0,
 rightsReviewed:false,
} as const

const equalHash=(value:string)=>
 value===RODIN_HEAD_SOURCE_SHA256||
 value===RODIN_HEAD_CALIBRATED_SHA256
export function rodinOwnerFileType(hash:string):
 'raw'|'calibrated'|null{
 if(hash===RODIN_HEAD_SOURCE_SHA256)return 'raw'
 if(hash===RODIN_HEAD_CALIBRATED_SHA256)return 'calibrated'
 return null
}
export function validRodinOwnerAudit(bytes:ArrayBuffer):boolean{
 try{
  const audit=auditStudioGlbBytes(bytes)
  return audit.valid&&audit.selfContained&&audit.triangles===117657&&
   audit.hasPBR&&audit.hasUV&&audit.hasNormals&&
   audit.rigTargets===0&&audit.animations===0&&audit.skins===0
 }catch{return false}
}
/** Patch only the single original glTF node's transform.
 * Embedded geometry, UV, normals and materials remain byte-for-byte intact.
 * This is a scale for PREVIEW (34 cm), NOT inferred real-world dimensions.
 */
export function calibrateRawOwnerRodinGlb(raw:ArrayBuffer):ArrayBuffer{
 if(!validRodinOwnerAudit(raw))throw Error('rodin_owner_invalid_glb')
 const view=new DataView(raw)
 const jsonLength=view.getUint32(12,true)
 const jsonData=JSON.parse(new TextDecoder().decode(
  new Uint8Array(raw,20,jsonLength))) as {
   asset:{generator?:string}
   nodes:Array<{
    mesh?:number;scale?:number[];translation?:number[]
    extras?:Record<string,unknown>
   }>
 }
 if(jsonData.nodes?.length!==1||jsonData.nodes[0].mesh!==0)
  throw Error('rodin_owner_unexpected_node_tree')
 jsonData.nodes[0].scale=[RODIN_HEAD_SCALE,RODIN_HEAD_SCALE,RODIN_HEAD_SCALE]
 jsonData.nodes[0].translation=[
  .000358134508*RODIN_HEAD_SCALE,
  -.0001015000016*RODIN_HEAD_SCALE,
  0,
 ]
 jsonData.nodes[0].extras={
  calibration:'head_bust_preview_34cm_not_anatomical_measurement',
  source:'Rodin owner-supplied 117657-triangle mobile LOD',
  faceForward:'estimated_+Z',
  morphTargets:0,
  originalsRetained:true,
 }
 const encoded=new TextEncoder().encode(JSON.stringify(jsonData))
 const paddedJson=new Uint8Array(Math.ceil(encoded.length/4)*4)
 paddedJson.fill(0x20);paddedJson.set(encoded)
 const originalBin=new Uint8Array(raw,20+jsonLength)
 const result=new Uint8Array(20+paddedJson.length+originalBin.length)
 const target=new DataView(result.buffer)
 target.setUint32(0,0x46546c67,true)
 target.setUint32(4,2,true)
 target.setUint32(8,result.length,true)
 target.setUint32(12,paddedJson.length,true)
 target.setUint32(16,0x4e4f534a,true)
 result.set(paddedJson,20)
 result.set(originalBin,20+paddedJson.length)
 if(!validRodinOwnerAudit(result.buffer))
  throw Error('rodin_owner_calibration_failed_qa')
 return result.buffer
}
export async function prepareOwnerRodinGlb(file:File):Promise<File>{
 if(!/\.glb$/i.test(file.name)||file.size<28||
  file.size>15*1024*1024)
  throw Error('rodin_owner_use_mobile_glb_under_15mb')
 const original=await file.arrayBuffer()
 if(!validRodinOwnerAudit(original))
  throw Error('rodin_owner_invalid_geometry')
 if(typeof crypto==='undefined'||!crypto.subtle)
  throw Error('rodin_owner_secure_browser_required')
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',original))
 const hash=Array.from(digest).map(b=>b.toString(16).padStart(2,'0')).join('')
 if(!equalHash(hash))
  throw Error('rodin_owner_sha256_mismatch')
 const inputType=rodinOwnerFileType(hash)
 if(!inputType)throw Error('rodin_owner_not_recognized')
 const data=inputType==='calibrated'?original:
  calibrateRawOwnerRodinGlb(original)
 return new File([data],RODIN_HEAD_CALIBRATED_FILENAME,{
  type:'model/gltf-binary',
 })
}
