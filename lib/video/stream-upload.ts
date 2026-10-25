/** Server-only Stream API client. No browser token or customer code. */
export const STREAM_MAX_BYTES = 100 * 1024 * 1024
export const STREAM_MAX_SECONDS = 60
export const STREAM_MAX_DAILY = 5
export const STREAM_UPLOAD_EXPIRY_MINUTES = 15

const uid = /^[a-f0-9]{32}$/
const accountId = /^[a-f0-9]{32}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function validUUID(value: string): boolean { return UUID.test(value) }
export function validStreamUid(value: string): boolean { return uid.test(value) }

export function videoRequestIsValid(value: unknown): value is { name: string; bytes: number; mimeType: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const input = value as Record<string, unknown>
  return typeof input.name === 'string' && input.name.length >= 1 && input.name.length <= 120 &&
    !/[\\/\x00-\x1f]/.test(input.name) &&
    typeof input.bytes === 'number' && Number.isSafeInteger(input.bytes) &&
    input.bytes >= 1024 && input.bytes <= STREAM_MAX_BYTES &&
    typeof input.mimeType === 'string' &&
    ['video/webm', 'video/mp4', 'video/quicktime'].includes(input.mimeType)
}

export function getStreamConfig(): { account: string; token: string } | null {
  if (process.env.SPAKTOK_STREAM_UPLOADS_ENABLED !== 'true') return null
  const account = process.env.CLOUDFLARE_ACCOUNT_ID?.toLowerCase()
  const token = process.env.CLOUDFLARE_STREAM_API_TOKEN
  if (!account || !accountId.test(account) || !token || token.length < 15) return null
  return { account, token }
}

function apiUrl(account: string, path: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${account}/stream/${path}`
}

async function cfRequest(url: string, token: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    signal: AbortSignal.timeout(12000),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('cloudflare_unavailable')
  const json: unknown = await response.json()
  if (!json || typeof json !== 'object' || (json as { success?: unknown }).success !== true) {
    throw new Error('cloudflare_unavailable')
  }
  return (json as { result?: unknown }).result
}

export async function createDirectVideoUpload(
  config: { account: string; token: string },
  userId: string,
  reservationId: string,
): Promise<{ uid: string; uploadURL: string }> {
  const result = await cfRequest(apiUrl(config.account, 'direct_upload'), config.token, {
    method: 'POST',
    body: JSON.stringify({
      maxDurationSeconds: STREAM_MAX_SECONDS,
      expiry: new Date(Date.now() + STREAM_UPLOAD_EXPIRY_MINUTES * 60000).toISOString(),
      requireSignedURLs: true,
      creator: userId,
      meta: { app: 'SpakTok', reservationId },
    }),
  })
  const r = result as { uid?: unknown; uploadURL?: unknown } | null
  if (!r || typeof r.uid !== 'string' || !validStreamUid(r.uid) ||
      typeof r.uploadURL !== 'string') throw new Error('cloudflare_invalid_response')
  let url: URL
  try { url = new URL(r.uploadURL) } catch { throw new Error('cloudflare_invalid_response') }
  if (url.protocol !== 'https:' || url.hostname !== 'upload.videodelivery.net' ||
      url.username || url.password) throw new Error('cloudflare_invalid_response')
  return { uid: r.uid, uploadURL: url.toString() }
}

type StreamDetails = {
  uid?: string
  creator?: string
  readyToStream?: boolean
  requireSignedURLs?: boolean
  meta?: { reservationId?: string; app?: string }
  status?: { state?: string }
  duration?: number
}
export async function getVideoProcessingState(
  config: { account: string; token: string }, uidValue: string,
  ownerId: string, reservationId: string,
): Promise<{ state: 'pending_upload' | 'processing' | 'ready_for_review' | 'failed'; durationSeconds: number | null }> {
  if (!validStreamUid(uidValue) || !validUUID(reservationId)) throw new Error('invalid_video')
  const result = await cfRequest(apiUrl(config.account, uidValue), config.token, { method: 'GET' })
  const video = result as StreamDetails | null
  // Fail closed; no URL is ever returned for private/unmoderated uploads.
  if (video?.uid !== uidValue || video.creator !== ownerId ||
      video.requireSignedURLs !== true ||
      video.meta?.reservationId !== reservationId ||
      video.meta?.app !== 'SpakTok') throw new Error('stream_ownership_mismatch')
  const state = video.status?.state === 'error' ? 'failed'
    : video.readyToStream === true ? 'ready_for_review'
      : video.status?.state === 'pendingupload' ? 'pending_upload' : 'processing'
  return {
    state,
    durationSeconds: typeof video.duration === 'number' && Number.isFinite(video.duration)
      ? video.duration : null,
  }
}
