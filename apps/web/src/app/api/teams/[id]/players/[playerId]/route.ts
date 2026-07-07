import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { auditSafe } from "@/lib/audit"
import { getSessionUserId } from "@/lib/auth-helpers"
import { canManageTeamRoster } from "@/lib/teams/roster-access"

export const dynamic = "force-dynamic"

const patchSchema = z.object({
  // null clears the number; releasing sets status INACTIVE + leftAt
  jerseyNumber: z.number().int().min(0).max(99).nullable().optional(),
  action: z.enum(["release", "reactivate"]).optional(),
})

/**
 * PATCH /api/teams/[id]/players/[playerId] — manual jersey change (with
 * clash guard) and release/reactivate. Coaches + managers included; every
 * change audited.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; playerId: string } }
) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const team = await prisma.team.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, tenantId: true },
    })
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 })
    if (!(await canManageTeamRoster(auth.userId, auth.isPlatformAdmin, team))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const row = await prisma.teamPlayer.findUnique({
      where: { teamId_playerId: { teamId: params.id, playerId: params.playerId } },
      select: {
        id: true,
        status: true,
        jerseyNumber: true,
        player: { select: { firstName: true, lastName: true } },
      },
    })
    if (!row) return NextResponse.json({ error: "Player is not on this roster" }, { status: 404 })
    const playerName = `${row.player.firstName} ${row.player.lastName}`

    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success || (parsed.data.jerseyNumber === undefined && !parsed.data.action)) {
      return NextResponse.json({ error: "Provide jerseyNumber or action" }, { status: 400 })
    }

    if (parsed.data.action === "release") {
      await prisma.teamPlayer.update({
        where: { id: row.id },
        data: { status: "INACTIVE", leftAt: new Date() },
      })
      await auditSafe({
        actorId: auth.realUserId,
        actorRole: auth.isPlatformAdmin ? "PlatformAdmin" : "Staff",
        action: "ROSTER_PLAYER_RELEASE",
        resource: "TeamPlayer",
        resourceId: row.id,
        tenantId: team.tenantId,
        changes: { teamName: team.name, playerName },
        request,
      })
      return NextResponse.json({ success: true, status: "INACTIVE" })
    }

    if (parsed.data.action === "reactivate") {
      await prisma.teamPlayer.update({
        where: { id: row.id },
        data: { status: "ACTIVE", leftAt: null },
      })
      await auditSafe({
        actorId: auth.realUserId,
        actorRole: auth.isPlatformAdmin ? "PlatformAdmin" : "Staff",
        action: "ROSTER_PLAYER_ADD",
        resource: "TeamPlayer",
        resourceId: row.id,
        tenantId: team.tenantId,
        changes: { teamName: team.name, playerName, reactivated: true },
        request,
      })
      return NextResponse.json({ success: true, status: "ACTIVE" })
    }

    // Jersey change — the multi-club case is already safe (numbers live per
    // team), this guard only protects THIS team's bench
    const jerseyNumber = parsed.data.jerseyNumber ?? null
    if (jerseyNumber != null) {
      const clash = await prisma.teamPlayer.findFirst({
        where: {
          teamId: params.id,
          status: "ACTIVE",
          jerseyNumber,
          playerId: { not: params.playerId },
        },
        select: { player: { select: { firstName: true, lastName: true } } },
      })
      if (clash) {
        return NextResponse.json(
          { error: `#${jerseyNumber} is taken by ${clash.player.firstName} ${clash.player.lastName} on this team.` },
          { status: 409 }
        )
      }
    }
    await prisma.teamPlayer.update({ where: { id: row.id }, data: { jerseyNumber } })
    await auditSafe({
      actorId: auth.realUserId,
      actorRole: auth.isPlatformAdmin ? "PlatformAdmin" : "Staff",
      action: "ROSTER_JERSEY_CHANGE",
      resource: "TeamPlayer",
      resourceId: row.id,
      tenantId: team.tenantId,
      changes: { teamName: team.name, playerName, from: row.jerseyNumber, to: jerseyNumber },
      request,
    })

    return NextResponse.json({ success: true, jerseyNumber })
  } catch (error) {
    console.error("Roster patch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
