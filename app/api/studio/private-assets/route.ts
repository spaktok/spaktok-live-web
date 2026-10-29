import {NextRequest,NextResponse} from 'next/server'
import {getNativeUser,rateLimit} from '@/lib/native/auth'
import {queryD1} from '@/lib/native/d1'
import {DIRECTOR_TARGETS,type DirectorTarget} from '@/lib/filter-engine/spaktok-ai-director'
import {
 studioPrivateR2Available,signStudioPrivateR2Request,
 STUDIO_PRIVATE_R2_MAX_BYTES,
} from '@/lib/server/spaktok-studio-private-r2'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const MAX_BODY=2048
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{
 'cache-control':'private,no-store','x-content-type-options':'nosniff',
}})
const sameOrigin=(r:NextRequest)=>
 r.headers.get('origin')===r.nextUrl.origin&&
 r.headers.get('sec-fetch-site')!=='cross-site'
type Draft={
 id:string;sha256:string;bytes:number;targets_json:string;
 created_at:string;status:string
}
export async function GET(){
 if(!studioPrivateR2Available())return json({configured:false},503)
 try{
  const user=await getNativeUser()
  if(!user)return json({error:'studio_login_required'},401)
  const d=await queryD1<Draft>(
   "SELECT id,sha256,bytes,targets_json,created_at,status FROM studio_asset_drafts WHERE user_id=? AND status='stored' ORDER BY created_at DESC LIMIT 10",
   [user.id])
  return json({configured:true,private:true,drafts:d.rows.map(row=>({
   id:row.id,sha256:row.sha256,bytes:row.bytes,
   targets:JSON.parse(row.targets_json) as DirectorTarget[],
   createdAt:row.created_at,
  }))})
 }catch{return json({error:'studio_drafts_unavailable'},503)}
}
export async function POST(req:NextRequest){
 if(!studioPrivateR2Available())return json({error:'studio_cloud_disabled'},503)
 if(!sameOrigin(req))return json({error:'invalid_origin'},403)
 const len=Number(req.headers.get('content-length')??0)
 if(!Number.isSafeInteger(len)||len<2||len>MAX_BODY)
  return json({error:'invalid_content_length'},413)
 let body:unknown
 try{const raw=await req.text();if(raw.length>MAX_BODY)throw Error('large');body=JSON.parse(raw)}
 catch{return json({error:'invalid_json'},422)}
 if(!body||typeof body!=='object'||Array.isArray(body))
  return json({error:'invalid_body'},422)
 const v=body as Record<string,unknown>
 const size=v.bytes,sha=v.sha256,targets=v.targets,rights=v.rights
 if(typeof sha!=='string'||!/^[a-f0-9]{64}$/.test(sha)||
  typeof size!=='number'||!Number.isSafeInteger(size)||
  size<128||size>STUDIO_PRIVATE_R2_MAX_BYTES||
  !['original','licensed'].includes(String(rights))||
  !Array.isArray(targets)||targets.length<1||
  targets.length>DIRECTOR_TARGETS.length||
  new Set(targets).size!==targets.length||
  !targets.every(t=>typeof t==='string'&&DIRECTOR_TARGETS.includes(t as DirectorTarget)))
  return json({error:'invalid_studio_asset_metadata'},422)
 try{
  const user=await getNativeUser()
  if(!user)return json({error:'studio_login_required'},401)
  if(!await rateLimit('studio-r2:'+user.id,5))
   return json({error:'studio_cloud_rate_limited'},429)
  const id=crypto.randomUUID()
  const objectKey='studio-drafts/'+user.id+'/'+id+'.glb'
  const result=await queryD1<{id:string}>(`
   INSERT INTO studio_asset_drafts
    (id,user_id,object_key,sha256,bytes,rights,targets_json,status)
   SELECT ?,?,?,?,?,?,?,'issued'
   WHERE (SELECT COUNT(*) FROM studio_asset_drafts
          WHERE user_id=? AND created_at>=datetime('now','-1 day'))<10
   RETURNING id`,[id,user.id,objectKey,sha,size,
    rights as string,JSON.stringify(targets),user.id])
  if(!result.rows.length)return json({error:'studio_daily_limit'},429)
  const ticket=signStudioPrivateR2Request('PUT',user.id,id,size,sha)
  return json({id,...ticket,expiresInSeconds:300,private:true,
   next:'confirm',note:'Opt-in private R2 upload, no public release.'},201)
 }catch{return json({error:'studio_cloud_reserve_failed'},503)}
}
