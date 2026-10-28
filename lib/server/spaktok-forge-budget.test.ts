import {describe,it,expect} from 'vitest'
import {
 FORGE_OPERATOR_MAX_DAILY_JOBS,FORGE_QUOTA_CLAIM_SQL,
 parseForgeDailyJobLimit,
} from './spaktok-forge-budget'

describe('Spaktok Forge operator GPU budget controls',()=>{
 it('fails closed when limit is missing or malformed',()=>{
  for(const value of [
   undefined,'','0','-1','1.5','1e2',' 1 ','001',
   '999','201','1000','NaN','Infinity',
  ])expect(parseForgeDailyJobLimit(value)).toBeNull()
 })
 it('accepts a bounded explicit whole number daily global budget',()=>{
  expect(FORGE_OPERATOR_MAX_DAILY_JOBS).toBe(200)
  expect(parseForgeDailyJobLimit('1')).toBe(1)
  expect(parseForgeDailyJobLimit('10')).toBe(10)
  expect(parseForgeDailyJobLimit('200')).toBe(200)
 })
 it('reserves owner-day uniqueness and global budget in the same INSERT statement',()=>{
  expect(FORGE_QUOTA_CLAIM_SQL).toMatch(/INSERT INTO forge_gpu_daily_claims/i)
  expect(FORGE_QUOTA_CLAIM_SQL).toMatch(/SELECT COUNT\(\*\)/i)
  expect(FORGE_QUOTA_CLAIM_SQL).toMatch(/WHERE day_utc=\?\) < \?/i)
  expect(FORGE_QUOTA_CLAIM_SQL).toMatch(/ON CONFLICT\(owner_id,day_utc\) DO NOTHING/i)
  expect(FORGE_QUOTA_CLAIM_SQL).toMatch(/RETURNING job_id/i)
 })
})
