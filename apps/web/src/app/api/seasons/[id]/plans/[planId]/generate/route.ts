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
import { applyProposal, solveSeasonV2 } from "@/lib/scheduler-v2"

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
 *    applyAssignment, the isActive flip, the settings re-snapshot), then
 *    SCHEDULER V2 (owner-ordered clean-sheet rebuild, 2026-08-08):
 *    snapshot -> audit (plain-words BLOCK findings, before any write) ->
 *    whole-season solve -> identity-preserving apply. Played/live/locked
 *    games are pins v2 schedules around; draft games keep their ids.
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

    /* DIVISIONS FROM REAL NUMBERS (owner ruling 2026-08-09): the plan's
       step-1 split intents become real Division rows only NOW, at the one
       button — plans stay sandboxes. Teams snake-deal deterministically
       (by record when standings exist, else by name); every non-empty
       target division inherits the grade's gym on each hosted weekend. */
    const divisionPlans =
      ((settings?.state as any)?.divisionPlans as Record<string, { count: number }> | undefined) ??
      {}
    for (const [gradeKey, dp] of Object.entries(divisionPlans)) {
      if (!dp || dp.count <= 1 || !gradeKey.startsWith("age:")) continue
      const ageGroup = gradeKey.slice(4)
      const divs = await (prisma as any).division.findMany({
        where: { seasonId: params.id, ageGroup },
        orderBy: { name: "asc" },
        include: { teamSubmissions: { where: { status: "APPROVED" }, include: { team: { select: { name: true } } } } },
      })
      if (divs.length === 0) continue
      const subs = divs.flatMap((d: any) => d.teamSubmissions)
      if (subs.length < dp.count) continue
      // Deterministic seed order: by name (records, when they exist, come
      // from the fine-tuning board later — recorded follow-up).
      subs.sort((a: any, b: any) => String(a.team?.name ?? a.teamId).localeCompare(String(b.team?.name ?? b.teamId)))
      // Target divisions: reuse existing rows in name order, create the rest.
      const targets: any[] = divs.slice(0, dp.count)
      for (let i = targets.length; i < dp.count; i++) {
        const created = await (prisma as any).division.create({
          data: {
            seasonId: params.id,
            name: `${ageGroup} · Division ${String.fromCharCode(65 + i)}`,
            ageGroup,
            tier: 1,
          },
        })
        targets.push(created)
      }
      // Snake deal.
      const assignment = new Map<string, string>()
      let idx = 0
      let dir = 1
      for (const sub of subs) {
        assignment.set(sub.id, targets[idx].id)
        idx += dir
        if (idx === dp.count || idx === -1) {
          dir = -dir
          idx += dir
        }
      }
      for (const [subId, divisionId] of assignment) {
        await (prisma as any).teamSubmission.update({ where: { id: subId }, data: { divisionId } })
      }
      // Hosting: wherever ANY of the grade's divisions is hosted, every
      // target division joins that weekend at the same gym.
      const sessions = await (prisma as any).seasonSession.findMany({
        where: { seasonId: params.id, phase: "REGULAR" },
        select: { id: true, unitVenues: true },
      })
      const gradeDivIds = new Set(divs.map((d: any) => d.id))
      for (const sess of sessions) {
        const uv = (sess.unitVenues ?? {}) as Record<string, string>
        const hostedGyms = Object.entries(uv)
          .filter(([k]) => k.startsWith("division:") && gradeDivIds.has(k.slice(9)))
          .map(([, v]) => v)
        if (hostedGyms.length === 0) continue
        const gym = hostedGyms[0]
        let changed = false
        for (const t of targets) {
          if (!uv[`division:${t.id}`]) {
            uv[`division:${t.id}`] = gym
            changed = true
          }
        }
        // Empty (surplus) divisions keep their keys harmlessly; the world
        // builder drops grade entries with no teams.
        if (changed) {
          await (prisma as any).seasonSession.update({ where: { id: sess.id }, data: { unitVenues: uv } })
        }
      }
    }

    /* -------- AND GENERATE: scheduler v2 (owner's clean-sheet rebuild, ------- */
    /* -------- 2026-08-08) — snapshot -> audit -> solve -> apply.        ------- */
    // The plan's own excluded teams stay out of the run (owner ruling
    // 2026-08-07, #8): generation covers "the N teams in this plan", and the
    // world builder drops the rest before any pairing exists.
    const excludedTeamIds =
      ((settings?.state as any)?.excludedTeamIds as string[] | undefined) ?? undefined
    const solved = await solveSeasonV2(params.id, { excludedTeamIds })
    if (solved.errors.length > 0) {
      return NextResponse.json({ error: "Cannot generate", errors: solved.errors }, { status: 422 })
    }
    const blocks = solved.findings.filter((f) => f.severity === "BLOCK")
    if (blocks.length > 0 || !solved.proposal) {
      // The auditor speaks BEFORE anything is written: plain words, real
      // arithmetic, concrete options (H1/H2 contract).
      return NextResponse.json(
        { error: "Cannot generate", errors: blocks.map((f) => f.message) },
        { status: 422 }
      )
    }
    if (solved.unplaced > 0) {
      // §6.11: the audit passed but placement failed — an engine bug, never
      // a silent degradation. Nothing is written.
      return NextResponse.json(
        {
          error: "Cannot generate",
          errors: [
            `${solved.unplaced} games could not be placed even though the plan fits — this is an engine fault, nothing was written. Please report it.`,
          ],
        },
        { status: 500 }
      )
    }
    await applyProposal(params.id, solved.proposal)

    return NextResponse.json({
      generated: true,
      games: solved.proposal.stats.games,
      unscheduled: 0,
      warnings: solved.findings.filter((f) => f.severity !== "BLOCK").map((f) => f.message),
      shape: {
        backToBacks: solved.proposal.stats.backToBacks,
        longGaps: solved.proposal.stats.longGaps,
        twoDateWeekends: solved.proposal.stats.twoDateWeekends,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Season plan generate error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
