"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { foldEvents } from "@/lib/scoring/fold"
import { monogram } from "@/lib/content/matchup-cover"
import { useRealtime } from "@/lib/realtime/use-realtime"
import { FlashNum } from "@/components/scoring/flash-num"
import { ShareCardDialog } from "@/components/social/share-card-dialog"
import { BOTTOM_TABS_FLOAT_OFFSET } from "@/components/nav/bottom-tabs-space"
import { GameStreamDock, type GameStreamStateWire } from "@/components/streaming/game-stream-dock"
import { buildModel } from "./components/model"
import { ScoreHero } from "./components/score-hero"
import { GameTab } from "./components/game-tab"
import { TeamStatsTab } from "./components/team-stats-tab"
import { PlayByPlayTab, type PlayFilter } from "./components/play-by-play-tab"
import { PregameRosters } from "./components/pregame-rosters"
import { PotgCard, ShareRow } from "./components/potg-card"
import { Crest, SHELL } from "./components/ui-bits"
import type { LivePayload, Tab } from "./components/types"

/**
 * Public game page — owner-approved redesign 2026-07-06 (ESPN/theScore
 * patterns), rebuilt 2026-08-14 (owner: "too clunky", and it stars in the
 * scoring demo):
 * - The linescore moved INTO the navy hero as a compact periods strip.
 * - Desktop lands the Game view in two columns: box score left, leaders and
 *   the latest plays in a right rail — about a screen and a half, not 2.6.
 * - Phones read top to bottom: hero, leaders, box score (sticky switcher),
 *   latest plays.
 * - Nothing was dropped: every number the old page showed is still here.
 *
 * This file owns state, polling and layout only. Every panel lives in
 * ./components (refactor R2), and the derived maths lives in model.ts.
 * Polling and the realtime hookup are untouched: full load, then ?sinceSeq.
 */

