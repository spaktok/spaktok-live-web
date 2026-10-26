'use client'
/**
 * SpakTok Face3D — one transparent Three.js/WebGL pass over a native camera.
 * Faces and expressions are processed locally. No tracking uploads.
 *
 * Coordinates are screen pixels (orthographic camera), the render pass only
 * contains AR geometry and a landmark-driven depth-only occluder.
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { FaceLandmarker } from '@mediapipe/tasks-vision'
import type {FaceGeometry} from './renderer'
import type {FaceFxId} from './params'
import {makeupLooks,isMakeupLook} from './makeup3d'
import {FaceMakeupLayer} from './makeup3d-render'
import {makePremiumAccessory} from './face3d-premium'

export const face3DPresets = [
 {id:'3d-lux-glasses',name:'نظارات ثلاثية',icon:'🥽',group:'3d'},
 {id:'3d-gold-crown',name:'تاج ثلاثي',icon:'👑',group:'3d'},
 {id:'3d-space-visor',name:'خوذة فضاء',icon:'🪐',group:'3d'},
 {id:'3d-metal-cap',name:'قبعة معدنية',icon:'🧢',group:'3d'},
 {id:'3d-crystal',name:'جوهرة ثلاثية',icon:'💎',group:'3d'},
 {id:'3d-expression',name:'قناع التعبيرات',icon:'🎭',group:'3d'},
 ...makeupLooks,
] as const
export type Face3DId = (typeof face3DPresets)[number]['id']
export const isFace3DId=(id:string):id is Face3DId=>face3DPresets.some(x=>x.id===id)

// GLTF URLs are allowlisted and served from our own same-origin public assets.
// No untrusted remote model URLs or arbitrary asset data can be supplied.
const MODEL_ASSETS:Partial<Record<Face3DId,string>>={
 '3d-crystal':'/face-assets/spaktok-crystal.glb',
}
const clamp=(n:number,low:number,high:number)=>Math.min(high,Math.max(low,n))
export interface Face3DFrame{
 landmarks:ReadonlyArray<{x:number;y:number;z:number}>
 geometry:FaceGeometry
 matrix?:ReadonlyArray<number>
 blendshapes?:Readonly<Record<string,number>>
 timestamp:number
}
export function viewportCrop(sourceW:number,sourceH:number,outW:number,outH:number){
 if(!sourceW||!sourceH||!outW||!outH)return null
 const scale=Math.max(outW/sourceW,outH/sourceH)
 return {x:(outW-sourceW*scale)/2,y:(outH-sourceH*scale)/2,
   width:sourceW*scale,height:sourceH*scale,scale}
}
export function getHeadPose(frame:Face3DFrame,sourceW:number,sourceH:number,outW:number,outH:number,mirror:boolean){
 const c=viewportCrop(sourceW,sourceH,outW,outH)
 if(!c||frame.landmarks.length<468)return null
 const p=(x:number,y:number)=>({x:c.x+x*c.width,y:c.y+y*c.height})
 const l=p(frame.geometry.leftEye.x,frame.geometry.leftEye.y)
 const r=p(frame.geometry.rightEye.x,frame.geometry.rightEye.y)
 const nose=p(frame.geometry.nose.x,frame.geometry.nose.y)
 const eye={x:(l.x+r.x)/2,y:(l.y+r.y)/2}
 const width=frame.geometry.width*sourceH*c.scale
 if(!Number.isFinite(width)||width<20||width>Math.max(outW,outH)*2)return null
 const eyeDx=r.x-l.x,eyeDy=r.y-l.y
 const roll=(mirror?-1:1)*Math.atan2(eyeDy,eyeDx)
 // Blend canonical transformation pose with actual on-screen eye/nose anchors.
 const m=frame.matrix
 const yaw=m&&m.length===16?clamp(Math.atan2(m[2],m[10]),-.9,.9):
    clamp((nose.x-eye.x)/width*2,-.7,.7)
 const pitch=m&&m.length===16?clamp(Math.atan2(-m[6],Math.hypot(m[4],m[5])),-.7,.7):
    clamp((nose.y-eye.y)/width-.42,-.45,.45)
 return {x:mirror?outW-eye.x:eye.x,y:eye.y,width,
  roll,yaw:mirror?-yaw:yaw,pitch}
}
/** Tessellation graph -> deterministic triangles, once per renderer instance. */
export function trianglesFromConnections(
 edges:ReadonlyArray<{start:number;end:number}>, count:number,
):number[]{
 const neighbors=Array.from({length:count},()=>new Set<number>())
 for(const {start,end} of edges){
  if(start<0||end<0||start>=count||end>=count||start===end)continue
  neighbors[start].add(end);neighbors[end].add(start)
 }
 const triangles:number[]=[]
 for(let a=0;a<count;a++)
  for(const b of neighbors[a])
   if(b>a)for(const c of neighbors[a])
    if(c>b&&neighbors[b].has(c))triangles.push(a,b,c)
 return triangles
}
const GOLD=new THREE.MeshStandardMaterial({color:0xe2b65a,metalness:.75,roughness:.22})
const CHROME=new THREE.MeshStandardMaterial({color:0x9bdaf4,metalness:.82,roughness:.13})
const BLACK=new THREE.MeshStandardMaterial({color:0x131824,metalness:.7,roughness:.27})
const GLASS=new THREE.MeshPhysicalMaterial({color:0x6eaee9,metalness:.1,roughness:.12,
  transparent:true,opacity:.32,depthWrite:false,side:THREE.DoubleSide})
