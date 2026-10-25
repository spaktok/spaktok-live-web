import {beforeEach,describe,expect,it,vi} from 'vitest'
import {NextRequest} from 'next/server'
vi.mock('server-only',()=>({}))
vi.mock('@/lib/native/auth',()=>({getNativeUser:vi.fn()}))
vi.mock('@/lib/native/d1',()=>({queryD1:vi.fn(),validId:(v:unknown)=>typeof v==='string'&&v.length===36}))
import {getNativeUser} from '@/lib/native/auth'
import {queryD1} from '@/lib/native/d1'
import {GET,POST} from './route'

describe('native D1 feed policy',()=>{
 beforeEach(()=>{vi.clearAllMocks();vi.mocked(getNativeUser).mockResolvedValue(null);vi.mocked(queryD1).mockResolvedValue({rows:[],changes:0})})
 it('does not show following feed without login',async()=>{
   const response=await GET(new NextRequest('https://app.test/api/feed?source=following'))
   expect(response.status).toBe(401)
   expect(queryD1).not.toHaveBeenCalled()
 })
 it('uses published-only SQL for public feed',async()=>{
   const response=await GET(new NextRequest('https://app.test/api/feed?source=forYou'))
   expect(response.status).toBe(200)
   expect(vi.mocked(queryD1).mock.calls[0][0]).toContain("v.status='published'")
   expect(await response.json()).toEqual({videos:[],nextCursor:null})
 })
 it('rejects unauthenticated likes',async()=>{
   const request=new NextRequest('https://app.test/api/feed',{
     method:'POST',headers:{origin:'https://app.test','content-type':'application/json'},
     body:JSON.stringify({videoId:'01234567-89ab-4def-8abc-0123456789ab',liked:true}),
   })
   expect((await POST(request)).status).toBe(401)
 })
})
