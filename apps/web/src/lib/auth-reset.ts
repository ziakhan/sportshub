// Signed, stateless password-reset tokens — mirrors lib/comms/unsubscribe.ts.
// HMAC over the payload with NEXTAUTH_SECRET; no DB table or round-trip to
// verify. The token embeds:
//   - exp: hard 1-hour expiry
//   - pwFrag: the tail of the CURRENT passwordHash — once the password
//     changes (via this flow or any other), every outstanding token dies,
//     so a reset link is single-use without server-side state.

import { createHmac, timingSafeEqual } from "crypto"

const TOKEN_TTL_SECONDS = 60 * 60 // 1 hour

/** How much of the passwordHash the token binds to. */
const PW_FRAG_LENGTH = 16

export interface PasswordResetPayload {
  userId: string
  /** Unix seconds after which the token is dead. */
  exp: number
  /** Tail of the passwordHash at issue time — must still match at redeem time. */
  pwFrag: string
}

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET
  if (!s) throw new Error("NEXTAUTH_SECRET is required for password-reset tokens")
  return s
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url")
}

export function passwordHashFragment(passwordHash: string): string {
  return passwordHash.slice(-PW_FRAG_LENGTH)
}

export function createPasswordResetToken(userId: string, passwordHash: string): string {
  const payload: [string, number, string] = [
    userId,
    Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    passwordHashFragment(passwordHash),
  ]
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${data}.${sign(data)}`
}

/**
 * Verifies signature + expiry and returns the payload, or null.
 * The caller MUST still compare `pwFrag` against the user's CURRENT
 * passwordHash (via `passwordHashFragment`) — that check is what makes
 * tokens single-use.
 */
export function verifyPasswordResetToken(token: string): PasswordResetPayload | null {
  const dot = token.lastIndexOf(".")
  if (dot <= 0) return null
  const data = token.slice(0, dot)
  const mac = token.slice(dot + 1)
  const expected = sign(data)
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const [userId, exp, pwFrag] = JSON.parse(Buffer.from(data, "base64url").toString())
    if (typeof userId !== "string" || !userId) return null
    if (typeof exp !== "number" || exp < Math.floor(Date.now() / 1000)) return null
    if (typeof pwFrag !== "string" || !pwFrag) return null
    return { userId, exp, pwFrag }
  } catch {
    return null
  }
}
