import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@youthbasketballhub/db"
import { withAuth, apiError } from "@/lib/api/handler"
import { canScoreGame } from "@/lib/scoring/authz"
import { dateInTz, wallTimeToUtc } from "@/lib/calendar/timezone"
import { placeChannel, StreamPlacementError } from "@/lib/streaming/placement"

export const dynamic = "force-dynamic"

/**
 * Placement — "the camera at my court is this one"
 * (docs/roadmap/live-streaming-plan.md, "The human interaction").
 *
 * The one human touch in the whole streaming system, and it is deliberately
 * cheap: the scorekeeper is already at the court and already signed in to
 * score this exact game, so they tap the preview tile showing THEIR gym.
 * Picking by picture is the anti-mistake mechanism — stickers get swapped and
 * labels get misread, but nobody mistakes someone else's gym for the floor
 * they are sitting beside.
 *
 * Who may call it: PlatformAdmin (the ops dashboard, dragging rigs between
 * courts from the office) and anyone the scoring console already trusts with
 * a game on that court — canScoreGame, unchanged, no second rule invented
 * here. If you can run the scoreboard for a game on that floor, you can say
 * which camera is pointing at it.
 */

const placementSchema = z
  .object({
    channelId: z.string().min(1),
    courtId: z.string().min(1).optional(),
    venueId: z.string().min(1).optional(),
    /** The user confirmed the take-over warning. */
    force: z.boolean().optional(),
  })
  .refine((v) => !!v.courtId !== !!v.venueId, {
    message: "Place a camera at exactly one court or one venue",
  })

/** Today's unfinished games at the placement target, in the app timezone. */
async function gamesAtTarget(courtId?: string, venueId?: string) {
  const { year, month, day } = dateInTz(new Date())
  const dayStart = wallTimeToUtc(year, month, day, 0, 0)
  const dayEnd = wallTimeToUtc(year, month, day + 1, 0, 0)
  return prisma.game.findMany({
    where: {
      scheduledAt: { gte: dayStart, lt: dayEnd },
      status: { notIn: ["COMPLETED", "CANCELLED", "POSTPONED", "DEFAULTED"] },
      ...(courtId ? { courtId } : { venueId, courtId: null }),
    },
    select: { id: true, homeTeamId: true, awayTeamId: true, seasonId: true },
  })
}

export const POST = withAuth<NextRequest>(async (request, _ctx, session) => {
  const body = placementSchema.parse(await request.json())

  let actorRole = "PlatformAdmin"
  if (!session.isPlatformAdmin) {
    const games = await gamesAtTarget(body.courtId, body.venueId)
    const allowed = await Promise.all(
      games.map((game) => canScoreGame(session.userId, false, game))
    )
    if (!allowed.some(Boolean)) {
      return apiError(
        403,
        "Only the people scoring a game on that court can move its camera",
        "FORBIDDEN"
      )
    }
    actorRole = "Scorekeeper"
  }

  try {
    const result = await placeChannel({
      channelId: body.channelId,
      courtId: body.courtId ?? null,
      venueId: body.venueId ?? null,
      actorId: session.realUserId,
      actorRole,
      force: body.force === true,
      request,
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    if (error instanceof StreamPlacementError) {
      // TAKEOVER_REQUIRED carries the other court's live game, so the dialog
      // can name what it is about to interrupt instead of saying "conflict".
      return apiError(error.status, error.message, error.code, error.details)
    }
    throw error
  }
})