function attach(group:THREE.Group,geometry:THREE.BufferGeometry,material:THREE.Material,
 x=0,y=0,z=0,rotationX=0,rotationY=0,rotationZ=0){
 const mesh=new THREE.Mesh(geometry,material)
 mesh.position.set(x,y,z);mesh.rotation.set(rotationX,rotationY,rotationZ)
 group.add(mesh);return mesh
}
function makeGlasses():THREE.Group{
 const group=new THREE.Group()
 for(const x of [-.27,.27]){
  attach(group,new THREE.TorusGeometry(.19,.029,10,36),CHROME,x,0,.24)
  attach(group,new THREE.CircleGeometry(.184,40),GLASS,x,0,.235)
  attach(group,new THREE.BoxGeometry(.06,.018,.018),GOLD,x+.19*Math.sign(x),-.01,.23)
 }
 attach(group,new THREE.CylinderGeometry(.017,.017,.15,10),CHROME,0,0,.25,0,0,Math.PI/2)
 for(const s of [-1,1]){
  attach(group,new THREE.CylinderGeometry(.017,.017,.28,10),CHROME,s*.51,.04,.10,0,.22*s,.50*s)
 }
 return group
}
function makeCrown():THREE.Group{
 const group=new THREE.Group()
 const gem=new THREE.MeshStandardMaterial({color:0x51d7f4,metalness:.24,roughness:.12,
  emissive:0x06243c})
 attach(group,new THREE.CylinderGeometry(.43,.48,.15,32),GOLD,0,-.61,.02)
 for(let i=0;i<7;i++){
  const x=(i-3)*.135,y=-.78+(i===3?-.18:Math.abs(i-3)===2?-.03:-.09)
  attach(group,new THREE.ConeGeometry(.108,.38,10),GOLD,x,y,.04)
  attach(group,new THREE.IcosahedronGeometry(.057,0),gem,x,y-.11,.15)
 }
 attach(group,new THREE.TorusGeometry(.42,.03,8,32),CHROME,0,-.54,.025)
 return group
}
function makeVisor():THREE.Group{
 const group=new THREE.Group()
 const glow=new THREE.MeshStandardMaterial({color:0x26e9ff,emissive:0x107b9c,
  emissiveIntensity:.9,metalness:.38,roughness:.18})
 attach(group,new THREE.SphereGeometry(.61,32,18,0,Math.PI*2,0,Math.PI*.55),BLACK,0,-.06,-.05,Math.PI)
 const shell=attach(group,new THREE.SphereGeometry(.62,32,18,0,Math.PI*2,0,Math.PI*.55),CHROME,0,-.06,-.06,Math.PI)
 shell.scale.z=.85
 const vis=attach(group,new THREE.SphereGeometry(.51,36,20,0,Math.PI,Math.PI*.32,Math.PI*.38),
    GLASS,0,.09,.22,-.1)
 vis.scale.z=.7
 attach(group,new THREE.TorusGeometry(.54,.032,8,40,Math.PI),glow,0,.11,.2)
 return group
}
function makeCap():THREE.Group{
 const group=new THREE.Group()
 const fabric=new THREE.MeshStandardMaterial({color:0x1d2940,metalness:.23,roughness:.47})
 const brim=new THREE.MeshStandardMaterial({color:0x20272f,metalness:.35,roughness:.34})
 attach(group,new THREE.SphereGeometry(.53,32,12,0,Math.PI*2,0,Math.PI/2),fabric,0,-.46,-.1,Math.PI)
 const bill=attach(group,new THREE.CylinderGeometry(.52,.56,.045,32,1,false,0,Math.PI),brim,0,-.47,.29,Math.PI/2)
 bill.scale.z=.55
 const badge=attach(group,new THREE.BoxGeometry(.20,.11,.02),GOLD,0,-.68,.36)
 badge.rotation.x=-.15
 return group
}
function makeExpressionMask():THREE.Group{
 const group=new THREE.Group()
 const cobalt=new THREE.MeshStandardMaterial({color:0x6fccef,metalness:.67,roughness:.21,
   emissive:0x042738})
 const pink=new THREE.MeshStandardMaterial({color:0xe9579b,metalness:.28,roughness:.25,
   emissive:0x2b0715})
 for(const [index,x] of [[0,-.27],[1,.27]] as const){
  const ring=attach(group,new THREE.TorusGeometry(.20,.028,10,32),cobalt,x,0,.24)
  ring.name=index===0?'EyeLeft':'EyeRight'
  const lens=attach(group,new THREE.SphereGeometry(.095,20,12),pink,x,0,.30)
  lens.name=index===0?'PupilLeft':'PupilRight'
  const brow=attach(group,new THREE.BoxGeometry(.36,.04,.045),cobalt,x,-.25,.24)
  brow.name=index===0?'BrowLeft':'BrowRight'
 }
 const mouth=attach(group,new THREE.TorusGeometry(.12,.023,10,30),pink,0,.53,.30)
 mouth.name='MouthRing'
 const jaw=attach(group,new THREE.CapsuleGeometry(.055,.18,6,14),cobalt,0,.68,.20)
 jaw.name='Jaw'
 return group
}
function disposeObject(node:THREE.Object3D){
 node.traverse(child=>{
  if(child instanceof THREE.Mesh){
   child.geometry.dispose()
   // Shared production materials are reusable; dispose only loaded model materials.
   const materials=Array.isArray(child.material)?child.material:[child.material]
   for(const m of materials) if(![CHROME,GOLD,BLACK,GLASS].includes(m as never)){
      m.dispose()
   }
  }
 })
}
function disposeShared(){ /* fixed shared PBR materials are kept while the module lives */ }

