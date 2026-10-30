import 'server-only'
import {NextRequest,NextResponse} from 'next/server'
import {createPrivateKey,sign} from 'node:crypto'
import {getNativeUser} from '@/lib/native/auth'
import {validId} from '@/lib/native/d1'
import {
 SPAKTOK_FIRST_GPU_LODS,isSpaktokFirstLodId,
} from '@/lib/filter-engine/spaktok-first-gpu-lods'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const DOMAIN='spaktok-studio-pilot-read-v1'
const WORKER='spaktok-private-studio-asset.spaktok.workers.dev'
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{
 'cache-control':'private,no-store','x-content-type-options':'nosniff',
}})
const configured=()=>
 process.env.SPAKTOK_STUDIO_PILOT_ENABLED==='true' &&
 validId(process.env.SPAKTOK_STUDIO_PILOT_OWNER_ID??'') &&
 Boolean(process.env.SPAKTOK_D1_BRIDGE_SIGNING_KEY)

export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==req.nextUrl.origin||
    req.headers.get('sec-fetch-site')==='cross-site')
  return json({error:'invalid_origin'},403)
 if(!configured())return json({error:'pilot_not_configured'},503)
 const user=await getNativeUser().catch(()=>null)
 if(!user)return json({error:'unauthorized'},401)
 if(user.id!==process.env.SPAKTOK_STUDIO_PILOT_OWNER_ID)
  return json({error:'forbidden'},403)
 let assetId:unknown='lod0'
 try{
  const body=await req.text()
  if(body.length>256) return json({error:'invalid_lod_request'},422)
  assetId=JSON.parse(body).lod??'lod0'
 }catch{return json({error:'invalid_lod_request'},422)}
 if(!isSpaktokFirstLodId(assetId))
  return json({error:'invalid_lod_selection'},422)
 const variant=SPAKTOK_FIRST_GPU_LODS[assetId]
 const origin=req.nextUrl.origin
 if(!origin.startsWith('https://'))return json({error:'https_required'},403)
 const key64=process.env.SPAKTOK_D1_BRIDGE_SIGNING_KEY
 if(!key64)return json({error:'pilot_not_configured'},503)
 try{
  const expiry=String(Math.floor(Date.now()/1000)+60)
  const privateKey=createPrivateKey(Buffer.from(key64,'base64').toString('utf8'))
  const claim=[DOMAIN,'GET',user.id,assetId,expiry,origin].join('\n')
  const signature=sign(null,Buffer.from(claim),privateKey).toString('base64url')
  return json({
   url:'https://'+WORKER+'/v1/pilot/'+assetId+'.glb',
   lod:assetId,
   headers:{
    'X-Spaktok-Studio-Signature':signature,
    'X-Spaktok-Studio-Expires':expiry,
    'X-Spaktok-Studio-User':user.id,
   },
   fileName:variant.fileName,
   sha256:variant.sha256,
   bytes:variant.bytes,
   expiresAt:new Date(Number(expiry)*1000).toISOString(),
   private:true,
  })
 }catch{return json({error:'pilot_signing_unavailable'},503)}
}
