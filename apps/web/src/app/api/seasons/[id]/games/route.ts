import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { auditSafe } from "@/lib/audit"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

const createGameSchema = z.object({
  homeTeamId: z.string(),
  awayTeamId: z.string(),
  scheduledAt: z.string().datetime(),
  venueId: z.string().optional(),
  duration: z.number().int().min(30).max(240).optional(),
})

/**
 * POST /api/seasons/[id]/games — manually add ONE game outside the
 * scheduler (make-up games, exhibition slots, schedule fixes). League
 * owner/manager only; double-booking checked; audited.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const season = (await prisma.season.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        label: true,
        gameSlotMinutes: true,
        league: { select: { id: true, ownerId: true } },
      },
    })) as any
    if (!season) return NextResponse.json({ error: "Season not found" }, { status: 404 })

    if (!auth.isPlatformAdmin && season.league.ownerId !== auth.userId) {
      const role = await prisma.userRole.findFirst({
        where: {
          userId: auth.userId,
          role: { in: ["LeagueOwner", "LeagueManager"] },
          leagueId: season.league.id,
        },
        select: { id: true },
      })
      if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const parsed = createGameSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }
    const data = parsed.data
    if (data.homeTeamId === data.awayTeamId) {
      return NextResponse.json({ error: "A team can't play itself" }, { status: 400 })
    }

    // Both teams must actually be in this season
    const submissions = await prisma.teamSubmission.count({
      where: {
        seasonId: params.id,
        teamId: { in: [data.homeTeamId, data.awayTeamId] },
        status: "APPROVED",
      },
    })
    if (submissions < 2) {
      return NextResponse.json(
        { error: "Both teams must be approved in this season" },
        { status: 400 }
      )
    }

    // Team double-booking guard around the slot
    const start = new Date(data.scheduledAt)
    const duration = data.duration ?? season.gameSlotMinutes ?? 90
    const end = new Date(start.getTime() + duration * 60_000)
    const clash = await prisma.game.findFirst({
      where: {
        status: { in: ["SCHEDULED", "LIVE", "POSTPONED"] },
        OR: [
          { homeTeamId: { in: [data.homeTeamId, data.awayTeamId] } },
          { awayTeamId: { in: [data.homeTeamId, data.awayTeamId] } },
        ],
        scheduledAt: { lt: end, gt: new Date(start.getTime() - 4 * 3600_000) },
      },
      select: { id: true, scheduledAt: true, duration: true },
    })
    if (clash) {
      const clashStart = new Date(clash.scheduledAt as any).getTime()
      const clashEnd = clashStart + ((clash.duration as any) ?? 90) * 60_000
      if (clashStart < end.getTime() && clashEnd > start.getTime()) {
        return NextResponse.json(
          { error: "One of the teams already has a game in that time slot" },
          { status: 409 }
        )
      }
    }

    const game = await prisma.game.create({
      data: {
        seasonId: params.id,
        phase: "REGULAR",
        homeTeamId: data.homeTeamId,
        awayTeamId: data.awayTeamId,
        venueId: data.venueId ?? null,
        scheduledAt: start,
        duration,
        status: "SCHEDULED",
      },
      select: { id: true },
    })
    await auditSafe({
      actorId: auth.realUserId,
      actorRole: auth.isPlatformAdmin ? "PlatformAdmin" : "LeagueOwner",
      action: "GAME_MANUAL_CREATE",
      resource: "Game",
      resourceId: game.id,
      changes: { seasonLabel: season.label, homeTeamId: data.homeTeamId, awayTeamId: data.awayTeamId, scheduledAt: data.scheduledAt },
      request,
    })

    return NextResponse.json({ success: true, gameId: game.id }, { status: 201 })
  } catch (error) {
    console.error("Manual game create error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
