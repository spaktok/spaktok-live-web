import {NextRequest,NextResponse} from 'next/server'
import {generateImage} from 'ai'
import {getNativeUser,rateLimit} from '@/lib/native/auth'
import {
 FORGE_TEXT_IMAGE_MAX_BYTES,FORGE_TEXT_IMAGE_MIME,FORGE_TEXT_IMAGE_MODEL,
 buildForgeConceptPrompt,normalizeForgeTextPrompt,
} from '@/lib/server/spaktok-forge-text-image'

/** Text-to-3D step 1: text -> concept image via AI Gateway. The user reviews
 * the image in the studio, then it feeds the existing A100 TRELLIS.2 job. */
export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=120

const headers={'cache-control':'private,no-store','x-content-type-options':'nosniff'}
const fail=(error:string,status:number)=>NextResponse.json({error},{status,headers})

export async function POST(request:NextRequest){
 if(request.headers.get('origin')!==request.nextUrl.origin||
  request.headers.get('sec-fetch-site')==='cross-site')
  return fail('forge_invalid_origin',403)
 if(Number(request.headers.get('content-length')??0)>4096)
  return fail('forge_text_payload_too_large',413)

 const body=await request.json().catch(()=>null)
 const subject=normalizeForgeTextPrompt(body?.prompt)
 if(!subject)return fail('forge_text_prompt_invalid',422)

 let user
 try{user=await getNativeUser()}catch{return fail('forge_auth_unavailable',503)}
 if(!user)return fail('forge_auth_required',401)
 try{
  if(!await rateLimit('forge-text-image:'+user.id,6))
   return fail('forge_request_rate_limited',429)
 }catch{return fail('forge_budget_database_unavailable',503)}

 try{
  const {image}=await generateImage({
   model:FORGE_TEXT_IMAGE_MODEL,
   prompt:buildForgeConceptPrompt(subject),
   size:'1024x1024',
   abortSignal:request.signal,
  })
  const type=(FORGE_TEXT_IMAGE_MIME as readonly string[]).includes(image.mediaType)?
   image.mediaType:'image/png'
  if(image.uint8Array.byteLength<128||image.uint8Array.byteLength>FORGE_TEXT_IMAGE_MAX_BYTES)
   return fail('forge_text_image_size_invalid',502)
  return new NextResponse(Buffer.from(image.uint8Array),{
   status:200,headers:{...headers,'content-type':type},
  })
 }catch{
  return fail('forge_text_image_failed',502)
 }
}
