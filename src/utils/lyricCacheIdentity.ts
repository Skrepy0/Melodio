export const normalizeLyricIdentity = (value: string) =>
  value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
// Unknown duration is only merged with unknown duration. Preserve version words in titles.
export function findLyricDuration(duration: number, candidates: number[]): number {
  const exact = candidates.indexOf(duration)
  if (exact >= 0) return exact
  if (duration <= 0) return -1
  const matches = candidates.flatMap((value, index) =>
    value > 0 && Math.abs(value - duration) <= 5000 ? [index] : []
  )
  return matches.length === 1 ? matches[0] : -1
}
