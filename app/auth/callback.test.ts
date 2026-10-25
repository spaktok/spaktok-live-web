import {describe,expect,it} from 'vitest'
import {NextRequest} from 'next/server'
import {GET} from './callback/route'
describe('retired Supabase OAuth callback',()=>{
 it('redirects to safe home without honoring injected next values',async()=>{
   const res=await GET(new NextRequest('https://app.example.org/auth/callback?next=https://evil.test'))
   expect(res.status).toBe(307)
   expect(res.headers.get('location')).toBe('https://app.example.org/')
 })
})
