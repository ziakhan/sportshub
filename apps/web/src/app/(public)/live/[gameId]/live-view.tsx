"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { foldEvents, totalRebounds, type FoldEvent, type PlayerLine } from "@/lib/scoring/fold"
import { monogram } from "@/lib/content/matchup-cover"
import { useRealtime } from "@/lib/realtime/use-realtime"
import { FlashNum } from "@/components/scoring/flash-num"

/**
 * Public game page — owner-approved redesign 2026-07-06 (ESPN/theScore
 * patterns, see docs/ux-audit + design artifact):
 * - Full-bleed score hero washed with both clubs' colors; records + rank.
 * - Desktop (lg+): BOTH box scores in full — side by side on very wide
 *   screens — with an always-visible play-by-play rail. Nothing hidden.
 * - Phones: Box/Plays tabs (filled active state) + one-team-at-a-time
 *   switcher filled in that team's color, so the full roster fits without
 *   endless scrolling (owner call: keep the swap on mobile).
 * - Starters above a divider, bench below (from the first LINEUP event).
 * - SCHEDULED games show each roster with season averages instead of an
 *   empty box score.
 * Polls every 10s and folds the event stream client-side with the same
 * engine the console uses.
 */

interface LivePlayer {
  playerId: string
  teamId: string
  name: string
  jerseyNumber: string | null
}

interface TeamRecord {
  record: string
  rank: number
  divisionName: string
}

interface LivePayload {
  game: {
    id: string
    status: string
    scheduledAt: string
    homeScore: number | null
    awayScore: number | null
    homeTeamId: string
    awayTeamId: string
    seasonId?: string | null
    homeTeamName: string
    awayTeamName: string
    homeColor: string | null
    awayColor: string | null
    homeRecord: TeamRecord | null
    awayRecord: TeamRecord | null
    venueName: string | null
    leagueName: string | null
    seasonName: string | null
  }
  events: FoldEvent[]
  /** Incremental polls only: sequences ≤ sinceSeq that are currently voided. */
  voidedSequences?: number[]
  players: LivePlayer[]
  seasonAverages: Record<string, { gp: number; ppg: number; rpg: number; apg: number }>
}

type Tab = "box" | "plays"

const HOME_FALLBACK = "#4f46e5" // play-600
const AWAY_FALLBACK = "#16a34a" // court-600

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

