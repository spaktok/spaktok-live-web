import {generateText,Output} from 'ai'
import {getNativeUser,rateLimit} from '@/lib/native/auth'
import {
 agentRequestSchema,agentStepSchema,validateAgentStep,
} from '@/lib/filter-engine/spaktok-director-agent-contract'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=20
const noCache={'cache-control':'private,no-store','x-content-type-options':'nosniff'} as const
const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:noCache})
const active=()=>process.env.SPAKTOK_DIRECTOR_AGENT_ENABLED==='true'

/** Capability read is truthful: if disabled or unauthenticated, the UI
 * must say "rule-based" rather than impersonating a working AI agent. */
export async function GET(){
 if(!active())return reply({enabled:false,reason:'agent_not_configured'})
 const user=await getNativeUser().catch(()=>null)
 return reply({enabled:!!user,reason:user?'ready':'login_required'})
}
/** One bounded agent decision. The next turn includes REAL observations
 * returned by browser-local tools; model never executes arbitrary code.
 * No GLB bytes or personal source filenames are sent to this endpoint.
 */
export async function POST(request:Request){
 if(!active())return reply({error:'agent_disabled'},503)
 const origin=request.headers.get('origin')
 if(origin!==new URL(request.url).origin||
    request.headers.get('sec-fetch-site')==='cross-site')
  return reply({error:'invalid_origin'},403)
 const length=Number(request.headers.get('content-length'))
 if(!Number.isSafeInteger(length)||length<2||length>235000)
  return reply({error:'payload_limit'},413)
 const raw=await request.text().catch(()=>'')
 if(raw.length>235000)return reply({error:'payload_limit'},413)
 let data:unknown
 try{data=JSON.parse(raw)}catch{return reply({error:'invalid_json'},422)}
 const parsed=agentRequestSchema.safeParse(data)
 if(!parsed.success)return reply({error:'bad_agent_request'},422)
 const user=await getNativeUser().catch(()=>null)
 if(!user)return reply({error:'login_required'},401)
 // At most 30 model decisions per authenticated user per 15 minute bucket,
 // plus a six-step hard limit in the client. AI model calls cost money.
 const allowed=await rateLimit('director-agent:'+user.id,30).catch(()=>false)
 if(!allowed)return reply({error:'agent_budget_limit'},429)
 const input=parsed.data
 // Optional one-time opt-in, heavily downsized camera/image preview.
 let image:Buffer|null=null
 if(input.imagePreview){
  if(input.originalSource!=='image'||input.steps.length!==0)
   return reply({error:'unexpected_image_preview'},422)
  if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(input.imagePreview))
   return reply({error:'invalid_preview_format'},422)
  image=Buffer.from(input.imagePreview.split(',')[1],'base64')
  if(image.length<100||image.length>165000)
   return reply({error:'invalid_preview_length'},413)
 }
 try{
  const instruction=JSON.stringify({
   goal:input.prompt,source:input.originalSource,
   currentAsset:input.workingSource,
   executedToolObservations:input.steps,
   availableActions:{
    inspect_asset:'Inspect existing GLB: actual mesh, UV, PBR and phone QA.',
    generate_relief:'Create real LOCAL 2.5D shallow textured GLB. ONLY if user EXPLICITLY asks 2.5D or relief.',
    generate_3d_gpu:'Generate real full 3D image-to-GLB on owner private GPU. ALWAYS requires explicit image transfer/paid credit consent, and may be offline.',
    recolor_asset:'Really recolor an existing static GLB with a named material preset. ONLY if user asks for that exact color.',
    dispatch_asset:'Verify SHA256 and send SAME real GLB to six specialist private draft previews.',
    finish:'Finish based on tool observations ONLY, or explain a needed source. No fake artifacts.',
   },
  })
  const messages:[{role:'user';content:string|Array<
   {type:'text';text:string}|{type:'image';image:Buffer}
  >}]=[{role:'user',content:image?[
   {type:'text',text:instruction},
   {type:'image',image},
  ]:instruction}]
  const response=await generateText({
   model:'google/gemini-3-flash',
   output:Output.object({schema:agentStepSchema}),
   system:`You are Spaktok AI Director, an actual tool-using creative agent.
You control ONLY the actions exposed in the JSON instruction; no invented APIs.
Each call chooses EXACTLY ONE next action after examining real past tool
observations; tool execution happens in the creator browser, then the browser
returns an observation for your next decision.
First evaluate whether an input is available and what should be done.
For an existing GLB, inspect_asset before dispatch_asset, unless
the user explicitly requests a material recolor; then recolor, inspect,
dispatch. For images, choose generate_3d_gpu for full-360 requests,
or generate_relief ONLY if explicitly asked for 2.5D relief, then inspect
and dispatch. A blocked GPU is not an invitation to silently make 2.5D.
After successful dispatch, choose finish. Never claim that text alone
created a model, rig, animation, live stream, video export or filter.
The six internal targets: avatar, live, filter, gift, world, video.
Choose only applicable targets from the creator's wording. If the creator
says all studios, include all six. Do not hallucinate photo content;
if an image preview is present you may infer visible NON-SENSITIVE subject
for choosing departments, without identifying any real person.
The photo is private and the model is only authorized to look at this
downsized preview when its owner opted in. Never request personal identity.
Do not execute publishing, transfers, payments or streaming.
Keep reply concise in Arabic; honest about which features remain pending.
Do not retry a previously failed tool endlessly, especially paid GPU.
All tool decisions remain subject to policy gates and owner consent.`,
   messages,
   temperature:0,
   abortSignal:AbortSignal.timeout(15000),
  })
  const step=agentStepSchema.parse(response.output)
  const policy=validateAgentStep(step,input)
  if(!policy.ok)return reply({error:'agent_policy_rejected',reason:policy.reason},422)
  return reply({enabled:true,step,modelDriven:true,sourceVision:image!==null})
 }catch{
  return reply({error:'model_unavailable'},503)
 }
}
