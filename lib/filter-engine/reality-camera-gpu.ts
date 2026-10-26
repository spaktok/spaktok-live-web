import * as THREE from 'three'
import {
  realityColorFragmentShader,
  type FaceGeometry,
  type RenderInput,
} from './renderer'
import { backgroundCode, fxCode } from './params'

/**
 * GPU v2 camera background inside the SAME WebGL scene as Three.js AR meshes.
 *
 * The exact same 2026 color/beauty GLSL source is reused, not approximated
 * with a second CSS filter. The plane is drawn first with depth writes off;
 * face depth, PBR gemstones and makeup then render over it.
 *
 * NOTE: VideoTexture.flipY must be false, matching FilterRenderer's original
 * UNPACK_FLIP_Y_WEBGL=false input. The app orthographic projection has Y down,
 * so the bottom row of PlaneGeometry has uv.y=0 at SCREEN TOP.
 */
export type RealityCameraMask = RenderInput['mask']

export type RealityCrop = Readonly<{
  scaleX: number
  scaleY: number
  offsetX: number
  offsetY: number
}>

export function realityCoverCrop(sourceW:number,sourceH:number,outW:number,outH:number):RealityCrop {
  if(!(sourceW>0&&sourceH>0&&outW>0&&outH>0))throw Error('reality_invalid_video_dimensions')
  const sourceAspect=sourceW/sourceH,outputAspect=outW/outH
  const scaleX=sourceAspect>outputAspect?outputAspect/sourceAspect:1
  const scaleY=sourceAspect>outputAspect?1:sourceAspect/outputAspect
  return {scaleX,scaleY,offsetX:(1-scaleX)/2,offsetY:(1-scaleY)/2}
}

const FLOATS=[
  'uTime','uMirror','uAspect','uHasFace','uFaceWidth','uMouthWidth',
  'uSmooth','uWhiten','uSlim','uEyes','uJaw','uNoseSlim','uLipstick','uBlush',
  'uHasMask','uBgBlur','uBgMode','uFx','uFxAmount','uClarity',
  'uExposure','uContrast','uSaturation','uVibrance','uTemperature','uTint',
  'uHighlights','uShadows','uHue','uFade','uSharpen','uVignette','uGrain',
  'uGlow','uSplit','uArFace','uArAmount',
] as const
const VECTORS2=[
  'uCropScale','uCropOffset','uTexel','uResolution','uLeftEye','uRightEye',
  'uFaceCenter','uLeftCheek','uRightCheek','uLeftJaw','uRightJaw','uChin',
  'uNose','uMouth','uLeftBlush','uRightBlush',
] as const
const VECTORS3=['uShadowTint','uHighlightTint'] as const
export const realityCameraUniforms={ floats:FLOATS,vectors2:VECTORS2,vectors3:VECTORS3 }

type Uniforms=Record<string,THREE.IUniform>
function emptyUniforms(video:THREE.Texture,mask:THREE.Texture):Uniforms {
  const result:Uniforms={uVideo:{value:video},uMask:{value:mask}}
  for(const key of FLOATS)result[key]={value:0}
  for(const key of VECTORS2)result[key]={value:new THREE.Vector2()}
  for(const key of VECTORS3)result[key]={value:new THREE.Vector3(.5,.5,.5)}
  return result
}

