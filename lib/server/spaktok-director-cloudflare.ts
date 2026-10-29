import 'server-only'
import {createHash,createPrivateKey,sign} from 'node:crypto'
import {agentStepSchema,type AgentStep} from '@/lib/filter-engine/spaktok-director-agent-contract'

const DOMAIN='spaktok-director-ai-step-v1'
const URL='https://spaktok-director-ai.spaktok.workers.dev/v1/agent/step'
const PUBLIC_PROVIDER='cloudflare-workers-ai'
const PAYLOAD_MAX=8000

export function freeCloudflareAgentConfigured():boolean{
 return process.env.SPAKTOK_DIRECTOR_AGENT_PROVIDER==='cloudflare'&&
  !!process.env.SPAKTOK_D1_BRIDGE_SIGNING_KEY
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
