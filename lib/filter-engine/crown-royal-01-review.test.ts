import {describe,it,expect} from 'bun:test'
import {ROYAL_CROWN_01_REVIEW,mayReleaseRoyalCrown01} from './crown-royal-01-review'

const all={
 rightsConfirmed:true,
 sourceImageFidelityApproved:true,
 fiveMaterialZonesValidated:true,
 faceTrackingAndroidTestPassed:true,
 visualAndFpsMobileQaPassed:true,
 privateMasterSha256:ROYAL_CROWN_01_REVIEW.sha256,
}

describe('Royal Crown 01 is a private, quality-gated GLB',()=>{
 it('is actually generated, immutable, and not yet a public Live effect',()=>{
  expect(ROYAL_CROWN_01_REVIEW.triangles).toBe(117788)
  expect(ROYAL_CROWN_01_REVIEW.bytes).toBe(4856516)
  expect(ROYAL_CROWN_01_REVIEW.geometryMobileBudgetPassed).toBe(true)
  expect(ROYAL_CROWN_01_REVIEW.materialCount).toBe(1)
  expect(ROYAL_CROWN_01_REVIEW.published).toBe(false)
  expect(ROYAL_CROWN_01_REVIEW.availableInLive).toBe(false)
 })
 it('requires every independent color and Live quality gate',()=>{
  expect(mayReleaseRoyalCrown01(all)).toBe(true)
  for(const key of ['sourceImageFidelityApproved','fiveMaterialZonesValidated',
    'faceTrackingAndroidTestPassed','visualAndFpsMobileQaPassed'] as const){
   expect(mayReleaseRoyalCrown01({...all,[key]:false})).toBe(false)
  }
  expect(mayReleaseRoyalCrown01({...all,privateMasterSha256:'f'.repeat(64)})).toBe(false)
 })
})
