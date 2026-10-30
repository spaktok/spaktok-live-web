import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {webcrypto} from 'node:crypto'
import {generateForgeGpuDirect} from './spaktok-forge-direct-client'

/** E2E contract at the client/network boundary, no GPU and no network. */
const host='gpu.spaktok.example.org'
const gpuUrl='https://'+host+'/v1/generate'
const grant='st1.'+'A'.repeat(32)+'.'+'B'.repeat(43)

function glbFixture():ArrayBuffer{
 const bytes=new Uint8Array(104)
 const data={
  asset:{version:'2.0'},
  buffers:[{byteLength:104}],
  bufferViews:[
   {buffer:0,byteOffset:0,byteLength:36},
   {buffer:0,byteOffset:36,byteLength:36},
   {buffer:0,byteOffset:72,byteLength:24},
   {buffer:0,byteOffset:96,byteLength:6},
  ],
  accessors:[
   {bufferView:0,componentType:5126,count:3,type:'VEC3'},
   {bufferView:1,componentType:5126,count:3,type:'VEC3'},
   {bufferView:2,componentType:5126,count:3,type:'VEC2'},
   {bufferView:3,componentType:5123,count:3,type:'SCALAR'},
  ],
  materials:[{pbrMetallicRoughness:{}}],
  meshes:[{primitives:[{
   attributes:{POSITION:0,NORMAL:1,TEXCOORD_0:2},
   indices:3,material:0,mode:4,
  }]}],
 }
 new Float32Array(bytes.buffer,0,9).set([0,0,0,1,0,0,0,1,0])
 new Float32Array(bytes.buffer,36,9).set([0,0,1,0,0,1,0,0,1])
 new Uint16Array(bytes.buffer,96,3).set([0,1,2])
 const json=new TextEncoder().encode(JSON.stringify(data))
 const jsonSize=Math.ceil(json.byteLength/4)*4
 const array=new ArrayBuffer(20+jsonSize+8+bytes.byteLength)
 const v=new DataView(array)
 v.setUint32(0,0x46546c67,true)
 v.setUint32(4,2,true)
 v.setUint32(8,array.byteLength,true)
 v.setUint32(12,jsonSize,true)
 v.setUint32(16,0x4e4f534a,true)
 new Uint8Array(array,20,jsonSize).fill(32)
 new Uint8Array(array,20,json.byteLength).set(json)
 const off=20+jsonSize
 v.setUint32(off,bytes.byteLength,true)
 v.setUint32(off+4,0x004e4942,true)
 new Uint8Array(array,off+8).set(bytes)
 return array
}
const image=()=>new File([new Uint8Array(256)],'owner.png',{type:'image/png'})
const ticket=(overrides:Record<string,unknown>={})=>({
 url:gpuUrl,host,provider:'vast',engine:'trellis2',ticket:grant,
 jobId:'test-job',expiresAt:new Date(Date.now()+60000).toISOString(),
 ...overrides,
})
const result=(buffer:ArrayBuffer,contentType='model/gltf-binary')=>
 new Response(buffer,{status:200,headers:{
  'content-type':contentType,
  'content-length':String(buffer.byteLength),
 }})

beforeEach(()=>{
 vi.stubGlobal('crypto',webcrypto)
})
afterEach(()=>vi.unstubAllGlobals())

