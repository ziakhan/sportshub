"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { foldEvents, totalRebounds, type FoldEvent, type PlayerLine } from "@/lib/scoring/fold"
import { monogram } from "@/lib/content/matchup-cover"
import { useRealtime } from "@/lib/realtime/use-realtime"
import { FlashNum } from "@/components/scoring/flash-num"
import { VenueLink } from "@/components/venues/venue-link"

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
    venueId: string | null
    leagueName: string | null
    clockMode?: "SIMPLE" | "OFF"
    seasonName: string | null
  }
  events: FoldEvent[]
  /** Incremental polls only: sequences ≤ sinceSeq that are currently voided. */
  voidedSequences?: number[]
  players: LivePlayer[]
  seasonAverages: Record<string, { gp: number; ppg: number; rpg: number; apg: number }>
}

type Tab = "game" | "box" | "plays"

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
  const [tab, setTab] = useState<Tab>("game")
  const [boxSide, setBoxSide] = useState<"home" | "away">("home")
  const [playFilter, setPlayFilter] = useState<"all" | "scoring" | number>("all")

  // Sticky mini score chip (Yahoo pattern): appears when the hero scrolls off
  const heroRef = useRef<HTMLDivElement | null>(null)
  const [chipVisible, setChipVisible] = useState(false)
  // Ticking game clock (only when the league runs one — clockMode SIMPLE)
  const [clockDisplay, setClockDisplay] = useState<number | null>(null)

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
    const t = setInterval(poll, connected ? 20_000 : 10_000)
    return () => {
      stop = true
      pollRef.current = null
      clearInterval(t)
    }
  }, [gameId, connected])

  const loaded = !!data
  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => setChipVisible(!entry.isIntersecting))
    obs.observe(el)
    return () => obs.disconnect()
  }, [loaded])


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
  const clockOn = data?.game.clockMode === "SIMPLE" && data.game.status === "LIVE"
  const foldClockRunning = fold?.clockRunning ?? false
  const foldClockBase = fold?.clockSecondsAtLastEvent ?? null
  useEffect(() => {
    if (!clockOn) {
      setClockDisplay(null)
      return
    }
    if (!foldClockRunning) {
      setClockDisplay(foldClockBase)
      return
    }
    const startedAt = Date.now()
    const t = setInterval(() => {
      if (foldClockBase != null) {
        setClockDisplay(Math.max(0, foldClockBase - Math.round((Date.now() - startedAt) / 1000)))
      }
    }, 500)
    return () => clearInterval(t)
  }, [clockOn, foldClockRunning, foldClockBase])

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
    // initial them again. Compression matches the privacy form (owner
    // 2026-07-16): FIRST name + last initial, "Aiden M.", never "A. Mensah".
    const last = parts[parts.length - 1]
    if (/^[A-Z]\.?$/.test(last)) return name
    return `${parts[0]} ${last[0]}.`
  }

  // Youth team names run long ("Burlington Force Grade 10") — the score
  // surfaces show initials + a grade/age qualifier ("BF · G10") until teams
  // get an owner-set short name (backlog).
  const shortTeam = (name: string) => {
    const m = name.match(/\b(?:grade\s*(\d{1,2})|gr\s*(\d{1,2})|u(\d{1,2})|(\d{1,2})u)\b/i)
    const qual = m ? (m[1] || m[2] ? `G${m[1] ?? m[2]}` : `U${m[3] ?? m[4]}`) : null
    const base = m ? name.replace(m[0], "").trim() : name
    return qual ? `${monogram(base)} · ${qual}` : monogram(base)
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

  // ---------- Game tab (Yahoo pattern): leaders + team stat comparison ----------
  const teamAgg = (teamId: string) => {
    const lines = teamLines(teamId)
    const sum = (get: (l: PlayerLine) => number) => lines.reduce((t, l) => t + get(l), 0)
    return {
      fgm: sum((l) => l.fgMade2 + l.fgMade3),
      fga: sum((l) => l.fgMade2 + l.fgMiss2 + l.fgMade3 + l.fgMiss3),
      tpm: sum((l) => l.fgMade3),
      tpa: sum((l) => l.fgMade3 + l.fgMiss3),
      ftm: sum((l) => l.ftMade),
      fta: sum((l) => l.ftMade + l.ftMiss),
      reb: sum(totalRebounds),
      ast: sum((l) => l.assists),
      stl: sum((l) => l.steals),
      blk: sum((l) => l.blocks),
      to: sum((l) => l.turnovers),
      pf: sum((l) => l.fouls),
    }
  }

  const defLeader = (teamId: string): { l: PlayerLine; value: number; unit: string } | null => {
    const st = leaderOf(teamId, (l) => l.steals)
    const bl = leaderOf(teamId, (l) => l.blocks)
    const sv = st?.steals ?? 0
    const bv = bl?.blocks ?? 0
    if (sv === 0 && bv === 0) return null
    return bv > sv ? { l: bl!, value: bv, unit: "BLK" } : { l: st!, value: sv, unit: "STL" }
  }

  const LEADER_SECTIONS: Array<{
    label: string
    unit: string
    pick: (teamId: string) => { l: PlayerLine; value: number; unit: string } | null
    sub: (l: PlayerLine) => string
  }> = [
    {
      label: "Points",
      unit: "PTS",
      pick: (tid) => {
        const l = leaderOf(tid, (x) => x.points)
        return l ? { l, value: l.points, unit: "PTS" } : null
      },
      sub: (l) => `${totalRebounds(l)} REB · ${l.assists} AST`,
    },
    {
      label: "Rebounds",
      unit: "REB",
      pick: (tid) => {
        const l = leaderOf(tid, totalRebounds)
        return l ? { l, value: totalRebounds(l), unit: "REB" } : null
      },
      sub: (l) => `${l.defRebounds} DReb · ${l.offRebounds} OReb`,
    },
    {
      label: "Assists",
      unit: "AST",
      pick: (tid) => {
        const l = leaderOf(tid, (x) => x.assists)
        return l ? { l, value: l.assists, unit: "AST" } : null
      },
      sub: (l) => `${l.points} PTS · ${l.turnovers} TO`,
    },
    {
      label: "Defense",
      unit: "",
      pick: defLeader,
      sub: (l) => `${l.steals} STL · ${l.blocks} BLK`,
    },
  ]

  const leaderCell = (
    entry: { l: PlayerLine; value: number; unit: string } | null,
    teamId: string,
    sub: (l: PlayerLine) => string,
    right: boolean
  ) => (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2.5 ${right ? "flex-row-reverse text-right" : ""}`}
    >
      {entry ? (
        <>
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[12px] font-extrabold text-white"
            style={{ backgroundColor: colorOf(teamId) }}
          >
            #{jerseyOf(entry.l.playerId)}
          </span>
          <div className="min-w-0">
            <p className="text-ink-900 truncate text-[13px] font-bold leading-tight">
              {shortName(entry.l.playerId)}
            </p>
            <p className="text-ink-950 text-lg font-extrabold leading-tight tabular-nums">
              <FlashNum value={entry.value} />{" "}
              <span className="text-ink-600 text-[10px] font-extrabold">{entry.unit}</span>
            </p>
            <p className="text-ink-600 truncate text-[11px]">{sub(entry.l)}</p>
          </div>
        </>
      ) : (
        <span className="text-ink-300 text-xs">—</span>
      )}
    </div>
  )

  // Always show all four quarters — a dash marks the unplayed ones (owner:
  // fixed columns read better); overtime columns append only when reached.
  const displayPeriods = [1, 2, 3, 4, ...periods.filter((p) => p > 4)]
  const playedPeriods = new Set(periods)
  const linescoreCard =
    periods.length > 0 ? (
      <div className="border-ink-100 overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full text-center text-[15px] font-bold tabular-nums">
          <thead>
            <tr className="text-ink-600 border-ink-100 border-b text-[12px] uppercase tracking-wide">
              <th className="py-2 pl-4 text-left font-extrabold" />
              {displayPeriods.map((p) => (
                <th key={p} className="px-2.5 py-2 font-extrabold sm:px-4">
                  {p <= 4 ? p : periodLabel(p)}
                </th>
              ))}
              <th className="text-ink-950 px-3 py-2 pr-4 font-extrabold">Tot</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                [game.homeTeamId, game.homeTeamName, homeScore],
                [game.awayTeamId, game.awayTeamName, awayScore],
              ] as Array<[string, string, number]>
            ).map(([tid, tname, total]) => (
              <tr key={tid} className="border-ink-50 border-b last:border-0">
                <td className="py-2.5 pl-4 text-left">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-4 w-4 shrink-0 rounded"
                      style={{ backgroundColor: colorOf(tid) }}
                    />
                    <span className="text-ink-900 whitespace-nowrap font-extrabold">
                      {shortTeam(tname)}
                    </span>
                  </span>
                </td>
                {displayPeriods.map((p) => (
                  <td key={p} className="text-ink-600 px-2.5 py-2.5 sm:px-4">
                    {playedPeriods.has(p) ? (
                      <FlashNum value={periodPoints(tid, p)} />
                    ) : (
                      <span className="text-ink-300">–</span>
                    )}
                  </td>
                ))}
                <td className="text-ink-950 px-3 py-2.5 pr-4 font-extrabold">
                  <FlashNum value={total} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : null

  const leadersCard = (
    <div className="border-ink-100 rounded-2xl border bg-white">
      <div className="divide-ink-50 divide-y">
        {LEADER_SECTIONS.map((sec) => {
          const h = sec.pick(game.homeTeamId)
          const a = sec.pick(game.awayTeamId)
          if (!h && !a) return null
          return (
            <div key={sec.label} className="px-4 py-3">
              <p className="text-ink-600 mb-1.5 text-center text-[11.5px] font-extrabold uppercase tracking-widest">
                {sec.label}
              </p>
              <div className="flex items-center gap-3">
                {leaderCell(h, game.homeTeamId, sec.sub, false)}
                {leaderCell(a, game.awayTeamId, sec.sub, true)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  const compareRow = (
    label: string,
    h: number,
    a: number,
    displayH?: string,
    displayA?: string
  ) => {
    const total = h + a
    const hShare = total === 0 ? 50 : (h / total) * 100
    const hWins = h > a
    const aWins = a > h
    const num = (wins: boolean, value: number, display?: string) => (
      <span
        className={`text-[15px] tabular-nums ${wins ? "text-ink-950 font-extrabold" : "text-ink-500 font-semibold"}`}
      >
        {display ?? <FlashNum value={value} />}
      </span>
    )
    return (
      <div key={label} className="px-4 py-2.5">
        <div className="flex items-baseline justify-between gap-3">
          {num(hWins, h, displayH)}
          <span className="text-ink-600 text-[12px] font-extrabold uppercase tracking-wide">
            {label}
          </span>
          {num(aWins, a, displayA)}
        </div>
        <div className="mt-1.5 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
          <span
            style={{ width: `${hShare}%`, backgroundColor: homeColor, opacity: hWins ? 1 : 0.3 }}
          />
          <span className="flex-1" style={{ backgroundColor: awayColor, opacity: aWins ? 1 : 0.3 }} />
        </div>
      </div>
    )
  }

  const shooting = (m: number, at: number) =>
    at === 0 ? "0-0" : `${m}-${at} · ${Math.round((m / at) * 100)}%`

  const teamStatsCard = (() => {
    const H = teamAgg(game.homeTeamId)
    const A = teamAgg(game.awayTeamId)
    const pct = (m: number, at: number) => (at === 0 ? 0 : m / at)
    return (
      <div className="border-ink-100 rounded-2xl border bg-white">
        <div className="border-ink-100 flex items-center justify-between border-b px-4 py-2.5">
          <span className="text-[13px] font-extrabold" style={{ color: homeColor }}>
            {shortTeam(game.homeTeamName)}
          </span>
          <span className="text-[13px] font-extrabold" style={{ color: awayColor }}>
            {shortTeam(game.awayTeamName)}
          </span>
        </div>
        <div className="divide-ink-50 divide-y">
          {compareRow("Field goals", pct(H.fgm, H.fga), pct(A.fgm, A.fga), shooting(H.fgm, H.fga), shooting(A.fgm, A.fga))}
          {compareRow("3-pointers", pct(H.tpm, H.tpa), pct(A.tpm, A.tpa), shooting(H.tpm, H.tpa), shooting(A.tpm, A.tpa))}
          {compareRow("Free throws", pct(H.ftm, H.fta), pct(A.ftm, A.fta), shooting(H.ftm, H.fta), shooting(A.ftm, A.fta))}
          {compareRow("Rebounds", H.reb, A.reb)}
          {compareRow("Assists", H.ast, A.ast)}
          {compareRow("Steals", H.stl, A.stl)}
          {compareRow("Blocks", H.blk, A.blk)}
          {compareRow("Turnovers", H.to, A.to)}
          {compareRow("Fouls", H.pf, A.pf)}
        </div>
      </div>
    )
  })()

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
  // Narrative merge (owner 2026-07-16): the console writes ASSIST right
  // after a made shot and REBOUND right after a miss (single-scorer lock →
  // always adjacent), so shots absorb their follow-up into one line:
  // "Basket by X, assisted by Y" / "X misses — defensive rebound Z".
  let runHome = 0
  let runAway = 0
  const ordered = fold.playByPlay
  const consumed = new Set<number>()
  const playByPlay: Array<{ e: FoldEvent; score: string | null; tail: string | null }> = []
  for (let i = 0; i < ordered.length; i++) {
    if (consumed.has(i)) continue
    const e = ordered[i]
    const pts = SCORE_PTS[e.eventType]
    const scored = pts != null && e.made !== false && !!e.teamId
    if (scored) {
      if (e.teamId === game.homeTeamId) runHome += pts
      else if (e.teamId === game.awayTeamId) runAway += pts
    }
    let tail: string | null = null
    if (pts != null && e.eventType !== "SCORE_FT") {
      // look at the next two entries for the chained follow-up
      for (let j = i + 1; j <= i + 2 && j < ordered.length; j++) {
        if (consumed.has(j)) continue
        const n = ordered[j]
        if (e.made !== false && n.eventType === "ASSIST" && n.teamId === e.teamId) {
          tail = n.playerId ? `, assisted by #${jerseyOf(n.playerId)} ${shortName(n.playerId)}` : null
          consumed.add(j)
          break
        }
        if (e.made === false && n.eventType === "REBOUND") {
          const off = (n.metadata as { offensive?: boolean } | null)?.offensive
          tail = n.playerId
            ? ` — ${off ? "offensive" : "defensive"} rebound #${jerseyOf(n.playerId)} ${shortName(n.playerId)}`
            : null
          consumed.add(j)
          break
        }
        if (["SCORE_2PT", "SCORE_3PT", "SCORE_FT", "PERIOD_START", "PERIOD_END"].includes(n.eventType)) break
      }
    }
    if (!PBP_TYPES.has(e.eventType)) continue
    playByPlay.push({ e, score: scored ? `${runHome}–${runAway}` : null, tail })
  }
  playByPlay.reverse()
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
        <span className="text-ink-500 mr-1.5 font-normal">#{jerseyOf(l.playerId)}</span>
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
    // Starters stay starters forever (owner 2026-07-16 v2) — the green
    // on-court dot carries "who's on the floor right now" during live games.
    const starters = starterIds.get(teamId)
    const groupSet = starters
    const starterLines = groupSet ? lines.filter((l) => groupSet.has(l.playerId)) : []
    const benchLines = groupSet ? lines.filter((l) => !groupSet.has(l.playerId)) : lines
    const groupLabel = "Starters"
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
        <table className="w-full text-[15px] tabular-nums">
          {header}
          <tbody>
            {groupSet && starterLines.length > 0 && (
              <tr>
                <td
                  colSpan={cols}
                  className="bg-ink-50 text-ink-500 border-ink-100 border-y px-4 py-1 text-[10.5px] font-extrabold uppercase tracking-widest"
                >
                  {groupLabel}
                </td>
              </tr>
            )}
            {starterLines.map((l) => statRow(l, teamColor, l.playerId === topId, showMinutes))}
            {groupSet && benchLines.length > 0 && (
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
      return <p className="text-ink-500 px-4 py-6 text-center text-[13px]">Roster not submitted yet.</p>
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
                  <span className="text-ink-500 mr-1.5 font-normal">
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

  return (
    <div className="pb-10">
      {/* Sticky mini score chip (Yahoo pattern) — appears once the hero
          scrolls away; tapping it returns to the top. */}
      {chipVisible && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to the scoreboard"
          className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 px-4 py-2 text-white shadow-lg"
          style={{ background: "linear-gradient(120deg, var(--stage), var(--stage-2))" }}
        >
          {crest(game.homeTeamId, "h-6 w-6 text-[10px]", monogram(game.homeTeamName))}
          <span className="text-lg font-extrabold tabular-nums">
            <FlashNum value={homeScore} />
          </span>
          <span className="min-w-14 text-center text-[11.5px] font-extrabold uppercase tracking-widest text-white/80">
            {live ? `Live · ${periodLabel(fold.period)}` : final ? "Final" : "vs"}
          </span>
          <span className="text-lg font-extrabold tabular-nums">
            <FlashNum value={awayScore} />
          </span>
          {crest(game.awayTeamId, "h-6 w-6 text-[10px]", monogram(game.awayTeamName))}
        </button>
      )}

      {/* ---------- score hero: broadcast-dark stage (Energy Pass) ----------
          Owner spec 2026-07-15: each team stacks vertically (crest → name →
          record → score) so BOTH teams always fit at 390px (the old side-by-
          side layout clipped the away team), and the freed center column
          gives the quarter-by-quarter table real size. Winner reads in the
          highlight color; team colors stay content, never theme. */}
      <div
        ref={heroRef}
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

          <div className="mt-3 grid grid-cols-[minmax(84px,1fr)_auto_minmax(84px,1fr)] items-center gap-2 sm:gap-6 lg:mx-auto lg:max-w-3xl">
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
                  title={tname}
                >
                  {shortTeam(tname)}
                </Link>
                {rec && <p className="text-[12.5px] font-semibold text-white/75">{rec.record}</p>}
                <p
                  className={`font-condensed mt-0.5 text-6xl font-bold tabular-nums leading-none lg:text-7xl ${
                    final && score > other ? "text-highlight" : "text-white"
                  } ${final && score < other ? "text-white/60" : ""}`}
                >
                  <FlashNum value={score} />
                </p>
              </div>
            ))}

            {/* center: game state — the quarter table lives in the Game tab
                (owner 2026-07-15: not everyone needs it, and it crowded the
                hero). Ticking clock only when the league runs one. */}
            <div className="order-2 min-w-0 self-center text-center">
              {live && (
                <>
                  <span className="bg-live-600 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-extrabold uppercase tracking-[0.14em] text-white">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    Live
                  </span>
                  <p className="font-condensed mt-1.5 text-2xl font-bold text-white">
                    {periodLabel(fold.period)}
                  </p>
                  {clockOn && clockDisplay != null && (
                    <p className="text-highlight mt-0.5 text-lg font-extrabold tabular-nums">
                      {Math.floor(clockDisplay / 60)}:{String(clockDisplay % 60).padStart(2, "0")}
                    </p>
                  )}
                </>
              )}
              {final && (
                <span className="bg-energy text-energy-on rounded-full px-4 py-1.5 text-sm font-extrabold uppercase tracking-[0.18em]">
                  Final
                </span>
              )}
              {!live && !final && (
                <p className="text-sm font-bold text-white/80">
                  {new Date(game.scheduledAt).toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          </div>

          {game.venueName && (
            <p className="mt-2.5 text-center text-xs font-medium text-white/50">
              <VenueLink venueId={game.venueId} name={game.venueName} className="hover:text-white/80 hover:underline" />
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1760px] px-4 sm:px-6">
        {/* Scorekeeper entry: floating pill instead of a block banner (owner:
            the banner ate the top of the page while testing). Sits above the
            mobile bottom tabs; bottom corner on desktop. */}
        {canScore && !final && (
          <a
            href={`/games/${gameId}/score`}
            className="bg-energy text-energy-on fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-extrabold shadow-xl transition hover:brightness-110 lg:bottom-6"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            Score
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

        {/* ---------- Game | Stats | Plays (Yahoo pattern, phones) ---------- */}
        {hasAnyStats && (
          <>
            <div className="bg-ink-100 mt-3 flex rounded-xl p-1 lg:hidden">
              {(
                [
                  ["game", "Game"],
                  ["box", "Stats"],
                  ["plays", "Plays"],
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

            {/* Game tab: linescore + leaders + team stats (always on desktop) */}
            <div className={`mt-3 ${tab === "game" ? "block" : "hidden"} lg:block`}>
              {linescoreCard}
              <div className="grid grid-cols-1 items-start gap-x-4 lg:grid-cols-2">
                <div>
                  <h3 className="text-ink-950 mb-2 mt-5 px-1 text-[17px] font-extrabold uppercase tracking-[0.04em]">
                    Game leaders
                  </h3>
                  {leadersCard}
                </div>
                <div>
                  <h3 className="text-ink-950 mb-2 mt-5 px-1 text-[17px] font-extrabold uppercase tracking-[0.04em]">
                    Team stats
                  </h3>
                  {teamStatsCard}
                </div>
              </div>
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
                  <h3 className="text-ink-600 hidden flex-1 text-[11.5px] font-bold uppercase tracking-[0.14em] lg:block">
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
                  {visiblePlays.map(({ e, score, tail }, i) =>
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
                        <span className="min-w-0 flex-1">
                          {describe(e)}
                          {tail}
                        </span>
                        {score && (
                          <span className="text-ink-900 shrink-0 text-[11px] font-bold tabular-nums">
                            {score}
                          </span>
                        )}
                      </li>
                    )
                  )}
                  {visiblePlays.length === 0 && (
                    <li className="text-ink-500 px-4 py-6 text-center text-[13px]">No plays yet.</li>
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
