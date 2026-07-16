"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { foldEvents, FOUL_LIMIT, type FoldEvent, type FoldEventType } from "@/lib/scoring/fold"
import { SignaturePad } from "./signature-pad"

/**
 * The scoring console (docs/live-scoring-design.md).
 *
 * Two-tap grammar, both directions: action → player, or player → action.
 * Assist/rebound follow-up chains. Per-team sub panel with staged swaps.
 * Append-only local event log with an offline queue (localStorage) synced in
 * the background; undo voids. Tablet-landscape 3-column layout; stacks on
 * phones with the action pad at the bottom (thumb zone).
 */

interface RosterEntry {
  playerId: string
  name: string
  jerseyNumber: string | null
}

interface Bootstrap {
  game: {
    id: string
    status: string
    scheduledAt: string
    homeTeam: { id: string; name: string }
    awayTeam: { id: string; name: string }
    venueName: string | null
    leagueName: string | null
  }
  config: {
    statDepth: "SCORE_ONLY" | "STANDARD" | "FULL"
    gameClockMode: "SIMPLE" | "OFF"
    periodType: "QUARTERS" | "HALVES"
    periodMinutes: number
    requireRefereeApproval: boolean
  }
  rosters: { home: RosterEntry[]; away: RosterEntry[] }
  /** Players whose family RSVP'd Not going — pre-marked absent in roll call */
  rsvpAbsent?: { home: string[]; away: string[] }
  events: Array<FoldEvent & { clientEventId: string | null }>
  lock: { sessionId: string | null; user: string | null; at: string | null }
  referees: Array<{ userId: string; name: string; hasPin: boolean }>
  me: string
}

type QueuedEvent = FoldEvent & { clientEventId: string }

