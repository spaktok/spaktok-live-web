import 'server-only'
import {createHash,createHmac} from 'node:crypto'

const ADDRESS='https://spaktok-word-rodin.spaktok.workers.dev'
export const WORD_MAX_SOURCE_BYTES=8*1024*1024
const JOB=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
function config(){
 const endpoint=process.env.SPAKTOK_WORD_WORKER_URL
 const secret=process.env.SPAKTOK_WORD_SIGNING_SECRET
 if(endpoint!==ADDRESS||!secret||secret.length<40)return null
 return {endpoint,secret}
}
export function wordGatewayConfigured(){return Boolean(config())}
export function signWordRequest(args:{
 secret:string;owner:string;method:'GET'|'POST';path:string
 body?:ArrayBuffer;metadata?:Record<string,unknown>;expires?:string
}){
 const expires=args.expires??String(Math.floor(Date.now()/1000)+60)
 const hash=args.body?createHash('sha256').update(Buffer.from(args.body)).digest('hex'):''
 const info=args.metadata?Buffer.from(JSON.stringify(args.metadata),'utf8').toString('base64url'):''
 const payload=[args.method,args.path,args.owner,expires,hash,info].join('\n')
 const signature=createHmac('sha256',args.secret).update(payload).digest('hex')
 return {
  'x-word-owner':args.owner,'x-word-expires':expires,
  'x-word-info':info,'x-word-signature':signature,
 }
}
export async function callWordWorker(args:{
 owner:string;method:'GET'|'POST';path:string;body?:ArrayBuffer
 metadata?:Record<string,unknown>
}):Promise<Response>{
 const cfg=config()
 if(!cfg)throw Error('word_backend_unconfigured')
 if(!JOB.test(args.owner)||!/^\/v1\/jobs(?:\/[a-f\d-]{36}(?:\/asset)?)?$/.test(args.path))
  throw Error('word_invalid_gateway_route')
 const headers=signWordRequest({...args,secret:cfg.secret})
 const response=await fetch(cfg.endpoint+args.path,{
  method:args.method,headers:{
   ...headers,
   ...(args.body?{'content-type':'application/octet-stream',
    'content-length':String(args.body.byteLength)}:{}),
  },body:args.method==='POST'?(args.body??null):undefined,
  cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000),
 })
 return response
}
