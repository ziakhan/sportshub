/**
 * Standings computation (v1).
 *
 * Pure — takes the set of completed games in a season plus the division
 * roster snapshot and returns per-division, tiebreaker-applied standings.
 *
 * Tiebreaker keys supported (mirrored from TIEBREAKER_OPTIONS in the UI):
 *   HEAD_TO_HEAD, POINT_DIFFERENTIAL, POINTS_SCORED, POINTS_ALLOWED,
 *   WINS, COIN_FLIP
 *
 * Approach: sort teams within each division primarily by wins, then by
 * win %, then apply each configured tiebreaker to sub-groups of teams
 * still tied after the previous pass. COIN_FLIP is deterministic — the
 * team with the alphabetically-smaller id comes first — so re-running
 * the endpoint yields a stable order.
 */

export type TiebreakerKey =
  | "HEAD_TO_HEAD"
  | "POINT_DIFFERENTIAL"
  | "POINTS_SCORED"
  | "POINTS_ALLOWED"
  | "WINS"
  | "COIN_FLIP"

export interface StandingsGame {
  id: string
  status: "SCHEDULED" | "LIVE" | "COMPLETED" | "CANCELLED" | "POSTPONED" | "DEFAULTED"
  homeTeamId: string
  awayTeamId: string
  homeScore: number | null
  awayScore: number | null
  defaultedBy: string | null
}

export interface StandingsTeam {
  teamId: string
  name: string
  divisionId: string
}

export interface StandingsInput {
  tiebreakerOrder: TiebreakerKey[]
  teamsByDivision: Array<{
    divisionId: string
    divisionName: string
    teams: StandingsTeam[]
  }>
  games: StandingsGame[]
}

export interface TeamRow {
  teamId: string
  name: string
  divisionId: string
  gamesPlayed: number
  wins: number
  losses: number
  ties: number
  pointsFor: number
  pointsAgainst: number
  differential: number
  winPct: number
  appliedTiebreakers: string[]
}

export interface DivisionStandings {
  divisionId: string
  divisionName: string
  rows: TeamRow[]
}

// ---------- aggregation ----------

function emptyRow(t: StandingsTeam): TeamRow {
  return {
    teamId: t.teamId,
    name: t.name,
    divisionId: t.divisionId,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    differential: 0,
    winPct: 0,
    appliedTiebreakers: [],
  }
}

function applyGame(row: TeamRow, my: number, opp: number, result: "W" | "L" | "T") {
  row.gamesPlayed += 1
  row.pointsFor += my
  row.pointsAgainst += opp
  if (result === "W") row.wins += 1
  else if (result === "L") row.losses += 1
  else row.ties += 1
}

function finalize(row: TeamRow) {
  row.differential = row.pointsFor - row.pointsAgainst
  row.winPct =
    row.gamesPlayed === 0 ? 0 : (row.wins + 0.5 * row.ties) / row.gamesPlayed
}

// ---------- tiebreakers ----------

function headToHeadScore(
  teamId: string,
  tied: Set<string>,
  games: StandingsGame[]
): number {
  // +1 for each win against any other team in the tied set, -1 for each loss
  let score = 0
  for (const g of games) {
    if (g.status !== "COMPLETED" && g.status !== "DEFAULTED") continue
    const isHome = g.homeTeamId === teamId
    const isAway = g.awayTeamId === teamId
    if (!isHome && !isAway) continue
    const opponentId = isHome ? g.awayTeamId : g.homeTeamId
    if (!tied.has(opponentId)) continue

    if (g.status === "DEFAULTED") {
      if (g.defaultedBy === teamId) score -= 1
      else score += 1
      continue
    }
    const my = isHome ? g.homeScore ?? 0 : g.awayScore ?? 0
    const opp = isHome ? g.awayScore ?? 0 : g.homeScore ?? 0
    if (my > opp) score += 1
    else if (my < opp) score -= 1
  }
  return score
}

function tiebreakerValue(
  row: TeamRow,
  key: TiebreakerKey,
  tied: Set<string>,
  games: StandingsGame[]
): number {
  switch (key) {
    case "WINS":
      return row.wins
    case "POINT_DIFFERENTIAL":
      return row.differential
    case "POINTS_SCORED":
      return row.pointsFor
    case "POINTS_ALLOWED":
      // Fewer is better — invert so "higher sorts first" rule still applies
      return -row.pointsAgainst
    case "HEAD_TO_HEAD":
      return headToHeadScore(row.teamId, tied, games)
    case "COIN_FLIP":
      // Deterministic: smaller teamId sorts first → higher "value"
      return -row.teamId.localeCompare("~")
    default:
      return 0
  }
}

// ---------- grouped sort ----------

