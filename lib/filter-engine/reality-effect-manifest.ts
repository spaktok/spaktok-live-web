import { backgroundModes, faceFxCatalog, filterPresets, fxList, neutralBeauty, type FaceFxId } from './params'
import { UPLOADED_CROWN_MOBILE } from './crown-asset-url'
import type {FaceSemanticRegion} from './reality-face-regions'

/** Explicit, versioned effect contracts for the entire camera studio:
 * AR wearables, mesh makeup, legacy masks, color looks, post-FX, background.
 * "authored" means a real available GLB; procedural previews are NEVER
 * advertised as photographic assets.
 */
export const REALITY_MANIFEST_VERSION = 1 as const
export type RealityAnchor =
  | 'eyes_center' | 'forehead_center' | 'head_top'
  | 'left_temple' | 'right_temple' | 'left_ear' | 'right_ear'
  | 'nose_bridge' | 'nose_tip' | 'upper_lip' | 'lower_lip'
  | 'chin' | 'jaw_left' | 'jaw_right'
export type RealityEffectKind =
  | 'wearable-3d' | 'expression-3d' | 'face-surface'
  | 'face-overlay' | 'face-deform' | 'color-grade' | 'post-process' | 'background'
export type RealityAssetQuality =
  | 'authored-glb' | 'tracked-mesh' | 'procedural-preview' | 'shader-only'
export type RealityOcclusion = 'face-depth' | 'surface-depth' | 'none'
export type RealityAsset = Readonly<{
  uri: string
  format: 'glb'
  /** Geometry coordinates of the point that must touch the chosen anchor.
   * Units are face-width normalized after the asset's authoring transform.
   */
  localAnchor: readonly [number, number, number]
  calibration: 'screen-y-down' | 'owner-crown-v1'
}>
export type RealityEffectManifest = Readonly<{
  schemaVersion: typeof REALITY_MANIFEST_VERSION
  id: string
  name: string
  kind: RealityEffectKind
  quality: RealityAssetQuality
  anchor: RealityAnchor | null
  occlusion: RealityOcclusion
  asset: RealityAsset | null
  surfaceBinding?: Readonly<{region:FaceSemanticRegion;targetLandmark:number;normalOffsetPx:number}> | null
  expressionBindings: readonly string[]
  requires: readonly ('face-mesh'|'segmentation')[]
  /** Coordinate convention shared with MediaPipe (top-left screen origin). */
  tracking: 'head-6dof' | 'face-surface' | 'screen-space'
}>

