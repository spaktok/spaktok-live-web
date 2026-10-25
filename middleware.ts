import { NextResponse, type NextRequest } from 'next/server'
/** No Supabase middleware: native SpakTok endpoints verify D1 sessions individually. */
export function middleware(req: NextRequest) {
  return NextResponse.next({ request: req })
}
export const config = {
 matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