function sortWithTiebreakers(
  rows: TeamRow[],
  tiebreakerOrder: TiebreakerKey[],
  games: StandingsGame[]
): TeamRow[] {
  // Primary: wins desc then win% desc
  rows.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins
    if (b.winPct !== a.winPct) return b.winPct - a.winPct
    return 0
  })

  // Recursively resolve adjacent rows with identical (wins, winPct)
  const resolve = (slice: TeamRow[]): TeamRow[] => {
    if (slice.length <= 1) return slice
    // Find the first group of tied rows in slice
    const first = slice[0]
    let tieEnd = 1
    while (
      tieEnd < slice.length &&
      slice[tieEnd].wins === first.wins &&
      slice[tieEnd].winPct === first.winPct
    )
      tieEnd++

    const tiedGroup = slice.slice(0, tieEnd)
    const rest = slice.slice(tieEnd)

    if (tiedGroup.length > 1) {
      const tiedIds = new Set(tiedGroup.map((r) => r.teamId))
      for (const key of tiebreakerOrder) {
        const scored = tiedGroup.map((r) => ({
          row: r,
          val: tiebreakerValue(r, key, tiedIds, games),
        }))
        scored.sort((a, b) => b.val - a.val)
        // If this tiebreaker differentiates anyone, record it and re-split
        const differentiates = scored.some((s, i, arr) =>
          i > 0 ? s.val !== arr[i - 1].val : false
        )
        if (differentiates) {
          // Reorder tiedGroup in place
          tiedGroup.splice(0, tiedGroup.length, ...scored.map((s) => s.row))
          for (const r of tiedGroup) {
            if (!r.appliedTiebreakers.includes(key)) r.appliedTiebreakers.push(key)
          }
          // Recursively resolve any remaining sub-ties
          const resolved: TeamRow[] = []
          let i = 0
          while (i < tiedGroup.length) {
            const myVal = tiebreakerValue(tiedGroup[i], key, tiedIds, games)
            let j = i + 1
            while (
              j < tiedGroup.length &&
              tiebreakerValue(tiedGroup[j], key, tiedIds, games) === myVal
            )
              j++
            resolved.push(...resolve(tiedGroup.slice(i, j)))
            i = j
          }
          return [...resolved, ...resolve(rest)]
        }
      }
    }

    return [...tiedGroup, ...resolve(rest)]
  }

  return resolve(rows)
}

// ---------- public ----------

export function computeStandings(input: StandingsInput): DivisionStandings[] {
  const result: DivisionStandings[] = []

  for (const div of input.teamsByDivision) {
    const rowsById = new Map<string, TeamRow>()
    for (const t of div.teams) rowsById.set(t.teamId, emptyRow(t))

    const divisionTeamIds = new Set(div.teams.map((t) => t.teamId))
    const divisionGames = input.games.filter(
      (g) => divisionTeamIds.has(g.homeTeamId) || divisionTeamIds.has(g.awayTeamId)
    )

    for (const g of divisionGames) {
      if (g.status === "COMPLETED" && g.homeScore != null && g.awayScore != null) {
        const home = rowsById.get(g.homeTeamId)
        const away = rowsById.get(g.awayTeamId)
        if (home && away) {
          if (g.homeScore > g.awayScore) {
            applyGame(home, g.homeScore, g.awayScore, "W")
            applyGame(away, g.awayScore, g.homeScore, "L")
          } else if (g.homeScore < g.awayScore) {
            applyGame(home, g.homeScore, g.awayScore, "L")
            applyGame(away, g.awayScore, g.homeScore, "W")
          } else {
            applyGame(home, g.homeScore, g.awayScore, "T")
            applyGame(away, g.awayScore, g.homeScore, "T")
          }
        } else if (home) applyGame(home, g.homeScore, g.awayScore, g.homeScore >= g.awayScore ? "W" : "L")
        else if (away) applyGame(away, g.awayScore, g.homeScore, g.awayScore >= g.homeScore ? "W" : "L")
      } else if (g.status === "DEFAULTED" && g.defaultedBy) {
        const loser = rowsById.get(g.defaultedBy)
        const winnerId =
          g.defaultedBy === g.homeTeamId ? g.awayTeamId : g.homeTeamId
        const winner = rowsById.get(winnerId)
        if (winner) applyGame(winner, 0, 0, "W")
        if (loser) applyGame(loser, 0, 0, "L")
      }
    }

    const rows = Array.from(rowsById.values())
    rows.forEach(finalize)

    const sorted = sortWithTiebreakers(rows, input.tiebreakerOrder, divisionGames)

    result.push({
      divisionId: div.divisionId,
      divisionName: div.divisionName,
      rows: sorted,
    })
  }

  return result
}
