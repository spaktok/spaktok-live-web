/** Cursor for the authenticated activity feed. Opaque to clients; not a permission token. */
export type ActivityCursor = {createdAt:string;id:string}
export const PAGE_SIZE=40
export function encodeActivityCursor(cursor:ActivityCursor):string {
  return Buffer.from(JSON.stringify(cursor),'utf8').toString('base64url')
}
export function decodeActivityCursor(raw:string|null):ActivityCursor|null|undefined {
  if(raw===null)return null
  if(raw.length<8||raw.length>512||!/^[A-Za-z0-9_-]+$/.test(raw))return undefined
  try {
    const decoded=Buffer.from(raw,'base64url')
    if(decoded.toString('base64url')!==raw)return undefined
    const obj=JSON.parse(decoded.toString('utf8')) as Record<string,unknown>
    if(!obj||typeof obj.createdAt!=='string'||typeof obj.id!=='string')return undefined
    if(obj.createdAt.length>40||obj.createdAt.length<10||
       !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})?$/.test(obj.createdAt)||
       !/^(follow|like|comment):[a-zA-Z0-9:_-]{1,100}$/.test(obj.id))return undefined
    return {createdAt:obj.createdAt,id:obj.id}
  }catch{return undefined}
}
export type ActivityRow={id:string;created_at:string}
export function sortActivityRows<T extends ActivityRow>(rows:T[]):T[]{
  return [...rows].sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id))
}
