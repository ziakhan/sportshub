/**
 * Scheduler v2 — L5 burden currency. THE one place day shapes are priced;
 * the engine's placement objective and the season report both call this,
 * so the table can never disagree with the optimizer (one-currency law).
 *
 * Owner's shape ladder (2026-08-08): same-day gap 2-4 slots is BEST (0);
 * gap 1 next; a long same-day gap (5+) and a two-date weekend are EQUALLY
 * bad; a back-to-back is unacceptable — priced at forbidden-tier and gated
 * to zero by acceptance test A7.
 */
import type { BurdenWeights, SnapTeam } from "./types"

export interface TeamStop {
  dayId: string
  /** Game start, epoch ms. */
  startMs: number
  /** Start minutes-from-midnight (window checks). */
  startMin: number
  dow: number
  dateKey: string
}

/** The actual first/last tip-off of a (day, grade) — the page's report
 *  counts THESE (per-division day edges), so the engine must balance the
 *  same thing, not the booked grid's phantom first/last slots (that
 *  mismatch let 8 teams collect 5 late endings while 13 had none). */
export interface DayEdges {
  first: number
  last: number
}

export interface BurdenCounts {
  b2b: number
  gap1: number
  longGap: number
  twoDates: number
  early: number
  late: number
  styleMiss: number
  windowMiss: number
}

export const zeroCounts = (): BurdenCounts => ({
  b2b: 0,
  gap1: 0,
  longGap: 0,
  twoDates: 0,
  early: 0,
  late: 0,
  styleMiss: 0,
  windowMiss: 0,
})

export function burdenPoints(c: BurdenCounts, w: BurdenWeights): number {
  return (
    c.b2b * w.b2b +
    c.gap1 * w.gap1 +
    c.longGap * w.longGap +
    c.twoDates * w.twoDates +
    c.early * w.early +
    c.late * w.late +
    c.styleMiss * w.styleMiss +
    c.windowMiss * w.windowMiss
  )
}

/** One team's burden counts for ONE weekend's placed stops. */
export function weekendCounts(
  stops: TeamStop[],
  team: Pick<SnapTeam, "style" | "windows">,
  slotMinutes: number,
  edgesOf?: (dayId: string) => DayEdges | null
): BurdenCounts {
  const c = zeroCounts()
  const sorted = [...stops].sort((a, b) => a.startMs - b.startMs)
  const slotMs = slotMinutes * 60000
  const days = new Set(sorted.map((s) => s.dayId))

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].dayId !== sorted[i - 1].dayId) continue
    const gap = Math.round((sorted[i].startMs - sorted[i - 1].startMs) / slotMs) - 1
    if (gap <= 0) c.b2b++
    else if (gap === 1) c.gap1++
    else if (gap >= 5) c.longGap++
    // 2-4 empty slots: the preferred breather — free.
  }
  if (sorted.length >= 2 && days.size > 1) c.twoDates++

  if (edgesOf) {
    for (const s of sorted) {
      const e = edgesOf(s.dayId)
      if (!e) continue
      if (s.startMs === e.first) c.early++
      if (s.startMs === e.last && e.last !== e.first) c.late++
    }
  }

  if (sorted.length >= 2) {
    const sameDay = days.size === 1
    if (team.style === "SAME_DAY" && !sameDay) c.styleMiss++
    if (team.style === "SPLIT_DAYS" && sameDay) c.styleMiss++
  }

  for (const s of sorted) {
    for (const win of team.windows) {
      const applies =
        (win.dateKey !== undefined && win.dateKey === s.dateKey) ||
        (win.dow !== undefined && win.dow === s.dow)
      if (!applies) continue
      if (
        (win.earliestMin !== undefined && s.startMin < win.earliestMin) ||
        (win.latestMin !== undefined && s.startMin > win.latestMin)
      ) {
        c.windowMiss++
      }
    }
  }
  return c
}

export function addCounts(a: BurdenCounts, b: BurdenCounts): BurdenCounts {
  return {
    b2b: a.b2b + b.b2b,
    gap1: a.gap1 + b.gap1,
    longGap: a.longGap + b.longGap,
    twoDates: a.twoDates + b.twoDates,
    early: a.early + b.early,
    late: a.late + b.late,
    styleMiss: a.styleMiss + b.styleMiss,
    windowMiss: a.windowMiss + b.windowMiss,
  }
}
