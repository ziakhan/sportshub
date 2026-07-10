import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

/**
 * Push quiet hours (M3 schema, M4 UI): "HH:MM" wall time in APP_TIMEZONE,
 * window may wrap midnight, null disables. The sidecar push worker reads
 * these columns at send time.
 */

const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/

const prefsSchema = z.object({
  pushQuietStart: z.string().regex(HHMM).nullable(),
  pushQuietEnd: z.string().regex(HHMM).nullable(),
})

export async function GET() {
  const auth = await getSessionUserId()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = await (prisma as any).user.findUnique({
    where: { id: auth.userId },
    select: { pushQuietStart: true, pushQuietEnd: true },
  })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  return NextResponse.json(user)
}

export async function PATCH(request: Request) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const parsed = prefsSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Quiet hours must be HH:MM times (or null to disable)" },
        { status: 400 }
      )
    }
    // Both-or-neither: a window needs two edges
    const { pushQuietStart, pushQuietEnd } = parsed.data
    if ((pushQuietStart === null) !== (pushQuietEnd === null)) {
      return NextResponse.json(
        { error: "Set both start and end, or clear both" },
        { status: 400 }
      )
    }

    await (prisma as any).user.update({
      where: { id: auth.userId },
      data: { pushQuietStart, pushQuietEnd },
    })
    return NextResponse.json({ ok: true, pushQuietStart, pushQuietEnd })
  } catch (error) {
    console.error("Push prefs error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
