import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

/**
 * Push-device registry (M3 — docs/roadmap/native-app-execution-plan.md).
 * POST   — register/refresh; the app calls this on every launch. Upsert by
 *          token: a token that switches accounts moves to the new user
 *          (families share tablets), revocation is cleared on re-register.
 * DELETE — sign-out for this device; only the token's owner can revoke it.
 * Bearer-authenticated in practice (the native app), but any authed session
 * works — getSessionUserId covers both.
 */

const registerSchema = z.object({
  token: z.string().min(10).max(300),
  platform: z.enum(["IOS", "ANDROID"]),
  appVersion: z.string().max(40).optional(),
})

export async function POST(request: Request) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const parsed = registerSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "token and platform are required" }, { status: 400 })
    }
    const { token, platform, appVersion } = parsed.data

    await (prisma as any).device.upsert({
      where: { token },
      create: { userId: auth.userId, token, platform, appVersion: appVersion ?? null },
      update: {
        userId: auth.userId,
        platform,
        appVersion: appVersion ?? null,
        lastSeenAt: new Date(),
        revokedAt: null,
      },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Device register error:", err)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

const revokeSchema = z.object({ token: z.string().min(10).max(300) })

export async function DELETE(request: Request) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const parsed = revokeSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "token is required" }, { status: 400 })
    }

    await (prisma as any).device.updateMany({
      where: { token: parsed.data.token, userId: auth.userId },
      data: { revokedAt: new Date() },
    })
    // Uniform response — doesn't reveal whether the token existed
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Device revoke error:", err)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
