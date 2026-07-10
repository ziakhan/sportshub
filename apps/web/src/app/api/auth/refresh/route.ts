import { NextResponse } from "next/server"
import { z } from "zod"
import { mintAccessToken } from "@/lib/native-auth-tokens"
import { rotateRefreshToken } from "@/lib/native-auth"
import { rateLimit } from "@/lib/rate-limit"

/**
 * POST /api/auth/refresh — rotate a native refresh token (M2 bearer auth).
 * A 401 here means the app must send the user back to sign-in: the token was
 * unknown, expired, already rotated (replay → whole family revoked), or the
 * account is no longer ACTIVE.
 */

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
})

export async function POST(request: Request) {
  try {
    const parsed = refreshSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "refreshToken is required" }, { status: 400 })
    }

    // Token space is 256-bit so guessing is hopeless; this just keeps a
    // misbehaving client from hammering the DB.
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    if (!rateLimit(`refresh:ip:${ip}`, 60, 15 * 60_000)) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 })
    }

    const rotated = await rotateRefreshToken(parsed.data.refreshToken)
    if (!rotated) {
      return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 })
    }

    const access = await mintAccessToken(rotated.userId)
    return NextResponse.json({
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshToken: rotated.refreshToken,
    })
  } catch (err) {
    console.error("Native refresh error:", err)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
