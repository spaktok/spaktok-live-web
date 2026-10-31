import * as THREE from 'three'
import type {DenseFaceTopology} from './reality-face-topology'
import type {FaceSemanticAtlas} from './reality-face-regions'
import type {AmbientLightEstimate} from './lighting3d'
import {createFacePhotorealUV} from './reality-canonical-face-uv'

/** AR V2 surface-conforming mask, not a head prop or identity swap.
 * Shares 478 tracked vertex positions and normals with face depth. Semantic
 * coverage is computed once, not re-rasterized every video frame.
 */
export const PRECISION_FACE_MASK_ID='3d-precision-cyber-mask' as const

function graphDistance(topology:DenseFaceTopology,seeds:readonly number[]):Int16Array{
 const distances=new Int16Array(topology.vertexCount).fill(-1)
 let frontier:number[]=[]
 for(const id of seeds){
  if(Number.isInteger(id)&&id>=0&&id<topology.vertexCount&&distances[id]<0){
   distances[id]=0
   frontier.push(id)
  }
 }
 let distance=0
 while(frontier.length){
  const next:number[]=[]
  for(const id of frontier)for(const neighbor of topology.neighbors[id]){
   if(distances[neighbor]>=0)continue
   distances[neighbor]=distance+1
   next.push(neighbor)
  }
  frontier=next
  distance++
 }
 return distances
}
const saturate=(n:number)=>Math.max(0,Math.min(1,n))

/** Transparent eyes, lips and silhouette, feathered across real adjacent
 * triangles. Never paint directly over the user's eyes or mouth.
 */
export function precisionMaskCoverage(topology:DenseFaceTopology,atlas:FaceSemanticAtlas):Float32Array{
 if(topology.vertexCount!==478||topology.indices.length<2400)
  throw Error('precision_face_mask_invalid_topology')
 const edge=graphDistance(topology,atlas.face_oval.vertexIds)
 const hole=graphDistance(topology,[
  ...atlas.left_eye.vertexIds,...atlas.right_eye.vertexIds,
  ...atlas.left_iris.vertexIds,...atlas.right_iris.vertexIds,
  ...atlas.lips.vertexIds,
 ])
 const coverage=new Float32Array(topology.vertexCount)
 for(let i=0;i<coverage.length;i++){
  if(edge[i]<0||hole[i]<0)continue
  coverage[i]=saturate(edge[i]/3)*saturate(hole[i]/3)
 }
 return coverage
}


/** Photoreal *material approximation* (not photographic face replacement).
 * Stable canonical UV + one mipmapped 256px microtexture allow fine ceramic
 * pores and brushed metal highlights without screen-space moving waves.
 * Camera light estimate updates at <=2Hz; no extra face inference or upload.
 */
export const PORCELAIN_FACE_MASK_ID='3d-photoreal-porcelain-mask' as const
export type PrecisionMaskFinish='titanium'|'porcelain'
const DETAIL_SIZE=256
function detailNoise(x:number,y:number,seed:number){
 let n=Math.imul(x+1,374761393)^Math.imul(y+1,668265263)^Math.imul(seed+1,2246822519)
 n=Math.imul(n^(n>>>13),1274126177)
 return ((n^(n>>>16))>>>0)/4294967295
}
/** Original deterministic roughness/micro-normal source, generated once on
 * the phone. It is mipmapped to prevent subpixel glitter / aliasing in motion.
 */
export function createPhotorealMicroTexture():THREE.DataTexture{
 const data=new Uint8Array(DETAIL_SIZE*DETAIL_SIZE*4)
 for(let y=0;y<DETAIL_SIZE;y++)for(let x=0;x<DETAIL_SIZE;x++){
  const idx=(y*DETAIL_SIZE+x)*4
  const coarse=detailNoise(x>>2,y>>2,3)
  const fine=detailNoise(x,y,7)
  data[idx]=Math.round((.5+(fine-.5)*.6)*255)
  data[idx+1]=Math.round((.5+(detailNoise(x,y,11)-.5)*.6)*255)
  data[idx+2]=Math.round((.58+(.5*coarse+.5*fine-.5)*.55)*255)
  data[idx+3]=255
 }
 const map=new THREE.DataTexture(data,DETAIL_SIZE,DETAIL_SIZE,THREE.RGBAFormat)
 map.colorSpace=THREE.NoColorSpace
 map.wrapS=map.wrapT=THREE.ClampToEdgeWrapping
 map.magFilter=THREE.LinearFilter
 map.minFilter=THREE.LinearMipmapLinearFilter
 map.generateMipmaps=true
 map.anisotropy=2
 map.needsUpdate=true
 return map
}

