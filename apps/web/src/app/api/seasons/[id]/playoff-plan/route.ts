import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@youthbasketballhub/db"
import { seasonPlannerAuth } from "@/lib/scheduler/planner-auth"
import { getSeasonStandings } from "@/lib/queries/standings"
import {
  buildStructure,
  defaultConfig,
  deriveFormat,
  divisionFirstRound1,
  placeWeekend,
  type PlayoffDivisionConfig,
  type SlotRef,
} from "@/lib/scheduler-v2/playoffs"
import type { SnapWeekend } from "@/lib/scheduler-v2/types"

export const dynamic = "force-dynamic"

/**
 * Playoff plan (owner 2026-08-08): configure per division, generate the
 * FULL structural schedule onto the booked playoff weekends with
 * placeholder slots, and materialize real Game rows only for games whose
 * participants are known. "Schedule the structure now, name the teams
 * later." Design + research: docs/roadmap/scheduler-v2-audit-2026-08-08.md.
 */

const configSchema = z.object({
  qualifiers: z.union([z.literal("all"), z.number().int().min(2).max(64)]),
  guaranteedGames: z.number().int().min(1).max(6),
  formatOverride: z.enum(["BRACKET", "POOLS", "PLACEMENT"]).nullable(),
  openingRound: z.enum(["SEEDED", "DIVISION_FIRST"]).optional(),
  thirdPlace: z.boolean(),
  maxGamesPerDay: z.number().int().min(1).max(4),
  weekendId: z.string().nullable(),
})

const putSchema = z.object({ configs: z.record(configSchema) })

/** PLAYOFF sessions as SnapWeekends. Day columns are DATE-ONLY (UTC
 *  midnight) — anchored at LOCAL midnight of the calendar date, the same
 *  law as world.ts (the "11 a.m. Friday" bug). */
async function playoffWeekends(seasonId: string): Promise<SnapWeekend[]> {
  const sessions = await (prisma as any).seasonSession.findMany({
    where: { seasonId, phase: "PLAYOFF" },
    orderBy: { id: "asc" },
    include: {
      days: {
        orderBy: { date: "asc" },
        include: {
          dayVenues: {
            orderBy: { id: "asc" },
            include: {
              courts: { select: { courtId: true, order: true }, orderBy: [{ order: "asc" }, { courtId: "asc" }] },
            },
          },
        },
      },
    },
  })
  const hhmm = (t: string | null, fallback: number): number => {
    const m = t ? /^(\d{1,2}):(\d{2})$/.exec(t) : null
    return m ? Number(m[1]) * 60 + Number(m[2]) : fallback
  }
  const weekends: SnapWeekend[] = []
  for (const sess of sessions) {
    const days = []
    for (const day of sess.days ?? []) {
      const raw = new Date(day.date)
      const date = new Date(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate())
      const venues = []
      for (const dv of day.dayVenues ?? []) {
        const openMin = hhmm(dv.startTime, 9 * 60)
        const closeMin = hhmm(dv.endTime, 20 * 60)
        const courts = (dv.courts ?? []).map((c: any, i: number) => ({
          id: c.courtId as string,
          order: (c.order as number) ?? i,
        }))
        if (closeMin > openMin && courts.length > 0) {
          venues.push({ dayVenueId: dv.id, gymId: dv.venueId, openMin, closeMin, courts })
        }
      }
      days.push({
        id: day.id,
        date: date.toISOString(),
        dateKey: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
        dow: date.getDay(),
        venues,
      })
    }
    weekends.push({
      id: sess.id,
      label: sess.label ?? null,
      order: weekends.length,
      roundId: sess.roundId ?? null,
      target: 0,
      days,
      hosting: [],
    })
  }
  return weekends
}

const weekendSupply = (w: SnapWeekend, slotMinutes: number): number => {
  let total = 0
  for (const d of w.days)
    for (const v of d.venues)
      total += Math.floor((v.closeMin - v.openMin) / slotMinutes) * v.courts.length
  return total
}


/**
 * Per-division configs with OWNER overrides on top of smart defaults. The
 * default weekend assignment bin-packs divisions (largest first) across
 * the booked playoff weekends by remaining court-slots — all-on-the-first
 * was measured overflowing the round cascade even under total capacity.
 */
