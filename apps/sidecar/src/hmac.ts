import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Publish-request authentication: HMAC-SHA256 over `${timestamp}.${rawBody}`.
 * The timestamp bound (default 60s) makes captured requests non-replayable
 * beyond the window; timingSafeEqual prevents signature oracle timing.
 */
const MAX_SKEW_MS = 60_000

export function signPublish(secret: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")
}

export function verifyPublish(
  secret: string,
  timestamp: string | undefined,
  signature: string | undefined,
  rawBody: string
): boolean {
  if (!timestamp || !signature) return false
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > MAX_SKEW_MS) return false
  const expected = signPublish(secret, timestamp, rawBody)
  const a = Buffer.from(expected, "utf8")
  const b = Buffer.from(signature, "utf8")
  return a.length === b.length && timingSafeEqual(a, b)
}
