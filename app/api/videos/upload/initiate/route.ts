import {NextResponse} from 'next/server'
/** Intentionally disabled: old Stream route requires paid media processing
 * and the removed Supabase database. */
export async function GET(){return NextResponse.json({enabled:false},{headers:{'Cache-Control':'no-store'}})}
export async function POST(){return NextResponse.json({error:'r2_upload_not_configured'},{status:503})}
