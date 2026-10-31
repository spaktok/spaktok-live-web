import 'server-only'
import {NextRequest,NextResponse} from 'next/server'
import {sign} from 'node:crypto'
import {getNativeUser} from '@/lib/native/auth'
import {studioPilotOwnerId,studioPilotReadiness,studioPilotSigner} from '@/lib/server/spaktok-studio-pilot-config'
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
/** Browser-side readiness distinguishes a configured signer from a
 * fully verified, deployed Cloudflare delivery route. Never expose
 * owner IDs, private keys or signed URLs through this endpoint.
 */
export async function GET(){
 const readiness=studioPilotReadiness(process.env)
 if(readiness!=='server_preconditions_met')
  return json({enabled:false,reason:'pilot_operator_not_configured',
   workerVerified:false,private:true})
 const user=await getNativeUser().catch(()=>null)
 if(!user)return json({enabled:false,reason:'pilot_sign_in_required',
  workerVerified:false,private:true})
 if(user.id.toLowerCase()!==studioPilotOwnerId(process.env))
  return json({enabled:false,reason:'pilot_owner_only',
   workerVerified:false,private:true})
 return json({enabled:true,reason:'server_signer_configured',
  workerVerified:false,private:true})
}

export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==req.nextUrl.origin||
    req.headers.get('sec-fetch-site')==='cross-site')
  return json({error:'invalid_origin'},403)
 if(studioPilotReadiness(process.env)!=='server_preconditions_met')
  return json({error:'pilot_not_configured'},503)
 const user=await getNativeUser().catch(()=>null)
 if(!user)return json({error:'unauthorized'},401)
 if(user.id.toLowerCase()!==studioPilotOwnerId(process.env))
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
 try{
  const expiry=String(Math.floor(Date.now()/1000)+60)
  const privateKey=studioPilotSigner(process.env)
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
