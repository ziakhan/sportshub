import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@youthbasketballhub/db"
import { applyAssignment } from "@/lib/scheduler/planner"
import { weekendDemand, type PlannerState } from "@/lib/scheduler/planner-core"
import { planStateFrom } from "@/lib/scheduler/plan-world"
import { seasonPlannerAuth } from "@/lib/scheduler/planner-auth"
import { isSeasonLocked, SEASON_LOCKED_MESSAGE } from "@/lib/seasons/season-lock"
import {
  applyPlanWorld,
  currentSettings,
  findOwnedPlan,
  type PlanAssignment,
  type PlanVenues,
} from "@/lib/scheduler/season-plans"
import type { PlanSettings } from "@/lib/scheduler/plan-documents"
import { loadSchedulerInput } from "@/lib/scheduler/load"
import { generateSchedule } from "@/lib/scheduler/generate"

export const dynamic = "force-dynamic"

/**
 * POST /api/seasons/[id]/plans/[planId]/generate — THE ONE BUTTON (owner
 * rulings 2026-08-07, #3 and #5): "one-click button to use this plan and
 * generate. A league owner is not technical." One press makes the plan the
 * season and builds the schedule on it; nothing else asks to be pressed
 * first, and nothing here says "activate" out loud.
 *
 * Body: {confirm?: boolean}
 *
 * 1. PREFLIGHT, before any write: the two sufficiency questions the board
 *    already answers in colour, in plain words (ruling #5). Computed off the
 *    PLAN'S OWN saved world (planStateFrom) — the same shape steps 1-3 render
 *    — never off a live re-read of the season, which would need the write
 *    this step comes before.
 * 2. Findings and no confirm yet → 200 {needsConfirm: true, findings},
 *    nothing written.
 * 3. Otherwise: the exact writes POST .../activate makes (applyPlanWorld,
 *    applyAssignment, the isActive flip, the settings re-snapshot), then the
 *    exact run POST .../schedule/commit makes for a whole-season regenerate
 *    (loadSchedulerInput, generateSchedule, the same existing-games seed and
 *    the same replace-unplayed-only delete).
 */
const bodySchema = z.object({ confirm: z.boolean().optional() })

/**
 * THE TWO QUESTIONS, AND NOTHING ELSE (owner ruling 2026-08-07, #5). Every
 * other structural fact — weekend counts out of the season's whole calendar,
 * how many plans exist, which weekends this plan left unused (ruling #9) —
 * is never a finding here, however true it is, because the board never
 * warned about it either.
 *
 * Deliberately NOT solvableState: that helper puts every pool gym in the
 * roster on the table as a CANDIDATE the draw could still book, which is the
 * right question for "could this weekend work" and the wrong one for "does
 * it, right now" — it would hide a real overage behind gyms nobody has
 * booked there. This reads the plan's raw saved world instead: exactly the
 * gyms and weekends the board already drew, so a green board can never
 * surprise the operator here.
 */
