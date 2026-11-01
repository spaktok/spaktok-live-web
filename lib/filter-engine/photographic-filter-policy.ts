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
 if(id==='3d-photo-face'||id==='3d-first-gpu-pilot'||
    id==='3d-royal-crown-v2'||id==='3d-gold-crown')
  return false // Never substitute old crown for the private V2 asset
 const definition=getFaceRealityEffect(id)
 if(!definition)return false
 const stage=photographicStage(definition)
 // The public camera contains only true tracked cosmetics / deformation.
 // Generated procedural "PBR-looking" masks and old authored accessories
 // are not proof of photographic realism; keep them out of public selection.
 return stage==='tracked-cosmetic'||stage==='tracked-deformation'
}

export const PUBLIC_PHOTOGRAPHIC_FACE_FX=faceFxCatalog.filter(
 fx=>isPublicPhotographicFaceFx(fx.id)
)

/** Existing deep links / saved presets may still name retired procedural lenses.
 * Never auto-enable them in the public camera. Only an explicit owner-preview
 * entry can request the private original crown or GPU pilot.
 */
export function safeInitialCameraFaceFx(
 id:FaceFxId,
 ownerPreview:boolean,
):FaceFxId{
 if(ownerPreview&&(id==='3d-royal-crown-v2'||id==='3d-first-gpu-pilot'))
  return id
 return isPublicPhotographicFaceFx(id)?id:'none'
}

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
