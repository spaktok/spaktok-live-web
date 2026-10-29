import 'server-only'
import {createHash,createPrivateKey,createPublicKey,sign} from 'node:crypto'
import {agentStepSchema,type AgentStep} from '@/lib/filter-engine/spaktok-director-agent-contract'

const DOMAIN='spaktok-director-ai-step-v1'
const URL='https://spaktok-director-ai.spaktok.workers.dev/v1/agent/step'
const PUBLIC_PROVIDER='cloudflare-workers-ai'
// The SAME signing identity must be configured on server and deployed Worker.
// An incorrect environment secret MUST fail closed before any LLM billing.
const DEPLOYED_SIGNER_SPKI='MCowBQYDK2VwAyEAN/tgkUKQRZ7J3fpryNYw3JFrK8OqQOxPpZDp05LcsLw='
const PAYLOAD_MAX=8000

export function freeCloudflareAgentConfigured():boolean{
 return process.env.SPAKTOK_DIRECTOR_AGENT_PROVIDER==='cloudflare'&&
  !!process.env.SPAKTOK_D1_BRIDGE_SIGNING_KEY
}
/** Read-only provider probe; does not consume LLM neurons.
 * Do not label the chat "AI connected" merely because env flags exist.
 * Both the configured signing identity and the deployed model must match.
 */
export async function cloudflareAgentReadiness():Promise<boolean>{
 if(!freeCloudflareAgentConfigured())return false
 try{
  const secret=process.env.SPAKTOK_D1_BRIDGE_SIGNING_KEY
  if(!secret)return false
  const key=createPrivateKey(Buffer.from(secret,'base64').toString('utf8'))
  const publicKey=createPublicKey(key).export({type:'spki',format:'der'})
  if(!Buffer.isBuffer(publicKey)||
     publicKey.toString('base64')!==DEPLOYED_SIGNER_SPKI)
   return false
  const response=await fetch(
   'https://spaktok-director-ai.spaktok.workers.dev/health',{
    method:'GET',cache:'no-store',redirect:'error',
    signal:AbortSignal.timeout(4000),
   })
  if(!response.ok)return false
  const result:unknown=await response.json()
  if(!result||typeof result!=='object')return false
  const health=result as Record<string,unknown>
  return health.ok===true&&health.auth==='signed-server-only'&&
   health.provider==='cloudflare-workers-ai'&&
   health.model==='@cf/meta/llama-3.3-70b-instruct-fp8-fast'
 }catch{return false}
}

/** Sign a domain-separated SHA256 of exactly the bytes sent to Workers AI.
 * No API keys are passed to users, browser or the Cloudflare Worker.
 */
export function signCloudflareAgentInstruction(
 system:string,instruction:string,
):{body:string;headers:Record<string,string>}{
 if(system.length>3500||instruction.length>7000)
  throw Error('director_cloudflare_prompt_too_large')
 const body=JSON.stringify({system,instruction})
 if(Buffer.byteLength(body,'utf8')>PAYLOAD_MAX)
  throw Error('director_cloudflare_payload_too_large')
 const secret=process.env.SPAKTOK_D1_BRIDGE_SIGNING_KEY
 if(!secret)throw Error('director_cloudflare_server_key_missing')
 const expires=String(Math.floor(Date.now()/1000)+45)
 const digest=createHash('sha256').update(body,'utf8').digest('hex')
 const canonical=[DOMAIN,digest,expires].join('\n')
 const key=createPrivateKey(Buffer.from(secret,'base64').toString('utf8'))
 const currentPublic=createPublicKey(key).export({type:'spki',format:'der'})
 if(!Buffer.isBuffer(currentPublic)||
    currentPublic.toString('base64')!==DEPLOYED_SIGNER_SPKI)
  throw Error('director_cloudflare_signer_key_mismatch')
 const signature=sign(null,Buffer.from(canonical,'utf8'),key).toString('base64url')
 return {body,headers:{
  'content-type':'application/json',
  'x-spaktok-director-expires':expires,
  'x-spaktok-director-signature':signature,
 }}
}
export async function requestCloudflareFreeAgentStep(
 system:string,instruction:string,
):Promise<{step:AgentStep;neurons:number|null;provider:string}>{
 if(!freeCloudflareAgentConfigured())throw Error('free_agent_not_configured')
 const payload=signCloudflareAgentInstruction(system,instruction)
 const response=await fetch(URL,{
  method:'POST',headers:payload.headers,body:payload.body,
  cache:'no-store',redirect:'error',signal:AbortSignal.timeout(16000),
 })
 if(!response.ok)throw Error('free_agent_http_'+response.status)
 const received:unknown=await response.json()
 if(!received||typeof received!=='object')
  throw Error('free_agent_empty_response')
 const typed=received as Record<string,unknown>
 const step=agentStepSchema.parse(typed.step)
 const usage=typed.usage
 let neurons:number|null=null
 if(usage&&typeof usage==='object'&&
    typeof (usage as Record<string,unknown>).neurons==='number')
  neurons=(usage as {neurons:number}).neurons
 return {step,neurons,provider:PUBLIC_PROVIDER}
}
