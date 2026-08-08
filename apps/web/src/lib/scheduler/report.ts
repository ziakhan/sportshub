/**
 * Schedule fairness report (owner 2026-08-01): after generating, show the
 * league exactly how the schedule treats every team — back-to-backs,
 * same-day venue splits, court distribution, early tip-off share — so
 * operators can see the trade-offs instead of trusting a black box.
 */

export interface ReportGame {
  id: string
  homeTeamId: string
  awayTeamId: string
  scheduledAt: string | Date
  venueId?: string | null
  venueName?: string | null
  courtId?: string | null
  courtName?: string | null
  status?: string
}

import { TRAVEL_MIN_GAP_SLOTS, type ScheduleBlackout, type ScheduleWindow } from "./generate"

export interface TeamFairness {
  teamId: string
  teamName: string
  games: number
  backToBacks: number
  bigGapDays: number
  /** Subset of bigGapDays: 3-4 empty slots between games the same day (the
   *  "mid wait" tier — bigGapDays is their sum with monsterGapDays). */
  midGapDays: number
  /** Subset of bigGapDays: 5+ empty slots between games the same day (the
   *  "monster wait" tier, roughly 5+ hours at a typical 90-minute slot). */
  monsterGapDays: number
  /** Same-day, same-venue pairs with exactly 1 empty slot between games
   *  (the owner's ladder prefers 2+; 1 slot costs a point). */
  gapOneDays: number
  /** Weekends where the team's 2+ games fall on different dates — priced
   *  equal to a 5hr+ wait by owner ruling 2026-08-08. */
  twoDateWeekends: number
  splitVenueDays: number
  /** Cross-gym consecutive pairs with a gap too short to drive between
   *  venues (under TRAVEL_MIN_GAP_SLOTS empty slots) — a day the family
   *  physically cannot attend in full (owner ruling 2026-08-07). Cross-gym
   *  gaps are otherwise exempt from the wait tiers: the gap is the drive. */
  tightSplitDays: number
  earlyGames: number
  lastGames: number
  /** The team's resolved weekend style, when known. */
  weekendStyle?: "SAME_DAY" | "SPLIT_DAYS"
  /** Weekends matching the team's style / weekends with 2+ games. */
  preferenceHonored?: { ok: number; total: number }
  /** Approved schedule requests: compliant games / games a request applies
   *  to (blackout violations count as applicable-and-failed). */
  requestsHonored?: { ok: number; total: number }
  topCourtName: string | null
  topCourtShare: number // 0..1 of games on their most-used court
}

export interface ScheduleFairnessReport {
  totals: {
    games: number
    teams: number
    backToBackTeamDays: number
    bigGapTeamDays: number
    splitVenueTeamDays: number
    earlyGamesMin: number
    earlyGamesMax: number
    lastGamesMin: number
    lastGamesMax: number
    /** Team-weekends NOT matching the team's style (when styles known). */
    preferenceViolations: number
    /** Approved-request games NOT honored (windows missed + blackout hits). */
    requestViolations: number
    maxTopCourtShare: number
  }
  teams: TeamFairness[]
}

const dayKey = (d: Date): string => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

