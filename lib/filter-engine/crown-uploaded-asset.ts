import * as THREE from 'three'
/**
 * User-supplied AR 3D crown from spacetok_3D_crown_AR_package(2).zip.
 * Exact mobile GLB SHA256:
 * 8301ca876983e9850a62dd86bfb3f406679aadb23549eb03308d74c84383f0f9
 * GLTF coordinates +Y UP, +Z front, physical meter units. Face engine +Y DOWN.
 */
export const UPLOADED_CROWN_MOBILE='/face-assets/spaktok-owner-crown-mobile.glb?v=20261026-owner-v1'
export const TARGET_CROWN_HEAD_WIDTH=0.97
export const CROWN_BAND_LOCAL_Y=-0.55
export const SOURCE_HEADBAND_Y=-0.0089
export interface PreparedCrown{
 sourceWidth:number
 normalizedScale:number
 sourceCenterX:number
 bandY:number
}
/** Correct the geometric units, axis orientation and headband base alignment. */
export function prepareUploadedCrown(root:THREE.Object3D):PreparedCrown{
 root.updateWorldMatrix(true,true)
 const bounds=new THREE.Box3().setFromObject(root)
 const sourceWidth=bounds.max.x-bounds.min.x
 if(!Number.isFinite(sourceWidth)||sourceWidth<=.02||sourceWidth>3)
   throw Error('uploaded_crown_invalid_bounds')
 const cx=(bounds.min.x+bounds.max.x)*0.5
 const scale=TARGET_CROWN_HEAD_WIDTH/sourceWidth
 root.scale.set(scale,-scale,scale)
 root.position.set(-cx*scale,CROWN_BAND_LOCAL_Y+SOURCE_HEADBAND_Y*scale,0)
 root.updateMatrixWorld(true)
 return {sourceWidth,normalizedScale:scale,sourceCenterX:cx,
  bandY:root.position.y-SOURCE_HEADBAND_Y*scale}
}
