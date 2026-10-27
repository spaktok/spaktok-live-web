/** Same-browser, private handoff between authoring and avatar preview.
 * One transient unpublished GLB, written only by creator action. Other
 * origins cannot read IndexedDB, but it is NOT encrypted at rest; avoid
 * sensitive or unlicensed materials on shared devices.
 */
export const REALITY_HANDOFF_KEY='latest-studio-glb'
export const REALITY_HANDOFF_MAX_BYTES=15*1024*1024
const DB='spaktok-studio-local-assets'
const STORE='handoff'
const VERSION=1
type StoredAsset={id:string;name:string;bytes:ArrayBuffer;at:number}
function openDb():Promise<IDBDatabase>{
 if(typeof indexedDB==='undefined')
  return Promise.reject(Error('studio_local_storage_unavailable'))
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB,VERSION)
  request.onupgradeneeded=()=>{
   const db=request.result
   if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'})
  }
  request.onsuccess=()=>resolve(request.result)
  request.onerror=()=>reject(request.error??Error('studio_db_failed'))
 })
}
export function validLocalHandoffName(name:string):boolean{
 return /^[^\\/\x00-\x1f]{1,120}\.glb$/i.test(name)
}
export async function saveLocalStudioGlb(name:string,bytes:ArrayBuffer):Promise<void>{
 if(!validLocalHandoffName(name)||bytes.byteLength<28||
  bytes.byteLength>REALITY_HANDOFF_MAX_BYTES)
  throw Error('studio_handoff_invalid_asset')
 const db=await openDb()
 try{
  await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction(STORE,'readwrite')
   tx.objectStore(STORE).put({id:REALITY_HANDOFF_KEY,name,bytes,
    at:Date.now()} satisfies StoredAsset)
   tx.oncomplete=()=>resolve()
   tx.onerror=()=>reject(tx.error??Error('studio_handoff_write_failed'))
   tx.onabort=()=>reject(tx.error??Error('studio_handoff_write_aborted'))
  })
 }finally{db.close()}
}
export async function loadLocalStudioGlb():Promise<File|null>{
 const db=await openDb()
 try{
  const value=await new Promise<StoredAsset|undefined>((resolve,reject)=>{
   const tx=db.transaction(STORE,'readonly')
   const req=tx.objectStore(STORE).get(REALITY_HANDOFF_KEY)
   req.onsuccess=()=>resolve(req.result as StoredAsset|undefined)
   req.onerror=()=>reject(req.error??Error('studio_handoff_read_failed'))
  })
  if(!value)return null
  // A local draft expires after 24 hours; no accidental resurrection of
  // an old creator's private assets on a shared device.
  if(!validLocalHandoffName(value.name)||Date.now()-value.at>86_400_000||
   value.bytes.byteLength<28||value.bytes.byteLength>REALITY_HANDOFF_MAX_BYTES)
   return null
  return new File([value.bytes],value.name,{type:'model/gltf-binary'})
 }finally{db.close()}
}
export async function clearLocalStudioGlb():Promise<void>{
 const db=await openDb()
 try{
  await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction(STORE,'readwrite')
   tx.objectStore(STORE).delete(REALITY_HANDOFF_KEY)
   tx.oncomplete=()=>resolve()
   tx.onerror=()=>reject(tx.error??Error('studio_handoff_delete_failed'))
  })
 }finally{db.close()}
}
