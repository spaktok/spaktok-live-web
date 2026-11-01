import {faceFxCatalog,filterPresets,type FaceFxId} from './params'
import {getFaceRealityEffect} from './reality-effect-manifest'
import {photographicStage} from './reality-effect-audit'

/** User-facing catalogue: no 2D sticker, primitive geometry or substituted face.
 * A PBR approximation is still labeled as an approximation in the audit, not
 * promised as an asset-authored, device-validated photorealistic effect.
 * Existing internal definitions stay stable for saved projects and migrations.
 */
export function isPublicPhotographicFaceFx(id:FaceFxId):boolean{
 if(id==='none')return true
 if(id==='3d-photo-face'||id==='3d-first-gpu-pilot'||id==='3d-royal-crown-v2')
  return false // private owner previews or prohibited legacy photo substitution
 const definition=getFaceRealityEffect(id)
 if(!definition)return false
 const stage=photographicStage(definition)
 return stage==='tracked-cosmetic'||stage==='pbr-approximation'||
   stage==='tracked-deformation'||
   (stage==='authored-3d'&&Boolean(definition.asset))
}

export const PUBLIC_PHOTOGRAPHIC_FACE_FX=faceFxCatalog.filter(
 fx=>isPublicPhotographicFaceFx(fx.id)
)

/** These operate on real camera pixels with the existing graded GPU pipeline.
 * They do not generate synthetic skin texture or change a person's identity.
 */
const PHOTO_LOOK_IDS=[
 'original','spk-natural-portrait','spk-studio-portrait','spk-clear-detail',
 'spk-luminous-face','spk-warm-skin','spk-cool-portrait',
 'spk-night-live','spk-candlelight','spk-diamond-light',
] as const

export const PHOTOGRAPHIC_CAMERA_LOOKS=PHOTO_LOOK_IDS.map(id=>{
 const preset=filterPresets.find(p=>p.id===id)
 if(!preset)throw Error('photographic_missing_color_preset:'+id)
 return preset
})