function resolveConfigs(
  season: any,
  weekends: SnapWeekend[],
  slotMinutes: number
): Map<string, { cfg: PlayoffDivisionConfig; teams: number; label: string; divisionIds: string[]; structure: ReturnType<typeof buildStructure> }> {
  const stored = (season.playoffConfig ?? {}) as Record<string, PlayoffDivisionConfig>
  const remaining = new Map<string, number>()
  for (const w of weekends) remaining.set(w.id, weekendSupply(w, slotMinutes))

  // THE PLAYOFF UNIT IS THE GRADE (final model, owner 2026-08-09):
  // conference divisions are labels; their teams pool for the playoffs,
  // seeded by merged regular-season records.
  const byGrade = new Map<string, { teams: number; divisionIds: string[] }>()
  for (const d of season.divisions ?? []) {
    const teams = d.teamSubmissions?.length ?? 0
    if (teams < 1) continue
    const age = d.ageGroup ?? d.name
    // Setting B: a grade whose playoff pooling is DIVISION runs one
    // bracket PER division — its units are the divisions themselves.
    const pooling = (stored[age] as any)?.pooling ?? "GRADE"
    const key = pooling === "DIVISION" ? (d.name.includes(age) ? d.name : `${age} · ${d.name}`) : age
    if (!byGrade.has(key)) byGrade.set(key, { teams: 0, divisionIds: [] })
    const g = byGrade.get(key)!
    g.teams += teams
    g.divisionIds.push(d.id)
  }

  const rows: Array<{ id: string; teams: number; label: string; divisionIds: string[]; cfg: PlayoffDivisionConfig; structure: ReturnType<typeof buildStructure> }> = []
  for (const [key, g] of [...byGrade.entries()].sort()) {
    if (g.teams < 2) continue
    const cfg: PlayoffDivisionConfig = {
      ...defaultConfig(g.teams),
      ...(stored[key] ?? {}),
      weekendId: stored[key]?.weekendId ?? null,
    }
    const field = cfg.qualifiers === "all" ? g.teams : Math.min(cfg.qualifiers, g.teams)
    rows.push({ id: key, teams: g.teams, label: key, divisionIds: g.divisionIds, cfg, structure: buildStructure(field, cfg) })
  }
  // Pinned choices consume capacity first, then defaults pack the rest.
  for (const r of rows) {
    if (r.cfg.weekendId && remaining.has(r.cfg.weekendId)) {
      remaining.set(r.cfg.weekendId, remaining.get(r.cfg.weekendId)! - r.structure.games.length)
    }
  }
  for (const r of [...rows].sort((a, b) => b.structure.games.length - a.structure.games.length || (a.id < b.id ? -1 : 1))) {
    if (r.cfg.weekendId) continue
    let best: string | null = null
    for (const [wid, left] of remaining) {
      if (best === null || left > remaining.get(best)!) best = wid
    }
    r.cfg.weekendId = best
    if (best) remaining.set(best, remaining.get(best)! - r.structure.games.length)
  }
  return new Map(rows.map((r) => [r.id, { cfg: r.cfg, teams: r.teams, label: r.label, divisionIds: r.divisionIds, structure: r.structure }]))
}

