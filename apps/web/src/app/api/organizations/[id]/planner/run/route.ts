import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { runSeasonSchedule } from "@/lib/scheduler/run"
import { buildSlots } from "@/lib/scheduler/generate"

export const dynamic = "force-dynamic"

const runSchema = z.object({
  seasonIds: z.array(z.string()).min(1).max(8),
  levers: z
    .object({
      // Courts held completely free across EVERY league in the run.
      holdCourtIds: z.array(z.string()).max(50).optional(),
      // Clamp every day's window across the run ("shrink/expand hours").
      dayWindow: z
        .object({
          startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
          endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        })
        .optional(),
      compactDays: z.boolean().optional(),
    })
    .optional(),
})

/** May this user manage the operator? Mirrors organizations/[id]/route.ts. */
async function canManageOrg(userId: string, isPlatformAdmin: boolean, orgId: string) {
  if (isPlatformAdmin) return true
  const leagues = await (prisma as any).league.findMany({
    where: { organizationId: orgId },
    select: { id: true, ownerId: true },
  })
  if (leagues.some((l: any) => l.ownerId === userId)) return true
  const role = await prisma.userRole.findFirst({
    where: {
      userId,
      role: { in: ["LeagueOwner", "LeagueManager"] },
      leagueId: { in: leagues.map((l: any) => l.id) },
    },
    select: { id: true },
  })
  return !!role
}

/**
 * POST /api/organizations/[id]/planner/run (owner 2026-08-01: the TRUE
 * capacity planner — "throw all the courts into a mix"). Simulates every
 * selected season IN SEQUENCE, feeding earlier seasons' placed games into
 * later ones as hard court bookings, so shared venues never double-book.
 * Pure simulation — nothing is written.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!(await canManageOrg(auth.userId, auth.isPlatformAdmin, params.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const parsed = runSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "seasonIds (1-8) required" }, { status: 400 })
    }
    // Only this org's seasons may enter the pool.
    const seasons = await (prisma as any).season.findMany({
      where: {
        id: { in: parsed.data.seasonIds },
        league: { organizationId: params.id },
      },
      select: { id: true, label: true, league: { select: { id: true, name: true } } },
    })
    if (seasons.length === 0) {
      return NextResponse.json({ error: "No matching seasons" }, { status: 404 })
    }
    const ordered = parsed.data.seasonIds
      .map((id) => seasons.find((s: any) => s.id === id))
      .filter(Boolean) as any[]

    const levers = parsed.data.levers
    const overrides = {
      excludeCourtIds: levers?.holdCourtIds?.length ? levers.holdCourtIds : undefined,
      dayWindow: levers?.dayWindow,
      compactDays: levers?.compactDays || undefined,
    }

    const crossBookings: Array<{ courtId: string; start: string; end: string }> = []
    const seasonRows: any[] = []
    const usedByCourt = new Map<string, number>()
    const capacityByCourt = new Map<string, number>()

    for (const season of ordered) {
      const { run, errors } = await runSeasonSchedule(
        season.id,
        { extraBusyBookings: [...crossBookings] },
        overrides
      )
      if (!run) {
        seasonRows.push({
          seasonId: season.id,
          label: `${season.league.name} · ${season.label}`,
          ok: false,
          errors,
        })
        continue
      }
      // This season's placements become hard bookings for the NEXT season.
      for (const g of run.result.games) {
        const start = new Date(g.scheduledAt)
        crossBookings.push({
          courtId: g.courtId,
          start: start.toISOString(),
          end: new Date(start.getTime() + run.input.gameSlotMinutes * 60000).toISOString(),
        })
        usedByCourt.set(g.courtId, (usedByCourt.get(g.courtId) ?? 0) + 1)
      }
      for (const slot of buildSlots(run.input)) {
        capacityByCourt.set(slot.courtId, (capacityByCourt.get(slot.courtId) ?? 0) + 1)
      }
      seasonRows.push({
        seasonId: season.id,
        label: `${season.league.name} · ${season.label}`,
        ok: true,
        games: run.result.games.length,
        unscheduled: run.result.unscheduled.length,
        backToBacks: run.report.totals.backToBackTeamDays,
        preferenceViolations: run.report.totals.preferenceViolations,
        requestViolations: run.report.totals.requestViolations,
        tradeoffs: run.result.tradeoffs,
      })
    }

    // Utilization: courts appearing in several seasons' grids share physical
    // capacity — count each court's real capacity once (max across runs).
    const courtIds = [...capacityByCourt.keys()]
    const courts = await (prisma as any).court.findMany({
      where: { id: { in: courtIds } },
      select: { id: true, name: true, venue: { select: { id: true, name: true } } },
    })
    const utilization = courts
      .map((c: any) => {
        const capacity = capacityByCourt.get(c.id) ?? 0
        const used = usedByCourt.get(c.id) ?? 0
        return {
          courtId: c.id,
          court: c.name,
          venue: c.venue?.name ?? "",
          venueId: c.venue?.id ?? "",
          used,
          capacity,
          pct: capacity > 0 ? Math.round((100 * used) / capacity) : 0,
        }
      })
      .sort((a: any, b: any) => a.venue.localeCompare(b.venue) || a.court.localeCompare(b.court))

    const allFit = seasonRows.every((r) => r.ok && r.unscheduled === 0)
    const idleCourts = utilization.filter((u: any) => u.pct === 0).map((u: any) => `${u.venue} ${u.court}`)
    const recommendations: string[] = []
    if (idleCourts.length > 0) {
      recommendations.push(
        `${idleCourts.join(", ")} ${idleCourts.length === 1 ? "is" : "are"} never used — hold ${idleCourts.length === 1 ? "it" : "them"} free permanently or drop the booking.`
      )
    }
    const lightCourts = utilization.filter((u: any) => u.pct > 0 && u.pct < 15)
    if (lightCourts.length > 0) {
      recommendations.push(
        `${lightCourts.map((u: any) => `${u.venue} ${u.court}`).join(", ")} run under 15% — try the hold-free lever and re-run.`
      )
    }
    if (!allFit) {
      recommendations.push(
        "Not everything fits with these levers — free fewer courts, widen the day window, or add court time."
      )
    }

    return NextResponse.json({
      allFit,
      seasons: seasonRows,
      utilization,
      recommendations,
      levers: levers ?? null,
    })
  } catch (error) {
    console.error("Org planner run error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
