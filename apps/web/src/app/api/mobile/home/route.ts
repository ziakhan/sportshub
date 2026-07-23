import { NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getNavShape } from "@/lib/queries/nav-shape"
import { getMyContexts } from "@/lib/queries/my-contexts"
import { getYourTeams } from "@/lib/queries/home"

export const dynamic = "force-dynamic"

/**
 * GET /api/mobile/home — one round trip powering the native app's Home tab
 * and tab bar (N3-v2 parity): the light nav shape (which tabs exist for this
 * role) plus the personal band (getMyContexts — same resolver as the web
 * home, so the two surfaces can never disagree) plus the bell's unread
 * count (top-bar dot). Bearer or session auth.
 */
export async function GET() {
  const session = await getSessionUserId()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const [shape, contexts, unreadNotifications, yourTeams] = await Promise.all([
    getNavShape(session.userId),
    getMyContexts(session.userId),
    prisma.notification.count({ where: { userId: session.userId, isRead: false } }),
    // Squad cards (native-parity-v2 P1): the SAME rail data the web home
    // renders — last game, next game, kid stat lines per team.
    getYourTeams(session.userId),
  ])
  return NextResponse.json({ shape, contexts, unreadNotifications, yourTeams })
}