type ThreeConfig = Readonly<{
  anchor: RealityAnchor
  asset?: RealityAsset
  kind?: 'wearable-3d' | 'expression-3d'
  surfaceBinding?: RealityEffectManifest['surfaceBinding']
  expressionBindings?: readonly string[]
}>
const threeConfigs: Readonly<Record<string, ThreeConfig>> = {
  '3d-gold-crown': {
    anchor:'forehead_center',
    asset:{uri:UPLOADED_CROWN_MOBILE,format:'glb',
      localAnchor:[0,-.55,0],calibration:'owner-crown-v1'},
  },
  '3d-first-gpu-pilot': {anchor:'head_top'},
  '3d-crystal': {
    anchor:'forehead_center',
    asset:{uri:'/face-assets/spaktok-crystal.glb',format:'glb',
      localAnchor:[0,0,0],calibration:'screen-y-down'},
    surfaceBinding:{region:'forehead',targetLandmark:10,normalOffsetPx:9},
  },
  '3d-photo-face':{anchor:'eyes_center'},
  '3d-lux-glasses':{anchor:'eyes_center'},
  '3d-space-visor':{anchor:'eyes_center'},
  '3d-metal-cap':{anchor:'eyes_center'},
  '3d-expression':{anchor:'eyes_center',kind:'expression-3d',
    expressionBindings:['jawOpen','eyeBlinkLeft','eyeBlinkRight','browInnerUp']},
}
const isMakeup=(id:string)=>id.startsWith('3d-makeup-')
const isThree=(id:string)=>id.startsWith('3d-')&&!isMakeup(id)
const faceManifests=faceFxCatalog.filter(x=>x.id!=='none').map((fx):RealityEffectManifest=>{
  const id=fx.id
  const conf=threeConfigs[id]
  const surface=isMakeup(id),three=isThree(id)
  if(three&&!conf)throw Error('reality_missing_3d_contract:'+id)
  return {
    schemaVersion:REALITY_MANIFEST_VERSION,id,name:fx.name,
    kind:id==='face-morph'?'face-deform':surface?'face-surface':three?conf.kind??'wearable-3d':'face-overlay',
    quality:surface?'tracked-mesh':three?(conf.asset?'authored-glb':'procedural-preview'):'shader-only',
    anchor:surface?null:three?conf.anchor:null,
    occlusion:surface?'surface-depth':three?'face-depth':'none',
    asset:conf?.asset??null,
    surfaceBinding:conf?.surfaceBinding??null,
    expressionBindings:conf?.expressionBindings??[],
    requires:['face-mesh'],tracking:surface||id==='face-morph'?'face-surface':three?'head-6dof':'screen-space',
  }
})
const gradeManifests=filterPresets.map((f):RealityEffectManifest=>({
  schemaVersion:1,id:'grade:'+f.id,name:f.name,
  kind:'color-grade',quality:'shader-only',anchor:null,occlusion:'none',asset:null,
  expressionBindings:[],requires:[],tracking:'screen-space',
}))
const postManifests=fxList.map((fx):RealityEffectManifest=>({
  schemaVersion:1,id:'post:'+fx,name:fx,
  kind:'post-process',quality:'shader-only',anchor:null,occlusion:'none',asset:null,
  expressionBindings:[],requires:[],tracking:'screen-space',
}))
const backgroundManifests=backgroundModes.map((mode):RealityEffectManifest=>({
  schemaVersion:1,id:'background:'+mode,name:mode,
  kind:'background',quality:'shader-only',anchor:null,occlusion:'none',asset:null,
  expressionBindings:[],requires:mode==='none'?[]:['segmentation'],tracking:'screen-space',
}))
const beautyManifests=(Object.keys(neutralBeauty) as Array<keyof typeof neutralBeauty>)
  .map((key):RealityEffectManifest=>{
    const needsMesh=['slim','eyes','jaw','nose','lipstick','blush'].includes(key)
    return {
      schemaVersion:1,id:'beauty:'+key,name:key,kind:'face-deform',
      quality:'shader-only',anchor:null,occlusion:'none',asset:null,
      expressionBindings:[],requires:needsMesh?['face-mesh']:[],
      tracking:needsMesh?'face-surface':'screen-space',
    }
  })
export const REALITY_EFFECTS:readonly RealityEffectManifest[]=[
  ...faceManifests,...gradeManifests,...postManifests,...backgroundManifests,
  ...beautyManifests,
]
const byId=new Map(REALITY_EFFECTS.map(manifest=>[manifest.id,manifest]))
if(byId.size!==REALITY_EFFECTS.length)throw Error('reality_duplicate_effect_id')

export function getRealityEffect(id:string):RealityEffectManifest|null{
 return byId.get(id)??null
}
export function getFaceRealityEffect(id:FaceFxId):RealityEffectManifest|null{
 return id==='none'?null:getRealityEffect(id)
}

/** Fail closed for unsafe/out-of-contract assets before any network request.
 * Only application-owned same-origin GLBs are accepted; no dynamic JS/shaders.
 */
export function assertRealityEffect(manifest:RealityEffectManifest):void{
 if(manifest.schemaVersion!==1||!manifest.id||!manifest.name)
   throw Error('reality_invalid_manifest')
 if(manifest.surfaceBinding){
  const {targetLandmark,normalOffsetPx}=manifest.surfaceBinding
  if(!Number.isSafeInteger(targetLandmark)||targetLandmark<0||targetLandmark>=468||
     !Number.isFinite(normalOffsetPx)||normalOffsetPx<0||normalOffsetPx>120||
     !['wearable-3d','expression-3d'].includes(manifest.kind))
    throw Error('reality_invalid_surface_attachment')
 }
 if(manifest.asset){
  const uri=manifest.asset.uri
  if(!/^\/face-assets\/[a-z0-9][a-z0-9-]*\.glb(?:\?v=[a-zA-Z0-9-]+)?$/.test(uri))
   throw Error('reality_unsafe_asset_path')
  if(manifest.quality!=='authored-glb'||!manifest.anchor||
    manifest.tracking!=='head-6dof')
   throw Error('reality_invalid_asset_binding')
  const anchor=manifest.asset.localAnchor
  if(anchor.length!==3||anchor.some(x=>!Number.isFinite(x)||Math.abs(x)>5))
   throw Error('reality_invalid_asset_pivot')
 }else if(manifest.quality==='authored-glb'){
  throw Error('reality_missing_authored_asset')
 }
 if((manifest.kind==='wearable-3d'||manifest.kind==='expression-3d')&&
   (!manifest.anchor||manifest.tracking!=='head-6dof'))
   throw Error('reality_missing_head_anchor')
}
