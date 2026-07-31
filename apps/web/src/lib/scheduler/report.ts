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
    maxTopCourtShare: number
  }
  teams: TeamFairness[]
}

const dayKey = (d: Date): string => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

export function computeFairnessReport(
  games: ReportGame[],
  teamNames: Map<string, string>,
  slotMinutes = 90
): ScheduleFairnessReport {
  const active = games.filter((g) => g.status !== "CANCELLED")
  const byTeam = new Map<string, ReportGame[]>()
  for (const g of active) {
    for (const id of [g.homeTeamId, g.awayTeamId]) {
      if (!byTeam.has(id)) byTeam.set(id, [])
      byTeam.get(id)!.push(g)
    }
  }

  // First tip-off per day (an "early game" = the day's first start time)
  const firstStartByDay = new Map<string, number>()
  for (const g of active) {
    const d = new Date(g.scheduledAt)
    const k = dayKey(d)
    const t = d.getTime()
    if (!firstStartByDay.has(k) || t < firstStartByDay.get(k)!) firstStartByDay.set(k, t)
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
    const byDay = new Map<string, ReportGame[]>()
    for (const g of sorted) {
      const d = new Date(g.scheduledAt)
      const k = dayKey(d)
      if (!byDay.has(k)) byDay.set(k, [])
      byDay.get(k)!.push(g)
      if (firstStartByDay.get(k) === d.getTime()) earlyGames++
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
      topCourtName,
      topCourtShare: sorted.length > 0 ? topCourtN / sorted.length : 0,
    })
  }
  teams.sort((a, b) => a.teamName.localeCompare(b.teamName))

  const earlyCounts = teams.map((t) => t.earlyGames)
  return {
    totals: {
      games: active.length,
      teams: teams.length,
      backToBackTeamDays: teams.reduce((s, t) => s + t.backToBacks, 0),
      bigGapTeamDays: teams.reduce((s, t) => s + t.bigGapDays, 0),
      splitVenueTeamDays: teams.reduce((s, t) => s + t.splitVenueDays, 0),
      earlyGamesMin: earlyCounts.length ? Math.min(...earlyCounts) : 0,
      earlyGamesMax: earlyCounts.length ? Math.max(...earlyCounts) : 0,
      maxTopCourtShare: teams.length ? Math.max(...teams.map((t) => t.topCourtShare)) : 0,
    },
    teams,
  }
}
