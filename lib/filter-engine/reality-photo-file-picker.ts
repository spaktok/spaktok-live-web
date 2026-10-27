/** Android/Chrome Custom Tabs may hide .glb in type-filtered pickers.
 * Let the native picker show all files, then validate magic+version+size.
 * A filename or MIME type alone is NOT evidence of a GLB model.
 */
export const PHOTO_FACE_MAX_FILE_BYTES=12*1024*1024
export type PhotoFacePickerResult=Readonly<{
 ok:boolean
 error?:'no-file'|'size'|'invalid-header'|'not-glb'
}>
export function checkPhotoFaceFileHeader(
 name:string,size:number,header:ArrayLike<number>,
):PhotoFacePickerResult{
 if(!name||size===0)return{ok:false,error:'no-file'}
 if(!Number.isFinite(size)||size<0||size>PHOTO_FACE_MAX_FILE_BYTES)
  return{ok:false,error:'size'}
 if(!/\.glb$/i.test(name))return{ok:false,error:'not-glb'}
 if(header.length<12)return{ok:false,error:'invalid-header'}
 const view=new DataView(Uint8Array.from(header).buffer)
 const magic=view.getUint32(0,true),version=view.getUint32(4,true)
 const declared=view.getUint32(8,true)
 if(magic!==0x46546c67||version!==2||declared!==size)
  return{ok:false,error:'invalid-header'}
 return{ok:true}
}
export async function inspectPhotoFacePickerFile(file:File):Promise<PhotoFacePickerResult>{
 const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer())
 return checkPhotoFaceFileHeader(file.name,file.size,bytes)
}
export function photoFacePickerArabicError(error:PhotoFacePickerResult['error']){
 switch(error){
  case 'no-file':return 'لم تختر أي ملف.'
  case 'size':return 'يجب أن يكون حجم ملف GLB أقل من 12 ميغابايت.'
  case 'not-glb':return 'الملف المحدد ليس بصيغة GLB. اختر مجسمًا من مجلد التنزيلات.'
  case 'invalid-header':return 'الملف ليس مجسم GLB 2.0 صحيحًا، أو أنه لم يكتمل تنزيله.'
  default:return 'تعذر فحص الملف.'
 }
}