describe('Spaktok AI image → signed GPU → GLB browser contract',()=>{
 it('uploads once after a same-origin signed ticket and audits private GLB',async()=>{
  const file=image(), glb=glbFixture()
  const call=vi.fn(async (url:string,init:RequestInit)=>{
   if(url==='/api/spaktok-forge/gpu-ticket'){
    const payload=JSON.parse(String(init.body))
    expect(init.credentials).toBe('same-origin')
    expect(payload.size).toBe(file.size)
    expect(payload.mime).toBe('image/png')
    expect(payload.rights).toBe('original')
    expect(payload.approveCompute).toBe('yes')
    expect(payload.approveTransfer).toBe('yes')
    expect(payload.sha256).toMatch(/^[0-9a-f]{64}$/)
    return Response.json(ticket())
   }
   expect(url).toBe(gpuUrl)
   expect(init.method).toBe('POST')
   expect(init.mode).toBe('cors')
   expect(init.credentials).toBe('omit')
   expect(init.headers).toMatchObject({authorization:'Bearer '+grant})
   expect(init.body).toBeInstanceOf(FormData)
   const raw=(init.body as FormData).get('image')
   expect(raw).toBeInstanceOf(File)
   expect((raw as File).size).toBe(file.size)
   return result(glb)
  })
  vi.stubGlobal('fetch',call)
  const generated=await generateForgeGpuDirect(file,'original')
  expect(call).toHaveBeenCalledTimes(2)
  expect(generated.file.name.endsWith('.glb')).toBe(true)
  expect(generated.file.size).toBe(glb.byteLength)
  expect(generated.inspection.audit.valid).toBe(true)
  expect(generated.inspection.audit.selfContained).toBe(true)
  expect(generated.inspection.audit.meshCount).toBe(1)
 })
 it('sends a studio-hd quality grant ONLY when explicitly selected',async()=>{
  const call=vi.fn(async (url:string,init:RequestInit)=>{
   if(url.startsWith('/api/')){
    expect(JSON.parse(String(init.body)).profile).toBe('studio-hd')
    return Response.json(ticket())
   }
   return result(glbFixture())
  })
  vi.stubGlobal('fetch',call)
  const returned=await generateForgeGpuDirect(image(),'licensed','studio-hd')
  expect(returned.inspection.audit.valid).toBe(true)
  expect(call).toHaveBeenCalledTimes(2)
 })
 it('rejects an expired ticket without sending the image to GPU',async()=>{
  const call=vi.fn(async()=>Response.json(ticket({
   expiresAt:new Date(Date.now()-5000).toISOString(),
  })))
  vi.stubGlobal('fetch',call)
  await expect(generateForgeGpuDirect(image(),'licensed'))
   .rejects.toThrow('forge_direct_invalid_destination_or_expired_ticket')
  expect(call).toHaveBeenCalledTimes(1)
 })
 it('rejects a server ticket for an unpinned hostname',async()=>{
  const call=vi.fn(async()=>Response.json(ticket({
   host:'different.example.org',
  })))
  vi.stubGlobal('fetch',call)
  await expect(generateForgeGpuDirect(image(),'original'))
   .rejects.toThrow('forge_direct_invalid_destination_or_expired_ticket')
  expect(call).toHaveBeenCalledTimes(1)
 })
 it('does not accept corrupt GLB bytes after one GPU response',async()=>{
  const call=vi.fn(async (url:string)=>{
   if(url.startsWith('/api/'))return Response.json(ticket())
   return result(new Uint8Array(256).buffer)
  })
  vi.stubGlobal('fetch',call)
  await expect(generateForgeGpuDirect(image(),'original'))
   .rejects.toThrow('studio_glb_invalid_header')
  expect(call).toHaveBeenCalledTimes(2)
 })
 it('refuses mismatched GPU response media type',async()=>{
  const call=vi.fn(async (url:string)=>{
   if(url.startsWith('/api/'))return Response.json(ticket())
   return result(glbFixture(),'text/html')
  })
  vi.stubGlobal('fetch',call)
  await expect(generateForgeGpuDirect(image(),'original'))
   .rejects.toThrow('forge_direct_wrong_content_type')
  expect(call).toHaveBeenCalledTimes(2)
 })
 it('does not send a GPU job after ticket endpoint rejects authentication',async()=>{
  const call=vi.fn(async()=>Response.json({error:'forge_auth_required'},{status:401}))
  vi.stubGlobal('fetch',call)
  await expect(generateForgeGpuDirect(image(),'original'))
   .rejects.toThrow('forge_auth_required')
  expect(call).toHaveBeenCalledTimes(1)
 })
})
