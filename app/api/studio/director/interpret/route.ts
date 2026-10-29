import {generateText,Output} from 'ai'
import {z} from 'zod'
import {getNativeUser,rateLimit} from '@/lib/native/auth'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=20
const target=z.enum(['avatar','live','filter','gift','world','video'])
const input=z.object({
 prompt:z.string().trim().min(2).max(1000),
 source:z.enum(['image','glb','none']),
}).strict()
const output=z.object({
 targets:z.array(target).min(1).max(6),
 intentSummary:z.string().max(250),
 mode:z.enum(['reuse-glb','full-360','local-relief','needs-source']),
 clarification:z.string().max(300),
})
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{
 'cache-control':'private,no-store','x-content-type-options':'nosniff',
}})
/** Optional AI interpretation of TEXT ONLY. Actual asset operations are
 * entirely separate, subject to source verification, paid-GPU consent,
 * account quotas and rights validation. Disable by default to avoid costs.
 */
export async function POST(request:Request){
 if(process.env.SPAKTOK_DIRECTOR_LLM_ENABLED!=='true')
  return reply({error:'director_llm_offline'},503)
 if(request.headers.get('origin')!==new URL(request.url).origin||
    request.headers.get('sec-fetch-site')==='cross-site')
  return reply({error:'invalid_origin'},403)
 const declared=Number(request.headers.get('content-length'))
 if(!Number.isSafeInteger(declared)||declared<2||declared>2048)
  return reply({error:'invalid_body_size'},413)
 const raw=await request.text().catch(()=>'')
 if(raw.length>2048)return reply({error:'invalid_body_size'},413)
 const parsed=input.safeParse((()=>{try{return JSON.parse(raw)}catch{return null}})())
 if(!parsed.success)return reply({error:'invalid_prompt'},422)
 const user=await getNativeUser().catch(()=>null)
 if(!user)return reply({error:'login_required'},401)
 const allowed=await rateLimit('studio-director-llm:'+user.id,12).catch(()=>false)
 if(!allowed)return reply({error:'director_llm_rate_limited'},429)
 try{
  const response=await generateText({
   model:'google/gemini-3-flash',
   output:Output.object({schema:output}),
   system:`You are the private Spaktok creative studio INTENT PARSER, not a 3D model generator.
Spaktok has six internal specialist targets: avatar, live, filter, gift, world, video.
Classify the user request in Arabic, German or English. Never guess what is actually
depicted in a photo: you receive only user's text and whether a source is attached.
If user asks for all studios, return all six targets.
For GLB use mode reuse-glb; for no source use needs-source; for an image use
full-360 unless the user explicitly requests shallow 2.5D/relief.
You may NOT authorize payment, image upload, live streaming, adult avatar face rig,
publishing, gifts payments, or camera tracking. You only return routing metadata.
"intentSummary" should be a very short Arabic explanation and "clarification"
should specify what the tool will need or which special rigging/animation
remains unfinished. Never claim a GLB/rig/filter/video has been produced.`,
   prompt:JSON.stringify(parsed.data),
  })
  const validated=output.parse(response.output)
  return reply({ok:true,interpretation:validated,source:'private-llm-text-only'})
 }catch{
  return reply({error:'director_llm_unavailable'},503)
 }
}
