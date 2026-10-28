import * as THREE from 'three'

/** Spaktok Word calibrated starter face rig for pre-existing GLB head meshes.
 * Not a trained photo-to-3D or anatomy detector. The creator selects the
 * face mesh and confirms eye/mouth positions before exporting morph targets.
 * Generated channels must pass human animation QA before broadcast.
 */
export const WORD_RIG_CHANNELS=[
 'jawOpen','eyeBlinkLeft','eyeBlinkRight','mouthSmileLeft',
 'mouthSmileRight','browInnerUp','mouthPucker',
] as const
export type WordRigChannel=(typeof WORD_RIG_CHANNELS)[number]
export type WordRigFront='positive-z'|'negative-z'
export type WordRigCalibration=Readonly<{
 front:WordRigFront
 eyeY:number
 eyeSeparation:number
 mouthY:number
 faceDepthThreshold:number
 strength:number
}>
export const DEFAULT_WORD_RIG_CALIBRATION:WordRigCalibration={
 front:'positive-z',eyeY:.60,eyeSeparation:.42,
 mouthY:.31,faceDepthThreshold:.34,strength:.65,
}
export type WordRigDiagnostics=Readonly<{
 vertices:number
 activeVertices:Readonly<Record<WordRigChannel,number>>
 boundingBox:Readonly<{width:number;height:number;depth:number}>
 warnings:readonly string[]
}>
const clamp=(n:number,min:number,max:number)=>
 Number.isFinite(n)?Math.min(max,Math.max(min,n)):min
const gaussian=(x:number,y:number,cx:number,cy:number,sx:number,sy:number)=>
 Math.exp(-.5*(Math.pow((x-cx)/sx,2)+Math.pow((y-cy)/sy,2)))
const smoothstep=(a:number,b:number,x:number)=>{
 const t=clamp((x-a)/(b-a),0,1)
 return t*t*(3-2*t)
}
export function validateWordRigCalibration(c:WordRigCalibration):void{
 if(!['positive-z','negative-z'].includes(c.front)||
  !Number.isFinite(c.eyeY)||c.eyeY<.36||c.eyeY>.82||
  !Number.isFinite(c.eyeSeparation)||c.eyeSeparation<.16||c.eyeSeparation>.75||
  !Number.isFinite(c.mouthY)||c.mouthY<.12||c.mouthY>.55||
  c.mouthY>=c.eyeY-.08||
  !Number.isFinite(c.faceDepthThreshold)||c.faceDepthThreshold<.15||c.faceDepthThreshold>.7||
  !Number.isFinite(c.strength)||c.strength<.1||c.strength>1)
  throw Error('word_rig_calibration_invalid')
}
/** Preview/export geometry is cloned. Never overwrite source geometry or
 * inherit uncalibrated morph targets from other unrelated meshes.
 */
