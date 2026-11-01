/** SQLite UTC timestamp normalizer for native activity dates.
 * D1 can return "YYYY-MM-DD HH:mm:ss", ISO UTC, or an explicit ISO offset.
 * Never append Z to a value which already contains a timezone.
 */
export function activityTimeMs(raw: string): number | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})?$/.test(value)) return null
  const iso = value.replace(' ', 'T')
  const withZone = /(?:Z|[+-]\d{2}:\d{2})$/.test(iso) ? iso : iso + 'Z'
  const ms = Date.parse(withZone)
  return Number.isFinite(ms) ? ms : null
}

export function relativeActivityTime(raw: string, nowMs: number = Date.now()): string {
  const at = activityTimeMs(raw)
  if (at === null) return ''
  const seconds = Math.max(0, Math.floor((nowMs - at) / 1000))
  if (seconds < 60) return 'الآن'
  if (seconds < 3600) return 'قبل ' + Math.floor(seconds / 60) + ' د'
  if (seconds < 86400) return 'قبل ' + Math.floor(seconds / 3600) + ' س'
  return new Date(at).toLocaleDateString('ar')
}
