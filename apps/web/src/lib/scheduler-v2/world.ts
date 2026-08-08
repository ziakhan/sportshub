/**
 * Scheduler v2 — L0 WorldSnapshot builder. The ONLY module that reads the
 * database. Everything the solver will ever see is frozen here, canonically
 * ordered and content-hashed; two reads of the same world produce identical
 * bytes regardless of row order.
 */
import { createHash } from "crypto"
import { prisma } from "@youthbasketballhub/db"
import { effectiveSeasonConfig } from "../org/season-defaults"
import {
  V2_WEIGHTS,
  type SnapDay,
  type SnapGame,
  type SnapGrade,
  type SnapTeam,
  type SnapWeekend,
  type WorldSnapshot,
} from "./types"

const hhmmToMin = (t: string | null | undefined, fallback: number): number => {
  if (!t) return fallback
  const m = /^(\d{1,2}):(\d{2})$/.exec(t)
  if (!m) return fallback
  return Number(m[1]) * 60 + Number(m[2])
}

/** Blackout DATE columns are date-only (UTC midnight); playing days are
 *  local dates. Keyed the same way v1 keyed them so data matches. */
const utcDateKey = (d: Date): string =>
  `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`

const localDateKey = (d: Date): string => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

export interface WorldOptions {
  excludedTeamIds?: string[]
}

