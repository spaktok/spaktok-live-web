export async function shareExternally(data: { title: string; text: string; url: string }) {
  if (typeof navigator !== 'undefined' && navigator.share) {
    await navigator.share(data)
    return 'shared'
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(data.url)
    return 'copied'
  }
  return 'unavailable'
}

export async function downloadVideo(url: string, filename: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error('download_failed')
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

