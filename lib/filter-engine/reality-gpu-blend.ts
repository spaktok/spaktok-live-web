import * as THREE from 'three'

/** Fractional effect intensity must fade the AR scene, NOT the camera video.
 * Two linear-light GPU targets and a final full-screen mix share one WebGL
 * context. Full-strength AR still follows the original single-pass path.
 */
export function needsRealityGpuBlend(strength:number):boolean {
 return Number.isFinite(strength)&&strength>.001&&strength<.999
}

export const realityGpuBlendFragmentShader = `uniform sampler2D uCamera;
uniform sampler2D uReality;
uniform float uIntensity;
varying vec2 vUv;
void main(){
 vec3 base=texture2D(uCamera,vUv).rgb;
 vec3 reality=texture2D(uReality,vUv).rgb;
 gl_FragColor=vec4(mix(base,reality,clamp(uIntensity,0.0,1.0)),1.0);
 #include <colorspace_fragment>
}`

export class RealityGpuBlendPass {
 readonly base:THREE.WebGLRenderTarget
 readonly reality:THREE.WebGLRenderTarget
 private readonly quad:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>
 private readonly scene=new THREE.Scene()
 private readonly camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10)
 constructor(private readonly renderer:THREE.WebGLRenderer,width:number,height:number){
  const create=()=>{
   const target=new THREE.WebGLRenderTarget(width,height,{
    depthBuffer:true,stencilBuffer:false,format:THREE.RGBAFormat,
    minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,
   })
   // Keep intermediates in linear space, encode for display only once.
   target.texture.colorSpace=THREE.LinearSRGBColorSpace
   target.texture.generateMipmaps=false
   return target
  }
  this.base=create()
  this.reality=create()
  const material=new THREE.ShaderMaterial({
   uniforms:{
    uCamera:{value:this.base.texture},
    uReality:{value:this.reality.texture},
    uIntensity:{value:1},
   },
   vertexShader:`varying vec2 vUv;
void main(){vUv=uv;gl_Position=vec4(position,1.0);}`,
   fragmentShader:realityGpuBlendFragmentShader,
   depthTest:false,depthWrite:false,transparent:false,toneMapped:false,
  })
  this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material)
  this.quad.frustumCulled=false
  this.scene.add(this.quad)
  this.camera.position.z=1
 }
 resize(width:number,height:number){
  if(width<=0||height<=0)return
  this.base.setSize(width,height)
  this.reality.setSize(width,height)
 }
 render(strength:number,renderFull:()=>void,renderCameraOnly:()=>void){
  const previous=this.renderer.getRenderTarget()
  try{
   this.renderer.setRenderTarget(this.reality)
   renderFull()
   this.renderer.setRenderTarget(this.base)
   renderCameraOnly()
   this.renderer.setRenderTarget(null)
   this.quad.material.uniforms.uIntensity.value=Math.min(1,Math.max(0,strength))
   this.renderer.render(this.scene,this.camera)
  }finally{
   this.renderer.setRenderTarget(previous)
  }
 }
 dispose(){
  this.base.dispose()
  this.reality.dispose()
  this.quad.geometry.dispose()
  this.quad.material.dispose()
  this.scene.remove(this.quad)
 }
}
