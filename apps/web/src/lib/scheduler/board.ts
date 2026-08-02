/**
 * Schedule board — PURE shaping helpers (owner 2026-08-02: "when we're
 * showing the games scheduled, I would like to show a day view or a gym
 * view or maybe somehow if you can combine them both to see where you see
 * them playing on which venue").
 *
 * The board answers ONE question at a glance: on this day, who plays on
 * which gym's which court, and when. Day and gym are not two views — the
 * day picks the board, the gyms are its column groups, so the operator
 * reads both at once the way they read the paper grid they build today.
 *
 * Everything here is pure and client-safe: the console feeds it the games
 * it already holds, so the board costs no extra query.
 */
import { gradeAbbrev, weekendLabel } from "./planner-core"

export interface BoardGame {
  id: string
  scheduledAt: string | Date
  venueId?: string | null
  venueName?: string | null
  courtId?: string | null
  courtName?: string | null
  homeTeamId: string
  awayTeamId: string
  homeTeamName?: string | null
  awayTeamName?: string | null
  /** Division / grade label, resolved from the teams' submissions. */
  unitLabel?: string | null
  status?: string | null
  homeScore?: number | null
  awayScore?: number | null
  publishedAt?: string | Date | null
}

/** Column key for games whose court was never assigned. */
export const UNASSIGNED_COLUMN = "unassigned"
/** Venue-group key for those same games. */
export const UNASSIGNED_GROUP = "unassigned-group"

/**
 * Local calendar date of a kick-off, "2026-10-24". Local, not UTC: a 7pm
 * Sunday game in Toronto is Monday in UTC, and the operator standing in
 * the gym is on Sunday. Matches how the games list and the fairness report
 * already bucket days.
 */
export function dayKeyOf(value: string | Date): string {
  const d = new Date(value)
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

/**
 * The Monday of a day's week, used to group the day chips into weekends.
 * Monday-start means Saturday and Sunday of one game weekend share a key
 * (a Sunday-start week would split them), and a stray Friday night slate
 * groups with the weekend it belongs to.
 */
export function weekendKeyOf(value: string | Date): string {
  const d = new Date(value)
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  // getDay(): 0 = Sunday, so Sunday steps back 6 days, Monday 0.
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return dayKeyOf(monday)
}

export interface BoardDay {
  key: string
  /** Local midnight of the day, for formatting. */
  date: Date
  games: number
  weekendKey: string
}

export interface BoardWeekend {
  key: string
  /** "Oct 24–25" — the one spelling of a weekend the platform uses. */
  label: string
  days: BoardDay[]
}

/** Every day that actually has a game, oldest first. Days with none never appear. */
export function boardDays(games: BoardGame[]): BoardDay[] {
  const counts = new Map<string, number>()
  for (const g of games) {
    const k = dayKeyOf(g.scheduledAt)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, count]) => ({
      key,
      date: dayFromKey(key),
      games: count,
      weekendKey: weekendKeyOf(dayFromKey(key)),
    }))
}

/** Local midnight Date for a "2026-10-24" key. */
export function dayFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/** The day chips, grouped into the weekends an operator thinks in. */
export function boardWeekends(days: BoardDay[]): BoardWeekend[] {
  const groups = new Map<string, BoardDay[]>()
  for (const d of days) {
    if (!groups.has(d.weekendKey)) groups.set(d.weekendKey, [])
    groups.get(d.weekendKey)!.push(d)
  }
  return [...groups.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, ds]) => ({
      key,
      // weekendLabel reads UTC parts, so hand it UTC midnights built from
      // the LOCAL day keys — same spelling as the planner, no drift.
      label: weekendLabel(ds.map((d) => new Date(`${d.key}T00:00:00Z`))),
      days: ds,
    }))
}

/**
 * Which day the board opens on: the next day that still has games to play,
 * falling back to the first day of the season for a schedule that is
 * entirely in the past.
 */
export function defaultBoardDayKey(days: BoardDay[], now: Date = new Date()): string | null {
  if (days.length === 0) return null
  const today = dayKeyOf(now)
  return days.find((d) => d.key >= today)?.key ?? days[0].key
}

export interface BoardVenue {
  venueId: string | null
  venueName: string
  games: number
}

