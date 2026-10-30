/** Strict period allowlist for a real, non-financial creator leaderboard. */
export const CREATOR_RANK_WINDOWS=['week','month','all'] as const
export type CreatorRankWindow=(typeof CREATOR_RANK_WINDOWS)[number]
export function parseRankWindow(value:string|null):CreatorRankWindow|null{
 const window=value??'week'
 return CREATOR_RANK_WINDOWS.includes(window as CreatorRankWindow)
  ?window as CreatorRankWindow:null
}
