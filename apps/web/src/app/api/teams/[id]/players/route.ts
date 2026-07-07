import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { auditSafe } from "@/lib/audit"
import { getSessionUserId } from "@/lib/auth-helpers"
import { canManageTeamRoster } from "@/lib/teams/roster-access"

export const dynamic = "force-dynamic"

async function loadTeam(teamId: string) {
  return prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true, tenantId: true },
  })
}

/**
 * GET /api/teams/[id]/players — candidates for a manual roster add: players
 * already connected to this club (other rosters, offers, tryout signups)
 * who are NOT active on this team.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const team = await loadTeam(params.id)
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 })
    if (!(await canManageTeamRoster(auth.userId, auth.isPlatformAdmin, team))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const [onTeam, candidates] = await Promise.all([
      prisma.teamPlayer.findMany({
        where: { teamId: params.id, status: "ACTIVE" },
        select: { playerId: true },
      }),
      prisma.player.findMany({
        where: {
          deletedAt: null,
          OR: [
            { teams: { some: { team: { tenantId: team.tenantId } } } },
            { offers: { some: { team: { tenantId: team.tenantId } } } },
            { tryoutSignups: { some: { tryout: { tenantId: team.tenantId } } } },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          position: true,
          dateOfBirth: true,
          teams: {
            where: { status: "ACTIVE" },
            select: { team: { select: { name: true } } },
          },
        },
        orderBy: [{ firstName: "asc" }],
        take: 200,
      }),
    ])
    const activeIds = new Set(onTeam.map((tp: any) => tp.playerId))

    return NextResponse.json({
      candidates: candidates
        .filter((p: any) => !activeIds.has(p.id))
        .map((p: any) => ({
          id: p.id,
          name: `${p.firstName} ${p.lastName}`,
          position: p.position,
          birthYear: p.dateOfBirth ? new Date(p.dateOfBirth).getFullYear() : null,
          currentTeams: p.teams.map((t: any) => t.team.name),
        })),
    })
  } catch (error) {
    console.error("Roster candidates error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const addSchema = z.object({
  playerId: z.string(),
  jerseyNumber: z.number().int().min(0).max(99).nullable().optional(),
})

/**
 * POST /api/teams/[id]/players { playerId, jerseyNumber? } — manually add
 * a player to the roster (coaches included). Jersey clashes 409 so the
 * bench decides, not the database.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const team = await loadTeam(params.id)
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 })
    if (!(await canManageTeamRoster(auth.userId, auth.isPlatformAdmin, team))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const parsed = addSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "playerId is required" }, { status: 400 })
    }
    const { playerId, jerseyNumber } = parsed.data

    const player = await prisma.player.findFirst({
      where: { id: playerId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
    })
    if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 })

    if (jerseyNumber != null) {
      const clash = await prisma.teamPlayer.findFirst({
        where: { teamId: params.id, status: "ACTIVE", jerseyNumber, playerId: { not: playerId } },
        select: { player: { select: { firstName: true, lastName: true } } },
      })
      if (clash) {
        return NextResponse.json(
          { error: `#${jerseyNumber} is taken by ${clash.player.firstName} ${clash.player.lastName} on this team.` },
          { status: 409 }
        )
      }
    }

    const existing = await prisma.teamPlayer.findUnique({
      where: { teamId_playerId: { teamId: params.id, playerId } },
      select: { id: true, status: true },
    })
    if (existing?.status === "ACTIVE") {
      return NextResponse.json({ error: "Player is already on this roster" }, { status: 409 })
    }

    await prisma.teamPlayer.upsert({
      where: { teamId_playerId: { teamId: params.id, playerId } },
      create: { teamId: params.id, playerId, status: "ACTIVE", jerseyNumber: jerseyNumber ?? null },
      update: { status: "ACTIVE", leftAt: null, jerseyNumber: jerseyNumber ?? null },
    })
    await auditSafe({
      actorId: auth.realUserId,
      actorRole: auth.isPlatformAdmin ? "PlatformAdmin" : "Staff",
      action: "ROSTER_PLAYER_ADD",
      resource: "TeamPlayer",
      resourceId: `${params.id}:${playerId}`,
      tenantId: team.tenantId,
      changes: { teamName: team.name, playerName: `${player.firstName} ${player.lastName}`, jerseyNumber: jerseyNumber ?? null },
      request,
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error("Roster add error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
