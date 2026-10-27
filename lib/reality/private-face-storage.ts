import 'server-only'
import {createPrivateKey,sign} from 'node:crypto'
import {validId} from '@/lib/native/d1'

export const PRIVATE_FACE_WORKER_HOST='spaktok-private-face-assets.spaktok.workers.dev'
import {PRIVATE_FACE_MAX_BYTES} from './private-face-glb'
export {PRIVATE_FACE_MAX_BYTES,validatePrivateFaceGlb} from './private-face-glb'
const DOMAIN='spaktok-face-draft-v1'
export type PrivateFaceMethod='GET'|'PUT'|'DELETE'

export function privateFaceAvailable(){
 return Boolean(process.env.SPAKTOK_D1_BRIDGE_SIGNING_KEY&&
  process.env.SPAKTOK_D1_BRIDGE_URL)
}
export function privateFaceWorkerRequest(
 method:PrivateFaceMethod,userId:string,assetId:string,size=0,
):{url:string;headers:Record<string,string>}{
 if(!validId(userId)||!validId(assetId))throw Error('private_face_bad_identity')
 if(method==='PUT'&&(!Number.isSafeInteger(size)||size<64||size>PRIVATE_FACE_MAX_BYTES))
  throw Error('private_face_bad_size')
 if(method!=='PUT'&&size!==0)throw Error('private_face_bad_read_size')
 const base64=process.env.SPAKTOK_D1_BRIDGE_SIGNING_KEY
 if(!base64)throw Error('private_face_unconfigured')
 const key=createPrivateKey(Buffer.from(base64,'base64').toString('utf8'))
 const expiry=(Math.floor(Date.now()/1000)+90).toString()
 const payload=[DOMAIN,method,userId,assetId,String(size),expiry].join('\n')
 const signature=sign(null,Buffer.from(payload),key).toString('base64url')
 return {
  url:`https://${PRIVATE_FACE_WORKER_HOST}/v1/face/${userId}/${assetId}.glb`,
  headers:{
   'X-SpakTok-Face-Signature':signature,
   'X-SpakTok-Face-Expires':expiry,
   ...(method==='PUT'?{'Content-Type':'model/gltf-binary'}:{}),
  },
 }
}

