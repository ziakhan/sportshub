import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { generateSchedule } from "@/lib/scheduler/generate"
import { runDistributed } from "@/lib/scheduler/distribute"
import { loadSchedulerInput } from "@/lib/scheduler/load"
import { canCommitSchedule, COMMIT_NOT_READY_MESSAGE } from "@/lib/seasons/season-lock"

export const dynamic = "force-dynamic"

const scenarioSchema = z
  .object({
    excludeCourtIds: z.array(z.string()).max(50).optional(),
    dayWindow: z
      .object({
        startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      })
      .optional(),
    compactDays: z.boolean().optional(),
    // Venue distribution (owner 2026-08-01): divisionId → venueIds it may
    // use; the engine runs once per venue group and merges.
    divisionVenueMap: z.record(z.array(z.string()).min(1)).optional(),
  })
  .optional()

const commitSchema = z.object({
  // Scenario descriptor (owner 2026-08-01) — commit writes what "Use this
  // scenario" previewed.
  scenario: scenarioSchema,
  // If true, wipe existing REGULAR games first — scoped to `sessionIds`
  // when session-by-session mode is on.
  replaceExisting: z.boolean().default(true),
  // sessionId → unit keys that session hosts (must match the previewed plan).
  sessionUnits: z.record(z.array(z.string())).optional(),
  // Session-by-session mode: only schedule + replace these sessions.
  sessionIds: z.array(z.string()).optional(),
  // Shuffle attempt (owner 2026-07-31): 0/absent = the season's standard
  // variation; N rolls a different deterministic variation. The UI passes
  // the SAME number it previewed with, so commit writes what was shown.
  varietyShuffle: z.number().int().min(0).max(999).optional(),
  // Minimal-disruption recovery (owner 2026-08-01): don't touch ANY existing
  // game — treat the whole current schedule as fixed and only ADD games for
  // teams under their guarantee (dropout make-ups, late-added teams,
  // make-up sessions). Ignores sessionIds; replaceExisting is forced off.
  fillGapsOnly: z.boolean().default(false),
})

/**
 * POST /api/seasons/[id]/schedule/commit
 * Re-runs the scheduler and persists proposed games as Game rows in a
 * transaction. Requires season to be FINALIZED or IN_PROGRESS.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const season = await (prisma as any).season.findUnique({
      where: { id: params.id },
      select: { status: true, league: { select: { ownerId: true } } },
    })
    if (!season) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (season.league.ownerId !== sessionInfo.userId && !sessionInfo.isPlatformAdmin)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (!canCommitSchedule(season.status)) {
      return NextResponse.json(
        { error: COMMIT_NOT_READY_MESSAGE, code: "SEASON_NOT_READY" },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const parsed = commitSchema.parse(body)
    const { sessionUnits, varietyShuffle, fillGapsOnly } = parsed
    const replaceExisting = fillGapsOnly ? false : parsed.replaceExisting
    const sessionIds = fillGapsOnly ? undefined : parsed.sessionIds

    const { input, errors } = await loadSchedulerInput(params.id)
    if (!input || errors.length > 0) {
      return NextResponse.json({ error: "Cannot commit", errors }, { status: 422 })
    }
    if (varietyShuffle) {
      input.varietySeed = ((input.varietySeed ?? 0) + varietyShuffle * 131) % 9973
    }
    if (parsed.scenario) {
      if (parsed.scenario.excludeCourtIds?.length)
        input.excludeCourtIds = parsed.scenario.excludeCourtIds
      if (parsed.scenario.dayWindow) input.dayWindow = parsed.scenario.dayWindow
      if (parsed.scenario.compactDays) input.compactDays = true
    }
    const divisionVenueMap = parsed.scenario?.divisionVenueMap
    if (sessionUnits) input.sessionUnitFilter = sessionUnits
    const scoped = !!(sessionIds && sessionIds.length > 0)
    if (scoped) {
      input.restrictToSessionIds = sessionIds
      // Everything that survives this commit seeds matchup rotation +
      // per-team counts: games outside the restricted sessions, plus
      // non-SCHEDULED (played/live) games inside them.
      input.existingGames = await (prisma as any).game.findMany({
        where: {
          seasonId: params.id,
          phase: "REGULAR",
          status: { not: "CANCELLED" },
          NOT: { sessionId: { in: sessionIds }, status: "SCHEDULED", isLocked: false },
        },
        select: { homeTeamId: true, awayTeamId: true, scheduledAt: true, courtId: true, sessionId: true },
      })
    } else if (fillGapsOnly) {
      // Every current game is FIXED — the run may only add.
      input.existingGames = await (prisma as any).game.findMany({
        where: { seasonId: params.id, phase: "REGULAR", status: { not: "CANCELLED" } },
        select: {
          homeTeamId: true,
          awayTeamId: true,
          scheduledAt: true,
          courtId: true,
          sessionId: true,
        },
      })
    } else {
      // Whole-season runs replace only un-played games — played/live ones
      // survive, so they must seed matchup + per-team counts too.
      input.existingGames = await (prisma as any).game.findMany({
        where: {
          seasonId: params.id,
          phase: "REGULAR",
          OR: [
            { status: { notIn: ["CANCELLED", "SCHEDULED"] } },
            { status: "SCHEDULED", isLocked: true },
          ],
        },
        select: { homeTeamId: true, awayTeamId: true, scheduledAt: true, courtId: true, sessionId: true },
      })
    }

    const result = divisionVenueMap
      ? { utilization: undefined, ...runDistributed(input, divisionVenueMap) }
      : generateSchedule(input)

    const writeCounts = await (prisma as any).$transaction(async (tx: any) => {
      let removed = 0
      if (replaceExisting) {
        // Only wipe games that haven't started or transitioned beyond
        // SCHEDULED — and only in the targeted sessions when scoped.
        // Locked games are PINNED (Studio P0): regeneration never removes
        // them — the generator schedules around them instead.
        const del = await tx.game.deleteMany({
          where: {
            seasonId: params.id,
            phase: "REGULAR",
            status: "SCHEDULED",
            isLocked: false,
            ...(scoped ? { sessionId: { in: sessionIds } } : {}),
          },
        })
        removed = del.count
      }

      const created = await tx.game.createMany({
        data: result.games.map((g) => ({
          seasonId: params.id,
          phase: "REGULAR",
          sessionId: g.sessionId,
          dayId: g.dayId,
          dayVenueId: g.dayVenueId,
          courtId: g.courtId,
          venueId: g.venueId,
          homeTeamId: g.homeTeamId,
          awayTeamId: g.awayTeamId,
          scheduledAt: new Date(g.scheduledAt),
          duration: g.duration,
          status: "SCHEDULED",
          isLocked: false,
        })),
      })
      return { removed, created: created.count }
    })

    // No fanout here (owner 2026-07-31): committing saves a DRAFT the
    // operator can inspect and re-run freely. Families and clubs hear once,
    // when POST …/schedule/publish stamps the drafts.
    const draftCount = await (prisma as any).game.count({
      where: { seasonId: params.id, publishedAt: null },
    })

    return NextResponse.json({
      success: true,
      removed: writeCounts.removed,
      created: writeCounts.created,
      draftCount,
      unscheduledCount: result.unscheduled.length,
      warnings: result.warnings,
      tradeoffs: result.tradeoffs,
      utilization: result.utilization,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Schedule commit error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
