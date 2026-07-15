import { NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

/**
 * GET /api/mobile/operator — read-only operations summary for the native
 * Dashboard tab (audit v2 §2: operator worlds render NATIVELY, read-only;
 * config/editing stays desktop with a "finish on computer" note, never a
 * webview). Per operated club: teams, pending offers, games this week, open
 * tryouts. Per owned league: active seasons + submitted teams.
 */
export async function GET() {
  try {
    const session = await getSessionUserId()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const roles = await prisma.userRole.findMany({
      where: { userId: session.userId, tenantId: { not: null } },
      select: { tenantId: true, role: true },
    })
    const tenantIds = Array.from(new Set(roles.map((r) => r.tenantId as string)))

    const weekAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const now = new Date()

    const [tenants, teamRows, gameGroups, tryoutGroups, leagues] = await Promise.all([
      tenantIds.length
        ? prisma.tenant.findMany({
            where: { id: { in: tenantIds } },
            select: { id: true, name: true, slug: true },
          })
        : Promise.resolve([]),
      tenantIds.length
        ? prisma.team.findMany({
            where: { tenantId: { in: tenantIds } },
            select: {
              id: true,
              tenantId: true,
              _count: { select: { offers: { where: { status: "PENDING" } } } },
            },
          })
        : Promise.resolve([]),
      tenantIds.length
        ? prisma.game.groupBy({
            by: ["homeTeamId"],
            where: {
              scheduledAt: { gte: now, lte: weekAhead },
              status: { not: "CANCELLED" },
              homeTeam: { tenantId: { in: tenantIds } },
            },
            _count: true,
          })
        : Promise.resolve([] as any[]),
      tenantIds.length
        ? prisma.tryout.groupBy({
            by: ["tenantId"],
            where: {
              tenantId: { in: tenantIds },
              isPublished: true,
              scheduledAt: { gte: now },
            },
            _count: true,
          })
        : Promise.resolve([] as any[]),
      (prisma as any).league.findMany({
        where: { ownerId: session.userId },
        select: {
          id: true,
          name: true,
          seasons: {
            where: { status: { in: ["REGISTRATION", "IN_PROGRESS"] } },
            select: {
              id: true,
              label: true,
              status: true,
              _count: { select: { teamSubmissions: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      }),
    ])

    // Team → tenant rollups (games groupBy is per home team; fold to tenant)
    const teamTenant = new Map(teamRows.map((t: any) => [t.id, t.tenantId]))
    const gamesByTenant = new Map<string, number>()
    for (const g of gameGroups as any[]) {
      const tenantId = teamTenant.get(g.homeTeamId)
      if (tenantId) gamesByTenant.set(tenantId, (gamesByTenant.get(tenantId) ?? 0) + g._count)
    }
    const offersByTenant = new Map<string, number>()
    const teamsByTenant = new Map<string, number>()
    for (const t of teamRows as any[]) {
      teamsByTenant.set(t.tenantId, (teamsByTenant.get(t.tenantId) ?? 0) + 1)
      offersByTenant.set(t.tenantId, (offersByTenant.get(t.tenantId) ?? 0) + t._count.offers)
    }
    const tryoutsByTenant = new Map<string, number>(
      (tryoutGroups as any[]).map((g) => [g.tenantId, g._count])
    )

    return NextResponse.json({
      clubs: tenants.map((t: any) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        teams: teamsByTenant.get(t.id) ?? 0,
        pendingOffers: offersByTenant.get(t.id) ?? 0,
        gamesThisWeek: gamesByTenant.get(t.id) ?? 0,
        openTryouts: tryoutsByTenant.get(t.id) ?? 0,
      })),
      leagues: leagues.map((l: any) => ({
        id: l.id,
        name: l.name,
        seasons: l.seasons.map((s: any) => ({
          id: s.id,
          name: s.label,
          status: s.status,
          teamCount: s._count.teamSubmissions,
        })),
      })),
    })
  } catch (error) {
    console.error("Mobile operator error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