export function computeFairnessReport(
  games: ReportGame[],
  teamNames: Map<string, string>,
  slotMinutes = 90,
  stylesByTeam?: Map<string, "SAME_DAY" | "SPLIT_DAYS">,
  /** gameId → sessionId, needed to group weekends for preference checks. */
  sessionByGame?: Map<string, string>,
  /**
   * OWNER RULING 2026-08-08: a late finish is the BUILDING's last slot of
   * the day, an early start its first — not your division's. Edges are
   * scoped per (day, gym); this param is kept for signature compatibility
   * and no longer read.
   */
  unitByTeam?: Map<string, string>,
  /** Approved best-effort windows per team (for "requests honored"). */
  windowsByTeam?: Map<string, ScheduleWindow[]>,
  /** Blackouts per team — a scheduled game overlapping one is a violation. */
  blackoutsByTeam?: Map<string, ScheduleBlackout[]>
): ScheduleFairnessReport {
  const active = games.filter((g) => g.status !== "CANCELLED")
  const byTeam = new Map<string, ReportGame[]>()
  for (const g of active) {
    for (const id of [g.homeTeamId, g.awayTeamId]) {
      if (!byTeam.has(id)) byTeam.set(id, [])
      byTeam.get(id)!.push(g)
    }
  }

  // First/last tip-off per (day, GYM), from the actual game set — the
  // building's opening and closing games (owner ruling 2026-08-08).
  const edgeKey = (g: ReportGame, dk: string): string => `${dk}|${g.venueId ?? ""}`
  const firstStartByDay = new Map<string, number>()
  const lastStartByDay = new Map<string, number>()
  for (const g of active) {
    const d = new Date(g.scheduledAt)
    const k = edgeKey(g, dayKey(d))
    const t = d.getTime()
    if (!firstStartByDay.has(k) || t < firstStartByDay.get(k)!) firstStartByDay.set(k, t)
    if (!lastStartByDay.has(k) || t > lastStartByDay.get(k)!) lastStartByDay.set(k, t)
  }

  const teams: TeamFairness[] = []
  for (const [teamId, list] of byTeam) {
    const sorted = [...list].sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    )
    let backToBacks = 0
    let bigGapDays = 0
    let midGapDays = 0
    let monsterGapDays = 0
    let splitVenueDays = 0
    let tightSplitDays = 0
    let gapOneDays = 0
    let twoDateWeekends = 0
    let earlyGames = 0
    let lastGames = 0
    const byDay = new Map<string, ReportGame[]>()
    const bySession = new Map<string, ReportGame[]>()
    for (const g of sorted) {
      const d = new Date(g.scheduledAt)
      const k = dayKey(d)
      if (!byDay.has(k)) byDay.set(k, [])
      byDay.get(k)!.push(g)
      const ek = edgeKey(g, k)
      if (firstStartByDay.get(ek) === d.getTime()) earlyGames++
      if (
        lastStartByDay.get(ek) === d.getTime() &&
        lastStartByDay.get(ek) !== firstStartByDay.get(ek)
      )
        lastGames++
      const sess = sessionByGame?.get(g.id)
      if (sess) {
        if (!bySession.has(sess)) bySession.set(sess, [])
        bySession.get(sess)!.push(g)
      }
    }
    const style = stylesByTeam?.get(teamId)
    // Requests honored: every game a window applies to counts; blackout
    // overlaps count as applicable-and-failed.
    let reqOk = 0
    let reqTotal = 0
    const windows = windowsByTeam?.get(teamId) ?? []
    const blackoutList = blackoutsByTeam?.get(teamId) ?? []
    if (windows.length > 0 || blackoutList.length > 0) {
      for (const g of sorted) {
        const d = new Date(g.scheduledAt)
        const dk = dayKey(d)
        const startMin = d.getHours() * 60 + d.getMinutes()
        for (const w of windows) {
          const applies =
            (w.dateKey !== undefined && w.dateKey === dk) ||
            (w.dayOfWeek !== undefined && d.getDay() === w.dayOfWeek)
          if (!applies) continue
          reqTotal++
          const okEarliest = w.earliestMin === undefined || startMin >= w.earliestMin
          const okLatest = w.latestMin === undefined || startMin <= w.latestMin
          if (okEarliest && okLatest) reqOk++
        }
        for (const b of blackoutList) {
          if (b.dateKey !== dk) continue
          const from = b.startMin ?? 0
          const to = b.endMin ?? 24 * 60
          if (startMin < to && from < startMin + slotMinutes) reqTotal++
        }
      }
    }
    for (const [, sessGames] of bySession) {
      if (sessGames.length < 2) continue
      const days = new Set(sessGames.map((g) => dayKey(new Date(g.scheduledAt))))
      if (days.size > 1) twoDateWeekends++
    }
    let prefOk = 0
    let prefTotal = 0
    if (style) {
      for (const [, sessGames] of bySession) {
        if (sessGames.length < 2) continue
        prefTotal++
        const days = new Set(sessGames.map((g) => dayKey(new Date(g.scheduledAt))))
        const sameDay = days.size === 1
        if ((style === "SAME_DAY" && sameDay) || (style === "SPLIT_DAYS" && !sameDay)) prefOk++
      }
    }
    for (const [, dayGames] of byDay) {
      const venues = new Set(dayGames.map((g) => g.venueId ?? "?"))
      if (venues.size > 1) splitVenueDays++
      for (let i = 1; i < dayGames.length; i++) {
        const prev = new Date(dayGames[i - 1].scheduledAt).getTime()
        const cur = new Date(dayGames[i].scheduledAt).getTime()
        const gapSlots = (cur - prev) / (slotMinutes * 60000) - 1
        // Consecutive games at DIFFERENT gyms: the gap is the family's
        // drive, never a wait — but a gap too short to drive means they
        // cannot attend both games at all (owner ruling 2026-08-07).
        if ((dayGames[i].venueId ?? "?") !== (dayGames[i - 1].venueId ?? "?")) {
          if (gapSlots < TRAVEL_MIN_GAP_SLOTS) tightSplitDays++
          continue
        }
        if (gapSlots <= 0) backToBacks++
        else if (Math.round(gapSlots) === 1) gapOneDays++
        else if (gapSlots > 2) {
          bigGapDays++
          // 3-4 slots = mid wait; 5+ slots = monster wait (owner tiers,
          // 2026-08-07). The two always sum to bigGapDays.
          if (gapSlots <= 4) midGapDays++
          else monsterGapDays++
        }
      }
    }
    const courtCounts = new Map<string, { name: string | null; n: number }>()
    for (const g of sorted) {
      if (!g.courtId) continue
      const cur = courtCounts.get(g.courtId) ?? { name: g.courtName ?? null, n: 0 }
      cur.n++
      if (g.courtName) cur.name = g.courtName
      courtCounts.set(g.courtId, cur)
    }
    let topCourtName: string | null = null
    let topCourtN = 0
    for (const [, v] of courtCounts) {
      if (v.n > topCourtN) {
        topCourtN = v.n
        topCourtName = v.name
      }
    }
    teams.push({
      teamId,
      teamName: teamNames.get(teamId) ?? teamId,
      games: sorted.length,
      backToBacks,
      bigGapDays,
      midGapDays,
      monsterGapDays,
      gapOneDays,
      twoDateWeekends,
      splitVenueDays,
      tightSplitDays,
      earlyGames,
      lastGames,
      weekendStyle: style,
      preferenceHonored: style ? { ok: prefOk, total: prefTotal } : undefined,
      requestsHonored:
        windows.length > 0 || blackoutList.length > 0 ? { ok: reqOk, total: reqTotal } : undefined,
      topCourtName,
      topCourtShare: sorted.length > 0 ? topCourtN / sorted.length : 0,
    })
  }
  teams.sort((a, b) => a.teamName.localeCompare(b.teamName))

  const earlyCounts = teams.map((t) => t.earlyGames)
  const lastCounts = teams.map((t) => t.lastGames)
  return {
    totals: {
      games: active.length,
      teams: teams.length,
      backToBackTeamDays: teams.reduce((s, t) => s + t.backToBacks, 0),
      bigGapTeamDays: teams.reduce((s, t) => s + t.bigGapDays, 0),
      splitVenueTeamDays: teams.reduce((s, t) => s + t.splitVenueDays, 0),
      earlyGamesMin: earlyCounts.length ? Math.min(...earlyCounts) : 0,
      earlyGamesMax: earlyCounts.length ? Math.max(...earlyCounts) : 0,
      lastGamesMin: lastCounts.length ? Math.min(...lastCounts) : 0,
      lastGamesMax: lastCounts.length ? Math.max(...lastCounts) : 0,
      preferenceViolations: teams.reduce(
        (s, t) => s + (t.preferenceHonored ? t.preferenceHonored.total - t.preferenceHonored.ok : 0),
        0
      ),
      requestViolations: teams.reduce(
        (s, t) => s + (t.requestsHonored ? t.requestsHonored.total - t.requestsHonored.ok : 0),
        0
      ),
      maxTopCourtShare: teams.length ? Math.max(...teams.map((t) => t.topCourtShare)) : 0,
    },
    teams,
  }
}
