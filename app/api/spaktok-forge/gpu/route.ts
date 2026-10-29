import {NextResponse} from 'next/server'

/** Fail-closed legacy proxy. Vercel Functions cannot accept or return
 * large 3D assets above their 4.5MB payload limit. In particular this
 * route used to charge an operator GPU job and then fail for a large GLB.
 * All new direct GPU requests require the authenticated, short-lived
 * HMAC nonce ticket flow at /api/spaktok-forge/gpu-ticket.
 */
export const runtime='nodejs'
export const dynamic='force-dynamic'
const json=(status:number)=>NextResponse.json({
 enabled:false,
 error:'forge_legacy_proxy_disabled_to_prevent_paid_oversize_failure',
 next:'/api/spaktok-forge/gpu-ticket',
 paidGpuStarted:false,
}, {status,headers:{
 'cache-control':'private,no-store',
 'x-content-type-options':'nosniff',
}})

export async function GET(){return json(200)}
export async function POST(){return json(410)}
