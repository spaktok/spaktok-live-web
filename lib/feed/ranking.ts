/** Deterministic "For You" ranking: engagement quality, recency decay, viewer
 * affinity and creator diversity. Pure functions only so the ordering can be
 * tested and reasoned about without a database. The candidate window and the
 * scoring instant (`now`) are supplied by the caller, which is what keeps
 * cursor pagination stable while new videos keep arriving. */
import { interestMultiplier, type InterestProfile } from './interests'

export interface RankCandidate {
  id: string
  userId: string
  createdAt: string
  likes: number
  comments: number
  shares: number
  views: number
  isFollowing: boolean
  isVerified: boolean
  /** Hashtags of the video, used for interest affinity. */
  tags?: string[]
}

export interface RankCursor { score: number; id: string; at: number }

export const MAX_RANK_SCORE = 1_000_000_000
const HOUR = 3_600_000
/** An unengaged upload halves its reach roughly every day and a half. */
const RECENCY_HALF_LIFE_HOURS = 36
const FRESH_EXPLORATION_HOURS = 2
const RECENT_EXPLORATION_HOURS = 12
/** Prior engagement so a brand-new upload is never ranked into a dead zone. */
const ENGAGEMENT_PRIOR = 0.45
const MAX_CONSECUTIVE_PER_AUTHOR = 2

const count = (value: number) => (Number.isFinite(value) && value > 0 ? Math.floor(value) : 0)

/** Log-damped weighted engagement: comments and shares signal more intent than
 * a passive view, and a single viral video cannot dominate the whole feed. */
export function engagementValue(candidate: Pick<RankCandidate, 'likes' | 'comments' | 'shares'>): number {
  const weighted = 3 * count(candidate.likes) + 5 * count(candidate.comments) + 6 * count(candidate.shares)
  return Math.log1p(weighted)
}

/** Like-rate quality: 8% likes per view is treated as excellent, and anything
 * under 50 views is too little signal to judge, so it stays neutral. */
function qualityMultiplier(candidate: Pick<RankCandidate, 'likes' | 'views'>): number {
  const views = count(candidate.views)
  if (views < 50) return 1
  const rate = Math.min(1, Math.max(0, count(candidate.likes) / views / 0.08))
  return 0.8 + 0.45 * rate
}

function explorationMultiplier(ageHours: number): number {
  if (ageHours <= FRESH_EXPLORATION_HOURS) return 1.6
  if (ageHours <= RECENT_EXPLORATION_HOURS) return 1.25
  return 1
}

export function scoreCandidate(
  candidate: RankCandidate,
  now: number,
  interests?: InterestProfile | null,
): number {
  const created = Date.parse(candidate.createdAt)
  const ageHours = Number.isFinite(created) ? Math.max(0, (now - created) / HOUR) : FRESH_EXPLORATION_HOURS
  const recency = Math.pow(0.5, ageHours / RECENCY_HALF_LIFE_HOURS)
  const social = (candidate.isFollowing ? 1.35 : 1) * (candidate.isVerified ? 1.05 : 1)
  const score =
    1000 *
    (engagementValue(candidate) + ENGAGEMENT_PRIOR) *
    (0.35 + 0.65 * recency) *
    qualityMultiplier(candidate) *
    explorationMultiplier(ageHours) *
    social *
    interestMultiplier(candidate.tags, interests)
  if (!Number.isFinite(score)) return 0
  return Math.min(MAX_RANK_SCORE, Math.max(0, Math.round(score)))
}

function tailStreak(items: Array<{ userId: string }>, userId: string): number {
  let streak = 0
  for (let i = items.length - 1; i >= 0 && items[i].userId === userId; i--) streak++
  return streak
}

/** Greedy author diversity: never more than two consecutive videos from one
 * creator, and it only reorders — nothing is dropped. */
export function diversifyByAuthor<T extends { userId: string }>(ordered: T[]): T[] {
  const remaining = [...ordered]
  const result: T[] = []
  while (remaining.length) {
    let picked = 0
    for (let i = 0; i < remaining.length; i++) {
      if (tailStreak(result, remaining[i].userId) < MAX_CONSECUTIVE_PER_AUTHOR) {
        picked = i
        break
      }
    }
    result.push(remaining.splice(picked, 1)[0])
  }
  return result
}

/** Sorts by score (desc), then recency, then id — a total order, so the same
 * candidate set always produces the same feed. */
export function rankCandidates<T extends RankCandidate>(
  candidates: T[],
  now: number,
  interests?: InterestProfile | null,
): Array<T & { score: number }> {
  const scored = candidates.map(candidate => ({ ...candidate, score: scoreCandidate(candidate, now, interests) }))
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const createdDelta = Date.parse(b.createdAt) - Date.parse(a.createdAt)
    if (Number.isFinite(createdDelta) && createdDelta !== 0) return createdDelta
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0
  })
  return diversifyByAuthor(scored)
}

function isAfter<T extends { id: string; score: number }>(item: T, cursor: RankCursor): boolean {
  if (item.score !== cursor.score) return item.score < cursor.score
  return item.id < cursor.id
}

/** Keyset page over an already-ranked list, strictly after the cursor. `at` is
 * the scoring instant pinned by the first page and carried forward. */
export function selectRankedPage<T extends { id: string; score: number }>(
  ranked: T[],
  cursor: RankCursor | null,
  limit: number,
  at: number,
): { page: T[]; nextCursor: RankCursor | null } {
  const size = Math.max(1, Math.trunc(limit) || 1)
  const start = cursor ? ranked.filter(item => isAfter(item, cursor)) : ranked
  const page = start.slice(0, size)
  const last = page.at(-1)
  const more = start.length > page.length
  return { page, nextCursor: more && last ? { score: last.score, id: last.id, at } : null }
}
