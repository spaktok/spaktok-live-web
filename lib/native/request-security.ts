import {isIP} from 'node:net'

/** Use only Vercel's proxy-owned client IP header for abuse limits.
 * Never trust an arbitrary X-Forwarded-For from the request sender.
 */
export function trustedVercelClientIp(headers:Pick<Headers,'get'>):string {
  const value=headers.get('x-vercel-forwarded-for')
  if(!value||value.length>256)return 'unknown'
  const first=value.split(',')[0]?.trim()||''
  return isIP(first) ? first.toLowerCase() : 'unknown'
}

export type LimitedJsonResult=
 | {ok:true;value:unknown}
 | {ok:false;reason:'too_large'|'invalid_json'}

/** Reject oversized HTTP bodies even with a forged/missing Content-Length.
 * Streams enforce the real byte limit before JSON parsing or DB access.
 */
export async function readLimitedJson(req:Request,maxBytes:number):Promise<LimitedJsonResult>{
  if(!Number.isSafeInteger(maxBytes)||maxBytes<1)throw Error('invalid_limit')
  const claimed=req.headers.get('content-length')
  if(claimed!==null&&/^\d+$/.test(claimed)&&Number(claimed)>maxBytes)
    return {ok:false,reason:'too_large'}
  const reader=req.body?.getReader()
  if(!reader)return {ok:false,reason:'invalid_json'}
  const chunks:Uint8Array[]=[]
  let size=0
  try{
    while(true){
      const {done,value}=await reader.read()
      if(done)break
      size+=value.byteLength
      if(size>maxBytes){
        await reader.cancel().catch(()=>{})
        return {ok:false,reason:'too_large'}
      }
      chunks.push(value)
    }
    const data=new Uint8Array(size)
    let at=0
    for(const chunk of chunks){data.set(chunk,at);at+=chunk.length}
    return {ok:true,value:JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data)) as unknown}
  }catch{return {ok:false,reason:'invalid_json'}}
  finally{reader.releaseLock()}
}
