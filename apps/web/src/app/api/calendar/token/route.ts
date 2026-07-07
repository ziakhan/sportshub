import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

/**
 * POST /api/calendar/token — mint (or return) the caller's personal iCal
 * feed token. The token is the feed's only auth, so it's unguessable and
 * per-user; DELETE rotates it (old links stop working).
 */
export async function POST() {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await (prisma as any).user.findUnique({
      where: { id: auth.userId },
      select: { calendarToken: true },
    })
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })

    let token = user.calendarToken
    if (!token) {
      token = randomUUID().replace(/-/g, "")
      await (prisma as any).user.update({
        where: { id: auth.userId },
        data: { calendarToken: token },
      })
    }
    return NextResponse.json({ token, path: `/api/calendar/${token}` })
  } catch (error) {
    console.error("Calendar token error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** DELETE /api/calendar/token — rotate: invalidate the current feed URL. */
export async function DELETE() {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    await (prisma as any).user.update({
      where: { id: auth.userId },
      data: { calendarToken: null },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Calendar token rotate error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
