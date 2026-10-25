import {NextResponse, type NextRequest} from 'next/server'
/** Old Supabase PKCE callback is retired. Do not exchange provider codes. */
export async function GET(req: NextRequest){
  return NextResponse.redirect(new URL('/',req.url))
}