/** The gym filter chips for one day: every gym with a game on it. */
export function boardVenues(games: BoardGame[]): BoardVenue[] {
  const map = new Map<string, BoardVenue>()
  for (const g of games) {
    const id = g.venueId ?? null
    const key = id ?? "none"
    const existing = map.get(key)
    if (existing) existing.games += 1
    else map.set(key, { venueId: id, venueName: g.venueName ?? "Gym not set", games: 1 })
  }
  return [...map.values()].sort(byName((v) => v.venueName, (v) => v.venueId))
}

export interface BoardColumn {
  key: string
  courtId: string | null
  courtName: string
  venueId: string | null
  venueName: string
  games: number
}

export interface BoardVenueGroup {
  key: string
  venueId: string | null
  venueName: string
  columns: BoardColumn[]
  games: number
}

/**
 * The board's columns: one per court, grouped under its gym. "Court 2"
 * sorts before "Court 10" (numeric collation) because a gym numbers its
 * courts, it doesn't alphabetize them.
 *
 * Games with no court land in a single Unassigned column at the far right,
 * and that column exists ONLY when such games do — an operator who has
 * assigned every court should never see a reminder of a problem they don't
 * have.
 */
export function buildBoardColumns(games: BoardGame[]): BoardVenueGroup[] {
  const groups = new Map<string, BoardVenueGroup>()
  const orphans: BoardGame[] = []

  for (const g of games) {
    if (!g.courtId) {
      orphans.push(g)
      continue
    }
    const venueKey = g.venueId ?? "no-venue"
    let group = groups.get(venueKey)
    if (!group) {
      group = {
        key: venueKey,
        venueId: g.venueId ?? null,
        venueName: g.venueName ?? "Gym not set",
        columns: [],
        games: 0,
      }
      groups.set(venueKey, group)
    }
    group.games += 1
    const columnKey = `court:${g.courtId}`
    const column = group.columns.find((c) => c.key === columnKey)
    if (column) column.games += 1
    else
      group.columns.push({
        key: columnKey,
        courtId: g.courtId,
        courtName: g.courtName ?? "Court",
        venueId: group.venueId,
        venueName: group.venueName,
        games: 1,
      })
  }

  const out = [...groups.values()].sort(byName((g) => g.venueName, (g) => g.venueId))
  for (const group of out) {
    group.columns.sort(byName((c) => c.courtName, (c) => c.courtId))
  }
  if (orphans.length > 0) {
    out.push({
      key: UNASSIGNED_GROUP,
      venueId: null,
      venueName: "No court set",
      games: orphans.length,
      columns: [
        {
          key: UNASSIGNED_COLUMN,
          courtId: null,
          courtName: "Unassigned",
          venueId: null,
          venueName: "No court set",
          games: orphans.length,
        },
      ],
    })
  }
  return out
}

/** Which column a game belongs to. */
export function columnKeyOf(game: BoardGame): string {
  return game.courtId ? `court:${game.courtId}` : UNASSIGNED_COLUMN
}

export interface BoardRow {
  /** Minutes past local midnight — the row's sort key and its id. */
  minute: number
  /** A kick-off at this time, for formatting the gutter label. */
  at: Date
  cells: Record<string, BoardGame[]>
}

/**
 * Rows are tip-off times, earliest first. A cell holds an ARRAY: two games
 * booked on one court at one time stack visibly instead of overlapping or
 * hiding each other, which is exactly the mistake an operator needs to see.
 */
export function buildBoardRows(games: BoardGame[], columnKeys: string[]): BoardRow[] {
  const allowed = new Set(columnKeys)
  const rows = new Map<number, BoardRow>()
  for (const g of games) {
    const key = columnKeyOf(g)
    if (!allowed.has(key)) continue
    const at = new Date(g.scheduledAt)
    const minute = at.getHours() * 60 + at.getMinutes()
    let row = rows.get(minute)
    if (!row) {
      row = { minute, at, cells: {} }
      rows.set(minute, row)
    }
    ;(row.cells[key] ??= []).push(g)
  }
  const out = [...rows.values()].sort((a, b) => a.minute - b.minute)
  for (const row of out) {
    for (const key of Object.keys(row.cells)) {
      row.cells[key].sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
    }
  }
  return out
}