export async function buildWorldSnapshot(
  seasonId: string,
  options?: WorldOptions
): Promise<{ snapshot: WorldSnapshot | null; errors: string[] }> {
  const errors: string[] = []
  const season = (await (prisma as any).season.findUnique({
    where: { id: seasonId },
    include: {
      divisions: {
        orderBy: { id: "asc" },
        include: {
          teamSubmissions: {
            where: { status: "APPROVED" },
            orderBy: { id: "asc" },
            include: {
              team: { select: { id: true, name: true } },
              blackouts: { orderBy: { id: "asc" } },
              scheduleRequests: { where: { status: "APPROVED" }, orderBy: { id: "asc" } },
            },
          },
        },
      },
      sessions: {
        orderBy: { id: "asc" },
        include: {
          days: {
            orderBy: { date: "asc" },
            include: {
              dayVenues: {
                orderBy: { id: "asc" },
                include: {
                  courts: {
                    select: { courtId: true, order: true },
                    orderBy: [{ order: "asc" }, { courtId: "asc" }],
                  },
                },
              },
            },
          },
        },
      },
      schedulingGroups: {
        orderBy: { id: "asc" },
        include: { divisions: { select: { divisionId: true } } },
      },
      league: { select: { organization: { select: { seasonDefaults: true } } } },
    },
  })) as any

  if (!season) {
    errors.push("Season not found")
    return { snapshot: null, errors }
  }

  const { values: cfg } = effectiveSeasonConfig(
    season,
    season.league?.organization?.seasonDefaults
  )
  if (!cfg.gamesGuaranteed) {
    errors.push("gamesGuaranteed must be set before generating a schedule")
    return { snapshot: null, errors }
  }

  const slotMinutes = (cfg.gameSlotMinutes as number) ?? 90
  const defaultOpen = hhmmToMin((cfg.defaultVenueOpenTime as string) ?? "09:00", 9 * 60)
  const defaultClose = hhmmToMin((cfg.defaultVenueCloseTime as string) ?? "20:00", 20 * 60)
  const fridayStart = (cfg.fridayStartTime as string | null) ?? null
  const fridayEnd = (cfg.fridayEndTime as string | null) ?? null

  /* --------------------------------- teams --------------------------------- */

  const excluded = new Set(options?.excludedTeamIds ?? [])
  const grades: SnapGrade[] = []
  const teams: SnapTeam[] = []
  for (const d of season.divisions ?? []) {
    const teamIds: string[] = []
    for (const ts of d.teamSubmissions ?? []) {
      if (excluded.has(ts.teamId)) continue
      teamIds.push(ts.teamId)
      teams.push({
        id: ts.teamId,
        name: ts.team?.name ?? ts.teamId,
        gradeId: d.id,
        style:
          ts.weekendStyle && ts.weekendStyle !== "NO_PREFERENCE"
            ? (ts.weekendStyle as "SAME_DAY" | "SPLIT_DAYS")
            : null,
        blackouts: (ts.blackouts ?? []).map((b: any) => ({
          dateKey: utcDateKey(new Date(b.date)),
          startMin: hhmmToMin(b.startTime, 0) || undefined,
          endMin: hhmmToMin(b.endTime, 24 * 60) === 24 * 60 ? undefined : hhmmToMin(b.endTime, 24 * 60),
        })),
        windows: (ts.scheduleRequests ?? [])
          .filter((r: any) => r.kind === "WINDOW")
          .map((r: any) => ({
            dow: r.dayOfWeek ?? undefined,
            dateKey: r.date ? utcDateKey(new Date(r.date)) : undefined,
            earliestMin: r.earliestStart ? hhmmToMin(r.earliestStart, 0) : undefined,
            latestMin: r.latestStart ? hhmmToMin(r.latestStart, 24 * 60) : undefined,
          })),
      })
    }
    teamIds.sort()
    // A division with fewer than 2 teams schedules nothing — same rule the
    // roster UI states; it is dropped here, not special-cased downstream.
    if (teamIds.length >= 2) grades.push({ id: d.id, name: d.name, teamIds })
  }
  grades.sort((a, b) => (a.id < b.id ? -1 : 1))
  teams.sort((a, b) => (a.id < b.id ? -1 : 1))

  /* -------------------------------- weekends -------------------------------- */

  const gradeIds = new Set(grades.map((g) => g.id))
  const weekendsRaw: SnapWeekend[] = []
  for (const sess of season.sessions ?? []) {
    if (sess.phase !== "REGULAR") continue
    const days: SnapDay[] = []
    for (const day of sess.days ?? []) {
      const date = new Date(day.date)
      const dow = date.getDay()
      const venues = []
      for (const dv of day.dayVenues ?? []) {
        let openMin = hhmmToMin(dv.startTime, defaultOpen)
        let closeMin = hhmmToMin(dv.endTime, defaultClose)
        // The league's Friday window narrows Friday bookings (H7: capacity
        // truth is the same everywhere it is computed).
        if (dow === 5 && fridayStart) openMin = Math.max(openMin, hhmmToMin(fridayStart, openMin))
        if (dow === 5 && fridayEnd) closeMin = Math.min(closeMin, hhmmToMin(fridayEnd, closeMin))
        const courts = (dv.courts ?? []).map((c: any, i: number) => ({
          id: c.courtId as string,
          order: (c.order as number) ?? i,
        }))
        courts.sort((a: any, b: any) => a.order - b.order || (a.id < b.id ? -1 : 1))
        if (closeMin > openMin && courts.length > 0) {
          venues.push({ dayVenueId: dv.id, gymId: dv.venueId, openMin, closeMin, courts })
        }
      }
      venues.sort((a, b) => (a.gymId < b.gymId ? -1 : 1))
      days.push({
        id: day.id,
        date: date.toISOString(),
        dateKey: localDateKey(date),
        dow,
        venues,
      })
    }
    // The plan's hosting law (H1): unitVenues says which grade plays where.
    // A grade absent from every weekend's hosting list does not play —
    // "sessions without an entry host any unit" died with v1 (legacy
    // inventory item 8).
    const hosting: Array<{ gradeId: string; gymId: string }> = []
    const raw = sess.unitVenues
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      for (const [key, gymId] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof gymId !== "string" || gymId.length === 0) continue
        if (!key.startsWith("division:")) continue
        const gid = key.slice("division:".length)
        if (gradeIds.has(gid)) hosting.push({ gradeId: gid, gymId })
      }
    }
    hosting.sort((a, b) => (a.gradeId < b.gradeId ? -1 : 1))
    if (hosting.length === 0) continue // a weekend the plan gave nobody
    weekendsRaw.push({
      id: sess.id,
      label: sess.label ?? null,
      order: 0, // set after sorting
      roundId: sess.roundId ?? null,
      target: Math.max(1, Math.min(2, sess.targetGamesPerTeam ?? 2)),
      days,
      hosting,
    })
  }
  // Chronological by first day date, then id — the weekend order everything
  // downstream (pace, rematch spacing, ledger threading) runs on.
  weekendsRaw.sort((a, b) => {
    const da = a.days[0]?.date ?? ""
    const db = b.days[0]?.date ?? ""
    return da < db ? -1 : da > db ? 1 : a.id < b.id ? -1 : 1
  })
  const weekends = weekendsRaw.map((w, i) => ({ ...w, order: i }))

  /* ----------------------------- existing games ----------------------------- */

  const teamIdSet = new Set(teams.map((t) => t.id))
  const gamesRaw = await (prisma as any).game.findMany({
    where: { seasonId, phase: "REGULAR", status: { not: "CANCELLED" } },
    select: {
      id: true,
      homeTeamId: true,
      awayTeamId: true,
      sessionId: true,
      dayId: true,
      dayVenueId: true,
      venueId: true,
      courtId: true,
      scheduledAt: true,
      duration: true,
      status: true,
      isLocked: true,
    },
    orderBy: { id: "asc" },
  })
  const existingGames: SnapGame[] = []
  for (const g of gamesRaw) {
    if (!teamIdSet.has(g.homeTeamId) || !teamIdSet.has(g.awayTeamId)) continue
    existingGames.push({
      id: g.id,
      teamAId: g.homeTeamId < g.awayTeamId ? g.homeTeamId : g.awayTeamId,
      teamBId: g.homeTeamId < g.awayTeamId ? g.awayTeamId : g.homeTeamId,
      weekendId: g.sessionId ?? null,
      dayId: g.dayId ?? null,
      dayVenueId: g.dayVenueId ?? null,
      gymId: g.venueId ?? null,
      courtId: g.courtId ?? null,
      startIso: new Date(g.scheduledAt).toISOString(),
      durationMin: g.duration ?? slotMinutes,
      // Played/live/final and locked games are PINs the solver never moves
      // (H5). Unlocked SCHEDULED games are replaceable drafts. NOTE
      // (printed assumption): publishedAt does NOT pin yet — the staged
      // publish UI is the feature that turns publishing into a pin, and the
      // owner's current testing loop regenerates published drafts freely.
      state: g.status !== "SCHEDULED" || g.isLocked ? "PIN" : "DRAFT",
    })
  }
  existingGames.sort((a, b) => (a.id < b.id ? -1 : 1))

  const snapshot: WorldSnapshot = {
    seasonId,
    config: {
      slotMinutes,
      promiseDefault: (cfg.gamesGuaranteed as number) ?? 0,
      weights: V2_WEIGHTS,
      keepBonus: 300,
      keepTheta: 3,
      courtBuffer: Math.max(0, season.courtBuffer ?? 0),
    },
    weekends,
    grades,
    teams,
    existingGames,
  }
  return { snapshot, errors }
}

/** Canonical serialization: object keys sorted at every level. */
export function serializeSnapshot(value: unknown): string {
  return JSON.stringify(sortKeys(value))
}

function sortKeys(value: any): any {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === "object") {
    const out: Record<string, any> = {}
    for (const k of Object.keys(value).sort()) out[k] = sortKeys(value[k])
    return out
  }
  return value
}

export function snapshotHash(snapshot: WorldSnapshot): string {
  return createHash("sha256").update(serializeSnapshot(snapshot)).digest("hex")
}
