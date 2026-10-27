/** Portable image intake + frontal UV projection for Reality Creator Studio.
 * A 2D image is a reference/texture, not a measured 3D scan, depth map or
 * authored rig. Exported canonical face meshes remain experimental previews.
 */
export type RealityImageFormat='jpeg'|'png'|'webp'
export type RealityImageProjection=Readonly<{
 zoom:number
 shiftX:number
 shiftY:number
 mirror:boolean
}>
export type XY=Readonly<{x:number;y:number}>
export type XYBounds=Readonly<{minX:number;maxX:number;minY:number;maxY:number}>
export const DEFAULT_IMAGE_PROJECTION:RealityImageProjection=Object.freeze({
 zoom:1,shiftX:0,shiftY:0,mirror:false,
})
export const REALITY_MAX_IMAGE_BYTES=12*1024*1024
export const REALITY_MAX_IMAGE_PIXELS=4096*4096
export function hasStudioImageExtension(name:string){
 return /\.(?:png|jpe?g|webp)$/i.test(name)
}
export function sniffStudioImageFormat(bytes:Uint8Array):RealityImageFormat|null{
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))return'png'
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return'jpeg'
 if(bytes.length>=12&&
  String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&
  String.fromCharCode(...bytes.slice(8,12))==='WEBP')return'webp'
 return null
}
export async function inspectStudioImage(file:Blob&{name?:string}){
 if(file.size<=0||file.size>REALITY_MAX_IMAGE_BYTES)throw Error('reality_image_size_limit')
 const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer())
 const format=sniffStudioImageFormat(bytes)
 if(!format)throw Error('reality_unsupported_image_data')
 const ext=(file.name??'').split('.').at(-1)?.toLowerCase()??''
 const declared=ext==='jpg'||ext==='jpeg'?'jpeg':ext==='png'?'png':ext==='webp'?'webp':null
 return {format,extensionMismatch:declared!==null&&declared!==format}
}
export function getProjectionUV(
 point:XY,bounds:XYBounds,projection:RealityImageProjection,
):readonly [number,number]{
 const width=bounds.maxX-bounds.minX,height=bounds.maxY-bounds.minY
 if(![point.x,point.y,...Object.values(bounds),projection.zoom,
  projection.shiftX,projection.shiftY].every(Number.isFinite)||
  width<=0||height<=0||projection.zoom<.25||projection.zoom>4||
  Math.abs(projection.shiftX)>1||Math.abs(projection.shiftY)>1)
  throw Error('reality_invalid_texture_projection')
 const centerX=(bounds.maxX+bounds.minX)/2
 const centerY=(bounds.maxY+bounds.minY)/2
 const x=(point.x-centerX)/width/projection.zoom
 const y=(point.y-centerY)/height/projection.zoom
 return [0.5+(projection.mirror?-x:x)+projection.shiftX,
  0.5+y+projection.shiftY]
}
export function getProjectionUVs(
 positions:ArrayLike<number>,bounds:XYBounds,projection:RealityImageProjection,
):Float32Array{
 if(positions.length%3!==0||positions.length<9)throw Error('reality_invalid_geometry_positions')
 const result=new Float32Array(positions.length/3*2)
 for(let i=0;i<positions.length;i+=3){
  const [u,v]=getProjectionUV({x:positions[i],y:positions[i+1]},bounds,projection)
  result[i/3*2]=u
  result[i/3*2+1]=v
 }
 return result
}
