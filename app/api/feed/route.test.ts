import {beforeEach,describe,expect,it,vi} from 'vitest'
import {NextRequest} from 'next/server'
vi.mock('server-only',()=>({}))
vi.mock('@/lib/native/auth',()=>({getNativeUser:vi.fn()}))
vi.mock('@/lib/native/d1',()=>({queryD1:vi.fn(),validId:(v:unknown)=>typeof v==='string'&&v.length===36}))
import {getNativeUser} from '@/lib/native/auth'
import {queryD1} from '@/lib/native/d1'
import {GET,POST} from './route'

const feedRow=(overrides:Record<string,unknown>={})=>({
  id:'01234567-89ab-4def-8abc-0123456789ab',user_id:'99999999-9999-4999-8999-999999999999',
  username:'creator',display_name:'Creator',avatar_url:null,is_verified:0,
  media_url:'https://cdn.test/clip.mp4',thumbnail_url:null,description:'#spaktok',music:null,
  view_count:0,like_count:0,comment_count:0,share_count:0,
  created_at:new Date(Date.now()-3_600_000).toISOString(),liked:0,bookmarked:0,followed:0,
  ...overrides,
})

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
 it('ranks For You by engagement instead of pure recency',async()=>{
   const minutesAgo=(m:number)=>new Date(Date.now()-m*60_000).toISOString()
   const engaged=feedRow({id:'11111111-1111-4111-8111-111111111111',created_at:minutesAgo(60*24*20),like_count:5000,comment_count:400,view_count:90000})
   const brandNew=feedRow({id:'22222222-2222-4222-8222-222222222222',created_at:minutesAgo(10)})
   vi.mocked(queryD1).mockResolvedValue({rows:[brandNew,engaged],changes:0})
   const payload=await (await GET(new NextRequest('https://app.test/api/feed?source=forYou&limit=2'))).json()
   expect(payload.videos.map((v:{id:string})=>v.id)).toEqual([engaged.id,brandNew.id])
 })
 it('personalises For You from what the viewer liked',async()=>{
   vi.mocked(getNativeUser).mockResolvedValue({id:'88888888-8888-4888-8888-888888888888',email:'me@test.dev',username:'me'} as never)
   const cooking=feedRow({id:'11111111-1111-4111-8111-111111111111',description:'#طبخ'})
   const dance=feedRow({id:'22222222-2222-4222-8222-222222222222',description:'#رقص'})
   vi.mocked(queryD1)
     .mockResolvedValueOnce({rows:[{description:'#رقص',at:new Date().toISOString()}],changes:0} as never)
     .mockResolvedValueOnce({rows:[cooking,dance],changes:0})
   const payload=await (await GET(new NextRequest('https://app.test/api/feed?source=forYou&limit=2'))).json()
   expect(payload.videos.map((v:{id:string})=>v.id)).toEqual([dance.id,cooking.id])
 })
 it('keeps the feed working when the interest read fails',async()=>{
   vi.mocked(getNativeUser).mockResolvedValue({id:'88888888-8888-4888-8888-888888888888',email:'me@test.dev',username:'me'} as never)
   vi.mocked(queryD1)
     .mockRejectedValueOnce(new Error('native_database_unavailable'))
     .mockResolvedValueOnce({rows:[feedRow({id:'22222222-2222-4222-8222-222222222222'})],changes:0})
   const response=await GET(new NextRequest('https://app.test/api/feed?source=forYou'))
   expect(response.status).toBe(200)
   expect((await response.json()).videos).toHaveLength(1)
 })
 it('rejects a tampered ranked cursor before touching the database',async()=>{
   const response=await GET(new NextRequest('https://app.test/api/feed?source=forYou&cursor=not-a-cursor'))
   expect(response.status).toBe(400)
   expect(queryD1).not.toHaveBeenCalled()
 })
 it('pages the ranked feed without repeating a video',async()=>{
   const rows=[
     feedRow({id:'11111111-1111-4111-8111-111111111111',like_count:300}),
     feedRow({id:'22222222-2222-4222-8222-222222222222',like_count:200}),
     feedRow({id:'33333333-3333-4333-8333-333333333333',like_count:100}),
   ]
   vi.mocked(queryD1).mockResolvedValue({rows,changes:0})
   const first=await (await GET(new NextRequest('https://app.test/api/feed?source=forYou&limit=2'))).json()
   expect(first.videos).toHaveLength(2)
   expect(typeof first.nextCursor).toBe('string')
   const second=await (await GET(new NextRequest(`https://app.test/api/feed?source=forYou&limit=2&cursor=${encodeURIComponent(first.nextCursor)}`))).json()
   expect(second.videos).toHaveLength(1)
   expect(second.nextCursor).toBeNull()
   const seen=[...first.videos,...second.videos].map((v:{id:string})=>v.id)
   expect(new Set(seen).size).toBe(3)
 })
 it('rejects unauthenticated likes',async()=>{
   const request=new NextRequest('https://app.test/api/feed',{
     method:'POST',headers:{origin:'https://app.test','content-type':'application/json'},
     body:JSON.stringify({videoId:'01234567-89ab-4def-8abc-0123456789ab',liked:true}),
   })
   expect((await POST(request)).status).toBe(401)
 })
})
