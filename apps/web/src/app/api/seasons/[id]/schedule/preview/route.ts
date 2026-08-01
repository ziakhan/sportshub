import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { generateSchedule } from "@/lib/scheduler/generate"
import { runDistributed } from "@/lib/scheduler/distribute"
import { loadSchedulerInput } from "@/lib/scheduler/load"

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

const previewSchema = z.object({
  // Scenario descriptor (owner 2026-08-01): recommendations from the
  // scenarios endpoint round-trip through preview and commit so "Use this"
  // writes exactly what was shown.
  scenario: scenarioSchema,
  // sessionId → unit keys that session hosts (capacity planning); a session
  // absent from the map hosts any unit.
  sessionUnits: z.record(z.array(z.string())).optional(),
  // Session-by-session mode: only schedule these sessions; committed games
  // elsewhere seed matchup rotation and count toward guarantees.
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
 * POST /api/seasons/[id]/schedule/preview
 * Runs the scheduler and returns the proposed game list + warnings.
 * Does NOT write anything.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const owner = await (prisma as any).season.findUnique({
      where: { id: params.id },
      select: { league: { select: { ownerId: true } } },
    })
    if (!owner) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (owner.league.ownerId !== sessionInfo.userId && !sessionInfo.isPlatformAdmin)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const parsed = previewSchema.parse(body ?? {})
    const { sessionUnits, varietyShuffle, fillGapsOnly } = parsed
    const sessionIds = fillGapsOnly ? undefined : parsed.sessionIds

    const { input, errors } = await loadSchedulerInput(params.id)
    if (!input || errors.length > 0) {
      return NextResponse.json({ error: "Cannot preview", errors }, { status: 422 })
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
    if (sessionIds && sessionIds.length > 0) {
      input.restrictToSessionIds = sessionIds
      // Games elsewhere in the season stand — a commit would only replace
      // SCHEDULED games inside the restricted sessions.
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

    // Enrich output with team/venue/court names so UI (incl. Team check's
    // preview mode) can render "when · who · where" without extra lookups.
    const teamNameById = new Map<string, string>()
    for (const d of input.divisions) for (const t of d.teams) teamNameById.set(t.teamId, t.name)
    const venueIds = [...new Set(result.games.map((g) => g.venueId))]
    const courtIds = [...new Set(result.games.map((g) => g.courtId))]
    const [venues, courts] = await Promise.all([
      (prisma as any).venue.findMany({
        where: { id: { in: venueIds } },
        select: { id: true, name: true },
      }),
      (prisma as any).court.findMany({
        where: { id: { in: courtIds } },
        select: { id: true, name: true },
      }),
    ])
    const venueNameById = new Map(venues.map((v: any) => [v.id, v.name]))
    const courtNameById = new Map(courts.map((c: any) => [c.id, c.name]))

    return NextResponse.json({
      games: result.games.map((g) => ({
        ...g,
        homeTeamName: teamNameById.get(g.homeTeamId) ?? g.homeTeamId,
        awayTeamName: teamNameById.get(g.awayTeamId) ?? g.awayTeamId,
        venue: g.venueId ? { name: venueNameById.get(g.venueId) ?? null } : null,
        court: g.courtId ? { name: courtNameById.get(g.courtId) ?? null } : null,
      })),
      unscheduled: result.unscheduled.map((u) => ({
        ...u,
        homeTeamName: teamNameById.get(u.homeTeamId) ?? u.homeTeamId,
        awayTeamName: teamNameById.get(u.awayTeamId) ?? u.awayTeamId,
      })),
      warnings: result.warnings,
      tradeoffs: result.tradeoffs,
      utilization: result.utilization,
    })
  } catch (error) {
    console.error("Schedule preview error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
