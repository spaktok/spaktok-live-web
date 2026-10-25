import 'server-only'
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { batchD1, hasNativeDatabase, oneD1, queryD1 } from './d1'

export const COOKIE = 'spaktok_session'
const SESSION_SECONDS = 60 * 60 * 24 * 14
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NAME = /^[a-z0-9_]{3,24}$/i
export function nativeAuthReady() {
  return hasNativeDatabase() && Boolean(process.env.SPAKTOK_AUTH_PEPPER) &&
    (process.env.SPAKTOK_AUTH_PEPPER?.length ?? 0) >= 32
}
export function betaRegistrationOpen() { return process.env.SPAKTOK_OPEN_BETA_REGISTRATION === 'true' }
export function registrationReady() {
  return nativeAuthReady() && (process.env.SPAKTOK_REGISTRATION_CODE?.length ?? 0) >= 12
}
export function parseCredentials(value: unknown): { email: string; password: string; username: string; inviteCode: string } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const b = value as Record<string, unknown>
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : ''
  const password = typeof b.password === 'string' ? b.password : ''
  const username = typeof b.username === 'string' ? b.username.trim().toLowerCase() : ''
  const inviteCode = typeof b.inviteCode === 'string' ? b.inviteCode : ''
  if (email.length > 254 || !EMAIL.test(email) || password.length < 10 ||
      password.length > 128 || (username && !NAME.test(username))) return null
  return { email, password, username, inviteCode }
}
function pepper(): string {
  const value = process.env.SPAKTOK_AUTH_PEPPER
  if (!value || value.length < 32) throw new Error('auth_not_configured')
  return value
}
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')
export async function derivePassword(password: string, salt: string) {
  const key = scryptSync(password + pepper(), Buffer.from(salt, 'hex'), 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
  return (key as Buffer).toString('hex')
}
export function safeEqual(a: string, b: string): boolean {
  const aa = Buffer.from(a), bb = Buffer.from(b)
  return aa.length === bb.length && timingSafeEqual(aa, bb)
}
type DbUser = { id: string; email: string; username: string; display_name: string; password_hash: string; password_salt: string }
export async function findAuthUser(email: string): Promise<DbUser | null> {
  return oneD1<DbUser>(
    'SELECT a.id,a.email,a.password_hash,a.password_salt,p.username,p.display_name FROM auth_users a JOIN profiles p ON p.id=a.id WHERE a.email=?',
    [email],
  )
}
export function newRecoveryCode(): string {
  return 'spak1_' + randomBytes(32).toString('base64url')
}
const RECOVERY_FORMAT = /^spak1_[A-Za-z0-9_-]{43}$/
export function parseRecovery(value: unknown): { email: string; password: string; recoveryCode: string } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  const password = typeof input.password === 'string' ? input.password : ''
  const recoveryCode = typeof input.recoveryCode === 'string' ? input.recoveryCode.trim() : ''
  if (email.length > 254 || !EMAIL.test(email) || password.length < 10 || password.length > 128 ||
      !RECOVERY_FORMAT.test(recoveryCode)) return null
  return { email, password, recoveryCode }
}
export async function createAuthUser(email: string, username: string, pass: string):
  Promise<{ id: string; recoveryCode: string }> {
  const id = crypto.randomUUID(), salt = randomBytes(16).toString('hex')
  const recoveryCode = newRecoveryCode()
  const hash = await derivePassword(pass, salt)
  // Database API batch is atomic: avoid orphan login/profile rows on conflict.
  await batchD1([
    {sql:'INSERT INTO auth_users(id,email,password_hash,password_salt,recovery_hash) VALUES (?,?,?,?,?)',
     params:[id,email,hash,salt,sha256(recoveryCode)]},
    {sql:'INSERT INTO profiles(id,username,display_name) VALUES (?,?,?)',
     params:[id,username,username]},
  ])
  return { id, recoveryCode }
}

/** Recovery via one-time high-entropy secret. Not proof of verified email ownership. */
export async function recoverAuthUser(email: string, oldCode: string, newPassword: string):
  Promise<string | null> {
  const salt = randomBytes(16).toString('hex')
  const hash = await derivePassword(newPassword, salt)
  const newCode = newRecoveryCode()
  const result = await queryD1<{ id: string }>(
    `UPDATE auth_users
     SET password_hash=?,password_salt=?,recovery_hash=?,auth_version=auth_version+1
     WHERE email=? AND recovery_hash=? RETURNING id`,
    [hash,salt,sha256(newCode),email,sha256(oldCode)],
  )
  return result.rows.length === 1 ? newCode : null
}
export async function rateLimit(id: string, cap: number): Promise<boolean> {
  const bucket = Math.floor(Date.now() / (15 * 60 * 1000))
  await queryD1(
    `INSERT INTO auth_limits(id,bucket,hits) VALUES (?,?,1)
     ON CONFLICT(id,bucket) DO UPDATE SET hits=hits+1`,
    [sha256(id),bucket],
  )
  const row = await oneD1<{hits:number}>('SELECT hits FROM auth_limits WHERE id=? AND bucket=?',
    [sha256(id),bucket])
  return Boolean(row && row.hits <= cap)
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = Math.floor(Date.now()/1000) + SESSION_SECONDS
  await queryD1(`INSERT INTO auth_sessions(token_hash,user_id,expires_at,created_at,auth_version)
    SELECT ?,id,?,?,auth_version FROM auth_users WHERE id=?`,
    [sha256(token),expiresAt,Math.floor(Date.now()/1000),userId])
  return { token, expiresAt }
}
export async function resolveSession(token?: string): Promise<{id:string;email:string;username:string}|null> {
  if (!token || token.length > 100 || !nativeAuthReady()) return null
  return oneD1<{id:string;email:string;username:string}>(
    `SELECT a.id,a.email,p.username FROM auth_sessions s
      JOIN auth_users a ON a.id=s.user_id JOIN profiles p ON p.id=a.id
      WHERE s.token_hash=? AND s.expires_at>? AND s.auth_version=a.auth_version LIMIT 1`,
    [sha256(token),Math.floor(Date.now()/1000)],
  )
}
export async function getNativeUser(): Promise<{id:string;email:string;username:string}|null> {
  const c = await cookies()
  return resolveSession(c.get(COOKIE)?.value)
}
export async function revokeSession(token?: string) {
  if (token) await queryD1('DELETE FROM auth_sessions WHERE token_hash=?', [sha256(token)])
}
