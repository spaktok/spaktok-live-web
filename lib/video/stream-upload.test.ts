import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDirectVideoUpload, getStreamConfig, getVideoProcessingState, videoRequestIsValid } from './stream-upload'

afterEach(() => { vi.unstubAllGlobals(); delete process.env.SPAKTOK_STREAM_UPLOADS_ENABLED })
describe('Stream upload security', () => {
  const cfg = { account: 'a'.repeat(32), token: 'test-token-never-store-in-repo' }
  const uid = 'b'.repeat(32)
  const resId = 'c3dc7435-e705-4072-9ff3-fb7c1ed3b4e4'
  const user = '6e33055e-0ee9-4e73-9afb-c77b749bfe68'
  it('stays off unless explicitly opted in', () => {
    delete process.env.SPAKTOK_STREAM_UPLOADS_ENABLED
    expect(getStreamConfig()).toBeNull()
  })
  it('validates maximum bytes, mime and filename', () => {
    expect(videoRequestIsValid({ name: 'clip.webm', bytes: 40000, mimeType: 'video/webm' })).toBe(true)
    expect(videoRequestIsValid({ name: '../clip.webm', bytes: 40000, mimeType: 'video/webm' })).toBe(false)
    expect(videoRequestIsValid({ name: 'clip.webm', bytes: 110_000_000, mimeType: 'video/webm' })).toBe(false)
    expect(videoRequestIsValid({ name: 'clip.exe', bytes: 40000, mimeType: 'application/octet-stream' })).toBe(false)
  })
  it('creates private expiring upload URL without returning API token', async () => {
    const fn = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body))
      expect(body.creator).toBe(user)
      expect(body.meta.reservationId).toBe(resId)
      expect(body.requireSignedURLs).toBe(true)
      expect(body.maxDurationSeconds).toBe(60)
      return { ok: true, json: async () => ({ success: true, result: { uid, uploadURL: `https://upload.videodelivery.net/${uid}` } }) }
    })
    vi.stubGlobal('fetch', fn)
    const issued = await createDirectVideoUpload(cfg, user, resId)
    expect(issued.uid).toBe(uid)
    expect(issued.uploadURL).not.toContain(cfg.token)
  })
  it('rejects an unexpected Cloudflare upload destination', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true, result: { uid, uploadURL: 'https://evil.example/upload' } }) })))
    await expect(createDirectVideoUpload(cfg, user, resId)).rejects.toThrow('cloudflare_invalid_response')
  })
  it('rejects video status if its creator metadata does not match', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({
      success: true, result: { uid, creator: 'someone-else', requireSignedURLs: true, readyToStream: true, meta: { app: 'SpakTok', reservationId: resId } },
    }) })))
    await expect(getVideoProcessingState(cfg, uid, user, resId)).rejects.toThrow('stream_ownership_mismatch')
  })
  it('marks a verified encoded video ready for review, not publication', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({
      success: true, result: { uid, creator: user, requireSignedURLs: true, readyToStream: true, meta: { app: 'SpakTok', reservationId: resId }, duration: 42, status: { state: 'ready' } },
    }) })))
    expect(await getVideoProcessingState(cfg, uid, user, resId))
      .toEqual({ state: 'ready_for_review', durationSeconds: 42 })
  })
})
