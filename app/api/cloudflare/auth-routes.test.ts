import {describe,it,expect} from 'vitest'
import {GET as getMessages,POST as postMessage} from './messages/route'
import {GET as getConversations} from './conversations/route'
describe('retired Supabase-dependent API routes',()=>{
 it('requires native chat endpoint instead of using old Cloudflare binding',async()=>{
   expect((await getConversations()).status).toBe(410)
   expect((await getMessages()).status).toBe(410)
   expect((await postMessage()).status).toBe(410)
 })
})