export class FaceMesh3DEngine{
 readonly renderer:THREE.WebGLRenderer
 readonly scene=new THREE.Scene()
 readonly camera:THREE.OrthographicCamera
 readonly mount=new THREE.Group()
 readonly depthMesh:THREE.Mesh
 readonly depthPositions:THREE.BufferAttribute
 readonly makeup:FaceMakeupLayer
 private readonly loader=new GLTFLoader()
 private model:THREE.Object3D|null=null
 private current:Face3DId|null=null
 private request=0
 private alive=true
 private width:number
 private height:number
 private lastFrame=-1
 private lensReady=false
 private lastSourceW=0
 private lastSourceH=0
 private lastMirror=false
 constructor(readonly canvas:HTMLCanvasElement, width:number,height:number){
  this.width=width;this.height=height
  this.renderer=new THREE.WebGLRenderer({
   canvas,alpha:true,premultipliedAlpha:false,antialias:false,
   powerPreference:'high-performance',preserveDrawingBuffer:true,
  })
  this.renderer.setPixelRatio(1)
  this.renderer.setSize(width,height,false)
  this.renderer.setClearColor(0x000000,0)
  this.renderer.outputColorSpace=THREE.SRGBColorSpace
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping
  this.renderer.toneMappingExposure=1.15
  this.camera=new THREE.OrthographicCamera(0,width,height,0,.1,2400)
  this.camera.position.set(0,0,1200);this.camera.lookAt(0,0,0)
  this.scene.add(new THREE.HemisphereLight(0xe7f3ff,0x5a6d8e,2.1))
  const main=new THREE.DirectionalLight(0xffefd8,3.1)
  main.position.set(-250,-400,800);this.scene.add(main)
  const rim=new THREE.DirectionalLight(0x679dff,1.6)
  rim.position.set(350,50,450);this.scene.add(rim)
  this.scene.add(this.mount)
  // MediaPipe exposes a triangle tessellation of the REAL tracked face.
  const edges=FaceLandmarker.FACE_LANDMARKS_TESSELATION
  const triangles=trianglesFromConnections(edges,478)
  if(triangles.length<1800)throw Error('face_mesh_connections_unavailable')
  const meshGeo=new THREE.BufferGeometry()
  const buffer=new Float32Array(478*3)
  this.depthPositions=new THREE.BufferAttribute(buffer,3)
  this.depthPositions.setUsage(THREE.DynamicDrawUsage)
  meshGeo.setAttribute('position',this.depthPositions)
  meshGeo.setIndex(triangles)
  const depthMaterial=new THREE.MeshBasicMaterial({
   color:0x000000,colorWrite:false,depthWrite:true,side:THREE.DoubleSide,
  })
  this.depthMesh=new THREE.Mesh(meshGeo,depthMaterial)
  this.depthMesh.renderOrder=-5
  this.depthMesh.frustumCulled=false
  this.scene.add(this.depthMesh)
  this.makeup=new FaceMakeupLayer(meshGeo,triangles)
  this.scene.add(this.makeup.mesh)
 }
 resize(w:number,h:number){
  if(this.width===w&&this.height===h)return
  this.width=w;this.height=h
  this.renderer.setSize(w,h,false)
  this.camera.left=0;this.camera.right=w;this.camera.top=0;this.camera.bottom=h
  this.camera.updateProjectionMatrix()
 }
 async setLens(id:Face3DId):Promise<boolean>{
  if(this.current===id)return this.lensReady
  this.current=id
  this.lensReady=false
  const token=++this.request
  if(this.model){this.mount.remove(this.model);disposeObject(this.model);this.model=null}
  if(!this.alive)return false
  let root:THREE.Object3D
  try{
   const asset=MODEL_ASSETS[id]
   if(asset){
    const parsed=await this.loader.loadAsync(asset)
    root=parsed.scene
   }else{
    root=isMakeupLook(id)?new THREE.Group():
       makePremiumAccessory(id) ?? (id==='3d-lux-glasses'?makeGlasses():
       id==='3d-gold-crown'?makeCrown():
       id==='3d-space-visor'?makeVisor():
       id==='3d-expression'?makeExpressionMask():makeCap())
   }
   if(!this.alive||token!==this.request){disposeObject(root);return false}
   this.model=root
   this.mount.add(root)
   this.lensReady=true
   return true
  }catch{
   if(token===this.request)this.current=null
   return false
  }
 }
 /** Overlay is a transparent PNG-ready canvas; video stays native below. */
 render(frame:Face3DFrame|null,sourceW:number,sourceH:number,mirror:boolean,id:FaceFxId,strength:number){
  if(!this.alive)return
  if(!isFace3DId(id)||!frame||strength<=0){
   this.depthMesh.visible=false;this.mount.visible=false
   this.makeup.setStyle(id,false)
   this.renderer.clear()
   return
  }
  this.mount.visible=this.lensReady
  this.mount.traverse(x=>{
   if(x instanceof THREE.Mesh){
     x.visible=true
   }
  })
  const pose=getHeadPose(frame,sourceW,sourceH,this.width,this.height,mirror)
  if(!pose){this.renderer.clear();return}
  this.depthMesh.visible=true
  this.makeup.setStyle(id,this.lensReady)
  // Update 478 surface vertices only on a *new* inference, not 30-60 times/sec.
  if(frame.timestamp!==this.lastFrame||this.lastSourceW!==sourceW||
    this.lastSourceH!==sourceH||mirror!==this.lastMirror){
   const crop=viewportCrop(sourceW,sourceH,this.width,this.height)!
   const buffer=this.depthPositions.array as Float32Array
   for(let i=0;i<478;i++){
    const p=frame.landmarks[i]
    buffer[i*3]=mirror?this.width-(crop.x+p.x*crop.width):crop.x+p.x*crop.width
    buffer[i*3+1]=crop.y+p.y*crop.height
    buffer[i*3+2]=clamp(18-p.z*crop.height*.64,-45,90)
   }
   this.depthPositions.needsUpdate=true
   this.depthMesh.geometry.computeVertexNormals()
   this.makeup.update(frame.landmarks,sourceW/sourceH)
   this.lastFrame=frame.timestamp
   this.lastSourceW=sourceW;this.lastSourceH=sourceH;this.lastMirror=mirror
  }
  this.mount.position.set(pose.x,pose.y,18)
  this.mount.scale.setScalar(pose.width)
  this.mount.rotation.set(pose.pitch*.7,pose.yaw*.75,pose.roll)
  if(this.model){
   const expr=frame.geometry.expression
   const mouth=clamp(frame.blendshapes?.jawOpen??expr?.mouthOpen??0,0,1)
   const blinkL=clamp(frame.blendshapes?.eyeBlinkLeft??(1-(expr?.leftEyeOpen??1)),0,1)
   const blinkR=clamp(frame.blendshapes?.eyeBlinkRight??(1-(expr?.rightEyeOpen??1)),0,1)
   const browUp=clamp(frame.blendshapes?.browInnerUp??0,0,1)
   for(const name of ['EyeLeft','PupilLeft']){const node=this.model.getObjectByName(name);if(node)node.scale.y=Math.max(.15,1-blinkL*.85)}
   for(const name of ['EyeRight','PupilRight']){const node=this.model.getObjectByName(name);if(node)node.scale.y=Math.max(.15,1-blinkR*.85)}
   for(const name of ['BrowLeft','BrowRight']){const node=this.model.getObjectByName(name);if(node)node.position.y=-.25-browUp*.12}
   const ring=this.model.getObjectByName('MouthRing');if(ring)ring.scale.y=.45+mouth*2.5
   const jaw=this.model.getObjectByName('Jaw');if(jaw)jaw.position.y=.68+mouth*.22
   this.model.traverse(child=>{
    if(child instanceof THREE.Mesh){
      if(child.morphTargetDictionary&&child.morphTargetInfluences){
        for(const [key,i] of Object.entries(child.morphTargetDictionary)){
          child.morphTargetInfluences[i]=clamp(frame.blendshapes?.[key]??0,0,1)
        }
      }
    }
   })
  }
  this.mount.visible=this.lensReady
  this.renderer.render(this.scene,this.camera)
  // Opacity is applied with the composited canvas element, not color grading.
  this.canvas.style.opacity=String(clamp(strength,0,1))
 }
 dispose(){
  if(!this.alive)return
  this.alive=false;this.request++
  if(this.model){this.mount.remove(this.model);disposeObject(this.model)}
  this.makeup.dispose()
  this.depthMesh.geometry.dispose()
  ;(this.depthMesh.material as THREE.Material).dispose()
  this.renderer.dispose()
  disposeShared()
 }
}
