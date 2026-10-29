import 'server-only'
import {createPrivateKey,sign} from 'node:crypto'
import {validId} from '@/lib/native/d1'

const HOST='spaktok-private-studio-assets.spaktok.workers.dev'
const DOMAIN='spaktok-studio-draft-v1'
const MAX_BYTES=15*1024*1024
const SHA=/^[a-f0-9]{64}$/
export type StudioStorageMethod='GET'|'PUT'|'HEAD'|'DELETE'
export const STUDIO_PRIVATE_R2_MAX_BYTES=MAX_BYTES

/** Disabled by default until the new Worker, R2 binding and auth are verified.
 * Requires an exact HTTPS web origin in the Worker setting; no public R2.dev.
 */
export function studioPrivateR2Available():boolean{
 return process.env.SPAKTOK_STUDIO_R2_ENABLED==='true'&&
  !!process.env.SPAKTOK_D1_BRIDGE_SIGNING_KEY&&
  !!process.env.SPAKTOK_D1_BRIDGE_URL
}
export function signStudioPrivateR2Request(
 method:StudioStorageMethod,userId:string,id:string,
 size:number,sha256:string,
):{url:string;headers:Record<string,string>}{
 if(!validId(userId)||!validId(id)||!SHA.test(sha256)||
  !Number.isSafeInteger(size)||size<128||size>MAX_BYTES||
  !['GET','HEAD','PUT','DELETE'].includes(method))
  throw Error('studio_r2_bad_claims')
 const secret=process.env.SPAKTOK_D1_BRIDGE_SIGNING_KEY
 if(!secret)throw Error('studio_r2_missing_signer')
 const key=createPrivateKey(Buffer.from(secret,'base64').toString('utf8'))
 const expires=String(Math.floor(Date.now()/1000)+90)
 const message=[DOMAIN,method,userId,id,sha256,String(size),expires].join('\n')
 const signature=sign(null,Buffer.from(message),key).toString('base64url')
 return {
  url:`https://${HOST}/v1/studio/${userId}/${id}.glb`,
  headers:{
   'X-SpakTok-Studio-Signature':signature,
   'X-SpakTok-Studio-Expires':expires,
   'X-SpakTok-Studio-Sha256':sha256,
   'X-SpakTok-Studio-Size':String(size),
   ...(method==='PUT'?{'Content-Type':'model/gltf-binary'}:{}),
  },
 }
}
