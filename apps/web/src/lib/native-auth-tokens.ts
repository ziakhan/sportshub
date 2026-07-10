import { SignJWT, jwtVerify } from "jose"

/**
 * Native-app access tokens (M2 — docs/roadmap/native-app-execution-plan.md).
 *
 * Edge-safe on purpose: middleware verifies Bearer requests with this module,
 * so it must not import Prisma or node:crypto. Tokens are signed with
 * AUTH_TOKEN_SECRET — the same secret the realtime sidecar verifies socket
 * tickets with, so a native access token also works as a socket handshake
 * ticket. The `token_use` claim keeps that one-directional: short-lived
 * realtime tickets (M1) won't carry token_use=access, so a leaked ticket can
 * never be replayed as an API credential.
 */

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_TOKEN_SECRET
  if (!secret) throw new Error("AUTH_TOKEN_SECRET is not set")
  return new TextEncoder().encode(secret)
}

export async function mintAccessToken(
  userId: string
): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000)
  const token = await new SignJWT({ token_use: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secretKey())
  return { token, expiresAt }
}

/**
 * Returns the userId, or null for anything invalid — bad signature, expired,
 * not an access token, or AUTH_TOKEN_SECRET unset (fail closed).
 */
export async function verifyAccessToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey())
    if (payload.token_use !== "access" || typeof payload.sub !== "string") return null
    return payload.sub
  } catch {
    return null
  }
}

/** Extracts the raw token from an `Authorization: Bearer …` header, or null. */
export function bearerToken(header: string | null | undefined): string | null {
  if (!header) return null
  const [scheme, token] = header.split(" ")
  if (scheme?.toLowerCase() !== "bearer" || !token) return null
  return token
}