interface ChainPrompt {
  kind: "assist" | "rebound"
  shooterTeamId: string
  shooterId: string | null
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `ev-${Math.random().toString(36).slice(2)}-${Date.now()}`

function periodLabel(period: number, type: "QUARTERS" | "HALVES") {
  const regulation = type === "QUARTERS" ? 4 : 2
  if (period > regulation) return `OT${period - regulation}`
  return type === "QUARTERS" ? `Q${period}` : `H${period}`
}

function fmtClock(seconds: number) {
  const m = Math.floor(Math.max(0, seconds) / 60)
  const s = Math.max(0, seconds) % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

const EVENT_LABELS: Partial<Record<FoldEventType, string>> = {
  SCORE_2PT: "2PT",
  SCORE_3PT: "3PT",
  SCORE_FT: "FT",
  REBOUND: "REB",
  ASSIST: "AST",
  STEAL: "STL",
  BLOCK: "BLK",
  TURNOVER: "TO",
  FOUL: "FOUL",
  SUBSTITUTION: "SUB",
  PERIOD_START: "period start",
  PERIOD_END: "period end",
  CLOCK_START: "clock",
  CLOCK_STOP: "clock",
  LINEUP: "lineup",
}

export function ScoringConsole({
  gameId,
  canCorrect = false,
}: {
  gameId: string
  /** League owner / platform admin may reopen a COMPLETED game for corrections
   *  (the finalize API already permits their re-finalize — audit wave 2). */
  canCorrect?: boolean
}) {
  // Guest scorekeeper (2026-07-15): the one-time token from /score-guest
  // rides every scoring API call as a header; middleware + routes validate.
  const guestToken =
    typeof window !== "undefined" ? sessionStorage.getItem(`guestScoreToken:${gameId}`) : null
  const scoreFetch: typeof fetch = (input, init = {}) =>
    fetch(input, {
      ...init,
      headers: {
        ...((init.headers as Record<string, string>) ?? {}),
        ...(guestToken ? { "x-guest-score-token": guestToken } : {}),
      },
    })

  const [boot, setBoot] = useState<Bootstrap | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lockedOutBy, setLockedOutBy] = useState<string | null>(null)

  // Local source of truth: server events + everything appended locally
  const [events, setEvents] = useState<QueuedEvent[]>([])
  const [queue, setQueue] = useState<QueuedEvent[]>([])
  const [voidQueue, setVoidQueue] = useState<string[]>([])
  const [syncing, setSyncing] = useState(false)
  const seqRef = useRef(0)
  const sessionIdRef = useRef<string>("")

  // Two-tap state (either order)
  const [pendingAction, setPendingAction] = useState<{
    type: FoldEventType
    made?: boolean
    technical?: boolean
  } | null>(null)
  const [pendingPlayer, setPendingPlayer] = useState<{ playerId: string; teamId: string } | null>(
    null
  )
  const [chain, setChain] = useState<ChainPrompt | null>(null)
  const [subsFor, setSubsFor] = useState<string | null>(null)
  const [stagedSwaps, setStagedSwaps] = useState<Array<{ out: string; in: string }>>([])
  const [subOut, setSubOut] = useState<string | null>(null)
  const [starters, setStarters] = useState<{ home: string[]; away: string[] }>({
    home: [],
    away: [],
  })
  // Pre-game roll call: absent players can't start or sub in, show as
  // ABSENT on the sheet, and won't count a game played in season stats.
  const [pregameStep, setPregameStep] = useState<"attendance" | "starters">("attendance")
  const [absentees, setAbsentees] = useState<{ home: Set<string>; away: Set<string> }>({
    home: new Set(),
    away: new Set(),
  })
  const [finalizing, setFinalizing] = useState(false)
  const [finalized, setFinalized] = useState(false)
  // True while an owner/admin has reopened a COMPLETED game to fix the record.
  const [correcting, setCorrecting] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [showBox, setShowBox] = useState(false)
  // Manual clock correction (owner 2026-07-16): the table clock drifts from
  // the arena clock — let the scorekeeper set MM:SS at any stoppage.
  const [clockEdit, setClockEdit] = useState<{ min: string; sec: string } | null>(null)
  const [refereeName, setRefereeName] = useState("")
  const [refereeSignature, setRefereeSignature] = useState<string | null>(null)
  const [refereePin, setRefereePin] = useState("")
  const [refereeUserId, setRefereeUserId] = useState<string | null>(null)
  const [approvalMode, setApprovalMode] = useState<"sign" | "pin">("sign")
  const [finalizeError, setFinalizeError] = useState<string | null>(null)
  const [clockDisplay, setClockDisplay] = useState<number | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  // Phone player-area layout — a per-DEVICE preference (scorekeepers pick
  // what fits their hands/screen); persisted locally, more layouts welcome.
  const [mobileLayout, setMobileLayout] = useState<"rows" | "tiles">("rows")
  // Form factor by width AND height: a phone in landscape is 850px wide but
  // ~390px tall — width-only breakpoints hand it the desktop layout, which
  // can never fit. Short viewports always use the compact phone layout.
  const [isTable, setIsTable] = useState(false)
  const [isShort, setIsShort] = useState(false)
  const [fsSupported, setFsSupported] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("scoring-layout")
    if (saved === "rows" || saved === "tiles") setMobileLayout(saved)

    const tableQ = window.matchMedia("(min-width: 768px) and (min-height: 560px)")
    const shortQ = window.matchMedia("(max-height: 520px)")
    const apply = () => {
      setIsTable(tableQ.matches)
      setIsShort(shortQ.matches)
    }
    apply()
    tableQ.addEventListener("change", apply)
    shortQ.addEventListener("change", apply)

    const el = document.documentElement as any
    setFsSupported(!!(el.requestFullscreen || el.webkitRequestFullscreen))
    return () => {
      tableQ.removeEventListener("change", apply)
      shortQ.removeEventListener("change", apply)
    }
  }, [])
  const switchLayout = () => {
    const next = mobileLayout === "rows" ? "tiles" : "rows"
    setMobileLayout(next)
    localStorage.setItem("scoring-layout", next)
  }

  const storageKey = `scoring-queue-${gameId}`

  // ---------- bootstrap ----------
  useEffect(() => {
    let cancelled = false
    async function load() {
      const sessKey = `scoring-session-${gameId}`
      sessionIdRef.current = localStorage.getItem(sessKey) || uid()
      localStorage.setItem(sessKey, sessionIdRef.current)

      const res = await scoreFetch(`/api/games/${gameId}/scoring`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (!cancelled) {
          setError(
            res.status === 403
              ? "This account can't score this game. Scoring is open to the league owner and staff of the two competing clubs — sign in with one of those accounts."
              : res.status === 401
                ? "You're not signed in — sign in first, then reopen this page."
                : body.error || "Couldn't load the game"
          )
        }
        return
      }
      const data: Bootstrap = await res.json()
      if (cancelled) return

      // Restore any offline queue from a previous visit
      let restored: QueuedEvent[] = []
      try {
        restored = JSON.parse(localStorage.getItem(storageKey) || "[]")
      } catch {
        restored = []
      }
      const serverIds = new Set(data.events.map((e) => e.clientEventId))
      restored = restored.filter((e) => !serverIds.has(e.clientEventId))

      const all = [
        ...data.events.map((e) => ({ ...e, clientEventId: e.clientEventId ?? uid() })),
        ...restored,
      ]
      seqRef.current = all.reduce((m, e) => Math.max(m, e.sequence), 0)
      setEvents(all)
      setQueue(restored)
      setBoot(data)

      // Fresh roll call only: seed absentees from Not-going RSVPs. Once an
      // ATTENDANCE event exists (resumed game), the scorer's record wins.
      const hasAttendance = all.some((e) => e.eventType === "ATTENDANCE" && !e.voided)
      if (!hasAttendance && data.rsvpAbsent) {
        setAbsentees({
          home: new Set(data.rsvpAbsent.home),
          away: new Set(data.rsvpAbsent.away),
        })
      }

      // Lock: claim unless someone else actively holds it
      const lockRes = await scoreFetch(`/api/games/${gameId}/scoring/lock`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: sessionIdRef.current }),
      })
      if (lockRes.status === 409) {
        const body = await lockRes.json().catch(() => ({}))
        if (!cancelled) setLockedOutBy(body.holder || "another device")
      }
      if (data.game.status === "COMPLETED") setFinalized(true)
    }
    load().catch(() => setError("Couldn't load the game"))
    return () => {
      cancelled = true
    }
  }, [gameId, storageKey])

  // ---------- fold ----------
  const ctx = useMemo(
    () =>
      boot
        ? { homeTeamId: boot.game.homeTeam.id, awayTeamId: boot.game.awayTeam.id }
        : { homeTeamId: "", awayTeamId: "" },
    [boot]
  )
  const fold = useMemo(() => foldEvents(events, ctx), [events, ctx])
  const started = fold.playByPlay.some((e) => e.eventType === "PERIOD_START")

  // ---------- offline queue persistence + sync ----------
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(queue))
  }, [queue, storageKey])

  const syncTick = useCallback(async () => {
    if (syncing) return
    if (queue.length === 0 && voidQueue.length === 0) return
    setSyncing(true)
    try {
      if (queue.length > 0) {
        const res = await scoreFetch(`/api/games/${gameId}/events`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
            events: queue.map((e) => ({
              clientEventId: e.clientEventId,
              eventType: e.eventType,
              teamId: e.teamId,
              playerId: e.playerId,
              made: e.made,
              period: e.period,
              clockSeconds: e.clockSeconds,
              timestampMs: e.timestampMs,
              metadata: e.metadata ?? undefined,
            })),
          }),
        })
        if (res.ok) {
          const sent = new Set(queue.map((e) => e.clientEventId))
          setQueue((q) => q.filter((e) => !sent.has(e.clientEventId)))
        } else if (res.status === 409) {
          // Another device took the lock — every append was bouncing
          // SILENTLY while this screen showed its local reality and the
          // public page showed the server's (owner-reported desync).
          // Surface the takeover screen; the queue is kept and flushes
          // after "Take over" reclaims the session.
          const body = await res.json().catch(() => ({}))
          setLockedOutBy(body.holder || "another device")
        }
      }
      if (voidQueue.length > 0) {
        const res = await scoreFetch(`/api/games/${gameId}/events`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
            clientEventIds: voidQueue,
            voided: true,
          }),
        })
        if (res.ok) setVoidQueue([])
      }
    } catch {
      // offline — retry next tick
    } finally {
      setSyncing(false)
    }
  }, [gameId, queue, voidQueue, syncing])

  useEffect(() => {
    const t = setInterval(syncTick, 4000)
    return () => clearInterval(t)
  }, [syncTick])

  // Lock heartbeat
  useEffect(() => {
    if (lockedOutBy) return
    const t = setInterval(() => {
      scoreFetch(`/api/games/${gameId}/scoring/lock`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: sessionIdRef.current }),
      })
        .then(async (res) => {
          if (res.status === 409) {
            const body = await res.json().catch(() => ({}))
            setLockedOutBy(body.holder || "another device")
          }
        })
        .catch(() => {})
    }, 60_000)
    return () => clearInterval(t)
  }, [gameId, lockedOutBy])

  // Browser fullscreen (webkit fallbacks for iPad Safari)
  useEffect(() => {
    const onChange = () =>
      setIsFullscreen(!!(document.fullscreenElement ?? (document as any).webkitFullscreenElement))
    document.addEventListener("fullscreenchange", onChange)
    document.addEventListener("webkitfullscreenchange", onChange)
    return () => {
      document.removeEventListener("fullscreenchange", onChange)
      document.removeEventListener("webkitfullscreenchange", onChange)
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    const el = document.documentElement as any
    const doc = document as any
    const inFullscreen = !!(document.fullscreenElement ?? doc.webkitFullscreenElement)
    // Trust EITHER signal — some mobile browsers enter fullscreen without
    // reporting fullscreenElement, which made exit look impossible.
    if (inFullscreen || isFullscreen) {
      ;(document.exitFullscreen ?? doc.webkitExitFullscreen)?.call(document)
      setIsFullscreen(false)
    } else {
      ;(el.requestFullscreen ?? el.webkitRequestFullscreen)?.call(el)
      setIsFullscreen(true)
    }
  }, [isFullscreen])

  // Clock display tick
  useEffect(() => {
    if (!boot || boot.config.gameClockMode !== "SIMPLE") return
    const base = fold.clockSecondsAtLastEvent
    if (!fold.clockRunning) {
      setClockDisplay(base)
      return
    }
    const startedAt = Date.now()
    const t = setInterval(() => {
      if (base != null) {
        setClockDisplay(Math.max(0, base - Math.round((Date.now() - startedAt) / 1000)))
      }
    }, 500)
    return () => clearInterval(t)
  }, [boot, fold.clockRunning, fold.clockSecondsAtLastEvent])

  // ---------- event append ----------
  const append = useCallback(
    (
      type: FoldEventType,
      fields: Partial<QueuedEvent> = {}
    ): QueuedEvent => {
      const e: QueuedEvent = {
        clientEventId: uid(),
        eventType: type,
        sequence: ++seqRef.current,
        period: fold.period,
        clockSeconds: clockDisplay ?? undefined,
        timestampMs: Date.now(),
        ...fields,
      } as QueuedEvent
      setEvents((prev) => [...prev, e])
      setQueue((prev) => [...prev, e])
      return e
    },
    [fold.period, clockDisplay]
  )

  const voidEvent = useCallback(
    (clientEventId: string) => {
      setEvents((prev) =>
        prev.map((e) => (e.clientEventId === clientEventId ? { ...e, voided: true } : e))
      )
      setQueue((prev) => {
        // If it never left the device, drop it entirely
        const inQueue = prev.some((e) => e.clientEventId === clientEventId)
        if (inQueue) return prev.filter((e) => e.clientEventId !== clientEventId)
        setVoidQueue((v) => [...v, clientEventId])
        return prev
      })
      setChain(null)
    },
    []
  )

  // ---------- two-tap commit ----------
  const commit = useCallback(
    (
      action: { type: FoldEventType; made?: boolean; technical?: boolean },
      playerId: string,
      teamId: string
    ) => {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10)
      if (action.type === "REBOUND") {
        append("REBOUND", { teamId, playerId, metadata: { offensive: false } })
      } else if (action.type === "FOUL" && action.technical) {
        append("FOUL", { teamId, playerId, metadata: { technical: true } })
      } else {
        append(action.type, { teamId, playerId, made: action.made })
      }
      setPendingAction(null)
      setPendingPlayer(null)

      const isShot = ["SCORE_2PT", "SCORE_3PT"].includes(action.type)
      if (isShot && action.made) {
        setChain({ kind: "assist", shooterTeamId: teamId, shooterId: playerId })
      } else if (isShot && action.made === false) {
        setChain({ kind: "rebound", shooterTeamId: teamId, shooterId: playerId })
      } else {
        setChain(null)
      }
    },
    [append]
  )

  const tapAction = (type: FoldEventType, made?: boolean, technical?: boolean) => {
    setChain(null)
    if (pendingPlayer) {
      commit({ type, made, technical }, pendingPlayer.playerId, pendingPlayer.teamId)
    } else {
      setPendingAction((cur) =>
        cur?.type === type && cur?.made === made && cur?.technical === technical
          ? null
          : { type, made, technical }
      )
    }
  }

  /** Taps on the chain toast's own buttons — records the assist/rebound. */
  const chainPick = (playerId: string, teamId: string) => {
    if (!chain) return
    if (chain.kind === "assist") {
      if (teamId === chain.shooterTeamId && playerId !== chain.shooterId) {
        append("ASSIST", { teamId, playerId })
      }
    } else {
      append("REBOUND", {
        teamId,
        playerId,
        metadata: { offensive: teamId === chain.shooterTeamId },
      })
    }
    setChain(null)
  }

  const openClockEdit = () => {
    const secs = clockDisplay ?? config.periodMinutes * 60
    setClockEdit({ min: String(Math.floor(secs / 60)), sec: String(secs % 60).padStart(2, "0") })
  }

  const applyClockEdit = () => {
    if (!clockEdit) return
    const min = Math.max(0, Math.min(99, parseInt(clockEdit.min || "0", 10) || 0))
    const sec = Math.max(0, Math.min(59, parseInt(clockEdit.sec || "0", 10) || 0))
    const total = min * 60 + sec
    // One corrective event keeps the run/pause state: a running clock restarts
    // from the corrected value, a paused clock just re-bases.
    if (fold.clockRunning) {
      append("CLOCK_START", { clockSeconds: total })
    } else {
      append("CLOCK_STOP", { clockSeconds: total })
    }
    setClockDisplay(total)
    setClockEdit(null)
  }

  /** Taps on the main on-floor tiles — ALWAYS selection. An open chain toast
   *  is optional by design: tapping a tile dismisses it and selects. */
  const tapPlayer = (playerId: string, teamId: string) => {
    if (chain) setChain(null)
    if (pendingAction) {
      commit(pendingAction, playerId, teamId)
    } else {
      setPendingPlayer((cur) =>
        cur?.playerId === playerId ? null : { playerId, teamId }
      )
    }
  }

  // ---------- derived helpers ----------
  if (error) {
    return <div className="p-8 text-center text-sm text-hoop-700">{error}</div>
  }
  if (!boot) {
    return <div className="p-8 text-center text-sm text-ink-500">Loading game…</div>
  }

  const { game, config, rosters } = boot
  const regulationPeriods = config.periodType === "QUARTERS" ? 4 : 2
  const rosterById = new Map<string, RosterEntry>()
  for (const r of [...rosters.home, ...rosters.away]) rosterById.set(r.playerId, r)
  const nameOf = (pid?: string | null) => (pid && rosterById.get(pid)?.name) || "—"
  const jerseyOf = (pid: string) => rosterById.get(pid)?.jerseyNumber ?? "?"

  const depth = config.statDepth
  const showMisses = depth !== "SCORE_ONLY"
  const showHustle = depth === "FULL"

  // ---------- locked out ----------
  if (lockedOutBy) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h2 className="text-ink-900 text-lg font-semibold">Game is being scored elsewhere</h2>
        <p className="text-ink-500 mt-2 text-sm">
          {lockedOutBy} is currently scoring this game on another device.
        </p>
        <button
          onClick={async () => {
            const res = await scoreFetch(`/api/games/${gameId}/scoring/lock`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ sessionId: sessionIdRef.current, takeover: true }),
            })
            if (res.ok) setLockedOutBy(null)
          }}
          className="bg-hoop-600 hover:bg-hoop-700 mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-white"
        >
          Take over scoring on this device
        </button>
      </div>
    )
  }

  // ---------- finalized ----------
  if (finalized) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <h2 className="text-ink-900 text-xl font-bold">Final</h2>
        <p className="text-ink-900 mt-2 text-3xl font-bold">
          {game.homeTeam.name} {fold.homeScore} — {fold.awayScore} {game.awayTeam.name}
        </p>
        <div className="mt-4 flex justify-center gap-4">
          <a
            href={`/scoresheet/${gameId}`}
            className="text-play-600 text-sm font-semibold hover:underline"
          >
            Official scoresheet (print) →
          </a>
          <a href={`/live/${gameId}`} className="text-play-600 text-sm font-semibold hover:underline">
            Public box score →
          </a>
        </div>
        {canCorrect && (
          <div className="mt-8">
            <button
              onClick={() => {
                if (
                  !window.confirm(
                    "Reopen this finalized game for corrections? Use Mark final again to republish the result."
                  )
                )
                  return
                setCorrecting(true)
                setFinalized(false)
              }}
              className="border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Correct result
            </button>
            <p className="text-ink-400 mt-2 text-xs">
              League owner correction — the record stays official until you re-finalize.
            </p>
          </div>
        )}
      </div>
    )
  }

  // ---------- pre-game: attendance, then starting fives ----------
  if (!started && pregameStep === "attendance") {
    const rollCall = (roster: RosterEntry[], key: "home" | "away") => (
      <div className="flex-1 rounded-xl border border-ink-200 bg-white p-4">
        <h3 className="text-ink-900 text-sm font-semibold">
          {key === "home" ? game.homeTeam.name : game.awayTeam.name}
          <span className="text-ink-400 ml-2 text-xs">
            {roster.length - absentees[key].size} here · {absentees[key].size} absent
          </span>
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {roster.map((p) => {
            const absent = absentees[key].has(p.playerId)
            return (
              <button
                key={p.playerId}
                onClick={() =>
                  setAbsentees((prev) => {
                    const set = new Set(prev[key])
                    absent ? set.delete(p.playerId) : set.add(p.playerId)
                    return { ...prev, [key]: set }
                  })
                }
                className={`rounded-lg border p-2 text-left text-xs ${
                  absent
                    ? "border-hoop-300 bg-hoop-50 text-hoop-700 line-through"
                    : "border-court-300 bg-court-50 text-ink-800"
                }`}
              >
                <span className="text-base font-bold">#{p.jerseyNumber ?? "?"}</span>
                <span className="ml-1.5">{p.name}</span>
                <span className="block pl-0.5 text-[9px] font-semibold uppercase">
                  {absent ? "absent" : "present"}
                </span>
              </button>
            )
          })}
          {roster.length === 0 && (
            <p className="text-ink-500 col-span-3 text-xs">No roster found for this team.</p>
          )}
        </div>
      </div>
    )
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-4">
        <div>
          <h2 className="text-ink-950 text-lg font-bold">
            Attendance — {game.homeTeam.name} vs {game.awayTeam.name}
          </h2>
          <p className="text-ink-500 text-xs">
            Everyone starts as present — tap whoever is missing. Absent players show on the
            scoresheet and don&apos;t count a game played in their season stats.
            {absentees.home.size + absentees.away.size > 0 &&
              " Players whose family said “Not going” are pre-marked — tap to correct."}
          </p>
        </div>
        <div className="flex flex-col gap-4 md:flex-row">
          {rollCall(rosters.home, "home")}
          {rollCall(rosters.away, "away")}
        </div>
        <button
          onClick={() => setPregameStep("starters")}
          className="bg-play-600 hover:bg-play-700 w-full rounded-xl px-4 py-3 text-sm font-bold text-white"
        >
          Continue to starting lineups →
        </button>
      </div>
    )
  }

  if (!started) {
    const pickList = (teamId: string, roster: RosterEntry[], key: "home" | "away") => (
      <div className="flex-1 rounded-xl border border-ink-200 bg-white p-4">
        <h3 className="text-ink-900 text-sm font-semibold">
          {key === "home" ? game.homeTeam.name : game.awayTeam.name}
          <span className="text-ink-400 ml-2 text-xs">
            starting five: {starters[key].length}/5
          </span>
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {roster.map((p) => {
            const on = starters[key].includes(p.playerId)
            return (
              <button
                key={p.playerId}
                onClick={() =>
                  setStarters((prev) => {
                    const cur = prev[key]
                    const next = on
                      ? cur.filter((x) => x !== p.playerId)
                      : cur.length < 5
                        ? [...cur, p.playerId]
                        : cur
                    return { ...prev, [key]: next }
                  })
                }
                className={`rounded-lg border p-2 text-left text-xs ${
                  on
                    ? "border-play-400 bg-play-50 text-play-800"
                    : "border-ink-200 text-ink-700 hover:bg-ink-50"
                }`}
              >
                <span className="text-base font-bold">#{p.jerseyNumber ?? "?"}</span>
                <span className="ml-1.5">{p.name}</span>
              </button>
            )
          })}
          {roster.length === 0 && (
            <p className="text-ink-500 col-span-3 text-xs">No roster found for this team.</p>
          )}
        </div>
      </div>
    )

    return (
      <div className="mx-auto max-w-5xl space-y-4 p-4">
        <div>
          <h2 className="text-ink-950 text-lg font-bold">
            {game.homeTeam.name} vs {game.awayTeam.name}
          </h2>
          <p className="text-ink-500 text-xs">
            {game.leagueName ?? ""}{game.venueName ? ` · ${game.venueName}` : ""} · pick each
            starting five, then start the game
          </p>
        </div>
        <div className="flex flex-col gap-4 md:flex-row">
          {pickList(
            game.homeTeam.id,
            rosters.home.filter((p) => !absentees.home.has(p.playerId)),
            "home"
          )}
          {pickList(
            game.awayTeam.id,
            rosters.away.filter((p) => !absentees.away.has(p.playerId)),
            "away"
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setPregameStep("attendance")}
            className="border-ink-200 text-ink-700 hover:bg-ink-50 rounded-xl border px-4 py-3 text-sm font-semibold"
          >
            ← Attendance
          </button>
          <button
            disabled={starters.home.length !== 5 || starters.away.length !== 5}
            onClick={() => {
              for (const side of ["home", "away"] as const) {
                const teamId = side === "home" ? game.homeTeam.id : game.awayTeam.id
                const roster = side === "home" ? rosters.home : rosters.away
                append("ATTENDANCE", {
                  teamId,
                  metadata: {
                    presentIds: roster
                      .map((p) => p.playerId)
                      .filter((id) => !absentees[side].has(id)),
                    absentIds: Array.from(absentees[side]),
                  },
                })
              }
              append("LINEUP", { teamId: game.homeTeam.id, metadata: { playerIds: starters.home } })
              append("LINEUP", { teamId: game.awayTeam.id, metadata: { playerIds: starters.away } })
              append("PERIOD_START", { period: 1 })
            }}
            className="bg-court-600 hover:bg-court-700 flex-1 rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            Start game
          </button>
        </div>
        <p className="text-ink-400 text-center text-xs">
          Fewer than 5 marked players? Tap the ones who are here — you can fix lineups with SUBS
          any time.
        </p>
      </div>
    )
  }

  // Shared box-score table — used by the review screen AND the in-game
  // BOX overlay ("how many fouls does #23 have?" without leaving the page).
  const boxTable = (teamId: string, label: string) => {
    const lines = Object.values(fold.players)
      .filter((l) => l.teamId === teamId)
      .sort((a, b) => b.points - a.points)
    return (
      <div className="flex-1 overflow-x-auto rounded-xl border border-ink-200 bg-white p-3">
        <h3 className="text-ink-900 mb-2 text-sm font-semibold">{label}</h3>
        <table className="w-full text-xs">
          <thead className="text-ink-400 text-left text-[10px] uppercase">
            <tr>
              <th className="py-1 pr-2">Player</th>
              <th className="px-1 text-right">PTS</th>
              <th className="px-1 text-right">REB</th>
              <th className="px-1 text-right">AST</th>
              <th className="px-1 text-right">PF</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.playerId} className="border-ink-100 border-t">
                <td className="py-1 pr-2">
                  #{jerseyOf(l.playerId)} {nameOf(l.playerId)}
                  {l.onFloor ? <span className="text-court-600"> ●</span> : null}
                </td>
                <td className="px-1 text-right font-semibold">{l.points}</td>
                <td className="px-1 text-right">{l.offRebounds + l.defRebounds}</td>
                <td className="px-1 text-right">{l.assists}</td>
                <td className={`px-1 text-right ${l.fouls >= FOUL_LIMIT - 1 ? "text-hoop-700 font-bold" : ""}`}>
                  {l.fouls}
                  {l.technicalFouls > 0 ? ` (T${l.technicalFouls})` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // ---------- review / finalize ----------
  if (reviewing) {
    const pinReferees = boot.referees.filter((r) => r.hasPin)
    const pinReady = !!refereeUserId && refereePin.length >= 4
    const hasApproval =
      (approvalMode === "pin" && pinReady) ||
      (approvalMode === "sign" && (!!refereeSignature || refereeName.trim().length >= 2))
    const needsReferee = config.requireRefereeApproval && !hasApproval
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-4">
        <h2 className="text-ink-950 text-center text-lg font-bold">
          Review: {game.homeTeam.name} {fold.homeScore} — {fold.awayScore} {game.awayTeam.name}
        </h2>
        <div className="flex flex-col gap-4 md:flex-row">
          {boxTable(game.homeTeam.id, game.homeTeam.name)}
          {boxTable(game.awayTeam.id, game.awayTeam.name)}
        </div>

        <div className="border-amber-300 bg-amber-50 rounded-xl border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-amber-800 text-xs font-semibold">
              Referee approval
              {config.requireRefereeApproval ? " (required by this league)" : " (optional)"}
            </p>
            {pinReferees.length > 0 && (
              <div className="flex rounded-lg bg-white p-0.5">
                {(
                  [
                    ["sign", "Signature"],
                    ["pin", "Referee PIN"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    onClick={() => setApprovalMode(mode)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                      approvalMode === mode ? "bg-amber-100 text-amber-900" : "text-ink-500"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {approvalMode === "pin" && pinReferees.length > 0 ? (
            <div className="mt-2 space-y-2">
              <p className="text-ink-600 text-xs">
                The assigned referee enters their personal PIN — verified against their account,
                the strongest form of approval.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {pinReferees.map((r) => (
                  <button
                    key={r.userId}
                    onClick={() => setRefereeUserId(r.userId)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                      refereeUserId === r.userId
                        ? "border-amber-500 bg-amber-100 text-amber-900"
                        : "border-ink-200 bg-white text-ink-700"
                    }`}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
              <input
                type="password"
                inputMode="numeric"
                value={refereePin}
                onChange={(e) => setRefereePin(e.target.value)}
                placeholder="Referee PIN"
                className="border-amber-300 w-full rounded-lg border bg-white px-3 py-2 text-sm"
              />
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              <SignaturePad onChange={setRefereeSignature} />
              <input
                type="text"
                value={refereeName}
                onChange={(e) => setRefereeName(e.target.value)}
                placeholder="Referee's printed name (optional with a signature)"
                className="border-amber-300 w-full rounded-lg border bg-white px-3 py-2 text-sm"
              />
            </div>
          )}

          {config.requireRefereeApproval && needsReferee && (
              <button
                disabled={finalizing}
                onClick={async () => {
                  if (
                    !confirm(
                      "Finalize WITHOUT referee approval? The scoresheet will be clearly stamped as not approved by the referee."
                    )
                  )
                    return
                  setFinalizing(true)
                  setFinalizeError(null)
                  await syncTick()
                  for (let i = 0; i < 10; i++) {
                    if (queue.length === 0 && voidQueue.length === 0) break
                    await new Promise((r) => setTimeout(r, 800))
                    await syncTick()
                  }
                  const res = await scoreFetch(`/api/games/${gameId}/finalize`, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ withoutReferee: true }),
                  })
                  setFinalizing(false)
                  if (res.ok) setFinalized(true)
                  else {
                    const body = await res.json().catch(() => ({}))
                    setFinalizeError(body.error || "Couldn't finalize the game")
                  }
                }}
                className="text-amber-700 mt-2 text-xs underline hover:text-amber-900"
              >
                Referee unavailable? Finalize without approval (stamped on the sheet)
              </button>
            )}
          </div>
        {finalizeError && (
          <p className="border-hoop-200 bg-hoop-50 text-hoop-700 rounded-xl border p-3 text-sm">
            {finalizeError}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => setReviewing(false)}
            className="border-ink-200 text-ink-700 hover:bg-ink-50 flex-1 rounded-xl border px-4 py-3 text-sm font-semibold"
          >
            ← Back to scoring
          </button>
          <button
            disabled={finalizing || needsReferee}
            title={needsReferee ? "The referee must sign off first" : ""}
            onClick={async () => {
              setFinalizing(true)
              setFinalizeError(null)
              await syncTick()
              // ensure queue fully flushed before finalizing
              for (let i = 0; i < 10; i++) {
                if (queue.length === 0 && voidQueue.length === 0) break
                await new Promise((r) => setTimeout(r, 800))
                await syncTick()
              }
              const payload: Record<string, unknown> = {}
              if (approvalMode === "pin" && refereeUserId && refereePin) {
                payload.refereeUserId = refereeUserId
                payload.refereePin = refereePin
              } else {
                if (refereeName.trim()) payload.refereeName = refereeName.trim()
                if (refereeSignature) payload.refereeSignature = refereeSignature
              }
              const res = await scoreFetch(`/api/games/${gameId}/finalize`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(payload),
              })
              setFinalizing(false)
              if (res.ok) {
                setFinalized(true)
              } else {
                const body = await res.json().catch(() => ({}))
                setFinalizeError(body.error || "Couldn't finalize the game")
              }
            }}
            className="bg-court-600 hover:bg-court-700 flex-1 rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {finalizing ? "Finalizing…" : "Mark final"}
          </button>
        </div>
      </div>
    )
  }

  // ---------- live scoring ----------
  const lastThree = [...fold.playByPlay]
    .filter((e) => !["LINEUP", "CLOCK_START", "CLOCK_STOP"].includes(e.eventType))
    .slice(-3)
    .reverse()

  const floorTiles = (teamId: string, side: "home" | "away") => {
    const ids = side === "home" ? fold.onFloor.home : fold.onFloor.away
    const bench = (side === "home" ? rosters.home : rosters.away).filter(
      (r) => !ids.includes(r.playerId)
    )
    return (
      <div className="flex flex-col gap-1.5">
        {ids.map((pid) => {
          const line = fold.players[pid]
          const selected = pendingPlayer?.playerId === pid
          return (
            <button
              key={pid}
              onClick={() => tapPlayer(pid, teamId)}
              className={`rounded-xl border p-2 text-left transition ${
                selected
                  ? "border-play-500 bg-play-100"
                  : pendingAction
                    ? "border-play-300 bg-white animate-pulse"
                    : "border-ink-200 bg-white"
              } ${line?.fouledOut ? "opacity-40" : ""}`}
              disabled={line?.fouledOut}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-ink-950 text-xl font-bold">#{jerseyOf(pid)}</span>
                <span className="text-ink-400 text-[10px]">
                  {"•".repeat(Math.min(line?.fouls ?? 0, FOUL_LIMIT))}
                </span>
              </div>
              <div className="text-ink-600 truncate text-[11px]">{nameOf(pid)}</div>
            </button>
          )
        })}
        <button
          onClick={() => {
            setSubsFor(teamId)
            setStagedSwaps([])
            setSubOut(null)
          }}
          className="border-ink-300 text-ink-600 hover:bg-ink-50 mt-1 rounded-xl border border-dashed px-2 py-1.5 text-xs font-semibold"
        >
          SUBS ⇄ ({bench.length} on bench)
        </button>
      </div>
    )
  }

  const actionBtn = (
    label: string,
    type: FoldEventType,
    made: boolean | undefined,
    tone: string,
    technical?: boolean
  ) => {
    const active =
      pendingAction?.type === type &&
      pendingAction?.made === made &&
      pendingAction?.technical === technical
    return (
      <button
        onClick={() => tapAction(type, made, technical)}
        className={`min-w-0 flex-1 rounded-xl px-1 py-3 text-sm font-bold transition max-md:py-2.5 [@media(max-height:520px)]:py-1.5 ${
          active ? "ring-play-500 ring-2 " : ""
        }${tone}`}
      >
        {label}
      </button>
    )
  }

  const subsTeamId = subsFor
  const subsRoster = subsTeamId === game.homeTeam.id ? rosters.home : rosters.away
  const subsOnFloor = subsTeamId === game.homeTeam.id ? fold.onFloor.home : fold.onFloor.away

  // Phone layout: a team's five as ONE row of jersey chips (numbers only —
  // names live in the subs sheet). Collapses ~300px of tiles into ~110px so
  // the whole console fits a phone screen without scrolling.
  const chipRow = (teamId: string, side: "home" | "away") => {
    const ids = side === "home" ? fold.onFloor.home : fold.onFloor.away
    const accent = side === "home" ? "border-b-play-400" : "border-b-court-400"
    const subsTone =
      side === "home"
        ? "border-play-300 text-play-700 hover:bg-play-50"
        : "border-court-300 text-court-700 hover:bg-court-50"
    return (
      <div className="flex items-stretch gap-1.5">
        <button
          onClick={() => {
            setSubsFor(teamId)
            setStagedSwaps([])
            setSubOut(null)
          }}
          aria-label={`Substitutions — ${side === "home" ? game.homeTeam.name : game.awayTeam.name}`}
          className={`w-11 shrink-0 rounded-xl border-2 border-dashed text-base font-bold ${subsTone}`}
        >
          ⇄
        </button>
        {ids.map((pid) => {
          const line = fold.players[pid]
          const selected = pendingPlayer?.playerId === pid
          return (
            <button
              key={pid}
              onClick={() => tapPlayer(pid, teamId)}
              disabled={line?.fouledOut}
              className={`relative h-12 min-w-0 flex-1 rounded-xl border border-b-4 bg-white text-lg font-bold text-ink-950 [@media(max-height:520px)]:h-10 ${accent} ${
                selected
                  ? "border-play-500 bg-play-100"
                  : pendingAction
                    ? "border-play-300 animate-pulse"
                    : "border-ink-200"
              } ${line?.fouledOut ? "opacity-40" : ""}`}
            >
              {jerseyOf(pid)}
              <span className="text-ink-400 absolute right-1 top-0 text-[8px]">
                {"•".repeat(Math.min(line?.fouls ?? 0, FOUL_LIMIT))}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  const actionPad = (
    <div className="sticky bottom-2 rounded-2xl border border-ink-200 bg-white p-2 shadow-sm">
      {/* Status strip: FIXED height, content swaps — never inserts.
          Hosts the idle hint, the two-tap hint, or the chain prompt. */}
      <div className="mb-1.5 flex min-h-[52px] items-center justify-center gap-2 overflow-x-auto px-1 max-md:min-h-[46px] [@media(max-height:520px)]:min-h-[40px]">
        {chain && chain.kind === "assist" ? (
          <>
            <span className="text-play-800 whitespace-nowrap text-xs font-semibold">
              Assist by?
            </span>
            {(chain.shooterTeamId === game.homeTeam.id
              ? fold.onFloor.home
              : fold.onFloor.away
            )
              .filter((pid) => pid !== chain.shooterId)
              .map((pid) => {
              const teamId = fold.onFloor.home.includes(pid)
                ? game.homeTeam.id
                : game.awayTeam.id
              return (
                <button
                  key={pid}
                  onClick={() => chainPick(pid, teamId)}
                  className={`min-h-[44px] min-w-[44px] shrink-0 rounded-lg border bg-white text-sm font-bold ${
                    teamId === game.homeTeam.id
                      ? "border-play-300 text-play-800 hover:bg-play-50"
                      : "border-court-300 text-court-800 hover:bg-court-50"
                  }`}
                >
                  #{jerseyOf(pid)}
                </button>
              )
            })}
            <button
              onClick={() => setChain(null)}
              className="text-ink-500 min-h-[44px] whitespace-nowrap px-2 text-xs hover:underline"
            >
              skip
            </button>
          </>
        ) : pendingAction ? (
          <p className="text-play-700 text-xs font-semibold">
            {EVENT_LABELS[pendingAction.type]}
            {pendingAction.made === false ? " miss" : ""} — now tap the player
          </p>
        ) : pendingPlayer ? (
          <p className="text-play-700 text-xs font-semibold">
            #{jerseyOf(pendingPlayer.playerId)} — now tap an action
          </p>
        ) : (
          <p className="text-ink-400 text-xs">
            Tap an action, then a player — either order works
          </p>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1.5 [@media(max-height:520px)]:grid-cols-6">
        {actionBtn("+2", "SCORE_2PT", true, "bg-court-600 text-white hover:bg-court-700")}
        {actionBtn("+3", "SCORE_3PT", true, "bg-court-600 text-white hover:bg-court-700")}
        {actionBtn("FT ✓", "SCORE_FT", true, "bg-court-500 text-white hover:bg-court-600")}
        {showMisses && (
          <>
            {actionBtn("2 ✗", "SCORE_2PT", false, "bg-ink-100 text-ink-700 hover:bg-ink-200")}
            {actionBtn("3 ✗", "SCORE_3PT", false, "bg-ink-100 text-ink-700 hover:bg-ink-200")}
            {actionBtn("FT ✗", "SCORE_FT", false, "bg-ink-100 text-ink-700 hover:bg-ink-200")}
          </>
        )}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {showMisses && (
          <>
            {actionBtn("REB", "REBOUND", undefined, "bg-play-50 text-play-700 hover:bg-play-100")}
            {actionBtn("AST", "ASSIST", undefined, "bg-play-50 text-play-700 hover:bg-play-100")}
          </>
        )}
        {showHustle && (
          <>
            {actionBtn("STL", "STEAL", undefined, "bg-play-50 text-play-700 hover:bg-play-100")}
            {actionBtn("BLK", "BLOCK", undefined, "bg-play-50 text-play-700 hover:bg-play-100")}
            {actionBtn("TO", "TURNOVER", undefined, "bg-play-50 text-play-700 hover:bg-play-100")}
          </>
        )}
        {actionBtn("FOUL", "FOUL", undefined, "bg-amber-100 text-amber-800 hover:bg-amber-200")}
        {showHustle &&
          actionBtn("TECH", "FOUL", undefined, "bg-hoop-50 text-hoop-700 hover:bg-hoop-100", true)}
      </div>
    </div>
  )

  // Alternative phone layout: the classic two tile columns, compacted to
  // h-10 rows (number + last name) so it also fits one screen.
  const compactColumn = (teamId: string, side: "home" | "away") => {
    const ids = side === "home" ? fold.onFloor.home : fold.onFloor.away
    const subsTone =
      side === "home"
        ? "border-play-300 text-play-700 hover:bg-play-50"
        : "border-court-300 text-court-700 hover:bg-court-50"
    const accent = side === "home" ? "border-l-play-400" : "border-l-court-400"
    return (
      <div className="space-y-1">
        <button
          onClick={() => {
            setSubsFor(teamId)
            setStagedSwaps([])
            setSubOut(null)
          }}
          className={`w-full rounded-lg border border-dashed py-1 text-[11px] font-semibold ${subsTone}`}
        >
          ⇄ {side === "home" ? game.homeTeam.name : game.awayTeam.name}
        </button>
        {ids.map((pid) => {
          const line = fold.players[pid]
          const selected = pendingPlayer?.playerId === pid
          return (
            <button
              key={pid}
              onClick={() => tapPlayer(pid, teamId)}
              disabled={line?.fouledOut}
              className={`flex h-[54px] w-full flex-col justify-center rounded-lg border border-l-4 bg-white px-2.5 text-left ${accent} ${
                selected
                  ? "border-play-500 bg-play-100"
                  : pendingAction
                    ? "border-play-300 animate-pulse"
                    : "border-ink-200"
              } ${line?.fouledOut ? "opacity-40" : ""}`}
            >
              <span className="flex w-full items-baseline justify-between">
                <span className="text-ink-950 text-base font-extrabold leading-tight">
                  #{jerseyOf(pid)}
                </span>
                <span className="text-ink-400 text-[9px]">
                  {"•".repeat(Math.min(line?.fouls ?? 0, FOUL_LIMIT))}
                </span>
              </span>
              <span className="text-ink-600 w-full truncate text-[11.5px] font-medium leading-tight">
                {nameOf(pid)}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl p-3 max-md:p-2">
      {correcting && (
        <div className="border-amber-300 bg-amber-50 text-amber-800 mb-2 rounded-xl border px-3 py-2 text-xs font-semibold">
          Correcting a finalized game — <span className="font-bold">Mark final</span> again to
          republish the result.
        </div>
      )}
      {/* header */}
      <div className="rounded-2xl border border-ink-200 bg-white p-3 max-md:p-2.5">
        {isShort ? (
          /* Landscape phones: ONE-line bar — every vertical pixel matters */
          <div className="flex items-center gap-2">
            <span className="bg-play-400 h-2 w-2 shrink-0 rounded-full" />
            <span className="text-ink-950 text-xl font-bold">{fold.homeScore}</span>
            <span className="text-ink-500 max-w-[90px] truncate text-[10px]">
              {game.homeTeam.name}
            </span>
            <div className="mx-auto flex shrink-0 items-center gap-1.5">
              <span className="text-ink-900 text-xs font-bold">
                {periodLabel(fold.period, config.periodType)}
              </span>
              {config.gameClockMode === "SIMPLE" && (
                <button
                  onClick={() => {
                    if (fold.clockRunning) {
                      append("CLOCK_STOP", { clockSeconds: clockDisplay ?? 0 })
                    } else {
                      append("CLOCK_START", {
                        clockSeconds: clockDisplay ?? config.periodMinutes * 60,
                      })
                    }
                  }}
                  className={`rounded-md px-2 py-0.5 font-mono text-sm font-bold ${
                    fold.clockRunning ? "bg-court-50 text-court-700" : "bg-ink-100 text-ink-700"
                  }`}
                >
                  {fmtClock(clockDisplay ?? config.periodMinutes * 60)}{" "}
                  {fold.clockRunning ? "⏸" : "▶"}
                </button>
              )}
              {config.gameClockMode === "SIMPLE" && (
                <button
                  onClick={openClockEdit}
                  aria-label="Adjust the clock"
                  className="border-ink-200 text-ink-500 hover:bg-ink-50 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold"
                >
                  ✎
                </button>
              )}
              {fold.periodOpen ? (
                <button
                  onClick={() => {
                    if (fold.clockRunning) append("CLOCK_STOP", { clockSeconds: clockDisplay ?? 0 })
                    append("PERIOD_END", {})
                  }}
                  className="border-ink-200 text-ink-600 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold"
                >
                  End
                </button>
              ) : (
                <>
                  <button
                    onClick={() => append("PERIOD_START", { period: fold.period + 1 })}
                    className="bg-play-600 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white"
                  >
                    Start {periodLabel(fold.period + 1, config.periodType)}
                  </button>
                  {fold.period >= regulationPeriods && (
                    <button
                      onClick={() => setReviewing(true)}
                      className="bg-court-600 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white"
                    >
                      End game
                    </button>
                  )}
                </>
              )}
            </div>
            <span className="text-ink-500 max-w-[90px] truncate text-[10px]">
              {game.awayTeam.name}
            </span>
            <span className="text-ink-950 text-xl font-bold">{fold.awayScore}</span>
            <span className="bg-court-400 h-2 w-2 shrink-0 rounded-full" />
            <span
              className={`ml-1 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] ${
                queue.length + voidQueue.length === 0
                  ? "bg-court-50 text-court-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {queue.length + voidQueue.length === 0 ? "✓" : queue.length + voidQueue.length}
            </span>
            <button
              onClick={() => setShowBox(true)}
              className="border-ink-200 text-ink-600 shrink-0 rounded-lg border px-2 py-1 text-[10px] font-semibold"
            >
              BOX
            </button>
            <button
              onClick={() => {
                const last = lastThree[0] as QueuedEvent | undefined
                if (last) voidEvent(last.clientEventId)
              }}
              className="bg-hoop-600 hover:bg-hoop-700 shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold text-white"
            >
              UNDO
            </button>
          </div>
        ) : (
          <>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 text-left">
            <div className="truncate text-[11px]">
              <span className="bg-play-400 mr-1 inline-block h-2 w-2 rounded-full align-middle" />
              <span className="text-ink-500">{game.homeTeam.name}</span>
            </div>
            <div className="text-ink-950 text-3xl font-bold max-md:text-2xl [@media(max-height:520px)]:text-xl">{fold.homeScore}</div>
            <div className="text-ink-400 text-[10px]">
              fouls {fold.teamFouls[game.homeTeam.id]?.[fold.period] ?? 0}
              {(fold.teamFouls[game.homeTeam.id]?.[fold.period] ?? 0) >= 7 ? " · bonus" : ""}
            </div>
          </div>
          <div className="text-center">
            <div className="text-ink-900 text-sm font-bold">
              {periodLabel(fold.period, config.periodType)}
            </div>
            {config.gameClockMode === "SIMPLE" && (
              <button
                onClick={() => {
                  if (fold.clockRunning) {
                    append("CLOCK_STOP", { clockSeconds: clockDisplay ?? 0 })
                  } else {
                    append("CLOCK_START", {
                      clockSeconds: clockDisplay ?? config.periodMinutes * 60,
                    })
                  }
                }}
                className={`mt-0.5 rounded-lg px-3 py-1 font-mono text-lg font-bold ${
                  fold.clockRunning
                    ? "bg-court-50 text-court-700"
                    : "bg-ink-100 text-ink-700"
                }`}
              >
                {fmtClock(clockDisplay ?? config.periodMinutes * 60)}{" "}
                <span className="text-[10px]">{fold.clockRunning ? "⏸" : "▶"}</span>
              </button>
            )}
            {config.gameClockMode === "SIMPLE" && (
              <button
                onClick={openClockEdit}
                aria-label="Adjust the clock"
                className="border-ink-200 text-ink-500 hover:bg-ink-50 mt-0.5 rounded-lg border px-2 py-1 text-xs font-semibold"
              >
                ✎
              </button>
            )}
            <div className="mt-1 flex items-center justify-center gap-1.5">
              {fold.periodOpen ? (
                <button
                  onClick={() => {
                    if (fold.clockRunning) append("CLOCK_STOP", { clockSeconds: clockDisplay ?? 0 })
                    append("PERIOD_END", {})
                  }}
                  className="border-ink-200 text-ink-600 rounded-lg border px-2 py-0.5 text-[10px] font-semibold hover:bg-ink-50"
                >
                  End {periodLabel(fold.period, config.periodType)}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => append("PERIOD_START", { period: fold.period + 1 })}
                    className="bg-play-600 rounded-lg px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-play-700"
                  >
                    Start {periodLabel(fold.period + 1, config.periodType)}
                    {fold.period + 1 > regulationPeriods ? " (OT)" : ""}
                  </button>
                  {fold.period >= regulationPeriods && (
                    <button
                      onClick={() => setReviewing(true)}
                      className="bg-court-600 rounded-lg px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-court-700"
                    >
                      End game →
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="min-w-0 flex-1 text-right">
            <div className="truncate text-[11px]">
              <span className="text-ink-500">{game.awayTeam.name}</span>
              <span className="bg-court-400 ml-1 inline-block h-2 w-2 rounded-full align-middle" />
            </div>
            <div className="text-ink-950 text-3xl font-bold max-md:text-2xl [@media(max-height:520px)]:text-xl">{fold.awayScore}</div>
            <div className="text-ink-400 text-[10px]">
              fouls {fold.teamFouls[game.awayTeam.id]?.[fold.period] ?? 0}
              {(fold.teamFouls[game.awayTeam.id]?.[fold.period] ?? 0) >= 7 ? " · bonus" : ""}
            </div>
          </div>
        </div>

        {/* ticker + sync + undo */}
        <div className="border-ink-100 mt-2 flex items-center justify-between gap-2 border-t pt-2">
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
            {lastThree.map((e) => (
              <button
                key={(e as QueuedEvent).clientEventId}
                onClick={() => voidEvent((e as QueuedEvent).clientEventId)}
                title="Tap to undo this event"
                className="bg-ink-50 text-ink-600 hover:bg-hoop-50 hover:text-hoop-700 shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px]"
              >
                {e.eventType.startsWith("SCORE") && e.made === false ? "miss " : ""}
                {EVENT_LABELS[e.eventType]}
                {e.playerId ? ` #${jerseyOf(e.playerId)}` : ""} ✕
              </button>
            ))}
          </div>
          <span
            className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${
              queue.length + voidQueue.length === 0
                ? "bg-court-50 text-court-700"
                : "animate-pulse bg-red-600 text-white"
            }`}
            title={
              queue.length + voidQueue.length === 0
                ? "All events saved"
                : "Events not reaching the server yet — check connection or lock"
            }
          >
            {queue.length + voidQueue.length === 0
              ? "synced"
              : `${queue.length + voidQueue.length} not saved`}
          </span>
          <button
            onClick={() => setShowBox(true)}
            title="Box score — points, rebounds, assists, fouls"
            className="border-ink-200 text-ink-600 hover:bg-ink-50 flex min-h-[44px] items-center whitespace-nowrap rounded-xl border px-2.5 text-xs font-semibold"
          >
            BOX
          </button>
          {!isTable && !isShort && (
            <button
              onClick={switchLayout}
              title="Switch player layout (rows vs tiles)"
              className="border-ink-200 text-ink-600 hover:bg-ink-50 flex min-h-[44px] items-center whitespace-nowrap rounded-xl border px-2.5 text-xs font-semibold"
            >
              {mobileLayout === "rows" ? "Rows" : "Tiles"}
            </button>
          )}
          <a
            href={`/live/${gameId}`}
            target="_blank"
            aria-label="Open the public spectator page"
            title="Open the public spectator page (share this one with parents)"
            className="border-ink-200 text-ink-600 hover:bg-ink-50 flex min-h-[44px] items-center rounded-xl border px-2.5 text-sm"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </a>
          {fsSupported && (
            <button
              onClick={toggleFullscreen}
              className={`flex min-h-[44px] items-center whitespace-nowrap rounded-xl border px-2.5 text-xs font-semibold ${
                isFullscreen
                  ? "border-play-400 bg-play-50 text-play-700 hover:bg-play-100"
                  : "border-ink-200 text-ink-600 hover:bg-ink-50"
              }`}
            >
              {isFullscreen ? "Exit full screen" : "Full screen"}
            </button>
          )}
          <button
            onClick={() => {
              const last = lastThree[0] as QueuedEvent | undefined
              if (last) voidEvent(last.clientEventId)
            }}
            className="bg-hoop-600 hover:bg-hoop-700 rounded-xl px-4 py-2 text-sm font-bold text-white"
          >
            UNDO
          </button>
        </div>
          </>
        )}
      </div>

      {/* Layout by form factor (width AND height). Landscape phones (short)
          force the rows layout — it's the only one that fits ~390px. */}
      {isTable ? (
        <div className="mt-2 grid gap-2 md:grid-cols-[1fr_2fr_1fr]">
          <div>{floorTiles(game.homeTeam.id, "home")}</div>
          <div>{actionPad}</div>
          <div>{floorTiles(game.awayTeam.id, "away")}</div>
        </div>
      ) : isShort ? (
        /* Landscape phones: full-width stack — the one-line top bar frees
           enough height for big chips and the full pad (owner preference) */
        <div className="mt-2 space-y-1.5">
          {chipRow(game.homeTeam.id, "home")}
          {chipRow(game.awayTeam.id, "away")}
          {actionPad}
        </div>
      ) : (
        <div className="mt-2 space-y-1.5">
          {mobileLayout === "rows" ? (
            <>
              {chipRow(game.homeTeam.id, "home")}
              {chipRow(game.awayTeam.id, "away")}
            </>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {compactColumn(game.homeTeam.id, "home")}
              {compactColumn(game.awayTeam.id, "away")}
            </div>
          )}
          {actionPad}
        </div>
      )}

      {/* manual clock correction (owner: table clock drifts from the arena's) */}
      {clockEdit && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center"
          onClick={() => setClockEdit(null)}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl bg-white p-5 md:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-ink-950 text-base font-bold">Set the clock</h3>
            <p className="text-ink-500 mt-0.5 text-xs">
              Match it to the arena clock — {fold.clockRunning ? "it keeps running from the new time" : "it stays paused at the new time"}.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={99}
                value={clockEdit.min}
                onChange={(e) => setClockEdit({ ...clockEdit, min: e.target.value })}
                className="border-ink-200 w-24 rounded-xl border px-3 py-3 text-center font-mono text-2xl font-bold"
                aria-label="Minutes"
              />
              <span className="text-ink-400 text-2xl font-bold">:</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={59}
                value={clockEdit.sec}
                onChange={(e) => setClockEdit({ ...clockEdit, sec: e.target.value })}
                className="border-ink-200 w-24 rounded-xl border px-3 py-3 text-center font-mono text-2xl font-bold"
                aria-label="Seconds"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setClockEdit(null)}
                className="border-ink-200 text-ink-600 hover:bg-ink-50 flex-1 rounded-xl border py-2.5 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={applyClockEdit}
                className="bg-play-600 hover:bg-play-700 flex-1 rounded-xl py-2.5 text-sm font-bold text-white"
              >
                Set clock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* rebound picker — a real sheet, not a cramped strip (owner: players
          were hidden and the "why" was unclear) */}
      {chain?.kind === "rebound" && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center"
          onClick={() => setChain(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 md:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-ink-950 text-base font-bold">Who got the rebound?</h3>
            <p className="text-ink-500 mt-0.5 text-xs">
              Missed shot{chain.shooterId ? ` by #${jerseyOf(chain.shooterId)}` : ""} — tap
              whoever grabbed the ball. Their team keeps it (offensive) or takes it over
              (defensive).
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {(
                [
                  [chain.shooterTeamId, "Offense"],
                  [
                    chain.shooterTeamId === game.homeTeam.id ? game.awayTeam.id : game.homeTeam.id,
                    "Defense",
                  ],
                ] as Array<[string, string]>
              ).map(([tid, role]) => {
                const home = tid === game.homeTeam.id
                const ids = home ? fold.onFloor.home : fold.onFloor.away
                return (
                  <div key={tid}>
                    <p
                      className={`mb-1.5 truncate text-[11px] font-extrabold uppercase tracking-wide ${
                        home ? "text-play-700" : "text-court-700"
                      }`}
                    >
                      {role} · {home ? game.homeTeam.name : game.awayTeam.name}
                    </p>
                    <div className="space-y-1.5">
                      {ids.map((pid) => (
                        <button
                          key={pid}
                          onClick={() => chainPick(pid, tid)}
                          className={`flex min-h-[46px] w-full items-center gap-2 rounded-xl border px-3 text-left ${
                            home
                              ? "border-play-200 hover:bg-play-50"
                              : "border-court-200 hover:bg-court-50"
                          }`}
                        >
                          <span className="text-ink-950 text-base font-extrabold">
                            #{jerseyOf(pid)}
                          </span>
                          <span className="text-ink-600 min-w-0 flex-1 truncate text-xs font-semibold">
                            {nameOf(pid)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            <button
              onClick={() => setChain(null)}
              className="border-ink-200 text-ink-600 hover:bg-ink-50 mt-3 w-full rounded-xl border py-2.5 text-sm font-semibold"
            >
              Skip — no rebound recorded
            </button>
          </div>
        </div>
      )}

      {/* in-game box score — answer "how many fouls?" without leaving */}
      {showBox && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center"
          onClick={() => setShowBox(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-4 md:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-ink-900 text-sm font-semibold">
                Box score — {game.homeTeam.name} {fold.homeScore} · {fold.awayScore}{" "}
                {game.awayTeam.name}
              </h3>
              <button
                onClick={() => setShowBox(false)}
                className="border-ink-200 text-ink-600 hover:bg-ink-50 rounded-lg border px-3 py-1.5 text-xs font-semibold"
              >
                Close
              </button>
            </div>
            <div className="flex flex-col gap-3 md:flex-row">
              {boxTable(game.homeTeam.id, game.homeTeam.name)}
              {boxTable(game.awayTeam.id, game.awayTeam.name)}
            </div>
            <p className="text-ink-400 mt-2 text-[10px]">
              ● = on the floor · red PF = one foul from fouling out. Live — updates as you score.
            </p>
          </div>
        </div>
      )}

      {/* subs panel */}
      {subsTeamId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 md:rounded-2xl">
            <h3 className="text-ink-900 text-sm font-semibold">
              Substitutions —{" "}
              {subsTeamId === game.homeTeam.id ? game.homeTeam.name : game.awayTeam.name}
            </h3>
            <p className="text-ink-500 mt-0.5 text-xs">
              Tap who comes OUT, then who goes IN. Stage as many swaps as you need, then apply.
            </p>

            <p className="text-ink-400 mt-3 text-[10px] font-semibold uppercase">On the floor</p>
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {subsOnFloor
                .filter((pid) => !stagedSwaps.some((s) => s.out === pid))
                .map((pid) => (
                  <button
                    key={pid}
                    onClick={() => setSubOut(subOut === pid ? null : pid)}
                    className={`rounded-lg border p-2 text-left text-xs ${
                      subOut === pid
                        ? "border-hoop-400 bg-hoop-50"
                        : "border-ink-200 hover:bg-ink-50"
                    }`}
                  >
                    <span className="font-bold">#{jerseyOf(pid)}</span> {nameOf(pid)}
                  </button>
                ))}
            </div>

            <p className="text-ink-400 mt-3 text-[10px] font-semibold uppercase">Bench</p>
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {subsRoster
                .filter(
                  (r) =>
                    !subsOnFloor.includes(r.playerId) &&
                    !stagedSwaps.some((s) => s.in === r.playerId) &&
                    !(subsTeamId ? fold.attendance[subsTeamId]?.absent ?? [] : []).includes(
                      r.playerId
                    )
                )
                .map((r) => {
                  const fouledOut = fold.players[r.playerId]?.fouledOut
                  return (
                    <button
                      key={r.playerId}
                      disabled={!subOut || fouledOut}
                      onClick={() => {
                        if (!subOut) return
                        setStagedSwaps((prev) => [...prev, { out: subOut, in: r.playerId }])
                        setSubOut(null)
                      }}
                      className={`rounded-lg border p-2 text-left text-xs ${
                        fouledOut
                          ? "border-ink-100 text-ink-300"
                          : subOut
                            ? "border-court-300 hover:bg-court-50"
                            : "border-ink-200 text-ink-400"
                      }`}
                    >
                      <span className="font-bold">#{r.jerseyNumber ?? "?"}</span> {r.name}
                      {fouledOut ? " (fouled out)" : ""}
                    </button>
                  )
                })}
            </div>

            {stagedSwaps.length > 0 && (
              <div className="bg-ink-50 mt-3 rounded-xl p-2">
                {stagedSwaps.map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-0.5 text-xs">
                    <span>
                      #{jerseyOf(s.out)} out → #{jerseyOf(s.in)} in
                    </span>
                    <button
                      onClick={() => setStagedSwaps((prev) => prev.filter((_, j) => j !== i))}
                      className="text-hoop-600 px-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setSubsFor(null)}
                className="border-ink-200 text-ink-700 flex-1 rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-ink-50"
              >
                Cancel
              </button>
              <button
                disabled={stagedSwaps.length === 0}
                onClick={() => {
                  for (const s of stagedSwaps) {
                    append("SUBSTITUTION", {
                      teamId: subsTeamId,
                      metadata: { inPlayerId: s.in, outPlayerId: s.out },
                    })
                  }
                  setSubsFor(null)
                }}
                className="bg-play-600 hover:bg-play-700 flex-1 rounded-xl px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                Apply {stagedSwaps.length || ""} swap{stagedSwaps.length === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
