import {beforeEach,describe,expect,it,vi} from 'vitest'
vi.mock('server-only',()=>({}))
vi.mock('@/lib/native/auth',()=>({getNativeUser:vi.fn()}))
vi.mock('@/lib/native/d1',()=>({
 queryD1:vi.fn(),
 validId:(v:unknown)=>typeof v==='string'&&v.length===36,
}))
import {getNativeUser} from '@/lib/native/auth'
import {queryD1} from '@/lib/native/d1'
import {GET} from './route'
const ADMIN='e72004cb-6abb-4cec-a651-0734c3b09d19'
describe('private D1 moderation',()=>{
 beforeEach(()=>{
   vi.clearAllMocks()
   vi.stubEnv('SPAKTOK_MODERATION_ENABLED','true')
   vi.stubEnv('SPAKTOK_ADMIN_USER_ID',ADMIN)
   vi.mocked(queryD1).mockResolvedValue({rows:[],changes:0})
 })
 it('remains disabled unless opted in',async()=>{
   vi.stubEnv('SPAKTOK_MODERATION_ENABLED','false')
   expect((await GET()).status).toBe(503)
 })
 it('rejects strangers without querying D1 records',async()=>{
   vi.mocked(getNativeUser).mockResolvedValue({id:'other',email:'other@example.org',username:'other'})
   expect((await GET()).status).toBe(403)
   expect(queryD1).not.toHaveBeenCalled()
 })
 it('permits configured admin to view pending metadata',async()=>{
   vi.mocked(getNativeUser).mockResolvedValue({id:ADMIN,email:'a@example.org',username:'admin'})
   const res=await GET()
   expect(res.status).toBe(200)
   expect(await res.json()).toEqual({items:[],moderationEnabled:true})
 })
})
