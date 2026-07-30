import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { auditSafe } from "@/lib/audit"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

const postSchema = z.object({
  playerId: z.string(),
  eligible: z.boolean(),
  note: z.string().trim().min(3, "A note is required — it becomes the audit trail"),
})

async function leagueAccess(userId: string, isPlatformAdmin: boolean, seasonId: string) {
  const season = await (prisma as any).season.findUnique({
    where: { id: seasonId },
    select: { id: true, leagueId: true, league: { select: { ownerId: true } } },
  })
  if (!season) return { season: null, allowed: false }
  const allowed =
    isPlatformAdmin ||
    season.league.ownerId === userId ||
    !!(await prisma.userRole.findFirst({
      where: { userId, leagueId: season.leagueId, role: { in: ["LeagueOwner", "LeagueManager"] } },
      select: { id: true },
    }))
  return { season, allowed }
}

/**
 * POST /api/seasons/[id]/eligibility-overrides — commissioner overrides a
 * player's playoff eligibility in either direction, note required (owner
 * 2026-07-29). Upserts: one ruling per player per season.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { season, allowed } = await leagueAccess(auth.userId, auth.isPlatformAdmin, params.id)
    if (!season) return NextResponse.json({ error: "Season not found" }, { status: 404 })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const parsed = postSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }

    const row = await (prisma as any).playoffEligibilityOverride.upsert({
      where: { seasonId_playerId: { seasonId: params.id, playerId: parsed.data.playerId } },
      create: {
        seasonId: params.id,
        playerId: parsed.data.playerId,
        eligible: parsed.data.eligible,
        note: parsed.data.note,
        setById: auth.userId,
      },
      update: { eligible: parsed.data.eligible, note: parsed.data.note, setById: auth.userId },
      select: { id: true },
    })

    await auditSafe({
      actorId: auth.realUserId,
      actorRole: "LeagueOwner",
      action: "PLAYOFF_ELIGIBILITY_OVERRIDE",
      resource: "PlayoffEligibilityOverride",
      resourceId: row.id,
      changes: { playerId: parsed.data.playerId, eligible: parsed.data.eligible, note: parsed.data.note },
      request,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Eligibility override error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** DELETE — clear an override (back to the games-played math). */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { season, allowed } = await leagueAccess(auth.userId, auth.isPlatformAdmin, params.id)
    if (!season) return NextResponse.json({ error: "Season not found" }, { status: 404 })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const playerId = new URL(request.url).searchParams.get("playerId")
    if (!playerId) return NextResponse.json({ error: "playerId required" }, { status: 400 })

    await (prisma as any).playoffEligibilityOverride.deleteMany({
      where: { seasonId: params.id, playerId },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Eligibility override delete error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
