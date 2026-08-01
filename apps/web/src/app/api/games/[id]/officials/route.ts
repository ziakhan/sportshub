import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { notify } from "@/lib/notifications"

export const dynamic = "force-dynamic"

const bodySchema = z.object({ userId: z.string().min(1) })

async function leagueSideGame(gameId: string, userId: string, isPlatformAdmin: boolean) {
  const game = await (prisma as any).game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      scheduledAt: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      season: { select: { leagueId: true, league: { select: { ownerId: true } } } },
    },
  })
  if (!game) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) }
  const isOwner = game.season?.league?.ownerId === userId
  const managerRole = isOwner
    ? null
    : await prisma.userRole.findFirst({
        where: {
          userId,
          leagueId: game.season?.leagueId ?? "",
          role: { in: ["LeagueOwner", "LeagueManager"] },
        },
        select: { id: true },
      })
  if (!isOwner && !isPlatformAdmin && !managerRole) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { game }
}

/**
 * POST /api/games/[id]/officials {userId} — assign a referee to the game
 * (owner 2026-08-01). Assignment = a game-scoped Referee role, which the
 * referee's calendar, ICS feed and console pick up automatically.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const gate = await leagueSideGame(params.id, auth.userId, auth.isPlatformAdmin)
    if ("error" in gate) return gate.error

    const parsed = bodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "userId required" }, { status: 400 })

    const existing = await prisma.userRole.findFirst({
      where: { userId: parsed.data.userId, role: "Referee", gameId: params.id },
      select: { id: true },
    })
    if (!existing) {
      await prisma.userRole.create({
        data: { userId: parsed.data.userId, role: "Referee", gameId: params.id },
      })
      const g = gate.game
      await notify(prisma as any, {
        userId: parsed.data.userId,
        type: "staff_request",
        title: "Officiating assignment",
        message: `You're assigned to officiate ${g.homeTeam?.name ?? "Home"} vs ${g.awayTeam?.name ?? "Away"} on ${new Date(g.scheduledAt).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}.`,
        link: `/games/${params.id}`,
        referenceId: params.id,
        referenceType: "Game",
      }).catch(() => {})
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Assign official error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** DELETE /api/games/[id]/officials {userId} — remove the assignment. */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const gate = await leagueSideGame(params.id, auth.userId, auth.isPlatformAdmin)
    if ("error" in gate) return gate.error
    const parsed = bodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "userId required" }, { status: 400 })
    await prisma.userRole.deleteMany({
      where: { userId: parsed.data.userId, role: "Referee", gameId: params.id },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Remove official error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