function preflightFindings(
  seasonId: string,
  plan: { assignment?: PlanAssignment | null; venues?: PlanVenues | null; settings?: PlanSettings | null }
): string[] {
  const state: PlannerState | null = planStateFrom(seasonId, plan)
  // A plan saved before plans remembered a world has nothing to measure
  // against — inventing one here would be the same lie applyPlanWorld
  // already refuses to tell.
  if (!state) return []

  const findings: string[] = []
  const guarantee = state.gamesPerTeam

  // a. THE GAMES PROMISE: what a grade's teams can actually get across the
  // weekends THIS PLAN chose for them, summed from each weekend's own
  // targetGamesPerTeam, against the season's guarantee as this plan's world
  // captured it.
  if (guarantee) {
    for (const unit of state.units) {
      if (unit.teams <= 0) continue
      let promised = 0
      for (const win of state.windows) {
        for (const w of win.weekends) {
          if (w.chosen && w.assigned.includes(unit.key)) promised += w.targetGamesPerTeam
        }
      }
      if (promised < guarantee) {
        findings.push(`${unit.label} teams would get ${promised} of ${guarantee} games.`)
      }
    }
  }

  // b. FIT: demand against the gym time actually booked, per weekend this
  // plan runs. Weekends it did not choose are never mentioned (ruling #9).
  for (const win of state.windows) {
    for (const w of win.weekends) {
      if (!w.chosen) continue
      const demand = weekendDemand(state.units, w, w.assigned)
      if (demand > w.capacityGames) {
        findings.push(`${w.label} holds ${demand} games but has room for ${w.capacityGames}.`)
      }
    }
  }

  return findings
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; planId: string } }
) {
  try {
    const gate = await seasonPlannerAuth(params.id)
    if (gate.status !== 200) return NextResponse.json({ error: gate.error }, { status: gate.status })
    if (isSeasonLocked(gate.seasonStatus)) {
      return NextResponse.json(
        { error: SEASON_LOCKED_MESSAGE, status: gate.seasonStatus },
        { status: 409 }
      )
    }

    const plan = await findOwnedPlan(params.id, params.planId)
    if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const { confirm } = bodySchema.parse(body)

    // THE ONLY QUESTIONS THE BUTTON MAY ASK (ruling #5). Green board = silent
    // button: confirm is never consulted unless there is something to say.
    const findings = preflightFindings(params.id, plan)
    if (findings.length > 0 && confirm !== true) {
      return NextResponse.json({ needsConfirm: true, findings })
    }

    /* -------- USE THIS CALENDAR: the same writes activate has always made ------- */
    const settings = (plan.settings ?? null) as PlanSettings | null
    const world = settings?.state ? await applyPlanWorld(params.id, settings.state) : null

    await applyAssignment(
      params.id,
      (plan.assignment ?? {}) as PlanAssignment,
      (plan.venues ?? {}) as PlanVenues
    )

    // Exactly one active plan per season, in one transaction — the same
    // guarantee activate makes.
    await (prisma as any).$transaction([
      (prisma as any).seasonPlan.updateMany({
        where: { seasonId: params.id, id: { not: plan.id } },
        data: { isActive: false },
      }),
      (prisma as any).seasonPlan.update({
        where: { id: plan.id },
        data: { isActive: true },
      }),
    ])

    // The plan's memory of its world is the season's own now, read back
    // rather than assumed (same reasoning as activate: a gym a game already
    // blocked is a real difference, and the snapshot has to show it).
    if (world) {
      await (prisma as any).seasonPlan.update({
        where: { id: plan.id },
        data: { settings: await currentSettings(params.id) },
      })
    }

    /* -------- AND GENERATE: the same run POST .../schedule/commit makes -------- */
    // The plan's own excluded teams stay out of the run (owner ruling
    // 2026-08-07, #8): generation covers "the N teams in this plan", and the
    // loader drops the rest before any pairing exists.
    const excludedTeamIds =
      ((settings?.state as any)?.excludedTeamIds as string[] | undefined) ?? undefined
    const { input, errors } = await loadSchedulerInput(params.id, { excludedTeamIds })
    if (!input || errors.length > 0) {
      return NextResponse.json({ error: "Cannot generate", errors }, { status: 422 })
    }

    // Whole-season regenerate: only un-played games are replaced. Played and
    // live games survive and seed matchup + per-team counts, exactly the
    // "else" branch of POST .../schedule/commit.
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

    const result = generateSchedule(input)

    const writeCounts = await (prisma as any).$transaction(async (tx: any) => {
      // Locked games are PINNED and never removed; the generator schedules
      // around them (same guard as schedule/commit).
      const del = await tx.game.deleteMany({
        where: { seasonId: params.id, phase: "REGULAR", status: "SCHEDULED", isLocked: false },
      })
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
      return { removed: del.count, created: created.count }
    })

    return NextResponse.json({
      generated: true,
      games: writeCounts.created,
      unscheduled: result.unscheduled.length,
      warnings: result.warnings,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Season plan generate error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
