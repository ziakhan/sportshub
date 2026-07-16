import { NextResponse } from "next/server"
import { z } from "zod"
import { createRemoteJWKSet, jwtVerify } from "jose"
import { ensureGoogleUser } from "@/lib/auth-social"
import { mintAccessToken } from "@/lib/native-auth-tokens"
import { issueRefreshToken } from "@/lib/native-auth"
import { rateLimit } from "@/lib/rate-limit"

/**
 * POST /api/auth/token/google — native Google sign-in (mirror of the Apple
 * route). The app's native Google sheet returns an idToken; we verify it
 * against Google's JWKS, require a verified email, then link by email via
 * auth-social.ts and mint the normal access/refresh pair.
 */

const googleSchema = z.object({
  idToken: z.string().min(20),
  deviceLabel: z.string().max(120).optional(),
})

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"))

// All three OAuth clients live in one GCP project. The app is configured with
// the WEB client id, so `aud` is normally the web id — the platform ids are
// accepted defensively (GoogleSignin has issued platform-audience tokens on
// some Android/Play-services versions).
const CLIENT_IDS = [
  process.env.GOOGLE_CLIENT_ID ?? "",
  "1011644585799-jgim78lhp8plp8pu3apv5eqtua8m66gh.apps.googleusercontent.com", // iOS
  "1011644585799-2ee04qegf5nuos2ir5qhompv951uodo7.apps.googleusercontent.com", // Android
].filter(Boolean)

export async function POST(request: Request) {
  try {
    const parsed = googleSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    if (!rateLimit(`google:ip:${ip}`, 20, 15 * 60_000)) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 })
    }

    let payload: {
      email?: string
      email_verified?: boolean | string
      given_name?: string
      family_name?: string
      picture?: string
    }
    try {
      const verified = await jwtVerify(parsed.data.idToken, GOOGLE_JWKS, {
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience: CLIENT_IDS,
      })
      payload = verified.payload as typeof payload
    } catch {
      return NextResponse.json({ error: "Google sign-in could not be verified" }, { status: 401 })
    }

    const email = payload.email?.trim().toLowerCase()
    // Unverified emails must not attach to existing accounts (linking is by
    // email — same rule the web's NextAuth Google provider enforces).
    const emailVerified = payload.email_verified === true || payload.email_verified === "true"
    if (!email || !emailVerified) {
      return NextResponse.json(
        { error: "Google didn't share a verified email for this account" },
        { status: 400 }
      )
    }

    const user = await ensureGoogleUser({
      email,
      firstName: payload.given_name ?? null,
      lastName: payload.family_name ?? null,
      avatarUrl: payload.picture ?? null,
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
    console.error("Google token error:", err)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
