import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { queryD1 } from '@/lib/native/d1'
import {
  COOKIE, createAuthUser, createSession, derivePassword, findAuthUser, getNativeUser,
  nativeAuthReady, parseCredentials, rateLimit, registrationReady, resolveSession,
  revokeSession, recoverAuthUser, parseRecovery, safeEqual, sha256, betaRegistrationOpen,
} from '@/lib/native/auth'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const reply = (data: unknown, status=200) => NextResponse.json(data, {status,headers:{'Cache-Control':'no-store'}})
function originAllowed(req: NextRequest) {
  return req.headers.get('origin') === req.nextUrl.origin &&
    req.headers.get('sec-fetch-site') !== 'cross-site'
}
function denyCookie(res: NextResponse) {
  res.cookies.set(COOKIE,'',{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:0})
}
export async function GET() {
  if (!nativeAuthReady()) return reply({configured:false,user:null},503)
  try {
    // Configuration alone is not enough: a missing D1 migration must fail closed.
    await queryD1('SELECT auth_version,recovery_hash FROM auth_users LIMIT 1')
    await queryD1('SELECT auth_version FROM auth_sessions LIMIT 1')
    const user = await getNativeUser()
    return reply({ configured:true,user,registration: registrationReady() ? (betaRegistrationOpen() ? 'limited_beta' : 'invite_only') : 'disabled' })
  } catch {return reply({configured:false,user:null},503)}
}
export async function POST(req: NextRequest) {
  if (!nativeAuthReady()) return reply({error:'native_auth_not_configured'},503)
  if (!originAllowed(req)) return reply({error:'invalid_origin'},403)
  if (Number(req.headers.get('content-length')||0)>4096) return reply({error:'invalid_request'},413)
  let body: Record<string,unknown>
  try {
    const value: unknown = await req.json()
    if (!value || typeof value!=='object' || Array.isArray(value)) return reply({error:'invalid_request'},400)
    body=value as Record<string,unknown>
  } catch {return reply({error:'invalid_json'},400)}
  const action = body.action
  try {
    if (action==='logout') {
      const cookie=(await cookies()).get(COOKIE)?.value
      await revokeSession(cookie)
      const res=reply({success:true});denyCookie(res);return res
    }
    if (action==='recover') {
      const parsed = parseRecovery(body)
      if (!parsed) return reply({error:'invalid_recovery'},400)
      const ip = req.headers.get('x-vercel-forwarded-for') || 'unknown'
      if (!await rateLimit('recover-ip:'+ip,8) ||
          !await rateLimit('recover-email:'+parsed.email,5))
        return reply({error:'too_many_attempts'},429)
      const rotated = await recoverAuthUser(parsed.email,parsed.recoveryCode,parsed.password)
      if (!rotated) return reply({error:'invalid_recovery'},401)
      const response = reply({success:true,recoveryCode:rotated})
      denyCookie(response)
      return response
    }
    if (action!=='register' && action!=='login') return reply({error:'invalid_action'},400)
    const credentials=parseCredentials(body)
    if (!credentials) return reply({error:'invalid_credentials'},400)
    const {email,password,username,inviteCode}=credentials
    const ip=(req.headers.get('x-vercel-forwarded-for')||req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim()
    if (!await rateLimit('auth-ip:'+ip,24) || !await rateLimit('auth-email:'+email,12))
      return reply({error:'too_many_attempts'},429)
    let userId=''
    let issuedRecoveryCode: string | null = null
    if (action==='register') {
      if (!registrationReady()) return reply({error:'registration_not_configured'},503)
      if (!username) return reply({error:'invalid_username'},400)
      const secret=process.env.SPAKTOK_REGISTRATION_CODE!
      const validInvite = inviteCode.length > 0 && safeEqual(sha256(inviteCode),sha256(secret))
      if (!validInvite && !betaRegistrationOpen()) return reply({error:'invalid_invite'},403)
      // Restricted pilot only: not a substitute for email verification.
      if (!validInvite) {
        const limit = await queryD1<{ count: number }>(
          "SELECT COUNT(*) AS count FROM auth_users WHERE created_at >= datetime('now','-24 hours')",
        )
        if ((limit.rows[0]?.count ?? 0) >= 100) return reply({error:'registration_capacity_reached'},429)
      }
      if (!await rateLimit('signup-ip:'+ip,3)) return reply({error:'too_many_attempts'},429)
      if (await findAuthUser(email)) return reply({error:'already_registered'},409)
      try {
        const created = await createAuthUser(email,username,password)
        userId=created.id
        issuedRecoveryCode=created.recoveryCode
      }
      catch {return reply({error:'registration_unavailable_or_taken'},409)}
    } else {
      const user=await findAuthUser(email)
      const salt=user?.password_salt||'00000000000000000000000000000000'
      const candidate=await derivePassword(password,salt)
      const expected=user?.password_hash||'00'.repeat(64)
      if (!safeEqual(candidate,expected) || !user) return reply({error:'invalid_login'},401)
      userId=user.id
    }
    const created=await createSession(userId)
    const res=reply({success:true,...(issuedRecoveryCode ? {recoveryCode:issuedRecoveryCode} : {})},action==='register'?201:200)
    res.cookies.set(COOKIE,created.token,{
      httpOnly:true,secure:true,sameSite:'lax',path:'/',
      maxAge:60*60*24*14,
    })
    return res
  } catch {return reply({error:'auth_unavailable'},503)}
}
