import {isOriginalFaceFinishId} from './spaktok-original-face-filters'
import {
  REALITY_EFFECTS,
  assertRealityEffect,
  type RealityEffectManifest,
} from './reality-effect-manifest'

/** Read-only, honest coverage inventory for EVERY effect known by the camera.
 * A valid manifest or an available GLB does not mean visual/mobile QA passed.
 */
export type RealityAuditFamily =
  | 'accessory-3d' | 'makeup-3d' | 'face-morph'
  | 'face-overlay' | 'color-grade' | 'post-process'
  | 'background' | 'beauty'

export type RealityAuditState = 'disabled' | 'prototype' | 'device-qa-required'
/** Architectural truth, not a perceptual-quality score or mobile certification. */
export type RealityVisualStage =
  | 'geometric-prototype' | 'illustrated-2d' | 'tracked-cosmetic'
  | 'pbr-approximation' | 'authored-3d' | 'tracked-deformation'
  | 'color-grade' | 'post-process' | 'background' | 'beauty'
export type RealityAuditCheck =
  | 'manifest-invalid' | 'legacy-photo-overlay-disabled'
  | 'original-3d-asset-needed' | 'verify-asset-rights'
  | 'head-pose-and-occlusion' | 'face-region-and-skin-tone'
  | 'face-tracking-and-mirror' | 'face-warp-and-identity'
  | 'segmentation-boundaries' | 'color-and-gamma'
  | 'post-fx-motion-and-latency' | 'beauty-and-skin-tone'
  | 'recording-parity' | 'real-device-performance'

export type RealityEffectAudit = Readonly<{
  id: string
  name: string
  family: RealityAuditFamily
  visualStage: RealityVisualStage
  photographicUpgrade: string
  state: RealityAuditState
  quality: RealityEffectManifest['quality']
  anchor: RealityEffectManifest['anchor']
  assetUri: string | null
  tracking: RealityEffectManifest['tracking']
  requiredModels: RealityEffectManifest['requires']
  checks: readonly RealityAuditCheck[]
}>

export const REALITY_AUDIT_FAMILIES: readonly RealityAuditFamily[] = [
  'accessory-3d','makeup-3d','face-morph','face-overlay',
  'color-grade','post-process','background','beauty',
]

export function realityAuditFamily(effect: RealityEffectManifest): RealityAuditFamily {
  if (effect.id.startsWith('beauty:')) return 'beauty'
  if (effect.kind === 'color-grade') return 'color-grade'
  if (effect.kind === 'post-process') return 'post-process'
  if (effect.kind === 'background') return 'background'
  if (effect.id === 'face-morph') return 'face-morph'
  if (effect.kind === 'face-surface') return 'makeup-3d'
  if (effect.kind === 'wearable-3d' || effect.kind === 'expression-3d') return 'accessory-3d'
  return 'face-overlay'
}