async function seasonState(seasonId: string) {
  const season = await (prisma as any).season.findUnique({
    where: { id: seasonId },
    include: {
      divisions: {
        orderBy: { id: "asc" },
        include: {
          teamSubmissions: { where: { status: "APPROVED" }, select: { teamId: true } },
        },
      },
    },
  })
  return season
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const gate = await seasonPlannerAuth(params.id)
    if (gate.status !== 200) return NextResponse.json({ error: gate.error }, { status: gate.status })
    const season = await seasonState(params.id)
    if (!season) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const weekends = await playoffWeekends(params.id)
    const slotMinutes = season.gameSlotMinutes ?? 75
    const resolved = resolveConfigs(season, weekends, slotMinutes)
    // Per-weekend load so each card can say, in one sentence, whether it
    // fits alongside the other grades sharing its weekend.
    const loadByWeekend = new Map<string, number>()
    for (const [, e] of resolved) {
      if (!e.cfg.weekendId) continue
      loadByWeekend.set(e.cfg.weekendId, (loadByWeekend.get(e.cfg.weekendId) ?? 0) + e.structure.games.length)
    }
    const divisions = [...resolved.entries()].map(([key, entry]) => {
      const { cfg, teams, structure, divisionIds } = entry
      const field = cfg.qualifiers === "all" ? teams : Math.min(cfg.qualifiers as number, teams)
      const w = weekends.find((x) => x.id === cfg.weekendId)
      const supply = w ? weekendSupply(w, slotMinutes) : 0
      const load = cfg.weekendId ? (loadByWeekend.get(cfg.weekendId) ?? 0) : 0
      const lastDay = w?.days[w.days.length - 1]
      const finalDayName = lastDay
        ? new Date(lastDay.date).toLocaleDateString("en-CA", { weekday: "long" })
        : "the final day"
      const fit = !w
        ? { ok: false, text: "No playoff weekend is booked yet." }
        : load <= supply
          ? { ok: true, text: `${structure.games.length} games · fits ${w.label ?? "the playoff weekend"} (${load} of ${supply} slots with the other grades)` }
          : { ok: false, text: `${w.label ?? "The playoff weekend"} needs ${load} games across its grades but holds ${supply}. Move a grade to another weekend or add court time.` }
      return {
        id: key,
        name: key,
        teams,
        divisionCount: divisionIds.length,
        config: cfg,
        preview: {
          field,
          games: structure.games.length,
          byes: structure.byes,
          guaranteedGames: structure.guaranteedGames,
          notes: structure.notes,
          finalDayName,
          fit,
        },
      }
    })

    // Grades running as multiple divisions: the Playoffs tab asks HERE how
    // their brackets pool (owner 2026-08-09: playoff questions live in the
    // playoff area, not in season-start division setup).
    const stored = (season.playoffConfig ?? {}) as Record<string, any>
    const divCountByAge = new Map<string, number>()
    for (const d of season.divisions ?? []) {
      if ((d.teamSubmissions?.length ?? 0) === 0) continue
      const age = d.ageGroup ?? d.name
      divCountByAge.set(age, (divCountByAge.get(age) ?? 0) + 1)
    }
    const gradePooling = [...divCountByAge.entries()]
      .filter(([, n]) => n > 1)
      .map(([age, n]) => ({
        ageGroup: age,
        divisions: n,
        pooling: stored[age]?.pooling === "DIVISION" ? "DIVISION" : "GRADE",
      }))

    return NextResponse.json({
      divisions,
      gradePooling,
      weekends: weekends.map((w) => ({
        id: w.id,
        label: w.label,
        days: w.days.length,
        supply: weekendSupply(w, slotMinutes),
      })),
      plan: season.playoffPlan ?? null,
    })
  } catch (error) {
    console.error("Playoff plan GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const gate = await seasonPlannerAuth(params.id)
    if (gate.status !== 200) return NextResponse.json({ error: gate.error }, { status: gate.status })
    const body = putSchema.parse(await req.json())
    // MERGE, never replace: playoffConfig also stores grade-level keys the
    // unit configs don't carry (pooling for DIVISION-pooled grades). A full
    // replace silently wiped them on every config change.
    const seasonRow = await (prisma as any).season.findUnique({
      where: { id: params.id },
      select: { playoffConfig: true },
    })
    const stored = { ...((seasonRow?.playoffConfig ?? {}) as Record<string, any>) }
    for (const [k, v] of Object.entries(body.configs)) {
      stored[k] = { ...(stored[k] ?? {}), ...(v as object) }
    }
    await (prisma as any).season.update({
      where: { id: params.id },
      data: { playoffConfig: stored },
    })
    return NextResponse.json({ saved: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Playoff plan PUT error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const patchSchema = z.object({
  ageGroup: z.string().min(1).max(80),
  pooling: z.enum(["GRADE", "DIVISION"]),
})

/** PATCH — one grade's bracket pooling (whole grade vs per-division). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const gate = await seasonPlannerAuth(params.id)
    if (gate.status !== 200) return NextResponse.json({ error: gate.error }, { status: gate.status })
    const body = patchSchema.parse(await req.json())
    const season = await (prisma as any).season.findUnique({
      where: { id: params.id },
      select: { playoffConfig: true },
    })
    const pc = { ...((season?.playoffConfig ?? {}) as Record<string, any>) }
    pc[body.ageGroup] = { ...(pc[body.ageGroup] ?? {}), pooling: body.pooling }
    await (prisma as any).season.update({ where: { id: params.id }, data: { playoffConfig: pc } })
    return NextResponse.json({ saved: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Playoff plan PATCH error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST — generate. Preflight speaks BEFORE any write (capacity per
 * weekend, in plain words). Then: build structures, place each weekend's
 * divisions together on its booked courts, store the plan, and
 * materialize real Game rows for every game whose two participants are
 * already known (seeds resolve only when the division's regular season is
 * complete — a half-played season never fakes a seeding).
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const gate = await seasonPlannerAuth(params.id)
    if (gate.status !== 200) return NextResponse.json({ error: gate.error }, { status: gate.status })
    const season = await seasonState(params.id)
    if (!season) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const weekends = await playoffWeekends(params.id)
    if (weekends.length === 0) {
      return NextResponse.json(
        { error: "Cannot generate", errors: ["No playoff weekends are booked yet. Add a playoff session with gym time in Planning first."] },
        { status: 422 }
      )
    }
    const slotMinutes = season.gameSlotMinutes ?? 75
    const resolved = resolveConfigs(season, weekends, slotMinutes)

    /* Structures per weekend, one unit per GRADE. */
    const perWeekend = new Map<string, Array<{ divisionId: string; name: string; games: any[] }>>()
    for (const [key, entry] of resolved) {
      if (!entry.cfg.weekendId) continue
      if (!perWeekend.has(entry.cfg.weekendId)) perWeekend.set(entry.cfg.weekendId, [])
      perWeekend.get(entry.cfg.weekendId)!.push({ divisionId: key, name: entry.label, games: entry.structure.games })
    }

    /* Preflight: plain words, before any write. */
    const errors: string[] = []
    for (const [weekendId, divs] of perWeekend) {
      const w = weekends.find((x) => x.id === weekendId)
      if (!w) continue
      const demand = divs.reduce((acc, d) => acc + d.games.length, 0)
      const supply = weekendSupply(w, slotMinutes)
      if (demand > supply) {
        errors.push(
          `${w.label ?? "Playoff weekend"}: ${divs.map((d) => `${d.name} (${d.games.length})`).join(", ")} — ${demand} games need it, but the booking holds ${supply}. Short by ${demand - supply}. Add court-hours, or move a division to another playoff weekend.`
        )
      }
    }
    if (errors.length > 0) return NextResponse.json({ error: "Cannot generate", errors }, { status: 422 })

    /* Place. */
    const placedAll: Array<any> = []
    for (const [weekendId, divs] of perWeekend) {
      const w = weekends.find((x) => x.id === weekendId)!
      const { placed, unplaced } = placeWeekend(divs, w, slotMinutes)
      if (unplaced.length > 0) {
        return NextResponse.json(
          {
            error: "Cannot generate",
            errors: [
              `${w.label ?? "Playoff weekend"}: ${unplaced.length} games fit the total court time but not the round structure (rounds need rest and sequence). Add hours or spread divisions across weekends.`,
            ],
          },
          { status: 422 }
        )
      }
      for (const g of placed) placedAll.push({ ...g, weekendId })
    }

    /* Seed resolution: only for divisions whose REGULAR season is done. */
    const standings = await getSeasonStandings(params.id)
    const seedsByDivision = new Map<string, Array<{ teamId: string; name: string }>>()
    const gradeOfDivision = new Map<string, string>()
    for (const [key, entry] of resolved) {
      for (const did of entry.divisionIds) gradeOfDivision.set(did, key)
    }
    const openRegular = await (prisma as any).game.groupBy({
      by: ["homeTeamId"],
      where: { seasonId: params.id, phase: "REGULAR", status: { in: ["SCHEDULED", "LIVE"] } },
    })
    const teamsWithOpenGames = new Set(openRegular.map((r: any) => r.homeTeamId))
    const openAway = await (prisma as any).game.groupBy({
      by: ["awayTeamId"],
      where: { seasonId: params.id, phase: "REGULAR", status: { in: ["SCHEDULED", "LIVE"] } },
    })
    for (const r of openAway) teamsWithOpenGames.add(r.awayTeamId)
    // Merge each grade's division standings into one seeded list: wins,
    // then losses, then differential, then name — deterministic. Seeds
    // resolve only when NO team in the grade has open regular games.
    const gradeRows = new Map<string, Array<any>>()
    const gradeOpen = new Map<string, boolean>()
    const gradePlayed = new Map<string, boolean>()
    for (const div of standings?.divisions ?? []) {
      const key = gradeOfDivision.get(div.divisionId)
      if (!key) continue
      if (!gradeRows.has(key)) gradeRows.set(key, [])
      gradeRows.get(key)!.push(...div.rows)
      if (div.rows.some((r) => teamsWithOpenGames.has(r.teamId))) gradeOpen.set(key, true)
      if (div.rows.some((r) => (r as any).wins + (r as any).losses > 0)) gradePlayed.set(key, true)
    }
    for (const [key, rows] of gradeRows) {
      if (gradeOpen.get(key) || !gradePlayed.get(key)) continue
      const sorted = [...rows].sort(
        (a: any, b: any) =>
          b.wins - a.wins ||
          a.losses - b.losses ||
          (b.differential ?? 0) - (a.differential ?? 0) ||
          String(a.name).localeCompare(String(b.name))
      )
      seedsByDivision.set(key, sorted.map((r: any) => ({ teamId: r.teamId, name: r.name ?? r.teamId })))
    }

    // DIVISION_FIRST opening round (owner + NPH forensics): once a unit's
    // seeds are known, re-pair its bracket's round 1 within divisions.
    const teamDivision = new Map<string, string>()
    for (const div of standings?.divisions ?? []) {
      for (const r of div.rows) teamDivision.set(r.teamId, div.divisionId)
    }
    for (const [key, entry] of resolved) {
      if (entry.cfg.openingRound !== "DIVISION_FIRST") continue
      if (entry.divisionIds.length < 2) continue
      const seeds = seedsByDivision.get(key)
      if (!seeds) continue
      const field = entry.cfg.qualifiers === "all" ? entry.teams : Math.min(entry.cfg.qualifiers as number, entry.teams)
      if (deriveFormat(field, entry.cfg) !== "BRACKET") continue
      divisionFirstRound1(
        placedAll.filter((g) => g.divisionId === key),
        (seed) => {
          const row = seeds[seed - 1]
          return row ? (teamDivision.get(row.teamId) ?? null) : null
        }
      )
    }

    const nameOf = (divisionId: string, slot: SlotRef): { teamId: string | null; label: string } => {
      if (slot.type === "SEED") {
        const seeds = seedsByDivision.get(divisionId)
        const idx = Number(slot.ref) - 1
        if (seeds && seeds[idx]) return { teamId: seeds[idx].teamId, label: seeds[idx].name }
        return { teamId: null, label: `Seed ${slot.ref}` }
      }
      if (slot.type === "WINNER") return { teamId: null, label: `Winner of ${slot.ref.toUpperCase()}` }
      if (slot.type === "LOSER") return { teamId: null, label: `Loser of ${slot.ref.toUpperCase()}` }
      if (slot.type === "BEST2ND") return { teamId: null, label: `Best runner-up #${slot.ref}` }
      return { teamId: null, label: `Pool ${slot.ref.replace(":", " · place ")}` }
    }

    const planGames = placedAll.map((g) => {
      const home = nameOf(g.divisionId, g.home)
      const away = nameOf(g.divisionId, g.away)
      return {
        structId: g.id,
        divisionId: g.divisionId,
        weekendId: g.weekendId,
        round: g.round,
        tier: g.tier,
        dayId: g.dayId,
        dayVenueId: g.dayVenueId,
        courtId: g.courtId,
        gymId: g.gymId,
        startIso: g.startIso,
        home: g.home,
        away: g.away,
        homeLabel: home.label,
        awayLabel: away.label,
        homeTeamId: home.teamId,
        awayTeamId: away.teamId,
      }
    })

    /* Materialize resolved games; replace prior un-played playoff games. */
    let materialized = 0
    await (prisma as any).$transaction(async (tx: any) => {
      await tx.game.deleteMany({
        where: { seasonId: params.id, phase: "PLAYOFF", status: "SCHEDULED", isLocked: false },
      })
      const rows = planGames
        .filter((g) => g.homeTeamId && g.awayTeamId)
        .map((g) => ({
          seasonId: params.id,
          phase: "PLAYOFF",
          sessionId: g.weekendId,
          dayId: g.dayId,
          dayVenueId: g.dayVenueId,
          courtId: g.courtId,
          venueId: g.gymId,
          homeTeamId: g.homeTeamId!,
          awayTeamId: g.awayTeamId!,
          scheduledAt: new Date(g.startIso),
          duration: slotMinutes,
          status: "SCHEDULED",
          isLocked: false,
        }))
      if (rows.length > 0) await tx.game.createMany({ data: rows })
      materialized = rows.length
      await tx.season.update({
        where: { id: params.id },
        data: { playoffPlan: { generatedAt: new Date().toISOString(), games: planGames } },
      })
    })

    return NextResponse.json({
      generated: true,
      games: planGames.length,
      materialized,
      placeholders: planGames.length - materialized,
      seededDivisions: [...seedsByDivision.keys()].length,
    })
  } catch (error) {
    console.error("Playoff plan POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