export function LiveView({ gameId }: { gameId: string }) {
  const [data, setData] = useState<LivePayload | null>(null)
  const [error, setError] = useState(false)
  const [canScore, setCanScore] = useState(false)
  const [tab, setTab] = useState<Tab>("box")
  const [boxSide, setBoxSide] = useState<"home" | "away">("home")
  const [playFilter, setPlayFilter] = useState<"all" | "scoring" | number>("all")

  useEffect(() => {
    fetch(`/api/games/${gameId}/scoring?probe=1`)
      .then((res) => setCanScore(res.ok))
      .catch(() => {})
  }, [gameId])

  // Realtime: a game.update ping (score/event/status) runs the existing
  // ?sinceSeq poll immediately; the socket never carries event data itself.
  const pollRef = useRef<(() => void) | null>(null)
  const { connected } = useRealtime({
    rooms: [`game:${gameId}`],
    events: { "game.update": () => pollRef.current?.() },
  })

  useEffect(() => {
    let stop = false
    // After the initial full load, poll with ?sinceSeq — the server then
    // skips rosters/standings/averages and returns only new events plus the
    // currently-voided sequences (voids mutate rows, so they must be
    // reconciled against the cache rather than appended).
    let lastSeq = 0
    async function poll() {
      try {
        const url =
          lastSeq > 0 ? `/api/live/${gameId}?sinceSeq=${lastSeq}` : `/api/live/${gameId}`
        const res = await fetch(url)
        if (!res.ok) throw new Error()
        const payload: LivePayload = await res.json()
        if (stop) return
        if (lastSeq === 0) {
          setData(payload)
        } else {
          setData((prev) => {
            if (!prev) return payload
            const fresh = new Set(payload.events.map((e) => e.sequence))
            const voided = new Set(payload.voidedSequences ?? [])
            const events = prev.events
              .filter((e) => !fresh.has(e.sequence))
              .map((e) =>
                (e.voided ?? false) === voided.has(e.sequence)
                  ? e
                  : { ...e, voided: voided.has(e.sequence) }
              )
              .concat(payload.events)
              .sort((a, b) => a.sequence - b.sequence)
            return {
              ...prev,
              // Header fields (score/status/clock) refresh every poll; the
              // standings-derived records only come with the initial load.
              game: {
                ...payload.game,
                homeRecord: payload.game.homeRecord ?? prev.game.homeRecord,
                awayRecord: payload.game.awayRecord ?? prev.game.awayRecord,
              },
              events,
            }
          })
        }
        lastSeq = payload.events.reduce((max, e) => Math.max(max, e.sequence), lastSeq)
        setError(false)
      } catch {
        if (!stop) setError(true)
      }
    }
    pollRef.current = poll
    poll()
    // Fast cadence without a socket; slow safety net while pings arrive.
    // (Flipping `connected` re-runs this effect — one fresh full load per
    // transition, which also covers any events missed while disconnected.)
    const t = setInterval(poll, connected ? 60_000 : 10_000)
    return () => {
      stop = true
      pollRef.current = null
      clearInterval(t)
    }
  }, [gameId, connected])

  const fold = useMemo(
    () =>
      data
        ? foldEvents(data.events, {
            homeTeamId: data.game.homeTeamId,
            awayTeamId: data.game.awayTeamId,
          })
        : null,
    [data]
  )

  if (!data || !fold) {
    return (
      <p className="text-ink-500 p-10 text-center text-sm">
        {error ? "Couldn't load this game." : "Loading…"}
      </p>
    )
  }

  const { game } = data
  const homeColor = game.homeColor || HOME_FALLBACK
  const awayColor = game.awayColor || AWAY_FALLBACK
  const colorOf = (teamId?: string | null) =>
    teamId === game.homeTeamId ? homeColor : teamId === game.awayTeamId ? awayColor : "#9191a1"

  const byId = new Map(data.players.map((p) => [p.playerId, p]))
  const nameOf = (pid?: string | null) => (pid ? byId.get(pid)?.name ?? "" : "")
  const jerseyOf = (pid: string) => byId.get(pid)?.jerseyNumber ?? "?"
  const shortName = (pid: string) => {
    const name = nameOf(pid) || ""
    const parts = name.split(" ")
    if (parts.length < 2) return parts[0] || "—"
    // Privacy-abbreviated names ("Cameron K.") arrive pre-shortened — never
    // initial them again ("C. K."). Only compress genuine full names.
    const last = parts[parts.length - 1]
    if (/^[A-Z]\.?$/.test(last)) return name
    return `${parts[0][0]}. ${last}`
  }

  const live = game.status === "LIVE"
  const final = game.status === "COMPLETED"
  const homeScore = final && game.homeScore != null ? game.homeScore : fold.homeScore
  const awayScore = final && game.awayScore != null ? game.awayScore : fold.awayScore

  const periods = Array.from(
    new Set(fold.playByPlay.filter((e) => e.period).map((e) => e.period as number))
  ).sort((a, b) => a - b)
  const periodLabel = (p: number) => (p <= 4 ? `Q${p}` : `OT${p - 4}`)
  const periodPoints = (teamId: string, p: number) =>
    fold.playByPlay
      .filter(
        (e) =>
          e.teamId === teamId &&
          e.period === p &&
          e.made !== false &&
          ["SCORE_2PT", "SCORE_3PT", "SCORE_FT"].includes(e.eventType)
      )
      .reduce(
        (s, e) => s + (e.eventType === "SCORE_2PT" ? 2 : e.eventType === "SCORE_3PT" ? 3 : 1),
        0
      )

  const teamLines = (teamId: string) =>
    Object.values(fold.players)
      .filter((l) => l.teamId === teamId)
      .sort((a, b) => b.points - a.points)

  // Starting five = the first LINEUP event each team recorded
  const starterIds = new Map<string, Set<string>>()
  for (const e of data.events) {
    if (e.eventType === "LINEUP" && e.teamId && !e.voided && !starterIds.has(e.teamId)) {
      starterIds.set(e.teamId, new Set((e.metadata as any)?.playerIds ?? []))
    }
  }

  const leaderOf = (teamId: string, stat: (l: PlayerLine) => number): PlayerLine | null => {
    const lines = teamLines(teamId).filter((l) => stat(l) > 0)
    if (lines.length === 0) return null
    return lines.reduce((best, l) => (stat(l) > stat(best) ? l : best))
  }

  const LEADER_STATS: Array<{ label: string; get: (l: PlayerLine) => number }> = [
    { label: "Points", get: (l) => l.points },
    { label: "Rebounds", get: (l) => totalRebounds(l) },
    { label: "Assists", get: (l) => l.assists },
  ]

  const hasAnyStats = Object.keys(fold.players).length > 0
  const boxTeamId = boxSide === "home" ? game.homeTeamId : game.awayTeamId

  // Play-by-play with a running score attached to scoring plays
  const SCORE_PTS: Record<string, number> = { SCORE_2PT: 2, SCORE_3PT: 3, SCORE_FT: 1 }
  const PBP_TYPES = new Set([
    "SCORE_2PT",
    "SCORE_3PT",
    "SCORE_FT",
    "FOUL",
    "SUBSTITUTION",
    "PERIOD_START",
    "PERIOD_END",
  ])
  let runHome = 0
  let runAway = 0
  const playByPlay = fold.playByPlay
    .map((e) => {
      const pts = SCORE_PTS[e.eventType]
      const scored = pts != null && e.made !== false && !!e.teamId
      if (scored) {
        if (e.teamId === game.homeTeamId) runHome += pts
        else if (e.teamId === game.awayTeamId) runAway += pts
      }
      return { e, score: scored ? `${runHome}–${runAway}` : null }
    })
    .filter(({ e }) => PBP_TYPES.has(e.eventType))
    .reverse()
  const visiblePlays = playByPlay.filter(({ e, score }) => {
    if (playFilter === "all") return true
    if (playFilter === "scoring") return score !== null || e.eventType.startsWith("PERIOD")
    return e.period === playFilter
  })

  const describe = (e: FoldEvent): string => {
    switch (e.eventType) {
      case "SCORE_2PT":
      case "SCORE_3PT":
      case "SCORE_FT": {
        const pts = e.eventType === "SCORE_2PT" ? 2 : e.eventType === "SCORE_3PT" ? 3 : 1
        const who = e.playerId ? `#${jerseyOf(e.playerId)} ${shortName(e.playerId)}` : "—"
        return e.made === false
          ? `${who} misses ${e.eventType === "SCORE_FT" ? "a free throw" : `a ${pts}-pointer`}`
          : `${who} ${e.eventType === "SCORE_FT" ? "makes a free throw" : `scores ${pts}`}`
      }
      case "FOUL":
        return `Foul on ${e.playerId ? `#${jerseyOf(e.playerId)} ${shortName(e.playerId)}` : "team"}${
          (e.metadata as any)?.technical ? " (technical)" : ""
        }`
      case "SUBSTITUTION":
        return `Sub: ${(e.metadata as any)?.inPlayerId ? `#${jerseyOf((e.metadata as any).inPlayerId)}` : "?"} in, ${
          (e.metadata as any)?.outPlayerId ? `#${jerseyOf((e.metadata as any).outPlayerId)}` : "?"
        } out`
      case "PERIOD_START":
        return `${periodLabel(e.period ?? 1)}`
      case "PERIOD_END":
        return "End of period"
      default:
        return e.eventType
    }
  }

  // ---------- shared building blocks ----------

  const crest = (teamId: string, size: string, text: string) => (
    <span
      className={`${size} flex shrink-0 items-center justify-center rounded-xl font-extrabold text-white shadow-sm`}
      style={{ backgroundColor: colorOf(teamId) }}
      aria-hidden="true"
    >
      {text}
    </span>
  )


  const statRow = (l: PlayerLine, teamColor: string, isTop: boolean, showMin: boolean) => (
    <tr
      key={l.playerId}
      className="border-ink-50 hover:bg-ink-50 border-t transition-colors"
      style={isTop ? { backgroundColor: `${teamColor}14` } : undefined}
    >
      <td className="text-ink-900 whitespace-nowrap py-2 pl-4 pr-2 font-semibold">
        <span className="text-ink-400 mr-1.5 font-normal">#{jerseyOf(l.playerId)}</span>
        <Link href={`/player/${l.playerId}`} className="hover:text-play-600 transition-colors">
          {shortName(l.playerId)}
        </Link>
        {l.onFloor && live ? <span className="text-court-600"> ●</span> : null}
        {isTop && (
          <span
            className="bg-highlight text-highlight-on ml-2 rounded px-1.5 py-0.5 align-[2px] text-[9.5px] font-extrabold tracking-widest"
            style={{ color: teamColor }}
          >
            TOP
          </span>
        )}
      </td>
      {showMin && <td className="px-1.5 text-right">{Math.round(l.secondsPlayed / 60)}</td>}
      <td className="text-energy-ink px-1.5 text-right text-base font-extrabold"><FlashNum value={l.points} /></td>
      <td className="px-1.5 text-right"><FlashNum value={totalRebounds(l)} /></td>
      <td className="px-1.5 text-right"><FlashNum value={l.assists} /></td>
      <td className="px-1.5 text-right"><FlashNum value={l.steals} /></td>
      <td className="hidden px-1.5 text-right sm:table-cell">{l.blocks}</td>
      <td className="px-1.5 pr-4 text-right sm:pr-1.5"><FlashNum value={l.turnovers} /></td>
      <td className="hidden px-1.5 pr-4 text-right sm:table-cell">
        {l.fouls}
        {l.technicalFouls > 0 ? "T" : ""}
      </td>
    </tr>
  )

  const statsTable = (teamId: string) => {
    const lines = teamLines(teamId)
    const teamColor = colorOf(teamId)
    const showMinutes = lines.some((l) => l.secondsPlayed > 0)
    const starters = starterIds.get(teamId)
    const starterLines = starters ? lines.filter((l) => starters.has(l.playerId)) : []
    const benchLines = starters ? lines.filter((l) => !starters.has(l.playerId)) : lines
    const topId = lines.length > 0 && lines[0].points > 0 ? lines[0].playerId : null
    const totals = lines.reduce(
      (t, l) => ({
        pts: t.pts + l.points,
        reb: t.reb + totalRebounds(l),
        ast: t.ast + l.assists,
        stl: t.stl + l.steals,
        blk: t.blk + l.blocks,
        to: t.to + l.turnovers,
        pf: t.pf + l.fouls,
      }),
      { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0, pf: 0 }
    )
    const header = (
      <thead className="text-ink-500 text-left text-[11.5px] uppercase tracking-wide">
        <tr>
          <th className="py-2 pl-4 pr-2 font-bold">Player</th>
          {showMinutes && <th className="px-1.5 text-right font-bold">Min</th>}
          <th className="px-1.5 text-right font-bold">Pts</th>
          <th className="px-1.5 text-right font-bold">Reb</th>
          <th className="px-1.5 text-right font-bold">Ast</th>
          <th className="px-1.5 text-right font-bold">Stl</th>
          <th className="hidden px-1.5 text-right font-bold sm:table-cell">Blk</th>
          <th className="px-1.5 pr-4 text-right font-bold sm:pr-1.5">TO</th>
          <th className="hidden px-1.5 pr-4 text-right font-bold sm:table-cell">PF</th>
        </tr>
      </thead>
    )
    const cols = showMinutes ? 9 : 8
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs lg:text-[13px]">
          {header}
          <tbody>
            {starterLines.map((l) => statRow(l, teamColor, l.playerId === topId, showMinutes))}
            {starters && benchLines.length > 0 && (
              <tr>
                <td
                  colSpan={cols}
                  className="bg-ink-50 text-ink-500 border-ink-100 border-y px-4 py-1 text-[10.5px] font-extrabold uppercase tracking-widest"
                >
                  Bench
                </td>
              </tr>
            )}
            {benchLines.map((l) => statRow(l, teamColor, l.playerId === topId, showMinutes))}
            <tr className="border-ink-200 text-ink-900 border-t-2 font-bold">
              <td className="py-2 pl-4 pr-2">Team</td>
              {showMinutes && <td />}
              <td className="px-1.5 text-right">{totals.pts}</td>
              <td className="px-1.5 text-right">{totals.reb}</td>
              <td className="px-1.5 text-right">{totals.ast}</td>
              <td className="px-1.5 text-right">{totals.stl}</td>
              <td className="hidden px-1.5 text-right sm:table-cell">{totals.blk}</td>
              <td className="px-1.5 pr-4 text-right sm:pr-1.5">{totals.to}</td>
              <td className="hidden px-1.5 pr-4 text-right sm:table-cell">{totals.pf}</td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  const boxHeader = (teamId: string, name: string, total: number | null) => (
    <div
      className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-extrabold text-white"
      style={{ backgroundColor: colorOf(teamId) }}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/25 text-[11px]">
        {monogram(name)}
      </span>
      <Link href={`/team/${teamId}`} className="truncate hover:underline">
        {name}
      </Link>
      {total != null && (
        <span className="font-condensed ml-auto text-2xl font-bold tabular-nums"><FlashNum value={total} /></span>
      )}
    </div>
  )

  // Pre-game roster with season averages (SCHEDULED games)
  const rosterTable = (teamId: string) => {
    const roster = data.players
      .filter((p) => p.teamId === teamId)
      .map((p) => ({ ...p, avg: data.seasonAverages[p.playerId] }))
      .sort((a, b) => (b.avg?.ppg ?? 0) - (a.avg?.ppg ?? 0))
    if (roster.length === 0) {
      return <p className="text-ink-400 px-4 py-6 text-center text-xs">Roster not submitted yet.</p>
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-[15px] tabular-nums">
          <thead className="text-ink-500 text-left text-[11.5px] uppercase tracking-wide">
            <tr>
              <th className="py-2 pl-4 pr-2 font-bold">Player</th>
              <th className="px-1.5 text-right font-bold">GP</th>
              <th className="px-1.5 text-right font-bold">PPG</th>
              <th className="px-1.5 text-right font-bold">RPG</th>
              <th className="px-1.5 pr-4 text-right font-bold">APG</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((p) => (
              <tr key={p.playerId} className="border-ink-50 hover:bg-ink-50 border-t transition-colors">
                <td className="text-ink-900 whitespace-nowrap py-2 pl-4 pr-2 font-semibold">
                  <span className="text-ink-400 mr-1.5 font-normal">
                    {p.jerseyNumber ? `#${p.jerseyNumber}` : ""}
                  </span>
                  <Link href={`/player/${p.playerId}`} className="hover:text-play-600 transition-colors">
                    {p.name}
                  </Link>
                </td>
                <td className="px-1.5 text-right">{p.avg?.gp ?? 0}</td>
                <td className="text-ink-950 px-1.5 text-right font-bold">{p.avg?.ppg ?? "—"}</td>
                <td className="px-1.5 text-right">{p.avg?.rpg ?? "—"}</td>
                <td className="px-1.5 pr-4 text-right">{p.avg?.apg ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // Compact one-liner per stat: dot #4 C. Lewis 10 · PTS · 14 O. Wright #3
  const leaderDuel = (label: string, get: (l: PlayerLine) => number) => {
    const h = leaderOf(game.homeTeamId, get)
    const a = leaderOf(game.awayTeamId, get)
    if (!h && !a) return null
    const cell = (l: PlayerLine | null, teamId: string, right: boolean) => (
      <div
        className={`flex min-w-0 flex-1 items-center gap-1.5 ${right ? "flex-row-reverse text-right" : ""}`}
      >
        {l ? (
          <>
            <span
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ backgroundColor: colorOf(teamId) }}
            />
            <span className="text-ink-800 min-w-0 truncate text-[13.5px] font-bold">
              {shortName(l.playerId)}
            </span>
            <span className="text-ink-950 shrink-0 text-lg font-extrabold tabular-nums">
              <FlashNum value={get(l)} />
            </span>
          </>
        ) : (
          <span className="text-ink-300 text-xs">—</span>
        )}
      </div>
    )
    return (
      <div key={label} className="flex items-center gap-2 px-4 py-2">
        {cell(h, game.homeTeamId, false)}
        <span className="text-ink-500 w-10 shrink-0 text-center text-[10px] font-extrabold uppercase tracking-widest">
          {label.slice(0, 3)}
        </span>
        {cell(a, game.awayTeamId, true)}
      </div>
    )
  }

  return (
    <div className="pb-10">
      {/* ---------- score hero: broadcast-dark stage (Energy Pass) ----------
          Owner spec 2026-07-15: each team stacks vertically (crest → name →
          record → score) so BOTH teams always fit at 390px (the old side-by-
          side layout clipped the away team), and the freed center column
          gives the quarter-by-quarter table real size. Winner reads in the
          highlight color; team colors stay content, never theme. */}
      <div
        className="from-stage to-stage-2 bg-gradient-to-br text-white"
        style={{
          backgroundImage: `radial-gradient(90% 140% at 0% 0%, ${homeColor}38 0%, transparent 50%), radial-gradient(90% 140% at 100% 0%, ${awayColor}38 0%, transparent 50%), linear-gradient(135deg, var(--stage), var(--stage-2))`,
        }}
      >
        <div className="mx-auto w-full max-w-[1760px] px-4 pb-5 pt-4 sm:px-6">
          <p className="text-center text-xs font-semibold text-white/60">
            {game.seasonId && game.leagueName ? (
              <Link href={`/league/${game.seasonId}`} className="text-highlight hover:underline">
                {game.leagueName}
              </Link>
            ) : (
              game.leagueName
            )}
            {game.seasonName ? ` · ${game.seasonName}` : ""}
          </p>

          <div className="mt-2 text-center">
            {live && (
              <span className="bg-live-600 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-extrabold uppercase tracking-[0.14em] text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                Live · {periodLabel(fold.period)}
              </span>
            )}
            {final && (
              <span className="bg-energy text-energy-on rounded-full px-3.5 py-1 text-xs font-extrabold uppercase tracking-[0.18em]">
                Final
              </span>
            )}
            {!live && !final && (
              <span className="text-sm font-bold text-white/80">
                {new Date(game.scheduledAt).toLocaleString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>

          <div className="mt-3 grid grid-cols-[minmax(84px,1fr)_auto_minmax(84px,1fr)] items-start gap-2 sm:gap-6 lg:mx-auto lg:max-w-3xl">
            {(
              [
                [game.homeTeamId, game.homeTeamName, game.homeRecord, homeScore, awayScore],
                [game.awayTeamId, game.awayTeamName, game.awayRecord, awayScore, homeScore],
              ] as Array<[string, string, TeamRecord | null, number, number]>
            ).map(([tid, tname, rec, score, other], i) => (
              <div key={tid} className={`text-center ${i === 1 ? "order-3" : "order-1"}`}>
                {crest(
                  tid,
                  "mx-auto h-14 w-14 text-lg lg:h-[72px] lg:w-[72px] lg:text-2xl",
                  monogram(tname)
                )}
                <Link
                  href={`/team/${tid}`}
                  className="mt-1.5 block text-[13px] font-extrabold leading-tight text-white hover:underline lg:text-base"
                >
                  {tname}
                </Link>
                {rec && <p className="text-[11px] font-semibold text-white/50">{rec.record}</p>}
                <p
                  className={`font-condensed mt-0.5 text-6xl font-bold tabular-nums leading-none lg:text-7xl ${
                    final && score > other ? "text-highlight" : "text-white"
                  } ${final && score < other ? "text-white/60" : ""}`}
                >
                  <FlashNum value={score} />
                </p>
              </div>
            ))}

            {/* center: the quarter-by-quarter gets the whole column */}
            <div className="order-2 min-w-0 pt-1">
              {periods.length > 0 ? (
                <table className="mx-auto border-collapse text-center text-[15px] font-bold tabular-nums lg:text-base">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-white/45">
                      <th className="px-1.5 py-1 text-left" />
                      {periods.map((p) => (
                        <th key={p} className="px-2 py-1 font-extrabold sm:px-3">
                          {periodLabel(p)}
                        </th>
                      ))}
                      <th className="text-highlight px-2 py-1 font-extrabold sm:px-3">T</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        [game.homeTeamId, game.homeTeamName, homeScore],
                        [game.awayTeamId, game.awayTeamName, awayScore],
                      ] as Array<[string, string, number]>
                    ).map(([tid, tname, total]) => (
                      <tr key={tid} className="border-t border-white/15">
                        <td
                          className="py-1.5 pr-1.5 text-left text-xs font-extrabold"
                          style={{ color: `color-mix(in srgb, ${colorOf(tid)} 45%, white)` }}
                        >
                          {monogram(tname)}
                        </td>
                        {periods.map((p) => (
                          <td key={p} className="px-2 py-1.5 text-white/85 sm:px-3">
                            <FlashNum value={periodPoints(tid, p)} />
                          </td>
                        ))}
                        <td className="text-highlight px-2 py-1.5 font-extrabold sm:px-3">
                          <FlashNum value={total} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="px-2 pt-4 text-center text-xs font-semibold text-white/40">
                  {live ? "First basket coming up" : final ? "" : "Tip-off soon"}
                </p>
              )}
            </div>
          </div>

          {game.venueName && (
            <p className="mt-2.5 text-center text-xs font-medium text-white/50">
              {game.venueName}
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1760px] px-4 sm:px-6">
        {canScore && !final && (
          <a
            href={`/games/${gameId}/score`}
            className="bg-play-600 hover:bg-play-700 mt-4 block rounded-2xl px-4 py-3 text-center text-sm font-bold text-white"
          >
            You can score this game — open the scoring console →
          </a>
        )}

        {/* ---------- pre-game: rosters with season averages ---------- */}
        {!hasAnyStats && !live && !final && (
          <>
            <div className="border-ink-100 mt-4 rounded-2xl border bg-white p-6 text-center">
              <p className="text-ink-900 text-sm font-semibold">This game hasn&apos;t started yet</p>
              <p className="text-ink-500 mt-1 text-xs">
                Live score, leaders and the box score appear here automatically at tip-off — the
                page refreshes on its own. Season numbers below.
              </p>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {(
                [
                  [game.homeTeamId, game.homeTeamName],
                  [game.awayTeamId, game.awayTeamName],
                ] as Array<[string, string]>
              ).map(([tid, tname]) => (
                <div key={tid} className="border-ink-100 overflow-hidden rounded-2xl border bg-white">
                  {boxHeader(tid, tname, null)}
                  {rosterTable(tid)}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ---------- leaders: one slim strip, three duels ---------- */}
        {hasAnyStats && (
          <div className="border-ink-100 divide-ink-50 mt-3 divide-y rounded-2xl border bg-white sm:grid sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {LEADER_STATS.map(({ label, get }) => leaderDuel(label, get))}
          </div>
        )}

        {/* ---------- box scores + play-by-play ---------- */}
        {hasAnyStats && (
          <>
            {/* phone tabs: filled active state, impossible to miss */}
            <div className="bg-ink-100 mt-3 flex rounded-xl p-1 lg:hidden">
              {(
                [
                  ["box", "Box score"],
                  ["plays", "Play-by-play"],
                ] as Array<[Tab, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`flex-1 rounded-lg py-2 text-sm font-bold transition-colors ${
                    tab === key ? "bg-play-600 text-white shadow-sm" : "text-ink-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_400px]">
              {/* phone: one team behind a color-coded switcher; desktop: both in full */}
              <div className={`${tab === "box" ? "block" : "hidden"} lg:block`}>
                <div className="bg-ink-100 mb-2 flex rounded-xl p-1 lg:hidden">
                  {(["home", "away"] as const).map((side) => {
                    const tid = side === "home" ? game.homeTeamId : game.awayTeamId
                    const on = boxSide === side
                    return (
                      <button
                        key={side}
                        onClick={() => setBoxSide(side)}
                        className={`flex-1 truncate rounded-lg px-2 py-1.5 text-xs font-bold transition-colors ${
                          on ? "text-white shadow-sm" : "text-ink-500"
                        }`}
                        style={on ? { backgroundColor: colorOf(tid) } : undefined}
                      >
                        {side === "home" ? game.homeTeamName : game.awayTeamName}
                      </button>
                    )
                  })}
                </div>
                {/* phone: selected team only — the switcher IS the header
                    (score already lives in the hero; no repeated bar) */}
                <div className="border-ink-100 overflow-hidden rounded-2xl border bg-white lg:hidden">
                  {statsTable(boxTeamId)}
                </div>
                {/* desktop: home box (away box is the next grid cell) */}
                <div className="border-ink-100 hidden overflow-hidden rounded-2xl border bg-white lg:block">
                  {boxHeader(game.homeTeamId, game.homeTeamName, homeScore)}
                  {statsTable(game.homeTeamId)}
                </div>
              </div>

              <div className="border-ink-100 hidden overflow-hidden rounded-2xl border bg-white lg:block xl:col-start-1 2xl:col-start-2 2xl:row-start-1">
                {boxHeader(game.awayTeamId, game.awayTeamName, awayScore)}
                {statsTable(game.awayTeamId)}
              </div>

              {/* play-by-play — rail on desktop, tab on phones */}
              <div
                className={`border-ink-100 overflow-hidden rounded-2xl border bg-white ${
                  tab === "plays" ? "block" : "hidden"
                } lg:block xl:sticky xl:top-[76px] xl:col-start-2 xl:row-start-1 xl:row-span-2 2xl:col-start-3 2xl:row-span-1`}
              >
                {/* chips only on phones (the tab already says "Play-by-play") */}
                <div className="border-ink-100 flex items-center gap-1.5 overflow-x-auto border-b px-4 py-2">
                  <h3 className="text-ink-400 hidden flex-1 text-[10px] font-bold uppercase tracking-[0.14em] lg:block">
                    Play-by-play
                  </h3>
                  {(
                    [
                      ["all", "All"],
                      ["scoring", "Scoring"],
                      ...periods.map((p) => [p, periodLabel(p)] as [number, string]),
                    ] as Array<["all" | "scoring" | number, string]>
                  ).map(([key, label]) => (
                    <button
                      key={String(key)}
                      onClick={() => setPlayFilter(key)}
                      className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-colors ${
                        playFilter === key
                          ? "bg-ink-950 text-white"
                          : "text-ink-500 border-ink-200 border bg-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <ul className="max-h-[420px] overflow-y-auto xl:max-h-[calc(100vh-190px)]">
                  {visiblePlays.map(({ e, score }, i) =>
                    e.eventType.startsWith("PERIOD") ? (
                      <li
                        key={i}
                        className="bg-ink-50 text-ink-500 border-ink-100 border-b px-4 py-1 text-center text-[10px] font-extrabold uppercase tracking-widest"
                      >
                        {e.eventType === "PERIOD_START" ? describe(e) : "End of period"}
                      </li>
                    ) : (
                      <li
                        key={i}
                        className={`border-ink-50 flex items-center gap-2.5 border-b px-4 py-1.5 text-xs ${
                          score ? "text-ink-950 font-semibold" : "text-ink-600"
                        }`}
                      >
                        <span
                          className="w-1 self-stretch rounded-full"
                          style={{ backgroundColor: colorOf(e.teamId) }}
                        />
                        <span className="min-w-0 flex-1">{describe(e)}</span>
                        {score && (
                          <span className="text-ink-900 shrink-0 text-[11px] font-bold tabular-nums">
                            {score}
                          </span>
                        )}
                      </li>
                    )
                  )}
                  {visiblePlays.length === 0 && (
                    <li className="text-ink-400 px-4 py-6 text-center text-xs">No plays yet.</li>
                  )}
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