/**
 * Teams playing more than once on the board's day, keyed "<gameId>:<teamId>"
 * → which game of the day it is. Double-headers are the thing operators get
 * wrong most often, so the chip marks the 2nd and 3rd game rather than
 * leaving the repeat to be spotted by eye.
 */
export function repeatOrdinals(games: BoardGame[]): Map<string, number> {
  const byTeam = new Map<string, BoardGame[]>()
  for (const g of games) {
    for (const teamId of [g.homeTeamId, g.awayTeamId]) {
      if (!teamId) continue
      const list = byTeam.get(teamId)
      if (list) list.push(g)
      else byTeam.set(teamId, [g])
    }
  }
  const out = new Map<string, number>()
  for (const [teamId, list] of byTeam) {
    if (list.length < 2) continue
    list
      .slice()
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime() ||
          sortKey(a).localeCompare(sortKey(b))
      )
      .forEach((g, i) => out.set(`${g.id}:${teamId}`, i + 1))
  }
  return out
}

const FILLER = /\s+(basketball club|basketball|athletics|club)$/i

/**
 * A team name that fits a chip. Drops a tier parenthetical (the division
 * label already carries it) and a trailing "Basketball"/"Club", then cuts
 * on a word boundary. The chip keeps the full name in its title attribute,
 * so nothing is ever lost — only shortened.
 */
export function abbrevTeamName(name: string, max = 16): string {
  let out = (name ?? "").trim()
  if (out.length <= max) return out
  out = out.replace(/\s*\([^)]*\)\s*$/, "").trim()
  const stripped = out.replace(FILLER, "").trim()
  if (stripped.length > 0) out = stripped
  if (out.length <= max) return out
  // The ellipsis counts against the budget, so the result never overflows.
  const cut = out.slice(0, max - 1)
  const space = cut.lastIndexOf(" ")
  return `${(space >= max - 7 ? cut.slice(0, space) : cut).trim()}…`
}

/**
 * A division in chip shorthand: "Grade 9 Boys · PRIME" → "Gr9 PRIME",
 * "Junior Girls" → "JrG". The grade abbreviation is the platform's
 * (planner-core), so the board spells a grade the way the season calendar
 * and the published poster do; the tier rides along because two Gr9 tiers
 * are two different competitions.
 */
export function unitAbbrev(divisionName: string | null | undefined): string | null {
  if (!divisionName) return null
  const parts = divisionName
    .split("·")
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length === 0) return null
  const tail = parts.slice(1).join(" ")
  return tail ? `${gradeAbbrev(parts[0])} ${tail}` : gradeAbbrev(parts[0])
}

/** Chip colors, from the design system's families only. */
export type BoardTone = "play" | "court" | "hoop" | "gold" | "navy" | "ink"

const TONE_CYCLE: BoardTone[] = ["play", "court", "hoop", "gold", "navy"]

/**
 * Same grade, same color, every day of the season — derived from the label,
 * never from position, so adding a division never re-colors the others.
 *
 * It reads the GRADE only (the label's first token), so every tier of Gr9
 * shares one color and the tier text tells them apart: an operator scanning
 * the board is looking for "where is Gr9 today", not for four shades of it.
 * A numbered grade steps through the palette by its own number, which is
 * what makes neighbouring grades — the ones that actually share a gym on a
 * Saturday — always land on different colors; anything else falls back to a
 * hash. Color is never the only carrier: the chip spells the division out.
 */
export function boardTone(unitLabel: string | null | undefined): BoardTone {
  const grade = (unitLabel ?? "").trim().split(/\s+/)[0]
  if (!grade) return "ink"
  const numbered = grade.match(/\d+/)
  if (numbered) return TONE_CYCLE[Number(numbered[0]) % TONE_CYCLE.length]
  let hash = 2166136261
  for (let i = 0; i < grade.length; i++) {
    hash ^= grade.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return TONE_CYCLE[Math.abs(hash) % TONE_CYCLE.length]
}

/** Natural-order comparator with a stable id tiebreak. */
function byName<T>(name: (x: T) => string, id: (x: T) => string | null) {
  return (a: T, b: T) =>
    name(a).localeCompare(name(b), undefined, { numeric: true, sensitivity: "base" }) ||
    (id(a) ?? "").localeCompare(id(b) ?? "")
}

const sortKey = (g: BoardGame) => `${g.unitLabel ?? ""}|${g.homeTeamName ?? ""}|${g.id}`
