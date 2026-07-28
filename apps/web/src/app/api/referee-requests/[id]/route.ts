import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { auditSafe } from "@/lib/audit"
import { getSessionUserId } from "@/lib/auth-helpers"
import { notify, notifySafe } from "@/lib/notifications"

export const dynamic = "force-dynamic"

const resolveSchema = z.object({ action: z.enum(["accept", "decline", "cancel"]) })

/**
 * PATCH /api/referee-requests/[id] { action }
 * accept/decline — the referee (target, or any pool member on broadcasts;
 * first accept wins). Accepting auto-assigns them to every game on that
 * session day inside the shift window. cancel — the league.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const req = (await prisma.refereeSessionRequest.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        targetUserId: true,
        startTime: true,
        endTime: true,
        createdById: true,
        league: { select: { id: true, name: true, ownerId: true } },
        sessionDay: { select: { id: true, date: true, session: { select: { label: true } } } },
      },
    })) as any
    if (!req) return NextResponse.json({ error: "Request not found" }, { status: 404 })

    const parsed = resolveSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "action must be accept, decline or cancel" }, { status: 400 })
    }
    const action = parsed.data.action

    if (action === "cancel") {
      const leagueSide =
        auth.isPlatformAdmin ||
        req.league.ownerId === auth.userId ||
        !!(await prisma.userRole.findFirst({
          where: { userId: auth.userId, role: { in: ["LeagueOwner", "LeagueManager"] }, leagueId: req.league.id },
          select: { id: true },
        }))
      if (!leagueSide) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      if (req.status !== "PENDING") {
        return NextResponse.json({ error: "Only pending offers can be cancelled" }, { status: 409 })
      }
      await prisma.refereeSessionRequest.update({
        where: { id: req.id },
        data: { status: "CANCELLED", respondedAt: new Date() },
      })
      // Tell the targeted referee the offer is gone — they may be holding the
      // day for it. Broadcast offers (no target) skip: no individual referee
      // was ever promised the day. notifySafe = best-effort, never throws.
      if (req.targetUserId) {
        await notifySafe({
          userId: req.targetUserId,
          type: "referee_request_cancelled",
          title: "Session offer withdrawn",
          message: `The ${new Date(req.sessionDay.date).toLocaleDateString()} session offer was withdrawn.`,
          link: "/referee/requests",
          referenceId: req.id,
          referenceType: "RefereeSessionRequest",
        })
      }
      return NextResponse.json({ success: true, status: "CANCELLED" })
    }

    // accept / decline — must be an eligible referee
    if (req.targetUserId) {
      if (req.targetUserId !== auth.userId) {
        return NextResponse.json({ error: "This offer is addressed to another referee" }, { status: 403 })
      }
    } else {
      const inPool = await prisma.leagueReferee.findUnique({
        where: { leagueId_userId: { leagueId: req.league.id, userId: auth.userId } },
        select: { id: true },
      })
      if (!inPool) {
        return NextResponse.json({ error: "This offer went to the league's referee pool" }, { status: 403 })
      }
    }
    if (req.status !== "PENDING") {
      return NextResponse.json(
        { error: req.status === "ACCEPTED" ? "Another referee already took this day" : "Offer is no longer open" },
        { status: 409 }
      )
    }

    if (action === "decline") {
      // Broadcast declines don't close the offer — others may still accept
      if (req.targetUserId) {
        await prisma.refereeSessionRequest.update({
          where: { id: req.id },
          data: { status: "DECLINED", respondedAt: new Date() },
        })
      }
      await notify(prisma, {
        userId: req.league.ownerId,
        type: "referee_request_declined",
        title: "Referee declined",
        message: `A referee declined the ${new Date(req.sessionDay.date).toLocaleDateString()} shift.`,
        link: `/manage/leagues/${req.league.id}`,
        referenceId: req.id,
        referenceType: "RefereeSessionRequest",
      })
      return NextResponse.json({ success: true, status: req.targetUserId ? "DECLINED" : "PENDING" })
    }

    // ACCEPT — first-accept-wins guard via conditional update
    const won = await prisma.refereeSessionRequest.updateMany({
      where: { id: req.id, status: "PENDING" },
      data: {
        // The agreement of record: accepting = agreeing to the offered per-game rate.
        agreedRatePerGame: (req as any).offeredRatePerGame ?? null, status: "ACCEPTED", acceptedById: auth.userId, respondedAt: new Date() },
    })
    if (won.count === 0) {
      return NextResponse.json({ error: "Another referee already took this day" }, { status: 409 })
    }

    // Auto-assign every game on that day inside the shift window
    const games = await prisma.game.findMany({
      where: { dayId: req.sessionDay.id, status: { in: ["SCHEDULED", "LIVE"] } },
      select: { id: true, scheduledAt: true },
    })
    const inWindow = games.filter((g: any) => {
      const hhmm = new Date(g.scheduledAt).toTimeString().slice(0, 5)
      return hhmm >= req.startTime && hhmm <= req.endTime
    })
    let assigned = 0
    for (const game of inWindow) {
      const exists = await prisma.userRole.findFirst({
        where: { userId: auth.userId, role: "Referee", gameId: game.id },
        select: { id: true },
      })
      if (!exists) {
        await prisma.userRole.create({
          data: { userId: auth.userId, role: "Referee", gameId: game.id },
        })
        assigned++
      }
    }

    await notify(prisma, {
      userId: req.league.ownerId,
      type: "referee_request_accepted",
      title: "Referee booked",
      message: `Your ${new Date(req.sessionDay.date).toLocaleDateString()} shift (${req.startTime}–${req.endTime}) was accepted — assigned to ${assigned} game${assigned !== 1 ? "s" : ""}.`,
      link: `/manage/leagues/${req.league.id}`,
      referenceId: req.id,
      referenceType: "RefereeSessionRequest",
    })
    await auditSafe({
      actorId: auth.realUserId,
      actorRole: "Referee",
      action: "REFEREE_ASSIGN",
      resource: "SeasonSessionDay",
      resourceId: req.sessionDay.id,
      changes: { via: "session-request", requestId: req.id, gamesAssigned: assigned, window: `${req.startTime}-${req.endTime}` },
      request,
    })

    return NextResponse.json({ success: true, status: "ACCEPTED", gamesAssigned: assigned })
  } catch (error) {
    console.error("Referee request resolve error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
