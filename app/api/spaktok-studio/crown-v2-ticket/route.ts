import 'server-only'
import {NextRequest,NextResponse} from 'next/server'
import {createPrivateKey,sign} from 'node:crypto'
import {getNativeUser} from '@/lib/native/auth'
import {studioPilotOwnerId} from '@/lib/server/spaktok-studio-pilot-config'

export const runtime='nodejs'
export const dynamic='force-dynamic'

const DOMAIN='spaktok-crown-v2-owner-filter-v1'
const WORKER='spaktok-crown-v2-filter.spaktok.workers.dev'
const SHA256='ee5ec583041a9e2b55e31f718e42670ba5526d2cccfa249b549dece4ad81f129'
const BYTES=3324548
const json=(body:unknown,status=200)=>NextResponse.json(body,{
 status,headers:{'cache-control':'private,no-store','x-content-type-options':'nosniff'}
})

/** Called ONLY by owner-authenticated local camera. No user-controlled R2 keys. */
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==req.nextUrl.origin||
    req.headers.get('sec-fetch-site')==='cross-site')return json({error:'invalid_origin'},403)
 if(process.env.SPAKTOK_CROWN_V2_DRAFT_ENABLED!=='true')return json({error:'draft_not_enabled'},503)
 const owner=studioPilotOwnerId(process.env)
 if(!owner)return json({error:'owner_not_configured'},503)
 const user=await getNativeUser().catch(()=>null)
 if(!user)return json({error:'login_required'},401)
 if(user.id.toLowerCase()!==owner)return json({error:'owner_only'},403)
 if(req.nextUrl.protocol!=='https:')return json({error:'https_required'},403)
 const key=process.env.SPAKTOK_CROWN_V2_SIGNING_KEY
 if(!key||key.length>8192)return json({error:'signing_unavailable'},503)
 try{
  const privateKey=createPrivateKey(Buffer.from(key,'base64').toString('utf8'))
  if(privateKey.asymmetricKeyType!=='ed25519')throw Error('invalid_signer_type')
  const expiry=String(Math.floor(Date.now()/1000)+60)
  const origin=req.nextUrl.origin
  const message=[DOMAIN,'GET',user.id,'crown-v2',expiry,origin].join('\n')
  const signature=sign(null,Buffer.from(message),privateKey).toString('base64url')
  return json({
   private:true,draft:true,livePublished:false,
   url:'https://'+WORKER+'/v1/crown-v2/draft.glb',
   bytes:BYTES,sha256:SHA256,fileName:'spaktok-royal-crown-v2-draft.glb',
   headers:{
    'X-Spaktok-Crown-User':user.id,
    'X-Spaktok-Crown-Expires':expiry,
    'X-Spaktok-Crown-Signature':signature,
   },
   expiresAt:new Date(Number(expiry)*1000).toISOString(),
  })
 }catch{return json({error:'signing_unavailable'},503)}
}
