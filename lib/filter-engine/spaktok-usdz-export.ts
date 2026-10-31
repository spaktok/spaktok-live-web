export const USDZ_MAX_INPUT_BYTES=256*1024*1024
export const USDZ_MAX_TEXTURE=2048

export function usdzFileName(glbName:string){
 const base=glbName.replace(/\.glb$/i,'').replace(/[^A-Za-z0-9_-]+/g,'-').slice(0,64)||'spaktok-model'
 return base+'.usdz'
}

export function isGlb(bytes:ArrayBuffer){
 if(bytes.byteLength<20)return false
 return new TextDecoder().decode(bytes.slice(0,4))==='glTF'
}

export function isUsdzZip(bytes:Uint8Array){
 return bytes.byteLength>30&&bytes[0]===0x50&&bytes[1]===0x4b&&bytes[2]===0x03&&bytes[3]===0x04
}

/** Browser-only: converts a GLB to USDZ (iOS AR Quick Look) without uploading it. */
export async function glbToUsdz(file:File):Promise<File>{
 if(file.size>USDZ_MAX_INPUT_BYTES)throw Error('usdz_input_too_large')
 const bytes=await file.arrayBuffer()
 if(!isGlb(bytes))throw Error('usdz_input_not_glb')
 const [{GLTFLoader},{USDZExporter}]=await Promise.all([
  import('three/addons/loaders/GLTFLoader.js'),
  import('three/addons/exporters/USDZExporter.js'),
 ])
 const gltf=await new GLTFLoader().parseAsync(bytes,'')
 const out=await new USDZExporter().parseAsync(gltf.scene,{
  maxTextureSize:USDZ_MAX_TEXTURE,quickLookCompatible:true,
 }) as unknown as Uint8Array
 const data=out instanceof Uint8Array?out:new Uint8Array(out as ArrayBuffer)
 if(!isUsdzZip(data))throw Error('usdz_export_invalid')
 return new File([new Blob([data as BlobPart])],usdzFileName(file.name),{type:'model/vnd.usdz+zip'})
}
