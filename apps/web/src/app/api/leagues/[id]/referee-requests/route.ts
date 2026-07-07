import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { notifyMany } from "@/lib/notifications"

export const dynamic = "force-dynamic"

async function requireLeagueSide(userId: string, isPlatformAdmin: boolean, leagueId: string) {
  const league = (await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, name: true, ownerId: true },
  })) as any
  if (!league) return { error: NextResponse.json({ error: "League not found" }, { status: 404 }) }
  if (isPlatformAdmin || league.ownerId === userId) return { league }
  const role = await prisma.userRole.findFirst({
    where: { userId, role: { in: ["LeagueOwner", "LeagueManager"] }, leagueId },
    select: { id: true },
  })
  if (!role) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  return { league }
}

/** GET /api/leagues/[id]/referee-requests — the league's offers, newest first. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const ctx = await requireLeagueSide(auth.userId, auth.isPlatformAdmin, params.id)
    if ("error" in ctx) return ctx.error

    const requests = await prisma.refereeSessionRequest.findMany({
      where: { leagueId: params.id },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        message: true,
        status: true,
        createdAt: true,
        respondedAt: true,
        targetUser: { select: { firstName: true, lastName: true } },
        acceptedBy: { select: { firstName: true, lastName: true } },
        sessionDay: {
          select: { date: true, session: { select: { label: true, season: { select: { label: true } } } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    return NextResponse.json({
      requests: requests.map((r: any) => ({
        id: r.id,
        date: r.sessionDay.date,
        sessionLabel: r.sessionDay.session.label,
        seasonLabel: r.sessionDay.session.season.label,
        window: `${r.startTime}–${r.endTime}`,
        message: r.message,
        status: r.status,
        target: r.targetUser
          ? `${r.targetUser.firstName ?? ""} ${r.targetUser.lastName ?? ""}`.trim()
          : "All league referees",
        acceptedBy: r.acceptedBy
          ? `${r.acceptedBy.firstName ?? ""} ${r.acceptedBy.lastName ?? ""}`.trim()
          : null,
        createdAt: r.createdAt,
      })),
    })
  } catch (error) {
    console.error("Referee requests list error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const createSchema = z.object({
  sessionDayId: z.string(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  targetUserId: z.string().optional(), // omitted → broadcast to the pool
  message: z.string().trim().max(1000).optional(),
})

/**
 * POST — send a shift offer for a session day. Targeted (one referee) or
 * broadcast (whole pool, first accept wins). Referees are notified either way.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const ctx = await requireLeagueSide(auth.userId, auth.isPlatformAdmin, params.id)
    if ("error" in ctx) return ctx.error
    const { league } = ctx

    const parsed = createSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }
    const data = parsed.data
    if (data.endTime <= data.startTime) {
      return NextResponse.json({ error: "Shift end must be after its start" }, { status: 400 })
    }

    // The day must belong to one of this league's seasons
    const day = (await prisma.seasonSessionDay.findFirst({
      where: { id: data.sessionDayId, session: { season: { leagueId: params.id } } },
      select: { id: true, date: true, session: { select: { label: true } } },
    })) as any
    if (!day) return NextResponse.json({ error: "Session day not found" }, { status: 404 })

    // One live offer per referee per day (broadcast counts as everyone's)
    const existing = await prisma.refereeSessionRequest.findFirst({
      where: {
        sessionDayId: day.id,
        status: "PENDING",
        OR: [{ targetUserId: data.targetUserId ?? null }, { targetUserId: null }],
      },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json(
        { error: "There is already a pending offer for that day" },
        { status: 409 }
      )
    }

    let notifyIds: string[] = []
    if (data.targetUserId) {
      const inPoolOrRef = await prisma.user.findFirst({
        where: { id: data.targetUserId, roles: { some: { role: "Referee" } } },
        select: { id: true },
      })
      if (!inPoolOrRef) {
        return NextResponse.json({ error: "That user is not a referee" }, { status: 400 })
      }
      notifyIds = [data.targetUserId]
    } else {
      const pool = await prisma.leagueReferee.findMany({
        where: { leagueId: params.id },
        select: { userId: true },
      })
      if (pool.length === 0) {
        return NextResponse.json(
          { error: "Your league referee pool is empty — add referees first" },
          { status: 400 }
        )
      }
      notifyIds = pool.map((p: any) => p.userId)
    }

    const created = await prisma.refereeSessionRequest.create({
      data: {
        leagueId: params.id,
        sessionDayId: day.id,
        targetUserId: data.targetUserId ?? null,
        startTime: data.startTime,
        endTime: data.endTime,
        message: data.message ?? null,
        createdById: auth.userId,
      },
      select: { id: true },
    })

    const dateLabel = new Date(day.date).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
    await notifyMany(prisma, notifyIds, {
      type: "referee_request",
      title: `${league.name} needs a referee`,
      message: `${dateLabel}${day.session.label ? ` (${day.session.label})` : ""}, ${data.startTime}–${data.endTime}.${data.targetUserId ? "" : " First to accept gets the day."}${data.message ? ` "${data.message}"` : ""}`,
      link: "/referee/requests",
      referenceId: created.id,
      referenceType: "RefereeSessionRequest",
    })

    return NextResponse.json({ success: true, requestId: created.id, notified: notifyIds.length }, { status: 201 })
  } catch (error) {
    console.error("Referee request create error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
