import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { notifyMany, type NotificationType } from "@/lib/notifications"
import { getGameAudienceUserIds } from "@/lib/game-audience"
import { sendEmail, appBaseUrl, escapeHtml, transactionalFooter } from "@/lib/email"
import { publishRealtime, rooms as rt } from "@/lib/realtime/publish"

export const dynamic = "force-dynamic"

/**
 * A game cancellation/reschedule fans out to EVERYONE affected — both clubs'
 * front office, both teams' coaches, and every player + parent — in one write.
 * This is the phone tree the platform replaces: the league changes the game
 * once, and every family is notified automatically (no club→coach→WhatsApp
 * relay). League owners already know (they did it), so they're not re-notified.
 *
 * Takes the pre-fetched audience so the bell fanout and the email fanout
 * (below) hit exactly the same recipients from one audience query.
 */
async function notifyGameAudience(
  game: { id: string; seasonId: string | null },
  userIds: string[],
  type: NotificationType,
  title: string,
  message: string
) {
  await notifyMany(prisma, userIds, {
    type,
    title,
    message,
    link: game.seasonId ? `/browse-leagues/${game.seasonId}` : null,
    referenceId: game.id,
    referenceType: "Game",
  })
}

/**
 * Email the same audience the bell reached. Bells alone weren't enough for
 * game changes — families drove to cancelled games (comms gap-audit phase 1).
 * Entirely best-effort: an SMTP hiccup must never fail the PATCH/DELETE, so
 * both the recipient lookup and every individual send are try/caught.
 */
