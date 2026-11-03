/** Viewer interest profile for the ranked feed, derived only from what the
 * viewer actually liked. Pure so the weighting is testable. */
import { extractHashtags, normalizeHashtag } from './hashtags'

export const MAX_INTEREST_SOURCES = 40
export const MAX_INTEREST_TAGS = 20
/** An interest fades to half its weight after three days of no reinforcement. */
const INTEREST_HALF_LIFE_HOURS = 72
const BOOST_PER_MATCH = 0.09
const MAX_AFFINITY_BOOST = 0.18

export type InterestSource = { description: string | null; at: string }
export type InterestProfile = Map<string, number>

/** Recent, repeated interests weigh more; the profile stays bounded so one
 * binge cannot permanently define a viewer. */
export function buildInterestProfile(sources: InterestSource[], now: number): InterestProfile {
  const weights: InterestProfile = new Map()
  for (const source of sources.slice(0, MAX_INTEREST_SOURCES)) {
    const at = Date.parse(source.at)
    const ageHours = Number.isFinite(at) ? Math.max(0, (now - at) / 3_600_000) : INTEREST_HALF_LIFE_HOURS
    const decay = Math.pow(0.5, ageHours / INTEREST_HALF_LIFE_HOURS)
    for (const tag of extractHashtags(source.description)) {
      weights.set(tag, (weights.get(tag) ?? 0) + decay)
    }
  }
  const strongest = Math.max(0, ...weights.values())
  return new Map(
    [...weights]
      .map(([tag, weight]) => [tag, strongest > 0 ? weight / strongest : 0] as const)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, MAX_INTEREST_TAGS),
  )
}

/** Up to +18% for content matching the viewer's strongest interests. Never a
 * hard filter: an unknown topic still competes on its own merits. */
export function interestMultiplier(tags: string[] | undefined, profile: InterestProfile | null | undefined): number {
  if (!tags?.length || !profile?.size) return 1
  let matched = 0
  for (const tag of tags) {
    const weight = profile.get(normalizeHashtag(tag.replace(/^#/, '')))
    if (weight) matched += weight
  }
  return 1 + Math.min(MAX_AFFINITY_BOOST, matched * BOOST_PER_MATCH)
}