export class RealityGpuCameraLayer {
  readonly videoTexture:THREE.VideoTexture
  readonly material:THREE.ShaderMaterial
  readonly plane:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>
  private readonly uniforms:Uniforms
  private maskTexture:THREE.DataTexture
  private lastMask:RealityCameraMask=null
  private width:number
  private height:number
  constructor(private readonly scene:THREE.Scene,video:HTMLVideoElement,width:number,height:number){
    this.width=width
    this.height=height
    this.videoTexture=new THREE.VideoTexture(video)
    this.videoTexture.flipY=false
    this.videoTexture.colorSpace=THREE.NoColorSpace
    this.videoTexture.minFilter=THREE.LinearFilter
    this.videoTexture.magFilter=THREE.LinearFilter
    this.videoTexture.generateMipmaps=false

    this.maskTexture=new THREE.DataTexture(new Uint8Array([255]),1,1,THREE.RedFormat)
    this.maskTexture.flipY=false
    this.maskTexture.minFilter=THREE.LinearFilter
    this.maskTexture.magFilter=THREE.LinearFilter
    this.maskTexture.generateMipmaps=false
    this.maskTexture.needsUpdate=true

    this.uniforms=emptyUniforms(this.videoTexture,this.maskTexture)
    this.material=new THREE.ShaderMaterial({
      uniforms:this.uniforms,
      // OrthographicCamera(0,width,0,height) projects world Y down.
      // PlaneGeometry uv.y=0 is consequently SCREEN TOP, just as the
      // original FilterRenderer used when uploading unflipped video.
      vertexShader:`varying vec2 vUv;
void main(){
  vUv=uv;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`,
      fragmentShader:realityColorFragmentShader,
      depthTest:false,depthWrite:false,transparent:false,
      toneMapped:false,side:THREE.DoubleSide,
    })
    this.plane=new THREE.Mesh(new THREE.PlaneGeometry(1,1),this.material)
    this.plane.name='SpakTokRealityGpu2Video'
    this.plane.renderOrder=-10000
    this.plane.frustumCulled=false
    this.resize(width,height)
    this.scene.add(this.plane)
  }
  resize(width:number,height:number){
    this.width=width
    this.height=height
    this.plane.scale.set(width,height,1)
    this.plane.position.set(width/2,height/2,-500)
  }
  setVisible(value:boolean){this.plane.visible=value}
  private n(key:string,value:number){this.uniforms[key].value=Number.isFinite(value)?value:0}
  private v2(key:string,x:number,y:number){
    ;(this.uniforms[key].value as THREE.Vector2).set(x,y)
  }
  private face(face:FaceGeometry|null){
    this.n('uHasFace',face?1:0)
    if(!face)return
    const fields={
      uLeftEye:face.leftEye,uRightEye:face.rightEye,uFaceCenter:face.center,
      uLeftCheek:face.leftCheek,uRightCheek:face.rightCheek,
      uLeftJaw:face.leftJaw,uRightJaw:face.rightJaw,uChin:face.chin,
      uNose:face.nose,uMouth:face.mouth,uLeftBlush:face.leftBlush,
      uRightBlush:face.rightBlush,
    }
    for(const [key,p] of Object.entries(fields))this.v2(key,p.x,p.y)
    this.n('uFaceWidth',face.width)
    this.n('uMouthWidth',face.mouthWidth)
  }
  private mask(mask:RealityCameraMask){
    if(!mask||mask.width<=0||mask.height<=0||mask.data.length!==mask.width*mask.height){
      this.n('uHasMask',0);return
    }
    if(mask!==this.lastMask){
      const next=new THREE.DataTexture(mask.data,mask.width,mask.height,THREE.RedFormat)
      next.flipY=false
      next.unpackAlignment=1
      next.minFilter=THREE.LinearFilter
      next.magFilter=THREE.LinearFilter
      next.generateMipmaps=false
      next.needsUpdate=true
      this.maskTexture.dispose()
      this.maskTexture=next
      this.uniforms.uMask.value=next
      this.lastMask=mask
    }
    this.n('uHasMask',1)
  }
  update(input:RenderInput){
    const sourceW=input.source.videoWidth||input.source.width||0
    const sourceH=input.source.videoHeight||input.source.height||0
    const crop=realityCoverCrop(sourceW,sourceH,this.width,this.height)
    this.v2('uCropScale',crop.scaleX,crop.scaleY)
    this.v2('uCropOffset',crop.offsetX,crop.offsetY)
    this.v2('uTexel',1/sourceW,1/sourceH)
    this.v2('uResolution',this.width,this.height)
    this.n('uAspect',sourceW/sourceH)
    this.n('uMirror',input.mirror?1:0)
    this.n('uTime',input.time%1000)
    this.face(input.face)
    const beauty=input.beauty,color=input.color,effects=input.effects
    this.n('uSmooth',beauty.smooth);this.n('uWhiten',beauty.whiten)
    this.n('uSlim',input.face?beauty.slim:0)
    this.n('uEyes',input.face?beauty.eyes:0)
    this.n('uJaw',input.face?beauty.jaw:0)
    this.n('uNoseSlim',input.face?beauty.nose:0)
    this.n('uLipstick',input.face?beauty.lipstick:0)
    this.n('uBlush',input.face?beauty.blush:0)
    this.n('uBgBlur',effects.backgroundBlur)
    this.n('uBgMode',backgroundCode(effects.background))
    this.n('uFx',fxCode(effects.fx))
    this.n('uFxAmount',effects.fxAmount)
    // AR decoration belongs to Three.js and its own depth-aware passes.
    // Prevent the GLSL shader from painting a second 2D face sticker.
    this.n('uArFace',0);this.n('uArAmount',0)
    this.n('uClarity',color.clarity)
    this.n('uExposure',color.exposure);this.n('uContrast',color.contrast)
    this.n('uSaturation',color.saturation);this.n('uVibrance',color.vibrance)
    this.n('uTemperature',color.temperature);this.n('uTint',color.tint)
    this.n('uHighlights',color.highlights);this.n('uShadows',color.shadows)
    this.n('uHue',color.hue);this.n('uFade',Math.max(0,color.fade))
    this.n('uSharpen',Math.max(0,color.sharpen))
    this.n('uVignette',Math.max(0,color.vignette))
    this.n('uGrain',Math.max(0,color.grain))
    this.n('uGlow',Math.max(0,color.glow))
    this.n('uSplit',Math.max(0,color.splitAmount))
    ;(this.uniforms.uShadowTint.value as THREE.Vector3).set(...color.shadowTint)
    ;(this.uniforms.uHighlightTint.value as THREE.Vector3).set(...color.highlightTint)
    this.mask(input.mask&&effects.background!=='none'&&effects.backgroundBlur>0?input.mask:null)
  }
  dispose(){
    this.scene.remove(this.plane)
    this.plane.geometry.dispose()
    this.material.dispose()
    this.maskTexture.dispose()
    this.videoTexture.dispose()
  }
}
