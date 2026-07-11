import { NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getMyCalendar } from "@/lib/calendar/my-calendar"

export const dynamic = "force-dynamic"

/**
 * GET /api/calendar/mine — the signed-in user's cross-team calendar
 * (family + staff sides) with RSVP context. Self-scoped: no params, no
 * cross-user access. Powers /calendar, polled like the team calendar.
 */
export async function GET() {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return NextResponse.json(await getMyCalendar(auth.userId))
  } catch (error) {
    console.error("My-calendar error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
