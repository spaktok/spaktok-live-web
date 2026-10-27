import * as THREE from 'three'
import {createStudioState,resolveColor,filterPresets} from './params'

/** Shared color preset parameters on a recorded video frame.
 * Uses the same authored presets as Camera Studio, but a light-weight video
 * shader approximation; NOT declared full camera shader parity.
 */
const vertex=`
varying vec2 vUv;
void main(){
 vUv=uv;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}
`
const fragment=`
precision highp float;
varying vec2 vUv;
uniform sampler2D uVideo;
uniform float uExposure;
uniform float uContrast;
uniform float uSaturation;
uniform float uTemperature;
uniform float uVibrance;
uniform float uFade;
uniform float uGlow;
void main(){
 vec3 color=texture2D(uVideo,vUv).rgb;
 color*=exp2(clamp(uExposure,-1.0,1.0)*.75);
 color=(color-.5)*(1.0+clamp(uContrast,-.85,1.0)*.75)+.5;
 float luminance=dot(color,vec3(.2126,.7152,.0722));
 color=mix(vec3(luminance),color,clamp(1.0+uSaturation,0.0,2.0));
 color=mix(color,color+(color-vec3(luminance))*uVibrance*.22,clamp(abs(uVibrance),0.0,1.0));
 color.r+=uTemperature*.05;
 color.b-=uTemperature*.05;
 color=mix(color,vec3(.5),clamp(uFade,0.0,1.0)*.32);
 color+=max(color-vec3(.7),0.0)*clamp(uGlow,0.0,1.0)*.08;
 gl_FragColor=vec4(clamp(color,0.0,1.0),1.0);
 #include <colorspace_fragment>
}
`
export function createRealityVideoGrade(texture:THREE.VideoTexture){
 return new THREE.ShaderMaterial({
  uniforms:{
   uVideo:{value:texture},
   uExposure:{value:0},uContrast:{value:0},uSaturation:{value:0},
   uTemperature:{value:0},uVibrance:{value:0},
   uFade:{value:0},uGlow:{value:0},
  },
  vertexShader:vertex,fragmentShader:fragment,
  depthTest:false,depthWrite:false,toneMapped:false,
 })
}
export function setRealityVideoGrade(
 material:THREE.ShaderMaterial,presetId:string,
):void{
 if(!filterPresets.some(p=>p.id===presetId))throw Error('reality_invalid_grade')
 const color=resolveColor(createStudioState(presetId))
 material.uniforms.uExposure.value=color.exposure
 material.uniforms.uContrast.value=color.contrast
 material.uniforms.uSaturation.value=color.saturation
 material.uniforms.uTemperature.value=color.temperature
 material.uniforms.uVibrance.value=color.vibrance
 material.uniforms.uFade.value=color.fade
 material.uniforms.uGlow.value=color.glow
}
