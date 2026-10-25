import {NextResponse} from 'next/server'
/** Cloudflare Stream upload is not a free video-storage feature.
 * Disabled until a budgeted R2 pipeline is provisioned. */
export async function GET() {
 return NextResponse.json({error:'video_storage_not_configured'},{status:503})
}
