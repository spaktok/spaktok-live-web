import {NextResponse} from 'next/server'
import {privateFaceAvailable,privateFaceWorkerRequest} from '@/lib/reality/private-face-storage'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(){
 if(!privateFaceAvailable())return NextResponse.json({
  connected:false,error:'not_configured',
 },{status:503,headers:{'Cache-Control':'public,max-age=0,s-maxage=30'}})
 try{
  // Signed GET of a deliberately non-existent asset. A 404 from the Worker
  // proves its signature verifier accepted the Vercel production key and
  // the private bucket binding works; we never expose signing credentials.
  const user=crypto.randomUUID(),asset=crypto.randomUUID()
  const ticket=privateFaceWorkerRequest('GET',user,asset)
  const remote=await fetch(ticket.url,{headers:{
   ...ticket.headers,'User-Agent':'SpakTok-Server/1.0',
   'Accept':'application/json',
  },cache:'no-store',signal:AbortSignal.timeout(9000)})
  const connected=remote.status===404
  return NextResponse.json({connected,private:true,authVerified:connected},{
   status:connected?200:503,
   headers:{'Cache-Control':'public,max-age=0,s-maxage=30'},
  })
 }catch{return NextResponse.json({connected:false,error:'upstream_unavailable'},{
  status:503,headers:{'Cache-Control':'public,max-age=0,s-maxage=30'},
 })}
}
