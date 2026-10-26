import * as THREE from 'three'
import {computeMakeupMasks,getMakeupPalette,isMakeupLook,type MakeupLookId,type TrackedPoint} from './makeup3d'

/** Face mesh makeup shares the 478 MediaPipe positions + normals of the depth
 * occluder. Exactly one transparent WebGL draw per video frame. */
const VERTEX="attribute vec4 cosmeticA;\nattribute vec4 cosmeticB;\nvarying vec4 vCosmeticA;\nvarying vec4 vCosmeticB;\nvarying vec3 vNormalView;\nvoid main(){\n vCosmeticA=cosmeticA;vCosmeticB=cosmeticB;\n vNormalView=normalize(normalMatrix*normal);\n gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);\n}"
const FRAGMENT="precision highp float;\nvarying vec4 vCosmeticA;\nvarying vec4 vCosmeticB;\nvarying vec3 vNormalView;\nuniform vec3 uFoundation;\nuniform vec3 uLip;\nuniform vec3 uShadow;\nuniform vec3 uLiner;\nuniform vec3 uBlush;\nuniform vec3 uContour;\nuniform vec3 uHighlight;\nuniform vec4 uCoverageA;\nuniform vec4 uCoverageB;\nuniform float uShimmer;\nvec4 composite(vec4 before,vec3 color,float coverage){\n float alpha=clamp(coverage,0.,.94);\n float total=alpha+before.a*(1.-alpha);\n vec3 blend=color*alpha+before.rgb*before.a*(1.-alpha);\n return vec4(blend/max(total,.00001),total);\n}\nvoid main(){\n vec4 a=clamp(vCosmeticA,0.,1.);\n vec4 b=clamp(vCosmeticB,0.,1.);\n float light=max(0.,dot(normalize(vNormalView),normalize(vec3(-.25,.45,1.))));\n vec3 shimmer=vec3(pow(light,14.)*uShimmer*.16);\n vec4 paint=vec4(0.);\n paint=composite(paint,uFoundation,a.x*uCoverageA.x);\n paint=composite(paint,uContour,b.y*uCoverageB.y);\n paint=composite(paint,uBlush,b.x*uCoverageB.x);\n paint=composite(paint,uShadow+shimmer,a.z*uCoverageA.z);\n paint=composite(paint,uLiner,a.w*uCoverageA.w);\n paint=composite(paint,uLip+shimmer*.25,a.y*uCoverageA.y);\n paint=composite(paint,uHighlight+shimmer,b.z*uCoverageB.z);\n if(paint.a<.003)discard;\n gl_FragColor=vec4(clamp(paint.rgb,0.,1.),min(paint.a,.88));\n #include <colorspace_fragment>\n}"
export class FaceMakeupLayer{
 readonly mesh:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>
 readonly masksA:THREE.BufferAttribute
 readonly masksB:THREE.BufferAttribute
 private current:MakeupLookId|null=null
 constructor(source:THREE.BufferGeometry,triangles:number[]){
  const material=new THREE.ShaderMaterial({
   vertexShader:VERTEX,fragmentShader:FRAGMENT,
   transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,
   polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
   uniforms:{
    uFoundation:{value:new THREE.Color()},uLip:{value:new THREE.Color()},
    uShadow:{value:new THREE.Color()},uLiner:{value:new THREE.Color()},
    uBlush:{value:new THREE.Color()},uContour:{value:new THREE.Color()},
    uHighlight:{value:new THREE.Color()},uShimmer:{value:0},
    uCoverageA:{value:new THREE.Vector4()},uCoverageB:{value:new THREE.Vector4()},
   },
  })
  source.computeVertexNormals()
  const geo=new THREE.BufferGeometry()
  geo.setIndex(triangles)
  geo.setAttribute('position',source.getAttribute('position'))
  geo.setAttribute('normal',source.getAttribute('normal'))
  this.masksA=new THREE.BufferAttribute(new Float32Array(478*4),4)
  this.masksB=new THREE.BufferAttribute(new Float32Array(478*4),4)
  this.masksA.setUsage(THREE.DynamicDrawUsage)
  this.masksB.setUsage(THREE.DynamicDrawUsage)
  geo.setAttribute('cosmeticA',this.masksA)
  geo.setAttribute('cosmeticB',this.masksB)
  this.mesh=new THREE.Mesh(geo,material)
  this.mesh.frustumCulled=false
  this.mesh.visible=false
  this.mesh.renderOrder=2
 }
 setStyle(id:string,ready:boolean){
  if(!ready||!isMakeupLook(id)){this.mesh.visible=false;return}
  this.mesh.visible=true
  if(this.current===id)return
  this.current=id
  const look=getMakeupPalette(id),u=this.mesh.material.uniforms
  const pigment=(key:string,color:string)=>(u[key].value as THREE.Color).set(color)
  pigment('uFoundation',look.foundation);pigment('uLip',look.lip)
  pigment('uShadow',look.shadow);pigment('uLiner',look.liner)
  pigment('uBlush',look.blush);pigment('uContour',look.contour)
  pigment('uHighlight',look.highlight)
  ;(u.uCoverageA.value as THREE.Vector4).set(look.coverage[0],look.coverage[1],look.coverage[2],look.coverage[3])
  ;(u.uCoverageB.value as THREE.Vector4).set(look.coverage[4],look.coverage[5],look.coverage[6],0)
  u.uShimmer.value=look.shimmer
 }
 update(landmarks:ReadonlyArray<TrackedPoint>,sourceAspect:number){
  if(!this.mesh.visible)return
  const masks=computeMakeupMasks(landmarks,sourceAspect)
  ;(this.masksA.array as Float32Array).set(masks.masksA)
  ;(this.masksB.array as Float32Array).set(masks.masksB)
  this.masksA.needsUpdate=true;this.masksB.needsUpdate=true
 }
 dispose(){
  this.mesh.geometry.dispose()
  this.mesh.material.dispose()
 }
}
