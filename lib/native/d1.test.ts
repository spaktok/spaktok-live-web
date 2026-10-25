import {beforeEach,describe,expect,it,vi} from 'vitest'
vi.mock('server-only',()=>({}))
import {hasNativeDatabase,httpSqlParams,queryD1} from './d1'
describe('signed D1 bridge',()=>{
  beforeEach(()=>{
    vi.stubEnv('SPAKTOK_D1_BRIDGE_URL','https://spaktok-d1-bridge.spaktok.workers.dev')
    vi.stubEnv('SPAKTOK_D1_BRIDGE_SIGNING_KEY','')
  })
  it('requires a server-only signing key',()=>expect(hasNativeDatabase()).toBe(false))
  it('does not treat a Cloudflare API token as authorization',()=>{
    vi.stubEnv('CLOUDFLARE_D1_API_TOKEN','untrusted')
    expect(hasNativeDatabase()).toBe(false)
  })
  it('rejects floating point params and preserves NULL',()=>{
    expect(httpSqlParams([1,'x',null])).toEqual(['1','x',null])
    expect(()=>httpSqlParams([1.1])).toThrow('invalid_database_parameter')
  })
  it('fails closed when no authorized bridge exists',async()=>{
    await expect(queryD1('SELECT 1')).rejects.toThrow('native_database_not_configured')
  })
})