async function emailGameAudience(
  userIds: string[],
  subject: string,
  heading: string,
  bodyHtml: string,
  gameId: string,
  orgName?: string | null
) {
  try {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { email: true },
    })
    const emails = Array.from(
      new Set(users.map((u) => u.email).filter((e): e is string => !!e))
    )
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${heading}</h2>
        ${bodyHtml}
        <p>
          <a href="${appBaseUrl()}/live/${gameId}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
            View game details
          </a>
        </p>
        ${transactionalFooter(orgName ?? undefined)}
      </div>
    `
    for (const to of emails) {
      try {
        await sendEmail({ to, subject, html })
      } catch (mailErr) {
        console.error("Game-change email failed:", to, mailErr)
      }
    }
  } catch (mailErr) {
    console.error("Game-change email fanout failed:", mailErr)
  }
}

const matchupLabel = (g: { homeTeam?: { name?: string }; awayTeam?: { name?: string } }) =>
  `${g.homeTeam?.name ?? "Home"} vs ${g.awayTeam?.name ?? "Away"}`

const fmtWhen = (d: Date | string) =>
  new Date(d).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })

const patchSchema = z.object({
  scheduledAt: z.string().datetime().optional(),
  venueId: z.string().nullable().optional(),
  courtId: z.string().nullable().optional(),
  dayId: z.string().nullable().optional(),
  dayVenueId: z.string().nullable().optional(),
  sessionId: z.string().nullable().optional(),
  homeTeamId: z.string().optional(),
  awayTeamId: z.string().optional(),
  status: z
    .enum(["SCHEDULED", "LIVE", "COMPLETED", "CANCELLED", "POSTPONED", "DEFAULTED"])
    .optional(),
  isLocked: z.boolean().optional(),
  defaultedBy: z.string().nullable().optional(),
  duration: z.number().int().min(10).max(240).optional(),
})

async function loadGameWithOwner(gameId: string) {
  return (await (prisma as any).game.findUnique({
    where: { id: gameId },
    include: {
      season: {
        select: {
          id: true,
          status: true,
          leagueId: true,
          league: { select: { ownerId: true, name: true } },
        },
      },
    },
  })) as any
}

/** Realtime ping after a schedule/status change (M1) — clients refetch. */
async function publishGameChange(
  game: { id: string; season?: { leagueId?: string | null } | null },
  status: string
) {
  await publishRealtime({
    rooms: [
      rt.game(game.id),
      rt.scores,
      ...(game.season?.leagueId ? [rt.leagueScores(game.season.leagueId)] : []),
    ],
    event: "game.update",
    payload: { gameId: game.id, status },
  })
}

/**
 * GET /api/games/[id] — fetch a single game with relations.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const game = await (prisma as any).game.findUnique({
      where: { id: params.id },
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
        venue: { select: { id: true, name: true } },
        court: { select: { id: true, name: true } },
        season: { select: { id: true, label: true, leagueId: true } },
      },
    })
    if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ game })
  } catch (error) {
    console.error("Game GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH /api/games/[id] — edit time/venue/court/teams/status.
 * Validates against team and court double-bookings within the season.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const game = await loadGameWithOwner(params.id)
    if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (game.season?.league?.ownerId !== sessionInfo.userId && !sessionInfo.isPlatformAdmin)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json()
    const data = patchSchema.parse(body)

    // A COMPLETED game is a signed record — its result/teams/time may only change
    // through the audited re-finalize flow (finalize + DELETE already guard this;
    // the generic PATCH didn't — docs/editability-audit.md §4). Toggling the lock
    // flag alone is still allowed.
    if (game.status === "COMPLETED") {
      const keys = Object.keys(data).filter((k) => (data as Record<string, unknown>)[k] !== undefined)
      const onlyLockToggle = keys.length > 0 && keys.every((k) => k === "isLocked")
      if (!onlyLockToggle) {
        return NextResponse.json(
          { error: "Game is completed — correct results through re-finalization" },
          { status: 409 }
        )
      }
    }

    // Derived values for conflict check
    const newStart = data.scheduledAt ? new Date(data.scheduledAt) : new Date(game.scheduledAt)
    const duration = data.duration ?? game.duration ?? 90
    const newEnd = new Date(newStart.getTime() + duration * 60000)
    const newCourtId = data.courtId !== undefined ? data.courtId : game.courtId
    const newHomeTeamId = data.homeTeamId ?? game.homeTeamId
    const newAwayTeamId = data.awayTeamId ?? game.awayTeamId

    if (newHomeTeamId === newAwayTeamId) {
      return NextResponse.json({ error: "Home and away team must differ" }, { status: 400 })
    }

    // Conflict check only applies when the game is still active
    const nextStatus = data.status ?? game.status
    const checkConflicts = game.seasonId && ["SCHEDULED", "LIVE", "POSTPONED"].includes(nextStatus)

    if (checkConflicts) {
      const overlappers = await (prisma as any).game.findMany({
        where: {
          seasonId: game.seasonId,
          id: { not: params.id },
          status: { in: ["SCHEDULED", "LIVE"] },
          OR: [
            { homeTeamId: { in: [newHomeTeamId, newAwayTeamId] } },
            { awayTeamId: { in: [newHomeTeamId, newAwayTeamId] } },
            ...(newCourtId ? [{ courtId: newCourtId }] : []),
          ],
        },
        select: {
          id: true,
          scheduledAt: true,
          duration: true,
          homeTeamId: true,
          awayTeamId: true,
          courtId: true,
        },
      })
      const conflicts: string[] = []
      for (const g of overlappers) {
        const gStart = new Date(g.scheduledAt)
        const gEnd = new Date(gStart.getTime() + (g.duration ?? 90) * 60000)
        const overlaps = gStart < newEnd && newStart < gEnd
        if (!overlaps) continue
        if (g.homeTeamId === newHomeTeamId || g.awayTeamId === newHomeTeamId)
          conflicts.push(`Home team double-booked against game ${g.id}`)
        if (g.homeTeamId === newAwayTeamId || g.awayTeamId === newAwayTeamId)
          conflicts.push(`Away team double-booked against game ${g.id}`)
        if (newCourtId && g.courtId === newCourtId)
          conflicts.push(`Court double-booked against game ${g.id}`)
      }
      if (conflicts.length > 0) {
        return NextResponse.json({ error: "Conflict detected", conflicts }, { status: 409 })
      }
    }

    const update: Record<string, any> = {}
    if (data.scheduledAt !== undefined) update.scheduledAt = new Date(data.scheduledAt)
    if (data.venueId !== undefined) update.venueId = data.venueId
    if (data.courtId !== undefined) update.courtId = data.courtId
    if (data.dayId !== undefined) update.dayId = data.dayId
    if (data.dayVenueId !== undefined) update.dayVenueId = data.dayVenueId
    if (data.sessionId !== undefined) update.sessionId = data.sessionId
    if (data.homeTeamId !== undefined) update.homeTeamId = data.homeTeamId
    if (data.awayTeamId !== undefined) update.awayTeamId = data.awayTeamId
    if (data.status !== undefined) update.status = data.status
    if (data.isLocked !== undefined) update.isLocked = data.isLocked
    if (data.defaultedBy !== undefined) update.defaultedBy = data.defaultedBy
    if (data.duration !== undefined) update.duration = data.duration

    const updated = await (prisma as any).game.update({
      where: { id: params.id },
      data: update,
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
        venue: { select: { id: true, name: true } },
        court: { select: { id: true, name: true } },
      },
    })

    // G8 notifications — compare against the pre-update row
    const becameInactive =
      data.status !== undefined &&
      ["CANCELLED", "POSTPONED"].includes(data.status) &&
      game.status !== data.status
    const becameDefaulted = data.status === "DEFAULTED" && game.status !== "DEFAULTED"
    const timeChanged =
      data.scheduledAt !== undefined &&
      new Date(data.scheduledAt).getTime() !== new Date(game.scheduledAt).getTime()
    const placeChanged =
      (data.venueId !== undefined && data.venueId !== game.venueId) ||
      (data.courtId !== undefined && data.courtId !== game.courtId)

    const leagueName: string | null = game.season?.league?.name ?? null
    const matchup = matchupLabel(updated)
    const matchupHtml = `${escapeHtml(updated.homeTeam?.name ?? "Home")} vs ${escapeHtml(updated.awayTeam?.name ?? "Away")}`
    const whereHtml = `${updated.venue?.name ? ` at ${escapeHtml(updated.venue.name)}` : ""}${updated.court?.name ? ` (${escapeHtml(updated.court.name)})` : ""}`

    if (becameInactive) {
      const verb = data.status === "POSTPONED" ? "postponed" : "cancelled"
      const audienceUserIds = await getGameAudienceUserIds(game.homeTeamId, game.awayTeamId)
      await notifyGameAudience(
        game,
        audienceUserIds,
        "game_cancelled",
        data.status === "POSTPONED" ? "Game Postponed" : "Game Cancelled",
        `${matchup} on ${fmtWhen(game.scheduledAt)} has been ${verb} by the league.`
      )
      await emailGameAudience(
        audienceUserIds,
        `Game ${verb}: ${matchup}`,
        `Game ${data.status === "POSTPONED" ? "Postponed" : "Cancelled"}`,
        `<p><strong>${matchupHtml}</strong>, scheduled for <strong>${fmtWhen(game.scheduledAt)}</strong>${whereHtml}, has been ${verb} by the league.</p>
         <p>This game will not be played as scheduled — please do not travel to the venue.${data.status === "POSTPONED" ? " A new time will be announced." : ""}</p>`,
        game.id,
        leagueName
      )
    } else if (becameDefaulted) {
      // A forfeit ends the matchup just like a cancellation — previously this
      // status change notified NOBODY and families showed up to a dead game.
      const defaultedById = data.defaultedBy !== undefined ? data.defaultedBy : game.defaultedBy
      const forfeiter =
        defaultedById === updated.homeTeam?.id
          ? updated.homeTeam
          : defaultedById === updated.awayTeam?.id
            ? updated.awayTeam
            : null
      const winner =
        forfeiter && forfeiter.id === updated.homeTeam?.id ? updated.awayTeam : updated.homeTeam
      const forfeitText =
        forfeiter && winner
          ? `${forfeiter.name} forfeited; ${winner.name} is awarded the game.`
          : `${matchup} has been recorded as a forfeit.`
      const audienceUserIds = await getGameAudienceUserIds(game.homeTeamId, game.awayTeamId)
      await notifyGameAudience(
        game,
        audienceUserIds,
        "game_cancelled",
        "Game Forfeited",
        `${matchup} on ${fmtWhen(game.scheduledAt)}: ${forfeitText}`
      )
      await emailGameAudience(
        audienceUserIds,
        `Game forfeited: ${matchup}`,
        "Game Forfeited",
        `<p><strong>${matchupHtml}</strong>, scheduled for <strong>${fmtWhen(game.scheduledAt)}</strong>${whereHtml}, will not be played.</p>
         <p>${escapeHtml(forfeitText)}</p>`,
        game.id,
        leagueName
      )
    } else if ((timeChanged || placeChanged) && ["SCHEDULED", "LIVE", "POSTPONED"].includes(nextStatus)) {
      const audienceUserIds = await getGameAudienceUserIds(game.homeTeamId, game.awayTeamId)
      await notifyGameAudience(
        game,
        audienceUserIds,
        "game_rescheduled",
        "Game Rescheduled",
        `${matchup} has moved to ${fmtWhen(updated.scheduledAt)}${updated.venue?.name ? ` at ${updated.venue.name}` : ""}${updated.court?.name ? ` (${updated.court.name})` : ""}.`
      )
      await emailGameAudience(
        audienceUserIds,
        `Game rescheduled: ${matchup}`,
        "Game Rescheduled",
        `<p><strong>${matchupHtml}</strong> has been rescheduled.</p>
         <p>Previously: ${fmtWhen(game.scheduledAt)}<br />
         New time: <strong>${fmtWhen(updated.scheduledAt)}</strong>${whereHtml}</p>`,
        game.id,
        leagueName
      )
    }

    await publishGameChange(game, updated.status)

    return NextResponse.json({ game: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Game PATCH error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/games/[id] — mark the game CANCELLED (soft). Refuses if
 * the game has a final score already.
 */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const game = await loadGameWithOwner(params.id)
    if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (game.season?.league?.ownerId !== sessionInfo.userId && !sessionInfo.isPlatformAdmin)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    if (game.status === "COMPLETED") {
      return NextResponse.json({ error: "Cannot cancel a completed game" }, { status: 400 })
    }

    const updated = await (prisma as any).game.update({
      where: { id: params.id },
      data: { status: "CANCELLED" },
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
      },
    })

    if (game.status !== "CANCELLED") {
      const audienceUserIds = await getGameAudienceUserIds(game.homeTeamId, game.awayTeamId)
      await notifyGameAudience(
        game,
        audienceUserIds,
        "game_cancelled",
        "Game Cancelled",
        `${matchupLabel(updated)} on ${fmtWhen(game.scheduledAt)} has been cancelled by the league.`
      )
      await emailGameAudience(
        audienceUserIds,
        `Game cancelled: ${matchupLabel(updated)}`,
        "Game Cancelled",
        `<p><strong>${escapeHtml(updated.homeTeam?.name ?? "Home")} vs ${escapeHtml(updated.awayTeam?.name ?? "Away")}</strong>, scheduled for <strong>${fmtWhen(game.scheduledAt)}</strong>, has been cancelled by the league.</p>
         <p>This game will not be played — please do not travel to the venue.</p>`,
        game.id,
        game.season?.league?.name ?? null
      )
    }

    await publishGameChange(game, "CANCELLED")

    return NextResponse.json({ game: updated })
  } catch (error) {
    console.error("Game DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
