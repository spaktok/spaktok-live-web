import { describe, expect, it } from 'vitest'
import { isHlsManifest, isDirectVideoFile } from './media-source'

describe('media format selection', () => {
  it('recognizes Cloudflare Stream signed HLS playlists', () => {
    const url = 'https://customer-demo.cloudflarestream.com/id/manifest/video.m3u8?token=signed'
    expect(isHlsManifest(url)).toBe(true)
    expect(isDirectVideoFile(url)).toBe(false)
  })
  it('keeps legacy MP4 uploads working', () => {
    expect(isHlsManifest('https://cdn.example.org/v/abcd.mp4?sig=abc')).toBe(false)
    expect(isDirectVideoFile('https://cdn.example.org/v/abcd.mp4')).toBe(true)
  })
  it('does not confuse fake paths and arbitrary schemes with HLS', () => {
    expect(isHlsManifest('https://example.org/video.mp4?file=video.m3u8')).toBe(false)
    expect(isHlsManifest('javascript:alert(1)/video.m3u8')).toBe(false)
  })
})