export function buildCalibratedWordFaceRig(
 source:THREE.BufferGeometry,
 calibration:WordRigCalibration=DEFAULT_WORD_RIG_CALIBRATION,
):Readonly<{geometry:THREE.BufferGeometry;diagnostics:WordRigDiagnostics}>{
 validateWordRigCalibration(calibration)
 if(source.morphAttributes.position?.length)
  throw Error('word_rig_existing_morphs_preserve_original')
 const position=source.getAttribute('position')
 if(!position||position.itemSize!==3||position.count<120||
  position.count>160000||!(position instanceof THREE.BufferAttribute))
  throw Error('word_rig_face_mesh_vertices_out_of_bounds')
 const bbox=source.boundingBox?.clone()??new THREE.Box3().setFromBufferAttribute(position)
 const size=new THREE.Vector3()
 bbox.getSize(size)
 if(!Number.isFinite(size.x+size.y+size.z)||
  Math.min(size.x,size.y,size.z)<1e-5)
  throw Error('word_rig_degenerate_mesh_bounds')
 const front=calibration.front==='positive-z'?1:-1
 const base=source.clone()
 const channels=WORD_RIG_CHANNELS
 const deltas=channels.map(()=>new Float32Array(position.count*3))
 const active=Object.fromEntries(channels.map(k=>[k,0])) as Record<WordRigChannel,number>
 const eyeLeft=.5-calibration.eyeSeparation/2
 const eyeRight=.5+calibration.eyeSeparation/2
 const strength=calibration.strength
 for(let i=0;i<position.count;i++){
  const x=position.getX(i),y=position.getY(i),z=position.getZ(i)
  if(!Number.isFinite(x+y+z)){
   base.dispose()
   throw Error('word_rig_non_finite_vertex')
  }
  const u=(x-bbox.min.x)/size.x
  const v=(y-bbox.min.y)/size.y
  const depth=front>0?(z-bbox.min.z)/size.z:(bbox.max.z-z)/size.z
  const facing=smoothstep(calibration.faceDepthThreshold,
   Math.min(.98,calibration.faceDepthThreshold+.29),depth)
  if(facing<.002)continue
  const mouth=gaussian(u,v,.5,calibration.mouthY,.23,.15)*facing
  const lower=gaussian(u,v,.5,calibration.mouthY-.12,.26,.21)*facing
  const leftEye=gaussian(u,v,eyeLeft,calibration.eyeY,.125,.07)*facing
  const rightEye=gaussian(u,v,eyeRight,calibration.eyeY,.125,.07)*facing
  const leftCorner=gaussian(u,v,.31,calibration.mouthY,.095,.09)*facing
  const rightCorner=gaussian(u,v,.69,calibration.mouthY,.095,.09)*facing
  const brow=gaussian(u,v,.5,calibration.eyeY+.13,.29,.105)*facing
  const values:ReadonlyArray<readonly [number,number,number]>=[
   [0,-size.y*(mouth*.048+lower*.035)*strength,0],
   [0,-Math.sign(v-calibration.eyeY)*size.y*leftEye*.032*strength,0],
   [0,-Math.sign(v-calibration.eyeY)*size.y*rightEye*.032*strength,0],
   [-size.x*leftCorner*.012*strength,size.y*leftCorner*.035*strength,0],
   [size.x*rightCorner*.012*strength,size.y*rightCorner*.035*strength,0],
   [0,size.y*brow*.029*strength,0],
   [-size.x*(u-.5)*mouth*.13*strength,0,front*size.z*mouth*.045*strength],
  ]
  for(let k=0;k<channels.length;k++){
   const [dx,dy,dz]=values[k]
   if(Math.abs(dx)+Math.abs(dy)+Math.abs(dz)>1e-7)active[channels[k]]++
   const j=i*3
   deltas[k][j]=dx;deltas[k][j+1]=dy;deltas[k][j+2]=dz
  }
 }
 const warnings:string[]=[]
 if(active.jawOpen<12||active.eyeBlinkLeft<8||active.eyeBlinkRight<8){
  warnings.push('calibration_insufficient_face_coverage')
 }
 if(!source.getAttribute('uv'))warnings.push('face_mesh_uv_missing')
 if(!source.getAttribute('normal'))warnings.push('face_mesh_normals_missing')
 if(warnings.includes('calibration_insufficient_face_coverage')){
  base.dispose()
  throw Error('word_rig_no_anatomical_coverage_adjust_calibration')
 }
 base.morphTargetsRelative=true
 base.morphAttributes.position=deltas.map((delta,index)=>{
  const attr=new THREE.Float32BufferAttribute(delta,3)
  attr.name=channels[index]
  return attr
 })
 return {
  geometry:base,
  diagnostics:{
   vertices:position.count,activeVertices:active,
   boundingBox:{width:size.x,height:size.y,depth:size.z},
   warnings,
  },
 }
}
export function eligibleWordRigMeshes(root:THREE.Object3D):THREE.Mesh[]{
 const results:THREE.Mesh[]=[]
 root.traverse(node=>{
  if(!(node instanceof THREE.Mesh))return
  const p=node.geometry?.getAttribute('position')
  if(p&&p.count>=120&&p.count<=160000&&p.itemSize===3&&
   !node.geometry.morphAttributes.position?.length)
   results.push(node)
 })
 return results
}
