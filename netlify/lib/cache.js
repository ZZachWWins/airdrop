/**
 * Per-instance TTL memoisation.
 *
 * Netlify Function instances are short-lived and there may be many of them, so
 * this is a best-effort shock absorber for the expensive aggregate reads
 * (leaderboard, activity breakdown) rather than a real cache. Numbers can lag
 * by up to the TTL; nothing that gates eligibility reads through here.
 */

const entries = new Map()

export async function cached(key, ttlMs, produce) {
  const hit = entries.get(key)
  if (hit && Date.now() - hit.at < ttlMs) return hit.value

  const value = await produce()
  entries.set(key, { value, at: Date.now() })
  return value
}
