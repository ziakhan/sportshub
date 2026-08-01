import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { runSeasonSchedule, type SeasonRun } from "@/lib/scheduler/run"
import type { SchedulerInput } from "@/lib/scheduler/generate"

export const dynamic = "force-dynamic"

interface ScenarioCard {
  key: string
  title: string
  descriptor: {
    excludeCourtIds?: string[]
    dayWindow?: { startTime?: string; endTime?: string }
    compactDays?: boolean
  } | null
  wins: string[]
  totals: Record<string, number>
  unscheduled: number
  tradeoffs: string[]
}

const fmtTime = (minOfDay: number): string => {
  const h = Math.floor(minOfDay / 60)
  const m = minOfDay % 60
  const ampm = h >= 12 ? "p.m." : "a.m."
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`
}

/** Latest game END across the season's days, as minutes-of-day. */
const latestEndMin = (run: SeasonRun): number => {
  let latest = 0
  for (const g of run.result.games) {
    const d = new Date(g.scheduledAt)
    latest = Math.max(latest, d.getHours() * 60 + d.getMinutes() + run.input.gameSlotMinutes)
  }
  return latest
}

const cardTotals = (run: SeasonRun): Record<string, number> => ({
  games: run.result.games.length,
  backToBackTeamDays: run.report.totals.backToBackTeamDays,
  preferenceViolations: run.report.totals.preferenceViolations,
  requestViolations: run.report.totals.requestViolations,
  splitVenueTeamDays: run.report.totals.splitVenueTeamDays,
  maxTopCourtShare: Math.round(run.report.totals.maxTopCourtShare * 100),
  latestEndMin: latestEndMin(run),
})

/** A variant "holds quality" when nothing strands and core fairness didn't regress. */
const holdsQuality = (variant: SeasonRun, baseline: SeasonRun): boolean =>
  variant.result.unscheduled.length === 0 &&
  variant.report.totals.backToBackTeamDays <= baseline.report.totals.backToBackTeamDays &&
  variant.report.totals.preferenceViolations <=
    baseline.report.totals.preferenceViolations + 2 &&
  variant.report.totals.requestViolations <= baseline.report.totals.requestViolations

/**
 * POST /api/seasons/[id]/schedule/scenarios (owner 2026-08-01: "run three or
 * four different scenarios and give them an option — a recommendation, not a
 * setting"). Runs the engine over the baseline plus automatic variants:
 * compact days, free-a-court, trim hours. Nothing is saved; each card's
 * descriptor round-trips through preview/commit.
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const owner = await (prisma as any).season.findUnique({
      where: { id: params.id },
      select: { league: { select: { ownerId: true } } },
    })
    if (!owner) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (owner.league.ownerId !== auth.userId && !auth.isPlatformAdmin)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { run: baseline, errors } = await runSeasonSchedule(params.id)
    if (!baseline) {
      return NextResponse.json({ error: "Cannot run scenarios", errors }, { status: 422 })
    }

    const cards: ScenarioCard[] = [
      {
        key: "baseline",
        title: "As configured",
        descriptor: null,
        wins: [],
        totals: cardTotals(baseline),
        unscheduled: baseline.result.unscheduled.length,
        tradeoffs: baseline.result.tradeoffs,
      },
    ]

    // 1. Compact days — finish as early as possible.
    const { run: compact } = await runSeasonSchedule(params.id, undefined, { compactDays: true })
    if (compact && holdsQuality(compact, baseline)) {
      const before = latestEndMin(baseline)
      const after = latestEndMin(compact)
      if (after < before) {
        cards.push({
          key: "compact",
          title: "Compact days — finish early",
          descriptor: { compactDays: true },
          wins: [`Days end by ${fmtTime(after)} instead of ${fmtTime(before)}`],
          totals: cardTotals(compact),
          unscheduled: 0,
          tradeoffs: compact.result.tradeoffs,
        })
      }
    }

    // 2. Free a court — try the least-used court, then the least-used venue.
    const useByCourt = new Map<string, number>()
    const useByVenue = new Map<string, number>()
    for (const g of baseline.result.games) {
      useByCourt.set(g.courtId, (useByCourt.get(g.courtId) ?? 0) + 1)
      useByVenue.set(g.venueId, (useByVenue.get(g.venueId) ?? 0) + 1)
    }
    const allCourts = new Map<string, { venueId: string }>()
    for (const sess of baseline.input.sessions) {
      for (const d of sess.days) {
        for (const dv of d.dayVenues) {
          for (const c of dv.courts) allCourts.set(c.id, { venueId: dv.venueId })
        }
      }
    }
    const courtCandidates = [...allCourts.keys()].sort(
      (a, b) => (useByCourt.get(a) ?? 0) - (useByCourt.get(b) ?? 0)
    )
    const venueCandidates = [...new Set([...allCourts.values()].map((v) => v.venueId))].sort(
      (a, b) => (useByVenue.get(a) ?? 0) - (useByVenue.get(b) ?? 0)
    )
    const [courtNames, venueNames] = await Promise.all([
      (prisma as any).court.findMany({
        where: { id: { in: [...allCourts.keys()] } },
        select: { id: true, name: true, venue: { select: { name: true } } },
      }),
      (prisma as any).venue.findMany({
        where: { id: { in: venueCandidates } },
        select: { id: true, name: true },
      }),
    ])
    const courtLabel = new Map(
      courtNames.map((c: any) => [c.id, `${c.venue?.name ?? ""} ${c.name}`.trim()])
    )
    const venueLabel = new Map(venueNames.map((v: any) => [v.id, v.name]))

    // Whole venue free first (the bigger win), else a single court.
    let freed = false
    if (venueCandidates.length > 1) {
      const vid = venueCandidates[0]
      const courts = [...allCourts.entries()].filter(([, v]) => v.venueId === vid).map(([id]) => id)
      const { run } = await runSeasonSchedule(params.id, undefined, { excludeCourtIds: courts })
      if (run && holdsQuality(run, baseline)) {
        cards.push({
          key: "free-venue",
          title: `Free up ${venueLabel.get(vid) ?? "a venue"} entirely`,
          descriptor: { excludeCourtIds: courts },
          wins: [
            `${venueLabel.get(vid) ?? "The venue"} stays completely free all season — drop the booking or rent it out`,
          ],
          totals: cardTotals(run),
          unscheduled: 0,
          tradeoffs: run.result.tradeoffs,
        })
        freed = true
      }
    }
    if (!freed && courtCandidates.length > 1) {
      const cid = courtCandidates[0]
      const { run } = await runSeasonSchedule(params.id, undefined, { excludeCourtIds: [cid] })
      if (run && holdsQuality(run, baseline)) {
        cards.push({
          key: "free-court",
          title: `Free up ${courtLabel.get(cid) ?? "a court"}`,
          descriptor: { excludeCourtIds: [cid] },
          wins: [`${courtLabel.get(cid) ?? "The court"} stays free all season`],
          totals: cardTotals(run),
          unscheduled: 0,
          tradeoffs: run.result.tradeoffs,
        })
      }
    }

    // 3. Trim hours — cap the day at what the compact run actually needed.
    const capSource = compact && holdsQuality(compact, baseline) ? compact : baseline
    const capMin = latestEndMin(capSource)
    const endTime = `${String(Math.floor(capMin / 60)).padStart(2, "0")}:${String(capMin % 60).padStart(2, "0")}`
    const { run: trimmed } = await runSeasonSchedule(params.id, undefined, {
      dayWindow: { endTime },
      compactDays: true,
    })
    if (trimmed && holdsQuality(trimmed, baseline)) {
      cards.push({
        key: "trim-hours",
        title: `Shrink the day — nothing after ${fmtTime(capMin)}`,
        descriptor: { dayWindow: { endTime }, compactDays: true },
        wins: [
          `Court time after ${fmtTime(capMin)} is never booked — shorten the rental or hand it to another program`,
        ],
        totals: cardTotals(trimmed),
        unscheduled: 0,
        tradeoffs: trimmed.result.tradeoffs,
      })
    }

    // When the baseline itself is struggling, say so — expansion advice
    // comes from the failure diagnostics, not a runnable variant (venue
    // hours can't be extended past what the buildings offer).
    const advice =
      baseline.result.unscheduled.length > 0
        ? "The baseline leaves games unplaced — scenarios can't fix missing capacity. Add court time, another venue, or a session."
        : null

    return NextResponse.json({ cards, advice })
  } catch (error) {
    console.error("Schedule scenarios error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
