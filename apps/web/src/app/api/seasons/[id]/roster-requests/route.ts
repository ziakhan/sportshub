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

    return NextResponse.json({
      requests: requests.map((r: any) => ({
        id: r.id,
        message: r.message,
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
