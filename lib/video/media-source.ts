/** True for adaptive HLS manifest URLs, including signed Cloudflare Stream URLs. */
export function isHlsManifest(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      parsed.pathname.toLowerCase().endsWith('.m3u8')
  } catch {
    return false
  }
}

/** A manifest is a playlist, never an MP4 file to download. */
export function isDirectVideoFile(url: string): boolean {
  return !isHlsManifest(url)
}
