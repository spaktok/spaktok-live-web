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

/** Owner's selected Rodin head is explicitly saved once and can then be
 * loaded privately on Word, Avatar Studio, Reality Studio and World preview.
 * It stays ONLY in this browser/profile. NOT synced to Cloudflare, the
 * native app, other devices, world publishing, or Agora live.
 * IndexedDB is NOT encrypted; creators must clear it on shared devices.
 */
import {
 prepareOwnerRodinGlb,validRodinOwnerAudit,
} from './rodin-owner-head'
export const RODIN_OWNER_ACTIVE_ASSET_KEY='owner-rodin-head-v1'
const OWNER_ASSET_MAX_AGE_MS=30*24*60*60*1000

export async function saveActiveOwnerRodinHead(file:File):Promise<File>{
 const calibrated=await prepareOwnerRodinGlb(file)
 const bytes=await calibrated.arrayBuffer()
 const db=await openDb()
 try{
  await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction(STORE,'readwrite')
   tx.objectStore(STORE).put({
    id:RODIN_OWNER_ACTIVE_ASSET_KEY,
    name:calibrated.name,bytes,at:Date.now(),
   } satisfies StoredAsset)
   tx.oncomplete=()=>resolve()
   tx.onerror=()=>reject(tx.error??Error('rodin_owner_storage_failed'))
   tx.onabort=()=>reject(tx.error??Error('rodin_owner_storage_aborted'))
  })
 }finally{db.close()}
 return calibrated
}
export async function loadActiveOwnerRodinHead():Promise<File|null>{
 const db=await openDb()
 try{
  const entry=await new Promise<StoredAsset|undefined>((resolve,reject)=>{
   const tx=db.transaction(STORE,'readonly')
   const req=tx.objectStore(STORE).get(RODIN_OWNER_ACTIVE_ASSET_KEY)
   req.onsuccess=()=>resolve(req.result as StoredAsset|undefined)
   req.onerror=()=>reject(req.error??Error('rodin_owner_storage_read_failed'))
  })
  if(!entry||entry.at>Date.now()+300000||
   Date.now()-entry.at>OWNER_ASSET_MAX_AGE_MS||
   !validLocalHandoffName(entry.name)||
   entry.bytes.byteLength>REALITY_HANDOFF_MAX_BYTES||
   !validRodinOwnerAudit(entry.bytes))return null
  return new File([entry.bytes],entry.name,{type:'model/gltf-binary'})
 }finally{db.close()}
}
export async function clearActiveOwnerRodinHead():Promise<void>{
 const db=await openDb()
 try{
  await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction(STORE,'readwrite')
   tx.objectStore(STORE).delete(RODIN_OWNER_ACTIVE_ASSET_KEY)
   tx.oncomplete=()=>resolve()
   tx.onerror=()=>reject(tx.error??Error('rodin_owner_delete_failed'))
  })
 }finally{db.close()}
}
