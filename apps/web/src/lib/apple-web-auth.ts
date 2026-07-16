import { createPrivateKey, sign } from "crypto"

/**
 * Sign in with Apple (web) — Apple has no static client secret; you sign a
 * short-lived ES256 JWT with the .p8 key from the developer portal (Team ID
 * V5S8N9K3X8, Services ID com.ysportshub.web). Synchronous on purpose:
 * authOptions' providers array is built at module load, so the secret must
 * exist before any await. Cached per process; Apple caps validity at 6
 * months, we mint 150 days and processes never live that long.
 *
 * Env (all four required for the provider/button to appear — same gating
 * pattern as Google): APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_CLIENT_ID,
 * APPLE_PRIVATE_KEY_B64 (base64 of the whole .p8 file).
 */

export function appleWebEnabled(): boolean {
  return !!(
    process.env.APPLE_TEAM_ID &&
    process.env.APPLE_KEY_ID &&
    process.env.APPLE_CLIENT_ID &&
    process.env.APPLE_PRIVATE_KEY_B64
  )
}

const b64url = (input: Buffer | string): string =>
  Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")

let cached: { secret: string; mintedAt: number } | null = null

export function appleClientSecret(): string {
  // Re-mint after 30 days — far inside the 150-day validity.
  if (cached && Date.now() - cached.mintedAt < 30 * 24 * 60 * 60 * 1000) {
    return cached.secret
  }

  const key = createPrivateKey(
    Buffer.from(process.env.APPLE_PRIVATE_KEY_B64!, "base64").toString("utf8")
  )
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: "ES256", kid: process.env.APPLE_KEY_ID }))
  const payload = b64url(
    JSON.stringify({
      iss: process.env.APPLE_TEAM_ID,
      iat: now - 60,
      exp: now + 150 * 24 * 60 * 60,
      aud: "https://appleid.apple.com",
      sub: process.env.APPLE_CLIENT_ID,
    })
  )
  // JWTs want the raw r||s signature, not ASN.1 DER — hence ieee-p1363.
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), {
    key,
    dsaEncoding: "ieee-p1363",
  })
  cached = { secret: `${header}.${payload}.${b64url(signature)}`, mintedAt: Date.now() }
  return cached.secret
}
