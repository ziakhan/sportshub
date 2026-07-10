/**
 * In-memory sliding-window rate limiter, used by the native-auth endpoints.
 *
 * Serverless honesty: state lives per warm function instance, so this
 * throttles repeated attempts hitting the same instance rather than acting
 * as a global limit. That is acceptable as a first line for credential
 * endpoints — the real defenses are bcrypt cost and uniform 401s. Move to a
 * shared store (the sidecar's Redis) if login abuse ever shows up in prod.
 */

const buckets = new Map<string, number[]>()

/** Records an attempt for `key`; returns false when over `max` per window. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const cutoff = now - windowMs
  const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff)
  if (hits.length >= max) {
    buckets.set(key, hits)
    return false
  }
  hits.push(now)
  buckets.set(key, hits)

  // Opportunistic GC so a long-lived dev server doesn't accumulate keys.
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => t <= cutoff)) buckets.delete(k)
    }
  }
  return true
}

/** Test hook — clears all rate-limit state. */
export function resetRateLimits(): void {
  buckets.clear()
}
