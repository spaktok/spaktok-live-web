import {describe,it,expect} from 'vitest'
import {
 checkPhotoFaceFileHeader,photoFacePickerArabicError,
 PHOTO_FACE_MAX_FILE_BYTES,
} from './reality-photo-file-picker'
function header(size=104){
 const bytes=new Uint8Array(12)
 const view=new DataView(bytes.buffer)
 view.setUint32(0,0x46546c67,true)
 view.setUint32(4,2,true)
 view.setUint32(8,size,true)
 return bytes
}
describe('Android-friendly local GLB camera picker',()=>{
 it('accepts matching self-described GLB 2.0 regardless of MIME type',()=>{
  expect(checkPhotoFaceFileHeader('face.glb',104,header())).toEqual({ok:true})
  expect(checkPhotoFaceFileHeader('FACE.GLB',104,header())).toEqual({ok:true})
 })
 it('rejects files not actually GLB, oversized data, and incomplete downloads',()=>{
  expect(checkPhotoFaceFileHeader('face.png',104,header()).error).toBe('not-glb')
  expect(checkPhotoFaceFileHeader('face.glb',104,[]).error).toBe('invalid-header')
  expect(checkPhotoFaceFileHeader('face.glb',103,header()).error).toBe('invalid-header')
  expect(checkPhotoFaceFileHeader('face.glb',PHOTO_FACE_MAX_FILE_BYTES+1,header()).error).toBe('size')
  expect(checkPhotoFaceFileHeader('',0,header()).error).toBe('no-file')
 })
 it('provides actionable Arabic feedback rather than silently falling back',()=>{
  expect(photoFacePickerArabicError('not-glb')).toContain('GLB')
  expect(photoFacePickerArabicError('invalid-header')).toContain('تنزيله')
 })
})
