import { NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/chat/teams — the viewer's chat-eligible teams (staff teams +
 * their kids' active teams). Powers the share-to-chat team picker
 * (social-feed-plan P5).
 */
export async function GET() {
  const sessionInfo = await getSessionUserId()
  if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [staffRoles, children] = await Promise.all([
    (prisma as any).userRole.findMany({
      where: { userId: sessionInfo.userId, teamId: { not: null }, role: { in: ["Staff", "TeamManager"] } },
      select: { teamId: true },
    }),
    (prisma as any).player.findMany({
      where: { parentId: sessionInfo.userId, deletedAt: null },
      select: { teams: { where: { status: "ACTIVE" }, select: { teamId: true } } },
    }),
  ])
  const ids = new Set<string>(staffRoles.map((r: any) => r.teamId))
  for (const child of children) for (const tp of child.teams) ids.add(tp.teamId)
  if (ids.size === 0) return NextResponse.json({ teams: [] })

  const teams = await (prisma as any).team.findMany({
    where: { id: { in: [...ids] }, archivedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  return NextResponse.json({ teams })
}
