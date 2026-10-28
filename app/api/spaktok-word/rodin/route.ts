import {NextRequest,NextResponse} from 'next/server'
import {getNativeUser} from '@/lib/native/auth'
import {
 callWordWorker,WORD_MAX_SOURCE_BYTES,wordGatewayConfigured,
} from '@/lib/server/spaktok-word-gateway'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const json=(body:unknown,status=200)=>NextResponse.json(body,{
 status,headers:{'cache-control':'private,no-store','x-content-type-options':'nosniff'},
})
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
function originAllowed(req:NextRequest){
 return req.headers.get('origin')===req.nextUrl.origin&&
  req.headers.get('sec-fetch-site')!=='cross-site'
}
function fixedCredits(){
 const n=Number(process.env.SPAKTOK_WORD_FIXED_CREDITS)
 return Number.isFinite(n)&&n>0&&n<=100?n:null
}
export async function GET(req:NextRequest){
 const quote=fixedCredits()
 const configured=wordGatewayConfigured()&&quote!==null
 if(req.nextUrl.searchParams.get('health')==='1')
  return json({configured,fixedCredits:configured?quote:null,
   model:'Gen-2.5-Medium',mesh:'Quad',material:'PBR',
   externalPaidGeneration:true,requiresExplicitApproval:true})
 if(!configured)return json({error:'word_backend_unconfigured'},503)
 try{
  const user=await getNativeUser()
  if(!user)return json({error:'unauthorized'},401)
  const id=req.nextUrl.searchParams.get('id')??''
  if(!UUID.test(id))return json({error:'invalid_job_id'},400)
  const asset=req.nextUrl.searchParams.get('asset')==='1'
  const response=await callWordWorker({
   owner:user.id,method:'GET',
   path:'/v1/jobs/'+id+(asset?'/asset':''),
  })
  if(asset){
   if(!response.ok)return json({error:'asset_not_ready'},response.status)
   return new Response(response.body,{
    status:200,headers:{'content-type':'model/gltf-binary',
     'content-disposition':'attachment; filename="spaktok-word-rodin.glb"',
     'cache-control':'private,no-store',
     'x-content-type-options':'nosniff'},
   })
  }
  return json(await response.json(),response.status)
 }catch{return json({error:'word_job_unavailable'},503)}
}
export async function POST(req:NextRequest){
 if(!originAllowed(req))return json({error:'invalid_origin'},403)
 const quote=fixedCredits()
 if(!wordGatewayConfigured()||quote===null)
  return json({error:'word_backend_unconfigured'},503)
 const size=Number(req.headers.get('content-length')??0)
 if(!Number.isSafeInteger(size)||size<128||
  size>WORD_MAX_SOURCE_BYTES+32*1024)
  return json({error:'request_too_large'},413)
 try{
  const user=await getNativeUser()
  if(!user)return json({error:'unauthorized'},401)
  const form=await req.formData()
  const file=form.get('image')
  if(!(file instanceof File)||file.size<128||
   file.size>WORD_MAX_SOURCE_BYTES)return json({error:'invalid_image'},422)
  const idem=form.get('idempotency')
  const rights=form.get('rights')
  const confirm=form.get('confirmCharge')
  const transfer=form.get('acceptTerms')
  const approved=Number(form.get('approvedCredits'))
  if(typeof idem!=='string'||!/^[a-zA-Z0-9_-]{12,70}$/.test(idem)||
   (rights!=='original'&&rights!=='licensed')||
   confirm!=='yes'||transfer!=='yes'||approved!==quote)
   return json({error:'explicit_approval_missing'},422)
  const metadata={
   idempotency:idem,rights,confirmCharge:true,acceptTerms:true,
   approvedCredits:quote,
   tier:'Gen-2.5-Medium',mesh:'Quad',quality:'medium',material:'PBR',
  }
  const response=await callWordWorker({
   owner:user.id,method:'POST',path:'/v1/jobs',
   body:await file.arrayBuffer(),metadata,
  })
  const data=await response.json()
  return json(data,response.status)
 }catch{return json({error:'word_submit_unavailable'},503)}
}
