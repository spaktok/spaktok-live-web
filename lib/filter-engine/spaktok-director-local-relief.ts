'use client'
import * as THREE from 'three'
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js'
import {
 buildForgeReliefGeometry,DEFAULT_FORGE_RELIEF,
 type ForgeReliefOptions,type ForgeReliefStats,
} from './spaktok-forge-relief'
import {inspectWordGeneratedGlb} from './spaktok-word-import'

/** Free client-only fallback for AI Director. Reuses the exact local
 * Forge heightfield algorithm without network requests or GPU inference.
 * A 2.5D plaque is NOT a face reconstruction or live-ready avatar.
 */
export async function createDirectorReliefGlb(
 source:File,options:ForgeReliefOptions=DEFAULT_FORGE_RELIEF,
):Promise<Readonly<{file:File;stats:ForgeReliefStats}>>{
 if(!/\.(png|jpe?g|webp)$/i.test(source.name)||
  source.size<128||source.size>8*1024*1024)
  throw Error('director_relief_invalid_image')
 if(typeof createImageBitmap!=='function')
  throw Error('director_relief_browser_decoder_unavailable')
 let bitmap:ImageBitmap|null=null
 let geometry:THREE.BufferGeometry|null=null
 let texture:THREE.CanvasTexture|null=null
 let material:THREE.MeshStandardMaterial|null=null
 try{
  bitmap=await createImageBitmap(source)
  if(bitmap.width<8||bitmap.height<8||
   bitmap.width>7000||bitmap.height>7000||
   bitmap.width*bitmap.height>24_000_000)
   throw Error('director_relief_image_dimensions_unsupported')
  const side=Math.max(bitmap.width,bitmap.height)
  const factor=Math.min(1,512/side)
  const canvas=document.createElement('canvas')
  canvas.width=Math.max(8,Math.round(bitmap.width*factor))
  canvas.height=Math.max(8,Math.round(bitmap.height*factor))
  const ctx=canvas.getContext('2d',{willReadFrequently:true})
  if(!ctx)throw Error('director_relief_canvas_unavailable')
  ctx.drawImage(bitmap,0,0,canvas.width,canvas.height)
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height)
  const built=buildForgeReliefGeometry(
   pixels.data,canvas.width,canvas.height,options)
  geometry=built.geometry
  texture=new THREE.CanvasTexture(canvas)
  texture.colorSpace=THREE.SRGBColorSpace
  let transparent=false
  for(let i=3;i<pixels.data.length;i+=4){
   if(pixels.data[i]<250){transparent=true;break}
  }
  material=new THREE.MeshStandardMaterial({
   map:texture,roughness:.68,metalness:.04,
   side:THREE.DoubleSide,transparent,
   alphaTest:transparent?.08:0,
  })
  const mesh=new THREE.Mesh(geometry,material)
  mesh.name='Spaktok Director 2.5D local relief — NOT 360 reconstruction'
  const binary=await new GLTFExporter().parseAsync(mesh,{
   binary:true,onlyVisible:true,maxTextureSize:1024,
  })
  if(!(binary instanceof ArrayBuffer))
   throw Error('director_relief_export_failed')
  const inspected=inspectWordGeneratedGlb(binary,'spaktok-director-local-2-5d.glb')
  if(!inspected.audit.valid||!inspected.audit.selfContained||
   !inspected.audit.hasUV||!inspected.audit.hasNormals||
   !inspected.audit.hasPBR)
   throw Error('director_relief_roundtrip_qa_failed')
  return {file:new File([binary],inspected.fileName,{
   type:'model/gltf-binary',
  }),stats:built.stats}
 }finally{
  bitmap?.close()
  geometry?.dispose();texture?.dispose();material?.dispose()
 }
}
