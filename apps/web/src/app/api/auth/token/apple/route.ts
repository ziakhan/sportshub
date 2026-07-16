import { NextResponse } from "next/server"
import { z } from "zod"
import { createRemoteJWKSet, jwtVerify } from "jose"
import { ensureAppleUser } from "@/lib/auth-social"
import { mintAccessToken } from "@/lib/native-auth-tokens"
import { issueRefreshToken } from "@/lib/native-auth"
import { rateLimit } from "@/lib/rate-limit"

/**
 * POST /api/auth/token/apple — native Sign in with Apple (App Store
 * requirement alongside Google). The app sends Apple's identityToken; we
 * verify it against Apple's JWKS (audience = our bundle id), then link by
 * email exactly like Google (auth-social.ts) and mint the normal
 * access/refresh pair. Apple only shares the name on FIRST authorization —
 * the app forwards it so new accounts aren't nameless.
 */

const appleSchema = z.object({
  identityToken: z.string().min(20),
  fullName: z
    .object({
      givenName: z.string().nullish(),
      familyName: z.string().nullish(),
    })
    .nullish(),
  deviceLabel: z.string().max(120).optional(),
})

const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"))
const BUNDLE_ID = "com.ysportshub.app"

export async function POST(request: Request) {
  try {
    const parsed = appleSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    if (!rateLimit(`apple:ip:${ip}`, 20, 15 * 60_000)) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 })
    }

    let payload: { email?: string; email_verified?: string | boolean; sub?: string }
    try {
      const verified = await jwtVerify(parsed.data.identityToken, APPLE_JWKS, {
        issuer: "https://appleid.apple.com",
        audience: BUNDLE_ID,
      })
      payload = verified.payload as typeof payload
    } catch {
      return NextResponse.json({ error: "Apple sign-in could not be verified" }, { status: 401 })
    }

    const email = payload.email?.trim().toLowerCase()
    if (!email) {
      // Extremely rare (email rides the identity token, relay included)
      return NextResponse.json(
        { error: "Apple didn't share an email for this account" },
        { status: 400 }
      )
    }

    const user = await ensureAppleUser({
      email,
      firstName: parsed.data.fullName?.givenName ?? null,
      lastName: parsed.data.fullName?.familyName ?? null,
    })
    if (!user) {
      return NextResponse.json({ error: "This account is not active" }, { status: 403 })
    }

    const [access, refreshToken] = await Promise.all([
      mintAccessToken(user.id),
      issueRefreshToken(user.id, { deviceLabel: parsed.data.deviceLabel }),
    ])

    return NextResponse.json({
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshToken,
      user,
    })
  } catch (err) {
    console.error("Apple token error:", err)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
