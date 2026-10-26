import {NextRequest,NextResponse} from 'next/server'
import {createPrivateKey,randomBytes,sign} from 'node:crypto'
import {getNativeUser, nativeAuthReady} from '@/lib/native/auth'
import {queryD1} from '@/lib/native/d1'
export const runtime='nodejs'
export const dynamic='force-dynamic'

const MAX_BYTES=20*1024*1024
const MAX_DAILY=5
const ACCEPTED=['video/mp4','video/webm']
const HOST='spaktok-media-upload.spaktok.workers.dev'
const json=(v:unknown,status=200)=>NextResponse.json(v,{status,headers:{'Cache-Control':'private,no-store'}})
function configured():boolean{
 return process.env.SPAKTOK_R2_UPLOADS_ENABLED==='true'&&nativeAuthReady()&&
  Boolean(process.env.SPAKTOK_D1_BRIDGE_SIGNING_KEY)
}
export async function GET(){
 return json({enabled:configured(),maxBytes:MAX_BYTES,maxDaily:MAX_DAILY})
}
export async function POST(req:NextRequest){
 if(!configured())return json({error:'upload_not_configured'},503)
 if(req.headers.get('origin')!==req.nextUrl.origin||
    req.headers.get('sec-fetch-site')==='cross-site')return json({error:'invalid_origin'},403)
 if(Number(req.headers.get('content-length')||0)>4096)return json({error:'invalid_request'},413)
 let body:unknown
 try{body=await req.json()}catch{return json({error:'invalid_json'},400)}
 if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'invalid_video'},400)
 const b=body as Record<string,unknown>
 const mime=b.mimeType,bytes=b.bytes
 if(!ACCEPTED.includes(String(mime))||typeof bytes!=='number'||!Number.isSafeInteger(bytes)||
    bytes<1024||bytes>MAX_BYTES)return json({error:'invalid_video'},400)
 try{
  const user=await getNativeUser()
  if(!user)return json({error:'unauthorized'},401)
  const id=crypto.randomUUID(),nonce=randomBytes(16).toString('hex')
  const key='drafts/'+user.id+'/'+id
  const reserved=await queryD1<{id:string}>(`
    INSERT INTO media_uploads(id,user_id,object_key,nonce,bytes,mime_type)
    SELECT ?,?,?,?,?,?
    WHERE (SELECT count(*) FROM media_uploads WHERE user_id=? AND created_at >= datetime('now','-1 day')) < ?
    RETURNING id`,[id,user.id,key,nonce,bytes,String(mime),user.id,MAX_DAILY])
  if(!reserved.rows.length)return json({error:'daily_limit',maxDaily:MAX_DAILY},429)
  const expiry=(Math.floor(Date.now()/1000)+600).toString()
  const text=[id,user.id,String(bytes),String(mime),expiry,nonce].join('\n')
  const keyBytes=Buffer.from(process.env.SPAKTOK_D1_BRIDGE_SIGNING_KEY!,'base64').toString('utf8')
  const signature=sign(null,Buffer.from(text,'utf8'),createPrivateKey(keyBytes)).toString('base64url')
  const url=new URL('https://'+HOST+'/upload')
  for(const [k,v] of Object.entries({id,user:user.id,bytes:String(bytes),mime:String(mime),expiry,nonce,signature}))
    url.searchParams.set(k,v)
  return json({reservationId:id,uploadURL:url.toString(),maxBytes:MAX_BYTES,expiresInSeconds:600},201)
 }catch{return json({error:'upload_unavailable'},503)}
}
