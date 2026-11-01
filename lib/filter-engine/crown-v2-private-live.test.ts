import {describe,expect,it} from 'vitest'
import {
 CROWN_V2_ASSET,CROWN_V2_FILTER_ID,verifiedCrownV2Buffer,crownV2ArabicError,
} from './crown-v2-private-live'

describe('owner-only crown V2 never accepts a placeholder asset',()=>{
 it('uses its own lens ID, not the old public crown ID',()=>{
  expect(CROWN_V2_FILTER_ID).not.toBe('3d-gold-crown')
  expect(CROWN_V2_ASSET.ownerDraftOnly).toBe(true)
  expect(CROWN_V2_ASSET.approvedForPublicLive).toBe(false)
 })
 it('rejects empty and wrong-sized GLB files before parsing or rendering',async()=>{
  const empty=new File([],'empty.glb',{type:'model/gltf-binary'})
  const old=new File([new Uint8Array(64)],'old-crown.glb',{type:'model/gltf-binary'})
  await expect(verifiedCrownV2Buffer(empty)).rejects.toThrow('crown_v2_wrong_size')
  await expect(verifiedCrownV2Buffer(old)).rejects.toThrow('crown_v2_wrong_size')
 })
 it('rejects an invalid GLB header even if byte length matches',async()=>{
  const notGlb=new File([new Uint8Array(CROWN_V2_ASSET.bytes)],'fake-crown.glb')
  await expect(verifiedCrownV2Buffer(notGlb)).rejects.toThrow('crown_v2_invalid_glb')
 })
 it('explains private login and does not silently claim a crown loaded',()=>{
  expect(crownV2ArabicError(new Error('crown_v2_login'))).toContain('سجّل الدخول')
  expect(crownV2ArabicError(new Error('crown_v2_owner_only'))).toContain('المالك')
  expect(crownV2ArabicError(new Error('crown_v2_digest_mismatch'))).toContain('لا يطابق')
  expect(crownV2ArabicError(new Error('crown_v2_origin'))).toContain('نطاق الإنتاج')
  expect(crownV2ArabicError(new Error('crown_v2_disabled'))).toContain('غير مفعّلة')
  expect(crownV2ArabicError(new Error('crown_v2_owner_config'))).toContain('إعداد حساب المالك')
  expect(crownV2ArabicError(new Error('crown_v2_signing'))).toContain('توقيع')
 })
})