export function LiveView({ gameId }: { gameId: string }) {
  const [data, setData] = useState<LivePayload | null>(null)
  const [error, setError] = useState(false)
  const [canScore, setCanScore] = useState(false)
  // Which of the viewer's players the share dialog is open for (P4)
  const [shareFor, setShareFor] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>("game")
  // Live streaming: one of {none, upcoming, live, ended} from the shared query
  // module. Refreshed by the SAME poll below — a stream that goes live between
  // two ticks lights up on the next one, and the page keeps exactly one timer.
  const [stream, setStream] = useState<GameStreamStateWire | null>(null)
  const [playFilter, setPlayFilter] = useState<PlayFilter>("all")
  /** Box score shows ONE team at a time behind a switcher, every viewport. */
  const [boxSide, setBoxSide] = useState<"home" | "away">("home")

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

      // The stream state rides this same tick — no second timer loop. It is
      // deliberately outside the try above: a camera that stops answering must
      // never make the SCORE page say "Couldn't load this game".
      try {
        const res = await fetch(`/api/games/${gameId}/stream`)
        if (res.ok) {
          const next: GameStreamStateWire = await res.json()
          if (!stop) setStream(next)
        }
      } catch {
        // Leave the last known state on screen.
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
  const model = useMemo(() => (data && fold ? buildModel(data, fold) : null), [data, fold])

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

  if (!data || !fold || !model) {
    return (
      <p className="text-ink-500 p-10 text-center text-sm">
        {error ? "Couldn't load this game." : "Loading…"}
      </p>
    )
  }

  const { game, live, final, homeScore, awayScore, periodLabel, hasAnyStats } = model

  return (
    <div className="pb-10">
      {/* Sticky mini score chip (Yahoo pattern) — appears once the hero
          scrolls away; tapping it returns to the top. */}
      {chipVisible && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to the scoreboard"
          className="fixed inset-x-0 top-0 z-50 flex cursor-pointer items-center justify-center gap-3 px-4 py-2 text-white shadow-lg"
          style={{ background: "linear-gradient(120deg, var(--stage), var(--stage-2))" }}
        >
          <Crest size="h-6 w-6 text-[10px]" text={monogram(game.homeTeamName)} />
          <span className="font-condensed text-xl font-semibold tabular-nums">
            <FlashNum value={homeScore} />
          </span>
          <span className="min-w-14 text-center text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/75">
            {live ? `Live · ${periodLabel(fold.period)}` : final ? "Final" : "vs"}
          </span>
          <span className="font-condensed text-xl font-semibold tabular-nums">
            <FlashNum value={awayScore} />
          </span>
          <Crest size="h-6 w-6 text-[10px]" text={monogram(game.awayTeamName)} />
        </button>
      )}

      {/* The picture leads: with a camera on this court the page becomes the
          single game centre (plan, "Surfaces" #1). `none` renders nothing at
          all — no empty frame, no reserved gap — so the thousands of games
          nobody films look exactly as they did before. */}
      {stream && stream.state !== "none" && (
        <div className={SHELL}>
          <GameStreamDock
            state={stream}
            matchup={`${game.homeTeamName} vs ${game.awayTeamName}`}
          />
        </div>
      )}

      <ScoreHero model={model} heroRef={heroRef} clockDisplay={clockDisplay} />

      <div className={`${SHELL} mt-4`}>
        {/* Scorekeeper entry: a floating pill instead of a block banner (owner:
            the banner ate the top of the page while testing). It clears the
            mobile tab bar by the bar's own height (2026-08-14) and stays
            compact so it never lands on the team switcher. */}
        {canScore && !final && (
          <a
            href={`/games/${gameId}/score`}
            className={`bg-energy text-energy-on fixed right-3 z-30 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold shadow-xl transition hover:brightness-110 lg:bottom-6 lg:right-4 lg:px-4 lg:py-3 lg:text-sm ${BOTTOM_TABS_FLOAT_OFFSET}`}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            Score
          </a>
        )}

        {final && (
          <div className="mb-4 space-y-3">
            <PotgCard model={model} />
            <ShareRow model={model} onShare={setShareFor} />
          </div>
        )}

        {shareFor && (
          <ShareCardDialog
            gameId={gameId}
            playerId={shareFor}
            playerName={model.nameOf(shareFor)}
            isPotg={shareFor === game.potgPlayerId}
            onClose={() => setShareFor(null)}
          />
        )}

        {/* ---------- pre-game: rosters with season averages ---------- */}
        {!hasAnyStats && !live && !final && <PregameRosters model={model} />}

        {/* A game with no recorded events used to leave a blank band between
            the hero and the footer (audit 2026-08-14) — result-only finals are
            common in imported seasons. Say what the page has instead. */}
        {!hasAnyStats && (live || final) && (
          <div className="border-ink-100 rounded-2xl border bg-white p-6 text-center">
            <p className="text-ink-900 text-sm font-semibold">
              {final ? "Final score only" : "Waiting for the first play"}
            </p>
            <p className="text-ink-500 mt-1 text-xs leading-5">
              {final
                ? "This game was recorded as a final score, so there is no box score or play-by-play for it."
                : "The box score, leaders and play-by-play appear here the moment the scorer records a play. This page updates on its own."}
            </p>
          </div>
        )}

        {/* ---------- Game | Team stats | Play-by-play ---------- */}
        {hasAnyStats && (
          <>
            <div
              role="tablist"
              aria-label="Game views"
              className="border-ink-100 mb-3 flex gap-1 overflow-x-auto rounded-2xl border bg-white p-1.5 shadow-sm lg:max-w-lg"
            >
              {(
                [
                  ["game", "Game"],
                  ["team", "Team stats"],
                  ["plays", "Play-by-play"],
                ] as Array<[Tab, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={`min-h-[44px] flex-1 cursor-pointer whitespace-nowrap rounded-xl px-2.5 py-2.5 text-[13px] font-semibold transition-colors sm:px-3 sm:text-[13.5px] ${
                    tab === key
                      ? "bg-play-600 text-white shadow-sm"
                      : "text-ink-500 hover:bg-ink-50 hover:text-ink-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className={tab === "game" ? "block" : "hidden"}>
              <GameTab
                model={model}
                boxSide={boxSide}
                onBoxSide={setBoxSide}
                onSeeAllPlays={() => setTab("plays")}
              />
            </div>

            <div className={tab === "team" ? "block" : "hidden"}>
              <TeamStatsTab model={model} />
            </div>

            <div className={tab === "plays" ? "block" : "hidden"}>
              <PlayByPlayTab model={model} filter={playFilter} onFilter={setPlayFilter} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
