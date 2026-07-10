import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { auditSafe } from "@/lib/audit"
import { getSessionUserId } from "@/lib/auth-helpers"
import { notifyMany } from "@/lib/notifications"
import { canScoreGame } from "@/lib/scoring/authz"

export const dynamic = "force-dynamic"

/**
 * Game-day scorekeeper assignment (mirrors the referee flow): whoever can run
 * scoring for a game (league owner, either club's staff, platform admin) can
 * look up scorekeepers and assign/unassign them right up to tip-off. An assigned
 * scorekeeper then passes canScoreGame and can open the console. Fully audited.
 */

async function loadGame(gameId: string) {
  return (await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      seasonId: true,
      scheduledAt: true,
      homeTeamId: true,
      awayTeamId: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  })) as any
}

async function authorize(gameId: string) {
  const auth = await getSessionUserId()
  if (!auth) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const game = await loadGame(gameId)
  if (!game) return { error: NextResponse.json({ error: "Game not found" }, { status: 404 }) }
  if (!(await canScoreGame(auth.userId, auth.isPlatformAdmin, game))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { auth, game }
}

/** GET /api/games/[id]/scorekeeper — current assignments + the searchable pool. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await authorize(params.id)
    if (ctx.error) return ctx.error

    const q = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? ""

    const [assignedRoles, pool] = await Promise.all([
      prisma.userRole.findMany({
        where: { gameId: params.id, role: "Scorekeeper" },
        select: { id: true, user: { select: { id: true, firstName: true, lastName: true } } },
      }),
      prisma.user.findMany({
        where: {
          roles: { some: { role: "Scorekeeper", gameId: null } },
          ...(q
            ? {
                OR: [
                  { firstName: { contains: q, mode: "insensitive" } },
                  { lastName: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        select: { id: true, firstName: true, lastName: true },
        take: 30,
        orderBy: { firstName: "asc" },
      }),
    ])

    const assignedIds = new Set(assignedRoles.map((r: any) => r.user.id))
    return NextResponse.json({
      assigned: assignedRoles.map((r: any) => ({
        roleId: r.id,
        userId: r.user.id,
        name: `${r.user.firstName ?? ""} ${r.user.lastName ?? ""}`.trim(),
      })),
      pool: pool
        .filter((u: any) => !assignedIds.has(u.id))
        .map((u: any) => ({
          userId: u.id,
          name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim(),
        })),
    })
  } catch (error) {
    console.error("Scorekeeper list error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const assignSchema = z.object({ userId: z.string() })

/** POST /api/games/[id]/scorekeeper { userId } — assign (additive). */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await authorize(params.id)
    if (ctx.error) return ctx.error
    const { auth, game } = ctx

    const parsed = assignSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "userId is required" }, { status: 400 })

    const keeper = await prisma.user.findFirst({
      where: { id: parsed.data.userId, roles: { some: { role: "Scorekeeper" } } },
      select: { id: true, firstName: true, lastName: true },
    })
    if (!keeper) {
      return NextResponse.json({ error: "That user is not a scorekeeper" }, { status: 400 })
    }
    const already = await prisma.userRole.findFirst({
      where: { userId: keeper.id, role: "Scorekeeper", gameId: params.id },
      select: { id: true },
    })
    if (already) {
      return NextResponse.json({ error: "Already assigned to this game" }, { status: 409 })
    }

    await prisma.userRole.create({
      data: { userId: keeper.id, role: "Scorekeeper", gameId: params.id },
    })
    const matchup = `${game.homeTeam.name} vs ${game.awayTeam.name}`
    await notifyMany(prisma, [keeper.id], {
      type: "schedule_published",
      title: "You've been assigned to score a game",
      message: `${matchup} — ${new Date(game.scheduledAt).toLocaleString()}. Open it from Score games to run the console.`,
      link: `/games/${params.id}/score`,
      referenceId: params.id,
      referenceType: "Game",
    })
    await auditSafe({
      actorId: auth.realUserId,
      actorRole: auth.isPlatformAdmin ? "PlatformAdmin" : "Staff",
      action: "SCOREKEEPER_ASSIGN",
      resource: "Game",
      resourceId: params.id,
      changes: { scorekeeper: `${keeper.firstName} ${keeper.lastName}`, matchup },
      request,
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error("Scorekeeper assign error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** DELETE /api/games/[id]/scorekeeper?userId= — unassign. */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await authorize(params.id)
    if (ctx.error) return ctx.error
    const { auth } = ctx

    const userId = new URL(request.url).searchParams.get("userId")
    if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 })

    const removed = await prisma.userRole.deleteMany({
      where: { userId, role: "Scorekeeper", gameId: params.id },
    })
    if (removed.count === 0) {
      return NextResponse.json({ error: "Not assigned to this game" }, { status: 404 })
    }
    await auditSafe({
      actorId: auth.realUserId,
      actorRole: auth.isPlatformAdmin ? "PlatformAdmin" : "Staff",
      action: "SCOREKEEPER_UNASSIGN",
      resource: "Game",
      resourceId: params.id,
      changes: { scorekeeperUserId: userId },
      request,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Scorekeeper unassign error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
