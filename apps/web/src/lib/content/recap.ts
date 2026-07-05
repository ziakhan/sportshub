/**
 * Game recap generation (docs/public-site-content-plan.md §6.1).
 *
 * Pure template engine: folds the score-event stream + player lines into a
 * newspaper-style 100–180 word recap. Deterministic — phrasing varies by
 * game shape (margin, runs, lead changes), never by randomness, so
 * re-finalizing a game regenerates the identical recap.
 *
 * The Claude-written variant (recap-claude.ts) upgrades this text when an
 * API key is configured; this template is the always-available floor, and
 * both paths consume the same RecapInput. Player names in RecapInput MUST
 * already be privacy-safe (publicPlayerName) — recap bodies are stored
 * public strings and cannot vary by viewer.
 */

export interface RecapTeam {
  id: string
  name: string
}

export interface RecapScoreEvent {
  teamId: string
  points: number
  /** 1-based period, when recorded */
  period: number | null
  sequence: number
}

export interface RecapPlayerLine {
  playerId: string
  teamId: string
  /** Privacy-safe display name (publicPlayerName output) */
  name: string
  points: number
  rebounds: number
  assists: number
}

export interface RecapInput {
  homeTeam: RecapTeam
  awayTeam: RecapTeam
  homeScore: number
  awayScore: number
  leagueName?: string | null
  seasonLabel?: string | null
  /** e.g. "Saturday, July 4" — omitted when unknown */
  dateLabel?: string | null
  periodType?: "QUARTERS" | "HALVES"
  scoreEvents: RecapScoreEvent[]
  playerLines: RecapPlayerLine[]
}

export interface RecapResult {
  title: string
  body: string
}

interface GameShape {
  winner: RecapTeam
  loser: RecapTeam
  winnerScore: number
  loserScore: number
  margin: number
  leadChanges: number
  biggestRun: { teamId: string; points: number; period: number | null } | null
}

const ORDINALS = ["", "first", "second", "third", "fourth", "fifth"]

function periodName(period: number | null, periodType: "QUARTERS" | "HALVES"): string {
  if (!period || period < 1) return ""
  const unit = periodType === "HALVES" ? "half" : "quarter"
  const ord = ORDINALS[period] ?? `${period}th`
  return `${ord} ${unit}`
}

/** Walk the ordered score events once, extracting lead changes + biggest run. */
export function analyzeGame(input: RecapInput): GameShape {
  const { homeTeam, awayTeam, homeScore, awayScore } = input
  const homeWon = homeScore >= awayScore
  const winner = homeWon ? homeTeam : awayTeam
  const loser = homeWon ? awayTeam : homeTeam

  let h = 0
  let a = 0
  let leader: "h" | "a" | null = null
  let leadChanges = 0

  let runTeam: string | null = null
  let runPoints = 0
  let runPeriod: number | null = null
  let biggestRun: GameShape["biggestRun"] = null

  const events = [...input.scoreEvents].sort((x, y) => x.sequence - y.sequence)
  for (const e of events) {
    if (e.teamId === homeTeam.id) h += e.points
    else if (e.teamId === awayTeam.id) a += e.points
    else continue

    const nowLeader: "h" | "a" | null = h > a ? "h" : a > h ? "a" : leader
    if (nowLeader !== leader && leader !== null && nowLeader !== null) leadChanges++
    leader = nowLeader

    if (e.teamId === runTeam) {
      runPoints += e.points
    } else {
      runTeam = e.teamId
      runPoints = e.points
      runPeriod = e.period
    }
    if (!biggestRun || runPoints > biggestRun.points) {
      biggestRun = { teamId: runTeam, points: runPoints, period: runPeriod }
    }
  }

  return {
    winner,
    loser,
    winnerScore: Math.max(homeScore, awayScore),
    loserScore: Math.min(homeScore, awayScore),
    margin: Math.abs(homeScore - awayScore),
    leadChanges,
    biggestRun,
  }
}

function titleVerb(margin: number): string {
  if (margin <= 3) return "edges"
  if (margin <= 9) return "tops"
  if (margin <= 14) return "pulls away from"
  return "rolls past"
}

function leadVerb(margin: number): string {
  if (margin <= 3) return "held off"
  if (margin <= 9) return "defeated"
  if (margin <= 14) return "pulled away from"
  return "rolled past"
}

function statLine(p: RecapPlayerLine): string {
  const extras: string[] = []
  if (p.rebounds >= 5) extras.push(`${p.rebounds} rebounds`)
  if (p.assists >= 4) extras.push(`${p.assists} assists`)
  if (extras.length === 0) return `${p.points} points`
  if (extras.length === 1) return `${p.points} points and ${extras[0]}`
  return `${p.points} points, ${extras[0]} and ${extras[1]}`
}

/** Deterministic, newspaper-style recap from the event stream. */
export function buildTemplateRecap(input: RecapInput): RecapResult {
  const shape = analyzeGame(input)
  const { winner, loser, winnerScore, loserScore, margin, leadChanges, biggestRun } = shape
  const periodType = input.periodType ?? "QUARTERS"

  const title =
    margin === 0
      ? `${input.homeTeam.name} and ${input.awayTeam.name} finish level, ${winnerScore}–${loserScore}`
      : `${winner.name} ${titleVerb(margin)} ${loser.name} ${winnerScore}–${loserScore}`

  const sentences: string[] = []

  // Lead sentence: result + context
  const context = [input.leagueName, input.seasonLabel].filter(Boolean).join(" ")
  const dateline = input.dateLabel ? ` on ${input.dateLabel}` : ""
  sentences.push(
    `${winner.name} ${leadVerb(margin)} ${loser.name} ${winnerScore}–${loserScore}${dateline}${
      context ? ` in ${context} action` : ""
    }.`
  )

  // Game-shape sentence
  if (margin <= 3) {
    sentences.push(
      leadChanges >= 3
        ? `The lead changed hands ${leadChanges} times in a game that stayed tight to the final buzzer.`
        : `Neither side could shake the other in a game that stayed tight to the final buzzer.`
    )
  } else if (leadChanges >= 4) {
    sentences.push(
      `The teams traded the lead ${leadChanges} times before ${winner.name} took control late.`
    )
  }

  // Biggest run, when it says something (6+ points unanswered)
  if (biggestRun && biggestRun.points >= 6) {
    const runTeamName = biggestRun.teamId === winner.id ? winner.name : loser.name
    const when = periodName(biggestRun.period, periodType)
    if (biggestRun.teamId === winner.id) {
      sentences.push(
        `A ${biggestRun.points}-0 run${when ? ` in the ${when}` : ""} broke the game open for ${runTeamName}.`
      )
    } else {
      sentences.push(
        `${runTeamName} made a push with a ${biggestRun.points}-0 run${
          when ? ` in the ${when}` : ""
        }, but it wasn't enough.`
      )
    }
  }

  // Top performers, one per team
  const topFor = (teamId: string) =>
    input.playerLines
      .filter((p) => p.teamId === teamId && p.points > 0)
      .sort((x, y) => y.points - x.points || y.rebounds - x.rebounds)[0]

  const winnerTop = topFor(winner.id)
  const loserTop = topFor(loser.id)
  if (winnerTop) {
    sentences.push(`${winnerTop.name} led ${winner.name} with ${statLine(winnerTop)}.`)
  }
  if (loserTop) {
    sentences.push(`${loserTop.name} paced ${loser.name} with ${statLine(loserTop)}.`)
  }

  return { title, body: sentences.join(" ") }
}
