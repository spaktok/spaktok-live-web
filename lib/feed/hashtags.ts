const HASHTAG = /#([\p{L}\p{N}\p{M}_]{1,40})/gu
// Arabic tatweel and harakat change bytes but not meaning, so #سـبـاق and #سباق are one tag.
const ARABIC_NOISE = /[\u0640\u064B-\u065F\u0670]/g
const MAX_TAGS_PER_VIDEO = 10
const HALF_LIFE_HOURS = 24

export function normalizeHashtag(tag: string): string {
  return tag.normalize('NFC').replace(ARABIC_NOISE, '').toLocaleLowerCase()
}

export function extractHashtags(text: string | null | undefined): string[] {
  if (!text) return []
  const seen = new Set<string>()
  for (const match of text.matchAll(HASHTAG)) {
    const tag = normalizeHashtag(match[1])
    if (tag && !/^\d+$/.test(tag)) seen.add(tag)
    if (seen.size >= MAX_TAGS_PER_VIDEO) break
  }
  return [...seen]
}

export type TrendingSource = { description: string | null; createdAt: string; views: number }
export type TrendingTag = { tag: string; videos: number; score: number }

/** Recency-weighted: a tag used once today outranks a tag used once last week. */
export function rankTrendingHashtags(rows: TrendingSource[], now: number, limit = 12): TrendingTag[] {
  const totals = new Map<string, { videos: number; score: number }>()
  for (const row of rows) {
    const created = Date.parse(row.createdAt)
    if (!Number.isFinite(created)) continue
    const ageHours = Math.max(0, (now - created) / 3_600_000)
    const weight = Math.pow(0.5, ageHours / HALF_LIFE_HOURS) * (1 + Math.log10(1 + Math.max(0, row.views || 0)))
    for (const tag of extractHashtags(row.description)) {
      const entry = totals.get(tag) ?? { videos: 0, score: 0 }
      entry.videos += 1
      entry.score += weight
      totals.set(tag, entry)
    }
  }
  return [...totals]
    .map(([tag, v]) => ({ tag, videos: v.videos, score: Math.round(v.score * 1000) / 1000 }))
    .sort((a, b) => b.score - a.score || b.videos - a.videos || a.tag.localeCompare(b.tag))
    .slice(0, limit)
}
