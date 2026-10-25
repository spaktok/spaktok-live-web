import { updateSession } from '@/lib/supabase/proxy'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Public Cloudflare D1 preview must not refresh a legacy Supabase session.
  // This exact route does not contain per-user data and authorizes no mutations.
  if (request.nextUrl.pathname === '/api/cloudflare/feed') return NextResponse.next()
  return await updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
