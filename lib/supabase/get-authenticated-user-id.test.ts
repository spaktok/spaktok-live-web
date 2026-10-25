import {describe,expect,it,vi} from 'vitest'
vi.mock('server-only',()=>({}))
vi.mock('@/lib/native/auth',()=>({getNativeUser:vi.fn()}))
import {getNativeUser} from '@/lib/native/auth'
import {getAuthenticatedUserId} from './get-authenticated-user-id'
describe('native authentication compatibility adapter',()=>{
 it('rejects unverified identity headers or cookies without D1 session',async()=>{
   vi.mocked(getNativeUser).mockResolvedValue(null)
   expect(await getAuthenticatedUserId()).toBeNull()
 })
 it('returns only native validated id',async()=>{
   vi.mocked(getNativeUser).mockResolvedValue({id:'native-user',email:'u@example.org',username:'new'})
   expect(await getAuthenticatedUserId()).toBe('native-user')
 })
})
