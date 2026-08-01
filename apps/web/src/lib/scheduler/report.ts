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

export interface TeamFairness {
  teamId: string
  teamName: string
  games: number
  backToBacks: number
  bigGapDays: number
  splitVenueDays: number
  earlyGames: number
  lastGames: number
  /** The team's resolved weekend style, when known. */
  weekendStyle?: "SAME_DAY" | "SPLIT_DAYS"
  /** Weekends matching the team's style / weekends with 2+ games. */
  preferenceHonored?: { ok: number; total: number }
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
   * teamId → division/unit key. When present, first/last tip-offs are the
   * DIVISION block's opening and closing games each day — the scarce,
   * rotatable slots — instead of the whole day's (at 8 courts most teams
   * sit in the day's global first wave, which is not a fairness signal).
   */
  unitByTeam?: Map<string, string>
): ScheduleFairnessReport {
  const active = games.filter((g) => g.status !== "CANCELLED")
  const byTeam = new Map<string, ReportGame[]>()
  for (const g of active) {
    for (const id of [g.homeTeamId, g.awayTeamId]) {
      if (!byTeam.has(id)) byTeam.set(id, [])
      byTeam.get(id)!.push(g)
    }
  }

  // First/last tip-off per day (from the actual game set) — scoped to the
  // division when unit info is available.
  const edgeKey = (g: ReportGame, dk: string): string =>
    unitByTeam ? `${dk}|${unitByTeam.get(g.homeTeamId) ?? ""}` : dk
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
    let splitVenueDays = 0
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
        if (gapSlots <= 0) backToBacks++
        else if (gapSlots > 2) bigGapDays++
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
      splitVenueDays,
      earlyGames,
      lastGames,
      weekendStyle: style,
      preferenceHonored: style ? { ok: prefOk, total: prefTotal } : undefined,
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
      maxTopCourtShare: teams.length ? Math.max(...teams.map((t) => t.topCourtShare)) : 0,
    },
    teams,
  }
}
