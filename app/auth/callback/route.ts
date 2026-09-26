import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      try {
        const target = new URL(next, origin)
        return NextResponse.redirect(target.origin === origin ? target : new URL('/', origin))
      } catch {
        return NextResponse.redirect(new URL('/', origin))
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
