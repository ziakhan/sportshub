/** Environment contract. Fail fast on missing secrets — a sidecar that starts
 * without them would silently accept nothing (or worse, everything). */
function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

export const env = {
  port: parseInt(process.env.PORT || "8080", 10),
  /** Shared secret for server→sidecar publishes (HMAC). Same value on Vercel. */
  sidecarSharedSecret: required("SIDECAR_SHARED_SECRET"),
  /** Verifies socket tickets + (M2) native bearer tokens. Same value on Vercel. */
  authTokenSecret: required("AUTH_TOKEN_SECRET"),
  /** Optional: enables the Redis adapter (multi-instance) + BullMQ (M3). */
  redisUrl: process.env.REDIS_URL || null,
  /** Comma-separated allowed socket origins, e.g. the Vercel prod + preview URLs. */
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
}
