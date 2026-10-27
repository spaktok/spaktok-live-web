import {describe,expect,it} from 'vitest'
import {
 DEFAULT_IMAGE_PROJECTION,REALITY_MAX_IMAGE_BYTES,
 getProjectionUV,getProjectionUVs,hasStudioImageExtension,
 inspectStudioImage,sniffStudioImageFormat,
} from './reality-image-projection'

describe('Reality Studio image ingestion and reference projection',()=>{
 it('accepts supported photo extensions and rejects unrelated files',()=>{
  expect(hasStudioImageExtension('face.png')).toBe(true)
  expect(hasStudioImageExtension('FACE.JPEG')).toBe(true)
  expect(hasStudioImageExtension('photo.webp')).toBe(true)
  expect(hasStudioImageExtension('object.obj')).toBe(false)
  expect(hasStudioImageExtension('script.svg')).toBe(false)
 })
 it('sniffs real format, including incorrectly named image files',async()=>{
  const jpg=Uint8Array.from([255,216,255,224,1,2,3])
  expect(sniffStudioImageFormat(jpg)).toBe('jpeg')
  const blob=Object.assign(new Blob([jpg]),{name:'portrait.png'})
  await expect(inspectStudioImage(blob)).resolves.toEqual({
   format:'jpeg',extensionMismatch:true,
  })
  const png=Uint8Array.from([137,80,78,71,13,10,26,10,1])
  expect(sniffStudioImageFormat(png)).toBe('png')
  const webp=Uint8Array.from([82,73,70,70,1,2,3,4,87,69,66,80,1])
  expect(sniffStudioImageFormat(webp)).toBe('webp')
  expect(sniffStudioImageFormat(Uint8Array.from([1,2,3]))).toBeNull()
 })
 it('rejects empty, dangerous or oversized image data',async()=>{
  const notImage=Object.assign(new Blob(['not-image']),{name:'photo.png'})
  await expect(inspectStudioImage(notImage)).rejects.toThrow('reality_unsupported_image_data')
  await expect(inspectStudioImage(Object.assign(new Blob([]),{name:'a.jpg'})))
   .rejects.toThrow('reality_image_size_limit')
  expect(REALITY_MAX_IMAGE_BYTES).toBe(12*1024*1024)
 })
 it('projects a real position on face surface to centered, adjustable UVs',()=>{
  const bounds={minX:-2,maxX:2,minY:-2,maxY:2}
  expect(getProjectionUV({x:0,y:0},bounds,DEFAULT_IMAGE_PROJECTION))
   .toEqual([.5,.5])
  expect(getProjectionUV({x:2,y:2},bounds,DEFAULT_IMAGE_PROJECTION))
   .toEqual([1,1])
  const shifted=getProjectionUV({x:1,y:1},bounds,{
   zoom:2,shiftX:-.10,shiftY:.05,mirror:true,
  })
  expect(shifted[0]).toBeCloseTo(.275)
  expect(shifted[1]).toBeCloseTo(.675)
  expect(()=>getProjectionUV({x:0,y:0},bounds,{
   zoom:0,shiftX:0,shiftY:0,mirror:false,
  })).toThrow('reality_invalid_texture_projection')
 })
 it('exports independent two-float UV for each XYZ vertex',()=>{
  const p=[-2,-2,0,0,0,1,2,2,0]
  const uvs=getProjectionUVs(p,{minX:-2,maxX:2,minY:-2,maxY:2},DEFAULT_IMAGE_PROJECTION)
  expect(uvs).toHaveLength(6)
  expect([...uvs]).toEqual([0,0,.5,.5,1,1])
  expect(()=>getProjectionUVs([1,2],{minX:0,maxX:1,minY:0,maxY:1},DEFAULT_IMAGE_PROJECTION))
   .toThrow('reality_invalid_geometry_positions')
 })
})
