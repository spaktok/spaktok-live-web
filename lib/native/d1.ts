import 'server-only'
import { createPrivateKey, randomBytes, sign } from 'node:crypto'

export type SqlParam = string | number | null
export interface D1Result<T> { rows: T[]; changes: number }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const validId = (value: unknown): value is string => typeof value === 'string' && UUID.test(value)

function config() {
  const address = process.env.SPAKTOK_D1_BRIDGE_URL
  const privateKeyBase64 = process.env.SPAKTOK_D1_BRIDGE_SIGNING_KEY
  if (!address || !privateKeyBase64) return null
  // Prevent a typo or tampered environment from sending signed SQL to another host.
  let url: URL
  try { url = new URL(address) } catch { return null }
  if (url.protocol !== 'https:' || url.hostname !== 'spaktok-d1-bridge.spaktok.workers.dev' ||
      url.pathname !== '/' || url.username || url.password || url.search || url.hash) return null
  return { endpoint: new URL('/query',url).toString(), privateKeyBase64 }
}
export function hasNativeDatabase(): boolean { return Boolean(config()) }

export function httpSqlParams(params: SqlParam[]): Array<string | null> {
  return params.map(value => {
    if (value === null) return null
    if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('invalid_database_parameter')
    return String(value)
  })
}
type Query={sql:string;params:Array<string|null>}
interface ResultRow<T> { success: boolean; results?: T[]; meta?:{changes?:number} }
async function send<T extends Record<string, unknown>>(queries: Query[]): Promise<ResultRow<T>[]> {
  const cfg=config()
  if(!cfg)throw new Error('native_database_not_configured')
  if(!queries.length||queries.length>8)throw new Error('invalid_database_batch')
  const payload=queries.length===1?queries[0]:{batch:queries}
  const body=JSON.stringify(payload)
  const ts=Math.floor(Date.now()/1000).toString()
  const nonce=randomBytes(16).toString('hex')
  const bytes=Buffer.from(ts+'\n'+nonce+'\n'+body,'utf8')
  const key=createPrivateKey(Buffer.from(cfg.privateKeyBase64,'base64').toString('utf8'))
  const signature=sign(null,bytes,key).toString('base64')
  const response=await fetch(cfg.endpoint,{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'X-SpakTok-Timestamp':ts,
      'X-SpakTok-Nonce':nonce,
      'X-SpakTok-Signature':signature,
    },
    body,cache:'no-store',signal:AbortSignal.timeout(9000),
  })
  if(!response.ok)throw new Error('native_database_unavailable')
  const parsed=await response.json() as {success?:boolean;result?:ResultRow<T>[]}
  if(!parsed.success||!Array.isArray(parsed.result)||parsed.result.length!==queries.length||
     parsed.result.some(item=>!item.success))throw new Error('native_database_query_failed')
  return parsed.result
}
/** Authenticated bridge calls the Cloudflare D1 binding; no Cloudflare API token
 * is present in Vercel, client bundles or source control. */
export async function queryD1<T extends Record<string,unknown>>(
  sql:string,params:SqlParam[]=[],
):Promise<D1Result<T>>{
  const [value]=await send<T>([{sql,params:httpSqlParams(params)}])
  return {rows:value.results??[],changes:value.meta?.changes??0}
}
export async function batchD1(queries:Array<{sql:string;params:SqlParam[]}>):Promise<void>{
  await send(queries.map(q=>({sql:q.sql,params:httpSqlParams(q.params)})))
}
export async function oneD1<T extends Record<string,unknown>>(
  sql:string,params:SqlParam[]=[],
):Promise<T|null>{return (await queryD1<T>(sql,params)).rows[0]??null}
