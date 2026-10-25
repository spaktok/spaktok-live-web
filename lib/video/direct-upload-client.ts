/** Direct browser -> Cloudflare Stream upload with progress, cancellation and a strict endpoint host. */
export async function uploadVideoDirect(
  uploadURL: string,
  blob: Blob,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const url = new URL(uploadURL)
  if (url.protocol !== 'https:' || url.hostname !== 'upload.videodelivery.net' ||
      url.username || url.password) throw new Error('invalid_upload_url')
  if (signal?.aborted) throw new Error('upload_cancelled')

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let finished = false
    const finish = (error?: Error) => {
      if (finished) return
      finished = true
      signal?.removeEventListener('abort', cancel)
      if (error) reject(error)
      else resolve()
    }
    const cancel = () => xhr.abort()
    xhr.open('POST', url.toString())
    xhr.timeout = 300000
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(100, Math.round(event.loaded / event.total * 100)))
      }
    }
    xhr.onload = () => finish(xhr.status >= 200 && xhr.status < 300
      ? undefined : new Error('stream_upload_failed'))
    xhr.onerror = () => finish(new Error('upload_network_error'))
    xhr.ontimeout = () => finish(new Error('upload_timeout'))
    xhr.onabort = () => finish(new Error('upload_cancelled'))
    signal?.addEventListener('abort', cancel, { once: true })
    const data = new FormData()
    const mime = blob.type.split(';')[0] || 'video/webm'
    const filename = mime === 'video/mp4' ? 'spaktok.mp4' : 'spaktok.webm'
    data.append('file', blob, filename)
    xhr.send(data)
  })
}
