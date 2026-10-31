import * as THREE from 'three'
import type {DenseFaceTopology} from './reality-face-topology'
import type {FaceSemanticAtlas} from './reality-face-regions'

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

const VERTEX_SHADER=[
 'attribute float aCoverage;',
 'varying float vCoverage;',
 'varying vec3 vNormal;',
 'void main(){',
 ' vCoverage=aCoverage;',
 ' vNormal=normalize(normalMatrix*normal);',
 ' gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);',
 '}',
].join('\n')
const FRAGMENT_SHADER=[
 'precision highp float;',
 'varying float vCoverage;',
 'varying vec3 vNormal;',
 'uniform float uStrength;',
 'void main(){',
 ' float alpha=clamp(uStrength,0.,1.)*.76*smoothstep(.05,.94,vCoverage);',
 ' if(alpha<.003)discard;',
 ' vec3 n=normalize(vNormal);',
 ' vec3 light=normalize(vec3(-.25,.40,1.));',
 ' float diff=max(dot(n,light),0.);',
 ' float rim=pow(1.-abs(n.z),3.);',
 ' float glint=pow(max(dot(reflect(-light,n),vec3(0.,0.,1.)),0.),22.);',
 ' vec3 base=mix(vec3(.022,.040,.072),vec3(.035,.18,.24),.35+.65*diff);',
 ' vec3 color=base+vec3(.015,.32,.40)*rim*.64+vec3(.40,.74,.79)*glint*.16;',
 ' gl_FragColor=vec4(color,alpha);',
 ' #include <tonemapping_fragment>',
 ' #include <colorspace_fragment>',
 '}',
].join('\n')

export class PrecisionFaceSurfaceMask{
 readonly mesh:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>
 readonly coverage:Float32Array
 constructor(source:THREE.BufferGeometry,topology:DenseFaceTopology,atlas:FaceSemanticAtlas){
  const position=source.getAttribute('position')
  const normal=source.getAttribute('normal')
  if(!position||!normal||position.count!==478||normal.count!==478)
   throw Error('precision_face_mask_missing_shared_mesh')
  this.coverage=precisionMaskCoverage(topology,atlas)
  const geometry=new THREE.BufferGeometry()
  geometry.setIndex(Array.from(topology.indices))
  geometry.setAttribute('position',position)
  geometry.setAttribute('normal',normal)
  geometry.setAttribute('aCoverage',new THREE.BufferAttribute(this.coverage,1))
  const material=new THREE.ShaderMaterial({
   vertexShader:VERTEX_SHADER,fragmentShader:FRAGMENT_SHADER,
   uniforms:{uStrength:{value:0.85}},
   transparent:true,depthTest:true,depthWrite:false,
   side:THREE.DoubleSide,
   polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,
  })
  this.mesh=new THREE.Mesh(geometry,material)
  this.mesh.frustumCulled=false
  this.mesh.visible=false
  this.mesh.renderOrder=3
  this.mesh.name='SpaktokPrecisionFaceSurfaceMaskV2'
 }
 setActive(active:boolean,strength=0.85){
  this.mesh.visible=active
  this.mesh.material.uniforms.uStrength.value=saturate(strength)
 }
 dispose(){
  this.mesh.geometry.dispose()
  this.mesh.material.dispose()
 }
}