const VERTEX_SHADER=[
 'attribute float aCoverage;',
 'varying float vCoverage;',
 'varying vec2 vFaceUv;',
 'varying vec3 vNormalView;',
 'void main(){',
 ' vCoverage=aCoverage;',
 ' vFaceUv=uv;',
 ' vNormalView=normalize(normalMatrix*normal);',
 ' gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);',
 '}',
].join('\n')
/** Bounded Cook–Torrance GGX, Schlick Fresnel, Smith visibility and a
 * secondary clearcoat lobe. Ambient term is a local camera-light estimate,
 * NOT a calibrated HDR probe or measured full environment reflection.
 */
const FRAGMENT_SHADER=[
 'precision highp float;',
 'varying float vCoverage;',
 'varying vec2 vFaceUv;',
 'varying vec3 vNormalView;',
 'uniform sampler2D uMicro;',
 'uniform vec3 uBaseColor;',
 'uniform vec3 uLightColor;',
 'uniform vec3 uLightDir;',
 'uniform float uStrength;',
 'uniform float uMetalness;',
 'uniform float uRoughness;',
 'uniform float uClearcoat;',
 'uniform float uSubsurface;',
 'uniform float uAmbient;',
 'uniform float uOpacity;',
 'const float PI=3.14159265359;',
 'float ggx(float nDotH,float alpha){',
 ' float a2=alpha*alpha;',
 ' float denom=nDotH*nDotH*(a2-1.)+1.;',
 ' return a2/max(PI*denom*denom,0.0001);',
 '}',
 'float smith1(float nDotV,float rough){',
 ' float k=pow(rough+1.,2.)*.125;',
 ' return nDotV/max(nDotV*(1.-k)+k,.001);',
 '}',
 'vec3 fresnel(float cosAngle,vec3 f0){',
 ' return f0+(vec3(1.)-f0)*pow(1.-clamp(cosAngle,0.,1.),5.);',
 '}',
 'void main(){',
 ' float alpha=clamp(uStrength,0.,1.)*uOpacity*smoothstep(.04,.98,vCoverage);',
 ' if(alpha<.004)discard;',
 ' vec4 micro=texture2D(uMicro,vFaceUv);',
 ' vec3 normal=normalize(vNormalView);',
 ' vec3 up=abs(normal.y)<.94?vec3(0.,1.,0.):vec3(1.,0.,0.);',
 ' vec3 tangent=normalize(cross(up,normal));',
 ' vec3 bitangent=normalize(cross(normal,tangent));',
 ' vec3 n=normalize(normal+(micro.r-.5)*.12*tangent+(micro.g-.5)*.12*bitangent);',
 ' vec3 v=vec3(0.,0.,1.);',
 ' vec3 l=normalize(uLightDir);',
 ' vec3 h=normalize(v+l);',
 ' float nL=max(dot(n,l),0.);',
 ' float nV=max(dot(n,v),.045);',
 ' float nH=max(dot(n,h),0.);',
 ' float vH=max(dot(v,h),0.);',
 ' float rough=clamp(uRoughness+(micro.b-.5)*.22,.14,.87);',
 ' float metal=clamp(uMetalness,0.,1.);',
 ' float a=max(.03,rough*rough);',
 ' vec3 f0=mix(vec3(.04),uBaseColor,metal);',
 ' vec3 f=fresnel(vH,f0);',
 ' float distribution=ggx(nH,a);',
 ' float visibility=smith1(nL,rough)*smith1(nV,rough);',
 ' vec3 spec=(distribution*visibility*f)/max(4.*nL*nV,.09);',
 ' vec3 diffuse=(vec3(1.)-f)*uBaseColor*(1.-metal)/PI;',
 ' vec3 direct=(diffuse+spec)*uLightColor*nL*1.65;',
 ' float wrap=(dot(n,l)+.5)/1.5;',
 ' vec3 skinScatter=uBaseColor*uSubsurface*max(wrap,0.)*.20;',
 ' vec3 ambient=uBaseColor*(1.-metal)*uAmbient;',
 ' vec3 reflection=f0*uAmbient*(.65+.35*nV);',
 ' float coatD=ggx(nH,.075);',
 ' float coatF=.04+.96*pow(1.-vH,5.);',
 ' vec3 clearcoat=vec3(coatD*coatF*nL*uClearcoat*.033);',
 ' vec3 color=ambient+reflection+direct+skinScatter+clearcoat;',
 ' gl_FragColor=vec4(max(color,vec3(0.)),alpha);',
 ' #include <tonemapping_fragment>',
 ' #include <colorspace_fragment>',
 '}',
].join('\n')

