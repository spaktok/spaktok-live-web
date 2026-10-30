/** Official Hi3D v3.0 REST client for one private paid smoke test.
 * No user-provided URLs, models, shell commands, unattended spending or
 * public publication. This file never reads credentials from a browser.
 * Docs: https://docs.hi3d.ai/en/api/api-reference/list/create-task
 */
import {createHash} from 'node:crypto'

export const HI3D_API_ROOT = 'https://api.hitem3d.ai'
export const HI3D_CDN_HOSTS = new Set(['hitem3dstatic.zaohaowu.net'])
export const HI3D_PLAN = Object.freeze({
  model: 'hi3dv3.0',
  resolution: '2048quality',
  requestType: '3',
  faces: '2000000',
  pbr: '1',
  shading: '0.5',
  format: '2', // GLB
  estimatedCredits: 45, // geometry=30 texture=10 PBR=5
})
export const MAX_INPUT_BYTES = 8 * 1024 * 1024
export const MAX_RESULT_BYTES = 256 * 1024 * 1024

export function imageMediaType(bytes, filename) {
  if (bytes.length < 128 || bytes.length > MAX_INPUT_BYTES)
    throw Error('hi3d_input_size_invalid')
  const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
  const jpg = bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff
  const webp = bytes.toString('ascii',0,4)==='RIFF' &&
    bytes.toString('ascii',8,12)==='WEBP'
  const type = png?'image/png':jpg?'image/jpeg':webp?'image/webp':null
  if (!type || !/\.(png|jpe?g|webp)$/i.test(filename))
    throw Error('hi3d_input_format_invalid')
  return type
}
function verifiedResponse(json) {
  if (!json || typeof json!=='object' || String(json.code)!=='200')
    throw Error('hi3d_provider_rejected_request')
  return json.data
}
async function jsonRequest(path, options, fetchImpl=fetch) {
  const url=HI3D_API_ROOT+path
  const response=await fetchImpl(url,{...options,redirect:'error',
    signal:AbortSignal.timeout(25000),cache:'no-store'})
  if (!response.ok) throw Error('hi3d_http_'+response.status)
  const raw=await response.text()
  if (raw.length>64*1024)throw Error('hi3d_provider_payload_oversized')
  let data
  try { data=JSON.parse(raw) }catch{throw Error('hi3d_provider_invalid_json')}
  return verifiedResponse(data)
}
function assertToken(token) {
  if(typeof token!=='string'||token.length<16)
    throw Error('hi3d_token_missing')
  return token
}
export async function getHi3dToken(clientId,clientSecret,fetchImpl=fetch) {
  if(!clientId||!clientSecret)throw Error('hi3d_credentials_missing')
  const basic=Buffer.from(clientId+':'+clientSecret).toString('base64')
  const data=await jsonRequest('/open-api/v1/auth/token',{
    method:'POST',
    headers:{Authorization:'Basic '+basic,'Content-Type':'application/json'},
    body:'{}',
  },fetchImpl)
  return assertToken(data?.accessToken)
}
export async function submitHi3dV3(imageBytes,imageName,token,fetchImpl=fetch) {
  const type=imageMediaType(imageBytes,imageName)
  const form=new FormData()
  form.set('images',new Blob([imageBytes],{type}),'image.'+type.split('/')[1])
  for(const [k,v] of Object.entries({
    request_type:HI3D_PLAN.requestType,
    model:HI3D_PLAN.model,
    resolution:HI3D_PLAN.resolution,
    face:HI3D_PLAN.faces,
    pbr:HI3D_PLAN.pbr,
    shading:HI3D_PLAN.shading,
    format:HI3D_PLAN.format,
  }))form.set(k,v)
  const data=await jsonRequest('/open-api/v1/submit-task',{
    method:'POST',headers:{Authorization:'Bearer '+assertToken(token)},
    body:form,
  },fetchImpl)
  return validateTaskId(data?.task_id)
}
export function validateTaskId(taskId) {
  if(typeof taskId!=='string'||taskId.length>256||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{7,255}$/.test(taskId))
    throw Error('hi3d_invalid_task_id')
  return taskId
}
export async function queryHi3dTask(taskId,token,fetchImpl=fetch) {
  const id=validateTaskId(taskId)
  const data=await jsonRequest(
    '/open-api/v1/query-task?task_id='+encodeURIComponent(id),
    {method:'GET',headers:{Authorization:'Bearer '+assertToken(token)}},
    fetchImpl)
  const state=data?.state
  if(!['created','queueing','processing','success','failed'].includes(state))
    throw Error('hi3d_unknown_task_state')
  if(state==='success')
    return {state,modelUrl:validateResultUrl(data?.url)}
  return {state}
}
export function validateResultUrl(value) {
  if(typeof value!=='string'||value.length>4096)
    throw Error('hi3d_result_url_invalid')
  let url
  try{url=new URL(value)}catch{throw Error('hi3d_result_url_invalid')}
  if(url.protocol!=='https:'||url.username||url.password||url.port||
    url.hash||!HI3D_CDN_HOSTS.has(url.hostname)||
    !url.pathname.toLowerCase().endsWith('.glb'))
    throw Error('hi3d_result_url_untrusted')
  return url.toString()
}
export async function downloadHi3dGlb(modelUrl,fetchImpl=fetch) {
  const url=validateResultUrl(modelUrl)
  const response=await fetchImpl(url,{
    method:'GET',redirect:'error',cache:'no-store',
    signal:AbortSignal.timeout(90000),
  })
  if(!response.ok)throw Error('hi3d_download_http_'+response.status)
  const declared=Number(response.headers.get('content-length')||'0')
  if(declared>MAX_RESULT_BYTES)throw Error('hi3d_result_too_large')
  if(!response.body)throw Error('hi3d_download_empty')
  const reader=response.body.getReader(),chunks=[]
  let length=0
  try{
    while(true){
      const {value,done}=await reader.read()
      if(done)break
      length+=value.byteLength
      if(length>MAX_RESULT_BYTES){
        await reader.cancel()
        throw Error('hi3d_result_too_large')
      }
      chunks.push(value)
    }
  }finally{reader.releaseLock()}
  const bytes=Buffer.concat(chunks.map(x=>Buffer.from(x)),length)
  validateGlb(bytes)
  return bytes
}
export function validateGlb(bytes) {
  if(!Buffer.isBuffer(bytes)||bytes.length<28||bytes.length>MAX_RESULT_BYTES||
    bytes.toString('ascii',0,4)!=='glTF'||
    bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)
    throw Error('hi3d_invalid_glb')
  return true
}
export function filenameForTask(taskId) {
  const digest=createHash('sha256').update(validateTaskId(taskId)).digest('hex').slice(0,16)
  return 'spaktok-hi3d-v3-'+digest+'.glb'
}