/** Every catalog effect receives a concrete photographic upgrade path. */
export function photographicStage(effect:RealityEffectManifest):RealityVisualStage{
  if(effect.quality==='procedural-preview')return 'geometric-prototype'
  if(effect.quality==='authored-glb')return 'authored-3d'
  if(effect.kind==='face-surface')
    return effect.id==='3d-precision-cyber-mask'||
      effect.id==='3d-photoreal-porcelain-mask'||
      isOriginalFaceFinishId(effect.id)?'pbr-approximation':'tracked-cosmetic'
  if(effect.kind==='face-overlay')return 'illustrated-2d'
  if(effect.id.startsWith('beauty:'))return 'beauty'
  if(effect.kind==='face-deform')return 'tracked-deformation'
  return effect.kind==='color-grade'?'color-grade'
    :effect.kind==='post-process'?'post-process'
    :effect.kind==='background'?'background':'beauty'
}
export const PHOTOGRAPHIC_UPGRADE_PATHS:Readonly<Record<RealityVisualStage,string>>={
 'geometric-prototype':'Replace procedural geometry with an original rigged GLB, calibrated PBR textures, depth and motion QA.',
 'illustrated-2d':'Author an original detailed face-bound mesh or texture with soft edges and pose-aware occlusion.',
 'tracked-cosmetic':'Improve anatomical UV cosmetics, physically plausible color and finish across skin tones and expressions.',
 'pbr-approximation':'Add licensed high-resolution normal/roughness maps and real-device multi-angle lighting tests.',
 'authored-3d':'Verify asset rights, per-angle occlusion, UV/texture fidelity, latency and thermal stability.',
 'tracked-deformation':'Improve identity-preserving landmark stability, natural warps, and high-motion boundary QA.',
 'color-grade':'Camera-metered exposure and white balance, highlight protection, and photo/recording color parity.',
 'post-process':'Resolve temporal jitter and GPU costs; preserve intentional artistic effects rather than mislabel photoreal.',
 'background':'Improve hair/hand edge matting, natural defocus, and low-light segmentation.',
 'beauty':'Preserve pores and identity with bounded, opt-in tone-neutral skin enhancements.',
}

/** Warning/checklist, not a claim that any camera/device has been tested. */
export function auditRealityEffect(effect: RealityEffectManifest): RealityEffectAudit {
  const family = realityAuditFamily(effect)
  const checks: RealityAuditCheck[] = []
  try { assertRealityEffect(effect) } catch { checks.push('manifest-invalid') }
  const disabled = effect.id === '3d-photo-face'
  if (disabled) checks.push('legacy-photo-overlay-disabled')
  if (effect.quality === 'procedural-preview') checks.push('original-3d-asset-needed')
  if (effect.asset) checks.push('verify-asset-rights')
  switch (family) {
    case 'accessory-3d':
      checks.push('head-pose-and-occlusion')
      break
    case 'makeup-3d':
      checks.push('face-region-and-skin-tone')
      break
    case 'face-morph':
      checks.push('face-warp-and-identity')
      break
    case 'face-overlay':
      checks.push('face-tracking-and-mirror')
      break
    case 'background':
      if (effect.requires.includes('segmentation')) checks.push('segmentation-boundaries')
      else checks.push('color-and-gamma')
      break
    case 'color-grade':
      checks.push('color-and-gamma')
      break
    case 'post-process':
      checks.push('post-fx-motion-and-latency')
      break
    case 'beauty':
      checks.push('beauty-and-skin-tone')
      break
  }
  checks.push('recording-parity','real-device-performance')
  return {
    id:effect.id,name:effect.name,family,
    visualStage:photographicStage(effect),
    photographicUpgrade:PHOTOGRAPHIC_UPGRADE_PATHS[photographicStage(effect)],
    state:disabled || checks.includes('manifest-invalid')
      ? 'disabled'
      : effect.quality === 'procedural-preview' ? 'prototype' : 'device-qa-required',
    quality:effect.quality,anchor:effect.anchor,
    assetUri:effect.asset?.uri ?? null,
    tracking:effect.tracking,
    requiredModels:effect.requires,
    checks,
  }
}

export const REALITY_EFFECT_AUDIT: readonly RealityEffectAudit[] =
  REALITY_EFFECTS.map(auditRealityEffect)

export function summarizeRealityAudit(items: readonly RealityEffectAudit[]) {
  return {
    total:items.length,
    disabled:items.filter(item=>item.state==='disabled').length,
    prototypes:items.filter(item=>item.state==='prototype').length,
    needingDeviceQa:items.filter(item=>item.state==='device-qa-required').length,
    visualStages:Array.from(new Set(items.map(item=>item.visualStage))).map(stage=>({
      stage,count:items.filter(item=>item.visualStage===stage).length,
    })),
    families:REALITY_AUDIT_FAMILIES.map(family=>({
      family,count:items.filter(item=>item.family===family).length,
    })),
  }
}