export class PrecisionFaceSurfaceMask{
 readonly mesh:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>
 readonly coverage:Float32Array
 readonly microTexture:THREE.DataTexture
 private finish:PrecisionMaskFinish='titanium'
 constructor(source:THREE.BufferGeometry,topology:DenseFaceTopology,atlas:FaceSemanticAtlas){
  const position=source.getAttribute('position')
  const normal=source.getAttribute('normal')
  if(!position||!normal||position.count!==478||normal.count!==478)
   throw Error('precision_face_mask_missing_shared_mesh')
  this.coverage=precisionMaskCoverage(topology,atlas)
  this.microTexture=createPhotorealMicroTexture()
  const geometry=new THREE.BufferGeometry()
  geometry.setIndex(Array.from(topology.indices))
  geometry.setAttribute('position',position)
  geometry.setAttribute('normal',normal)
  geometry.setAttribute('uv',new THREE.BufferAttribute(createFacePhotorealUV(),2))
  geometry.setAttribute('aCoverage',new THREE.BufferAttribute(this.coverage,1))
  const material=new THREE.ShaderMaterial({
   vertexShader:VERTEX_SHADER,fragmentShader:FRAGMENT_SHADER,
   uniforms:{
    uMicro:{value:this.microTexture},
    uBaseColor:{value:new THREE.Color(0x405d69)},
    uLightColor:{value:new THREE.Color(0xffeadf)},
    uLightDir:{value:new THREE.Vector3(-.25,.40,1).normalize()},
    uStrength:{value:.85},
    uMetalness:{value:.75},
    uRoughness:{value:.34},
    uClearcoat:{value:.34},
    uSubsurface:{value:0},
    uAmbient:{value:.3},
    uOpacity:{value:.86},
   },
   transparent:true,depthTest:true,depthWrite:false,
   side:THREE.DoubleSide,
   polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,
  })
  this.mesh=new THREE.Mesh(geometry,material)
  this.mesh.frustumCulled=false
  this.mesh.visible=false
  this.mesh.renderOrder=3
  this.mesh.name='SpaktokPhotorealFaceSurfaceMaskV2'
 }
 setFinish(finish:PrecisionMaskFinish){
  if(this.finish===finish)return
  this.finish=finish
  const u=this.mesh.material.uniforms
  if(finish==='porcelain'){
   ;(u.uBaseColor.value as THREE.Color).set(0xe5d4c7)
   u.uMetalness.value=.04
   u.uRoughness.value=.38
   u.uClearcoat.value=.62
   u.uSubsurface.value=.28
   u.uOpacity.value=.91
  }else{
   ;(u.uBaseColor.value as THREE.Color).set(0x405d69)
   u.uMetalness.value=.75
   u.uRoughness.value=.34
   u.uClearcoat.value=.34
   u.uSubsurface.value=0
   u.uOpacity.value=.86
  }
 }
 /** Existing 32x18 camera light estimate; no second pixel readback. */
 setLighting(light:AmbientLightEstimate){
  const clamp=(x:number,a:number,b:number)=>Number.isFinite(x)?Math.min(b,Math.max(a,x)):(a+b)*.5
  const brightness=clamp(light.brightness,.07,.85)
  const warmth=clamp(light.warmth,-.35,.35)
  const side=clamp(light.side,-.6,.6)
  const u=this.mesh.material.uniforms
  u.uAmbient.value=.15+brightness*.44
  ;(u.uLightDir.value as THREE.Vector3).set(-.35+side*.75,.42,1).normalize()
  ;(u.uLightColor.value as THREE.Color).setRGB(
   1,clamp(.93-warmth*.14,.82,.99),clamp(.88-warmth*.32,.72,.99),
  )
 }
 setActive(active:boolean,strength=0.85){
  this.mesh.visible=active
  this.mesh.material.uniforms.uStrength.value=saturate(strength)
 }
 dispose(){
  this.mesh.geometry.dispose()
  this.mesh.material.dispose()
  this.microTexture.dispose()
 }
}
