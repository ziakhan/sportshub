import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { auditSafe } from "@/lib/audit"
import { getSessionUserId } from "@/lib/auth-helpers"
import { notifyMany } from "@/lib/notifications"
import { canScoreGame } from "@/lib/scoring/authz"

export const dynamic = "force-dynamic"

/**
 * Game-day referee assignment: whoever can run the scoring for a game
 * (league owner, either club's staff, platform admin) can look up available
 * referees and assign/unassign them right up to tip-off. Fully audited.
 */

async function loadGame(gameId: string) {
  return (await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      seasonId: true,
      scheduledAt: true,
      duration: true,
      homeTeamId: true,
      awayTeamId: true,
      homeTeam: { select: { name: true, tenantId: true } },
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

/**
 * GET /api/games/[id]/referee — current assignments + the searchable pool.
 * ?q= filters by name; "busy" = assigned to an overlapping game.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await authorize(params.id)
    if ("error" in ctx) return ctx.error
    const { game } = ctx

    const q = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? ""

    const [assignedRoles, pool] = await Promise.all([
      prisma.userRole.findMany({
        where: { gameId: params.id, role: "Referee" },
        select: {
          id: true,
          user: {
            select: { id: true, firstName: true, lastName: true, refereeProfile: { select: { signoffPinHash: true } } },
          },
        },
      }),
      prisma.user.findMany({
        where: {
          roles: { some: { role: "Referee", gameId: null } },
          ...(q
            ? { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }] }
            : {}),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          refereeProfile: {
            select: { certificationLevel: true, standardFee: true, gamesRefereed: true, signoffPinHash: true },
          },
          roles: {
            where: { role: "Referee", gameId: { not: null } },
            select: { game: { select: { id: true, scheduledAt: true, duration: true, status: true } } },
          },
        },
        take: 30,
        orderBy: { firstName: "asc" },
      }),
    ])

    const gameStart = new Date(game.scheduledAt).getTime()
    const gameEnd = gameStart + (game.duration ?? 90) * 60_000
    const overlaps = (g: any) => {
      if (!g?.scheduledAt || g.status === "CANCELLED" || g.id === game.id) return false
      const start = new Date(g.scheduledAt).getTime()
      const end = start + (g.duration ?? 90) * 60_000
      return start < gameEnd && end > gameStart
    }

    return NextResponse.json({
      assigned: assignedRoles.map((r: any) => ({
        roleId: r.id,
        userId: r.user.id,
        name: `${r.user.firstName ?? ""} ${r.user.lastName ?? ""}`.trim(),
        hasPin: !!r.user.refereeProfile?.signoffPinHash,
      })),
      pool: pool.map((u: any) => ({
        userId: u.id,
        name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim(),
        certification: u.refereeProfile?.certificationLevel ?? null,
        fee: u.refereeProfile?.standardFee ? Number(u.refereeProfile.standardFee) : null,
        gamesRefereed: u.refereeProfile?.gamesRefereed ?? 0,
        hasPin: !!u.refereeProfile?.signoffPinHash,
        busy: u.roles.some((r: any) => overlaps(r.game)),
      })),
    })
  } catch (error) {
    console.error("Referee list error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const assignSchema = z.object({ userId: z.string() })

/** POST /api/games/[id]/referee { userId } — assign (additive; crews are real). */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await authorize(params.id)
    if ("error" in ctx) return ctx.error
    const { auth, game } = ctx

    const parsed = assignSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "userId is required" }, { status: 400 })

    const referee = await prisma.user.findFirst({
      where: { id: parsed.data.userId, roles: { some: { role: "Referee" } } },
      select: { id: true, firstName: true, lastName: true },
    })
    if (!referee) {
      return NextResponse.json({ error: "That user is not a referee" }, { status: 400 })
    }
    const already = await prisma.userRole.findFirst({
      where: { userId: referee.id, role: "Referee", gameId: params.id },
      select: { id: true },
    })
    if (already) {
      return NextResponse.json({ error: "Already assigned to this game" }, { status: 409 })
    }

    await prisma.userRole.create({
      data: { userId: referee.id, role: "Referee", gameId: params.id },
    })
    const matchup = `${game.homeTeam.name} vs ${game.awayTeam.name}`
    await notifyMany(prisma, [referee.id], {
      type: "schedule_published",
      title: "You've been assigned a game",
      message: `${matchup} — ${new Date(game.scheduledAt).toLocaleString()}. Your sign-off PIN will be requested at finalize.`,
      link: `/live/${params.id}`,
      referenceId: params.id,
      referenceType: "Game",
    })
    await auditSafe({
      actorId: auth.realUserId,
      actorRole: auth.isPlatformAdmin ? "PlatformAdmin" : "Staff",
      action: "REFEREE_ASSIGN",
      resource: "Game",
      resourceId: params.id,
      changes: { referee: `${referee.firstName} ${referee.lastName}`, matchup },
      request,
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error("Referee assign error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** DELETE /api/games/[id]/referee?userId= — unassign. */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await authorize(params.id)
    if ("error" in ctx) return ctx.error
    const { auth } = ctx

    const userId = new URL(request.url).searchParams.get("userId")
    if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 })

    const removed = await prisma.userRole.deleteMany({
      where: { userId, role: "Referee", gameId: params.id },
    })
    if (removed.count === 0) {
      return NextResponse.json({ error: "Not assigned to this game" }, { status: 404 })
    }
    await auditSafe({
      actorId: auth.realUserId,
      actorRole: auth.isPlatformAdmin ? "PlatformAdmin" : "Staff",
      action: "REFEREE_UNASSIGN",
      resource: "Game",
      resourceId: params.id,
      changes: { refereeUserId: userId },
      request,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Referee unassign error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
