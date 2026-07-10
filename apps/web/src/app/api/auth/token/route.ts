import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeCredentials } from "@/lib/auth-credentials"
import { mintAccessToken } from "@/lib/native-auth-tokens"
import { issueRefreshToken } from "@/lib/native-auth"
import { rateLimit } from "@/lib/rate-limit"

/**
 * POST /api/auth/token — native-app sign-in (M2 bearer auth).
 * Same credential checks as the NextAuth web flow (authorizeCredentials:
 * bcrypt + ACTIVE), but returns a 15-min access JWT + rotating 60-day
 * refresh token instead of a session cookie.
 */

const tokenSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
  deviceLabel: z.string().max(120).optional(),
})

export async function POST(request: Request) {
  try {
    const parsed = tokenSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }
    const { email, password, deviceLabel } = parsed.data

    // Two keys: rotating emails burns the per-IP budget, rotating IPs still
    // trips the per-account key. Attempts count whether or not they succeed.
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    const withinLimits =
      rateLimit(`token:ip:${ip}`, 20, 15 * 60_000) &&
      rateLimit(`token:email:${email}`, 10, 15 * 60_000)
    if (!withinLimits) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 })
    }

    const user = await authorizeCredentials({ email, password })
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    const [access, refreshToken] = await Promise.all([
      mintAccessToken(user.id),
      issueRefreshToken(user.id, { deviceLabel }),
    ])

    return NextResponse.json({
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshToken,
      user,
    })
  } catch (err) {
    console.error("Native token error:", err)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
