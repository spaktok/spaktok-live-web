import { NextResponse } from 'next/server'
import { hasNativeDatabase,queryD1 } from '@/lib/native/d1'
import { nativeAuthReady,registrationReady } from '@/lib/native/auth'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(){
  if(!nativeAuthReady()||!hasNativeDatabase())
    return NextResponse.json({status:'not_configured',backend:'cloudflare_d1'},{status:503,headers:{'Cache-Control':'no-store'}})
  try{
    await queryD1('SELECT recovery_hash,auth_version FROM auth_users LIMIT 1')
    await queryD1('SELECT auth_version FROM auth_sessions LIMIT 1')
    return NextResponse.json({status:'available',backend:'cloudflare_d1',registration:registrationReady()?'invite_only':'disabled'},{headers:{'Cache-Control':'no-store'}})
  }catch{
    return NextResponse.json({status:'unavailable',backend:'cloudflare_d1'},{status:503,headers:{'Cache-Control':'no-store'}})
  }
}
