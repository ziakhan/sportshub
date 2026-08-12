import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { auditSafe } from "@/lib/audit"
import { getSessionUserId } from "@/lib/auth-helpers"
import { PUBLISHED_GAME } from "@/lib/games/visibility"
import { notify, notifySafe } from "@/lib/notifications"
import { assignRefereeToGames, inShiftWindow } from "@/lib/referees/shift-assign"

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

    /**
     * Auto-assign every PUBLISHED game on that day inside the shift window
     * (QA T-013a). Drafts are the operator's private working copy — the
     * PUBLISHED_GAME law every public surface filters by — so booking a
     * referee onto one produced assignments the referee could not see
     * anywhere. Draft games in the window are counted instead, so the
     * response can say honestly what is still to come: publishing attaches
     * this shift's referee to them (see schedule/publish).
     */
    const games = await prisma.game.findMany({
      where: { dayId: req.sessionDay.id, status: { in: ["SCHEDULED", "LIVE"] }, ...PUBLISHED_GAME },
      select: { id: true, scheduledAt: true },
    })
    const inWindow = games.filter((g: any) => inShiftWindow(g.scheduledAt, req.startTime, req.endTime))
    const assigned = await assignRefereeToGames(
      auth.userId,
      inWindow.map((g: any) => g.id)
    )
    const drafts = await prisma.game.findMany({
      where: { dayId: req.sessionDay.id, status: "SCHEDULED", publishedAt: null },
      select: { scheduledAt: true },
    })
    const draftGamesPending = drafts.filter((g: any) =>
      inShiftWindow(g.scheduledAt, req.startTime, req.endTime)
    ).length

    const shiftDay = new Date(req.sessionDay.date).toLocaleDateString()
    await notify(prisma, {
      userId: req.league.ownerId,
      type: "referee_request_accepted",
      title: "Referee booked",
      message: `Your ${shiftDay} shift (${req.startTime} to ${req.endTime}) was accepted and the referee is assigned to ${assigned} published game${assigned !== 1 ? "s" : ""}.${
        draftGamesPending > 0
          ? ` ${draftGamesPending} draft game${draftGamesPending !== 1 ? "s" : ""} in the window will attach when you publish.`
          : ""
      }`,
      link: `/manage/leagues/${req.league.id}`,
      referenceId: req.id,
      referenceType: "RefereeSessionRequest",
    })
    // The referee hears about their own booking too (QA T-013a: only the
    // league owner used to get a notification). Best effort, never a failed
    // accept.
    await notifySafe({
      userId: auth.userId,
      type: "referee_shift_booked",
      title: "You're booked",
      message:
        assigned > 0
          ? `${req.league.name}: ${shiftDay}, ${req.startTime} to ${req.endTime}. You are assigned to ${assigned} game${assigned !== 1 ? "s" : ""}. See My Calendar.`
          : `${req.league.name}: ${shiftDay}, ${req.startTime} to ${req.endTime}. The schedule for that day is not published yet. Your games will appear in My Calendar when it goes out.`,
      link: "/calendar",
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

    return NextResponse.json({
      success: true,
      status: "ACCEPTED",
      gamesAssigned: assigned,
      // Draft games inside the window: booked-but-not-published work the UI
      // can be honest about instead of reporting "0 games" as if the day
      // were empty (QA T-013a).
      draftGamesPending,
    })
  } catch (error) {
    console.error("Referee request resolve error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
