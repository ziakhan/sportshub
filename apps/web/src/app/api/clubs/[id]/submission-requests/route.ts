import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

/**
 * GET /api/clubs/[id]/submission-requests — the club's approval queue for
 * coach-initiated league registrations (owner 2026-07-15). Operator-only.
 * ?status=PENDING (default) | ALL
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const operatorRole = await prisma.userRole.findFirst({
      where: {
        userId: auth.userId,
        OR: [
          { tenantId: params.id, role: { in: ["ClubOwner", "ClubManager"] } },
          { role: "PlatformAdmin" },
        ],
      },
      select: { id: true },
    })
    if (!operatorRole && !auth.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const statusParam = (new URL(request.url).searchParams.get("status") ?? "PENDING").toUpperCase()
    const where: any = { team: { tenantId: params.id } }
    if (statusParam !== "ALL") where.status = statusParam

    const rows = await (prisma as any).teamSubmissionRequest.findMany({
      where,
      select: {
        id: true,
        status: true,
        divisionId: true,
        playerIds: true,
        createdAt: true,
        decidedAt: true,
        declineReason: true,
        team: { select: { id: true, name: true } },
        season: {
          select: { id: true, label: true, teamFee: true, league: { select: { name: true } } },
        },
        requestedBy: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    // Division names (no relation on the request model — plain id)
    const divisionIds = [...new Set(rows.map((r: any) => r.divisionId))] as string[]
    const divisions = divisionIds.length
      ? await prisma.division.findMany({
          where: { id: { in: divisionIds } },
          select: { id: true, name: true },
        })
      : []
    const divisionName = new Map(divisions.map((d) => [d.id, d.name]))

    return NextResponse.json({
      requests: rows.map((r: any) => ({
        id: r.id,
        status: r.status,
        createdAt: r.createdAt,
        decidedAt: r.decidedAt,
        declineReason: r.declineReason,
        team: r.team,
        season: {
          id: r.season.id,
          label: r.season.label,
          leagueName: r.season.league?.name ?? null,
          teamFee: r.season.teamFee != null ? Number(r.season.teamFee) : null,
        },
        divisionName: divisionName.get(r.divisionId) ?? "—",
        playerCount: Array.isArray(r.playerIds) ? r.playerIds.length : null,
        requestedBy:
          [r.requestedBy?.firstName, r.requestedBy?.lastName].filter(Boolean).join(" ") ||
          r.requestedBy?.email ||
          "Team staff",
      })),
    })
  } catch (error) {
    console.error("Club submission-requests error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
