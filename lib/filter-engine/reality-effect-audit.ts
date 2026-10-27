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
      if (effect.requiredModels?.includes('segmentation')) checks.push('segmentation-boundaries')
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
    families:REALITY_AUDIT_FAMILIES.map(family=>({
      family,count:items.filter(item=>item.family===family).length,
    })),
  }
}
