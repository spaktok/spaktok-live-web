import * as THREE from 'three'
import {
 WORD_RIG_CHANNELS,type WordRigChannel,
 type WordRigDiagnostics,
} from './spaktok-word-face-rig'

/** Non-visual morphology QC. Its success does NOT approve anatomy,
 * visual similarity, commercial rights, or real-time device performance. */
export type WordRigQualityReport=Readonly<{
 status:'needs-recalibration'|'ready-for-visual-review'
 coverage:Readonly<Record<WordRigChannel,number>>
 channelNames:readonly WordRigChannel[]
 warnings:readonly string[]
 visualApprovalRequired:true
}>
export function inspectWordRigQuality(
 geometry:THREE.BufferGeometry,
 diagnostics:WordRigDiagnostics,
):WordRigQualityReport{
 const count=geometry.getAttribute('position')?.count??0
 const channels=WORD_RIG_CHANNELS
 const warnings:string[]=[]
 const coverage={} as Record<WordRigChannel,number>
 for(let i=0;i<channels.length;i++){
  const channel=channels[i]
  const attr=geometry.morphAttributes.position?.[i]
  if(!attr||attr.name!==channel||attr.count!==count)
   warnings.push('missing_or_misnamed_'+channel)
  const active=diagnostics.activeVertices[channel]??0
  coverage[channel]=count>0?Math.round(active/count*1000)/10:0
  if(active<8)warnings.push('insufficient_'+channel)
  if(!attr)continue
  let highest=0
  for(let v=0;v<attr.count;v++){
   const d=Math.hypot(attr.getX(v),attr.getY(v),attr.getZ(v))
   if(!Number.isFinite(d)){
    warnings.push('non_finite_'+channel);break
   }
   highest=Math.max(highest,d)
  }
  const scale=Math.max(diagnostics.boundingBox.width,
   diagnostics.boundingBox.height,diagnostics.boundingBox.depth)
  if(highest>scale*.14)warnings.push('excessive_displacement_'+channel)
  if(highest<scale*.00001)warnings.push('negligible_displacement_'+channel)
 }
 const eyes=[coverage.eyeBlinkLeft,coverage.eyeBlinkRight]
 if(Math.min(...eyes)>0&&Math.max(...eyes)/Math.min(...eyes)>2.3)
  warnings.push('eye_coverage_asymmetric_check_orientation')
 if(diagnostics.warnings.length)warnings.push(...diagnostics.warnings)
 return {
  status:warnings.length?'needs-recalibration':'ready-for-visual-review',
  channelNames:channels,coverage,warnings,visualApprovalRequired:true,
 }
}
/** Suggest likely head geometry without silently selecting hair, eyes or
 * the whole body. The user MUST visually confirm the mesh.
 */
export function rankWordFaceMeshes(meshes:readonly THREE.Mesh[]):ReadonlyArray<Readonly<{
 index:number;score:number;reason:string
}>>{
 return meshes.map((mesh,index)=>{
  const name=(mesh.name||'').toLowerCase()
  const geometry=mesh.geometry
  const position=geometry.getAttribute('position')
  const bounds=geometry.boundingBox?.clone()??new THREE.Box3().setFromBufferAttribute(position)
  const size=new THREE.Vector3();bounds.getSize(size)
  const ratio=size.y>0?size.x/size.y:0
  let score=0
  const notes:string[]=[]
  if(/face|head|skin|visage|facial|gesicht|الرأس|وجه/i.test(name)){
   score+=45;notes.push('اسم يشبه شبكة الرأس أو الوجه')
  }
  if(/hair|lash|brow|eye|teeth|tongue|mouth|beard|cloth|body|shirt|dress|cape|earring|hat|accessory|الشعر|الجسم|ملابس/i.test(name)){
   score-=65;notes.push('اسم يشبه جزءًا غير مناسب للنحت')
  }
  if(ratio>.48&&ratio<1.65){score+=18;notes.push('نسبة أبعاد قد تناسب الرأس')}
  else{score-=15;notes.push('نسبة الأبعاد غير نموذجية للرأس')}
  if(position.count>=800&&position.count<=80000){score+=12;notes.push('كثافة شبكة مناسبة للاختبار')}
  if(size.z>0&&size.z/Math.max(size.x,1e-9)>.12)score+=6
  return {index,score,reason:notes.join('؛ ')||'لا توجد معلومات كافية'}
 }).sort((a,b)=>b.score-a.score)
}
/** GLB is re-audited after export: named morph targets must survive
 * serialization, not merely exist in an in-memory Three.js mesh.
 */
export function verifyWordRigGlbChannels(binary:ArrayBuffer):Readonly<{
 present:readonly WordRigChannel[];missing:readonly WordRigChannel[]
}>{
 if(binary.byteLength<28)throw Error('word_rig_export_invalid_glb')
 const view=new DataView(binary)
 if(view.getUint32(0,true)!==0x46546c67||
  view.getUint32(4,true)!==2||
  view.getUint32(8,true)!==binary.byteLength||
  view.getUint32(16,true)!==0x4e4f534a)
  throw Error('word_rig_export_invalid_glb')
 const length=view.getUint32(12,true)
 if(length<4||length%4!==0||length>binary.byteLength-20)
  throw Error('word_rig_export_invalid_json')
 let json:unknown
 try{
  json=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(
   new Uint8Array(binary,20,length)))
 }catch{throw Error('word_rig_export_invalid_json')}
 if(!json||typeof json!=='object'||!('meshes' in json)||
  !Array.isArray(json.meshes))throw Error('word_rig_export_no_mesh')
 const known=new Set<string>()
 for(const mesh of json.meshes){
  const targets=mesh?.extras?.targetNames
  if(Array.isArray(targets)&&Array.isArray(mesh?.primitives)){
   const targetCount=mesh.primitives.reduce((max:number,p:{targets?:unknown[]})=>
    Math.max(max,Array.isArray(p.targets)?p.targets.length:0),0)
   for(let i=0;i<targetCount;i++){
    if(typeof targets[i]==='string')known.add(targets[i])
   }
  }
 }
 const present=WORD_RIG_CHANNELS.filter(k=>known.has(k))
 const missing=WORD_RIG_CHANNELS.filter(k=>!known.has(k))
 return {present,missing}
}
