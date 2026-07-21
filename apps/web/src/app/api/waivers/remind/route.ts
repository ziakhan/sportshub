import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { sendManualWaiverReminder } from "@/lib/waivers/remind"

export const dynamic = "force-dynamic"

const CLUB_STAFF_ROLES = ["ClubOwner", "ClubManager", "Staff", "TeamManager"] as any[]

const remindSchema = z
  .object({
    playerId: z.string().min(1),
    seasonId: z.string().optional(),
    tenantId: z.string().optional(),
  })
  .refine((d) => !!d.seasonId !== !!d.tenantId, {
    message: "Provide exactly one of seasonId or tenantId",
  })

/**
 * POST /api/waivers/remind — staff-triggered reminder for one player (owner
 * 2026-07-20: game-day nudge instead of a hard block). Pushes + emails the
 * family fresh signing links for the outstanding waivers in the given
 * context (league season or club).
 */
export async function POST(request: NextRequest) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const parsed = remindSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }
    const { playerId, seasonId, tenantId } = parsed.data

    let allowed = sessionInfo.isPlatformAdmin
    if (!allowed && seasonId) {
      // League side, or staff of a club that rosters this player in the season
      const season = await prisma.season.findUnique({
        where: { id: seasonId },
        select: { leagueId: true, league: { select: { ownerId: true } } },
      })
      if (!season) return NextResponse.json({ error: "Season not found" }, { status: 404 })
      if (season.league.ownerId === sessionInfo.userId) {
        allowed = true
      } else {
        const rosterTenants = await (prisma as any).seasonRosterPlayer.findMany({
          where: { playerId, roster: { seasonId } },
          select: {
            roster: {
              select: { teamSubmission: { select: { team: { select: { tenantId: true } } } } },
            },
          },
        })
        const tenantIds = Array.from(
          new Set(
            rosterTenants
              .map((r: any) => r.roster?.teamSubmission?.team?.tenantId)
              .filter(Boolean)
          )
        ) as string[]
        const role = await prisma.userRole.findFirst({
          where: {
            userId: sessionInfo.userId,
            OR: [
              { leagueId: season.leagueId, role: { in: ["LeagueOwner", "LeagueManager"] } },
              ...(tenantIds.length > 0
                ? [{ tenantId: { in: tenantIds }, role: { in: CLUB_STAFF_ROLES } } as any]
                : []),
            ],
          },
        })
        allowed = !!role
      }
    } else if (!allowed && tenantId) {
      const role = await prisma.userRole.findFirst({
        where: { userId: sessionInfo.userId, tenantId, role: { in: CLUB_STAFF_ROLES } },
      })
      allowed = !!role
    }
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const result = await sendManualWaiverReminder({ playerId, seasonId, tenantId })
    if (result.reason === "no_parent_email") {
      return NextResponse.json(
        { error: "No parent email on file for this player", ...result },
        { status: 409 }
      )
    }
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("Manual waiver reminder error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
