import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

/**
 * GET /api/seasons/[id]/roster-requests — the commissioner's queue.
 * ?status=PENDING (default) | APPROVED | DENIED | ALL
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const season = (await prisma.season.findUnique({
      where: { id: params.id },
      select: { id: true, league: { select: { ownerId: true } } },
    })) as any
    if (!season) return NextResponse.json({ error: "Season not found" }, { status: 404 })

    if (!auth.isPlatformAdmin && season.league.ownerId !== auth.userId) {
      const role = await prisma.userRole.findFirst({
        where: {
          userId: auth.userId,
          role: { in: ["LeagueOwner", "LeagueManager"] },
          league: { seasons: { some: { id: params.id } } },
        },
        select: { id: true },
      })
      if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const statusParam = (new URL(request.url).searchParams.get("status") ?? "PENDING").toUpperCase()
    const where: any = { roster: { seasonId: params.id } }
    if (statusParam !== "ALL") where.status = statusParam

    const requests = await prisma.rosterChangeRequest.findMany({
      where,
      select: {
        id: true,
        message: true,
        additions: true,
        removals: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
        resolutionNote: true,
        requestedBy: { select: { firstName: true, lastName: true, email: true } },
        roster: {
          select: {
            id: true,
            isLocked: true,
            teamSubmission: {
              select: {
                team: { select: { id: true, name: true, tenant: { select: { name: true } } } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    // Resolve player names for structured requests so the commissioner sees
    // exactly who is being added/removed (2026-07-15)
    const allPlayerIds = [
      ...new Set(
        requests.flatMap((r: any) => [
          ...(Array.isArray(r.additions) ? r.additions : []),
          ...(Array.isArray(r.removals) ? r.removals : []),
        ])
      ),
    ] as string[]
    const players = allPlayerIds.length
      ? await prisma.player.findMany({
          where: { id: { in: allPlayerIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : []
    const playerName = new Map(
      players.map((p: any) => [p.id, `${p.firstName} ${p.lastName}`.trim()])
    )
    const names = (ids: unknown) =>
      Array.isArray(ids) ? ids.map((id) => playerName.get(id) ?? "Unknown player") : []

    return NextResponse.json({
      requests: requests.map((r: any) => ({
        id: r.id,
        message: r.message,
        additions: names(r.additions),
        removals: names(r.removals),
        status: r.status,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt,
        resolutionNote: r.resolutionNote,
        requestedBy: `${r.requestedBy.firstName ?? ""} ${r.requestedBy.lastName ?? ""}`.trim(),
        teamName: r.roster.teamSubmission.team.name,
        clubName: r.roster.teamSubmission.team.tenant.name,
        rosterLocked: r.roster.isLocked,
      })),
    })
  } catch (error) {
    console.error("Roster requests list error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
