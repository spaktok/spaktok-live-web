import 'server-only'

export type SqlParam = string | number | null
export interface D1Result<T> { rows: T[]; changes: number }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const validId = (value: unknown): value is string =>
  typeof value === 'string' && UUID.test(value)

function config() {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID
  const database = process.env.CLOUDFLARE_D1_DATABASE_ID
  const token = process.env.CLOUDFLARE_D1_API_TOKEN
  if (!account || !/^[a-f0-9]{32}$/i.test(account) ||
      !database || !UUID.test(database) || !token) return null
  return { account, database, token }
}
export function hasNativeDatabase(): boolean { return Boolean(config()) }

/** Cloudflare's HTTP D1 API: parameterized statements only; never expose token to browser. */
export async function queryD1<T extends Record<string, unknown>>(
  sql: string, params: SqlParam[] = [],
): Promise<D1Result<T>> {
  const c = config()
  if (!c) throw new Error('native_database_not_configured')
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${c.account}/d1/database/${c.database}/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params }),
      cache: 'no-store',
      signal: AbortSignal.timeout(9000),
    },
  )
  if (!response.ok) throw new Error('native_database_unavailable')
  const payload = await response.json() as {
    success?: boolean
    result?: Array<{ success?: boolean; results?: T[]; meta?: { changes?: number } }>
  }
  if (!payload.success || !Array.isArray(payload.result) ||
      !payload.result[0]?.success) throw new Error('native_database_query_failed')
  return { rows: payload.result[0].results ?? [], changes: payload.result[0].meta?.changes ?? 0 }
}
/** Cloudflare D1 batch executes related statements transactionally. */
export async function batchD1(queries: Array<{ sql: string; params: SqlParam[] }>): Promise<void> {
  const c = config()
  if (!c) throw new Error('native_database_not_configured')
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${c.account}/d1/database/${c.database}/query`,
    {
      method:'POST',
      headers:{Authorization:`Bearer ${c.token}`,'Content-Type':'application/json'},
      body:JSON.stringify({ batch:queries }),
      cache:'no-store',
      signal:AbortSignal.timeout(9000),
    },
  )
  if(!response.ok)throw new Error('native_database_unavailable')
  const data=await response.json() as {success?:boolean;result?:Array<{success?:boolean}>}
  if(!data.success||!Array.isArray(data.result)||
     data.result.length!==queries.length||data.result.some(item=>!item.success))
    throw new Error('native_database_query_failed')
}

export async function oneD1<T extends Record<string, unknown>>(
  sql: string, params: SqlParam[] = [],
): Promise<T | null> { return (await queryD1<T>(sql, params)).rows[0] ?? null }
