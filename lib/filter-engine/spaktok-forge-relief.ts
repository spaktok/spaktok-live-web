import * as THREE from 'three'

/** Zero-inference, browser-local relief mesh. A raised 2.5D surface is useful
 * for AR stickers, medals, signs, plaques and some decorative filters.
 * It CANNOT reconstruct the hidden back of a face or a genuine 360° object.
 */
export type ForgeReliefOptions=Readonly<{
 resolution:32|48|64|96
 relief:number
 thickness:number
 contrast:number
 invert:boolean
}>
export const DEFAULT_FORGE_RELIEF:ForgeReliefOptions={
 resolution:64,relief:.2,thickness:.08,contrast:1.1,invert:false,
}
export type ForgeReliefStats=Readonly<{
 vertices:number;triangles:number;width:number;height:number
 maxDisplacement:number;mode:'browser-2.5d'
}>
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x))
export function validateForgeReliefOptions(o:ForgeReliefOptions):void{
 if(![32,48,64,96].includes(o.resolution)||
  !Number.isFinite(o.relief)||o.relief<0||o.relief>.7||
  !Number.isFinite(o.thickness)||o.thickness<.015||o.thickness>.3||
  !Number.isFinite(o.contrast)||o.contrast<.4||o.contrast>2.5||
  typeof o.invert!=='boolean')throw Error('forge_relief_invalid_settings')
}
/** Pixel buffer is RGBA; no ML or external uploads are performed here.
 * All positions are independent, finite, 32-bit floats; triangles, normals
 * and UVs export into a self-contained glTF/GLB through Three GLTFExporter.
 */
export function buildForgeReliefGeometry(
 pixels:Uint8ClampedArray,width:number,height:number,
 options:ForgeReliefOptions=DEFAULT_FORGE_RELIEF,
):Readonly<{geometry:THREE.BufferGeometry;stats:ForgeReliefStats}>{
 validateForgeReliefOptions(options)
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||
  width<8||height<8||width>2048||height>2048||
  pixels.length<width*height*4)
  throw Error('forge_relief_invalid_pixels')
 const ratio=width/height
 const cols=options.resolution
 const rows=clamp(Math.round(cols/ratio),16,128)
 const modelWidth=ratio>=1?2:2*ratio
 const modelHeight=ratio>=1?2/ratio:2
 const n=cols*rows
 const positions=new Float32Array(n*2*3)
 const uv=new Float32Array(n*2*2)
 const triangles:number[]=[]
 const sample=(u:number,v:number):Readonly<[number,number]>=>{
  const x=clamp(Math.round(u*(width-1)),0,width-1)
  const y=clamp(Math.round(v*(height-1)),0,height-1)
  const i=(y*width+x)*4
  return [(.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2])/255,
   pixels[i+3]/255]
 }
 let maxDisplacement=0
 for(let row=0;row<rows;row++){
  const v=row/(rows-1)
  for(let col=0;col<cols;col++){
   const u=col/(cols-1),index=row*cols+col
   const [luminance,alpha]=sample(u,v)
   const heightSignal=Math.pow(clamp(options.invert?luminance:1-luminance,0,1),
    options.contrast)*alpha
   const edgeFade=clamp(Math.min(u,1-u,v,1-v)*18,0,1)
   const displacement=options.relief*heightSignal*edgeFade
   maxDisplacement=Math.max(maxDisplacement,displacement)
   const x=(u-.5)*modelWidth,y=(.5-v)*modelHeight
   const front=index*3,back=(index+n)*3
   positions[front]=x;positions[front+1]=y
   positions[front+2]=options.thickness/2+displacement
   positions[back]=x;positions[back+1]=y
   positions[back+2]=-options.thickness/2
   uv[index*2]=u;uv[index*2+1]=1-v
   uv[(index+n)*2]=1-u;uv[(index+n)*2+1]=1-v
  }
 }
 for(let row=0;row<rows-1;row++)for(let col=0;col<cols-1;col++){
  const a=row*cols+col,b=a+1,c=a+cols,d=c+1
  triangles.push(a,c,b,b,c,d)
  triangles.push(a+n,b+n,c+n,b+n,d+n,c+n)
 }
 const boundary:number[]=[]
 // Top -> right -> bottom -> left, clockwise when seen from +Z.
 for(let x=0;x<cols-1;x++)boundary.push(x)
 for(let y=0;y<rows-1;y++)boundary.push(y*cols+cols-1)
 for(let x=cols-1;x>0;x--)boundary.push((rows-1)*cols+x)
 for(let y=rows-1;y>0;y--)boundary.push(y*cols)
 for(let i=0;i<boundary.length;i++){
  const a=boundary[i],b=boundary[(i+1)%boundary.length]
  triangles.push(a,b,a+n,b,b+n,a+n)
 }
 const geometry=new THREE.BufferGeometry()
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3))
 geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2))
 geometry.setIndex(triangles)
 geometry.computeVertexNormals()
 geometry.computeBoundingSphere()
 return {
  geometry,
  stats:{
   vertices:n*2,triangles:triangles.length/3,
   width:modelWidth,height:modelHeight,maxDisplacement,
   mode:'browser-2.5d',
  },
 }
}
