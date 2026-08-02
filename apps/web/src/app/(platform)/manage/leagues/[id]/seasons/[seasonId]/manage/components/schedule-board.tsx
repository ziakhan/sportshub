"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import {
  UNASSIGNED_COLUMN,
  abbrevTeamName,
  boardDays,
  boardTone,
  boardVenues,
  boardWeekends,
  buildBoardColumns,
  buildBoardRows,
  dayKeyOf,
  defaultBoardDayKey,
  repeatOrdinals,
  type BoardGame,
  type BoardTone,
} from "@/lib/scheduler/board"

/**
 * The schedule board (owner 2026-08-02): a day and its gyms on one screen,
 * so "who plays where" is read, not reconstructed. Columns are courts under
 * their gym, rows are tip-off times, and every game is a chip in its cell —
 * the paper grid operators already draw by hand, kept honest by the data.
 *
 * Read-only by design in v1: this is the visibility view. Moving games
 * stays in the list below, where the guardrails (conflicts, pinning,
 * alternates) already live.
 */

/**
 * Chip skins: a pale tint to group at a glance plus a saturated left stripe,
 * because two pale tints from neighbouring families (indigo, steel) are hard
 * to tell apart in a wall of 40 chips and the stripe never is. Written out
 * in full so Tailwind keeps every class.
 */
const TONE_CLASS: Record<BoardTone, string> = {
  play: "border-play-200 border-l-play-500 bg-play-50 text-play-800 hover:bg-play-100",
  court: "border-court-200 border-l-court-500 bg-court-50 text-court-800 hover:bg-court-100",
  hoop: "border-hoop-200 border-l-hoop-500 bg-hoop-50 text-hoop-800 hover:bg-hoop-100",
  gold: "border-gold-100 border-l-gold-500 bg-gold-50 text-gold-600 hover:bg-gold-100",
  navy: "border-navy-200 border-l-navy-500 bg-navy-50 text-navy-800 hover:bg-navy-100",
  ink: "border-ink-200 border-l-ink-400 bg-ink-50 text-ink-700 hover:bg-ink-100",
}

const SUPERSCRIPT = ["", "", "²", "³", "⁴", "⁵", "⁶"]

const ALL_GYMS = "all"
/** Filter value for games whose gym was never set. */
const NO_GYM = "none"

export function ScheduleBoard({ games }: { games: BoardGame[] }) {
  const [pickedDay, setPickedDay] = useState<string | null>(null)
  const [pickedGym, setPickedGym] = useState<string>(ALL_GYMS)

  const days = useMemo(() => boardDays(games), [games])
  const weekends = useMemo(() => boardWeekends(days), [days])
  // Derived, not stored: when the games change under it (a commit, a
  // session switch) the board falls back to a day that still exists
  // instead of going blank.
  const activeDay =
    pickedDay && days.some((d) => d.key === pickedDay) ? pickedDay : defaultBoardDayKey(days)

  const dayGames = useMemo(
    () => (activeDay ? games.filter((g) => dayKeyOf(g.scheduledAt) === activeDay) : []),
    [games, activeDay]
  )
  const gyms = useMemo(() => boardVenues(dayGames), [dayGames])
  const activeGym =
    pickedGym !== ALL_GYMS && gyms.some((v) => (v.venueId ?? NO_GYM) === pickedGym)
      ? pickedGym
      : ALL_GYMS

  const shownGames = useMemo(
    () =>
      activeGym === ALL_GYMS
        ? dayGames
        : dayGames.filter((g) => (g.venueId ?? NO_GYM) === activeGym),
    [dayGames, activeGym]
  )
  const groups = useMemo(() => buildBoardColumns(shownGames), [shownGames])
  const columns = useMemo(() => groups.flatMap((g) => g.columns), [groups])
  const rows = useMemo(
    () => buildBoardRows(shownGames, columns.map((c) => c.key)),
    [shownGames, columns]
  )
  // Repeats are counted across the WHOLE day, never the filtered gym: a team
  // playing twice in two different gyms is exactly the case worth flagging.
  const repeats = useMemo(() => repeatOrdinals(dayGames), [dayGames])
  const hasRepeats = repeats.size > 0

  if (games.length === 0) {
    return (
      <p className="text-ink-500 text-sm">
        No schedule yet. Generate one from this tab and it lands here.
      </p>
    )
  }

  // Gym headers stay up while you are looking at every gym; picking one
  // collapses them, because its name is already on the chip you pressed.
  const showGymHeaders = activeGym === ALL_GYMS
  const gridTemplate = `4.5rem repeat(${Math.max(columns.length, 1)}, minmax(10rem, 1fr))`
  const gridMinWidth = `${4.5 + Math.max(columns.length, 1) * 10}rem`

  return (
    <div className="space-y-3" data-board-root="">
      {/* Days, grouped by the weekend an operator thinks in. */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex w-max items-stretch gap-3">
          {weekends.map((w) => (
            <div key={w.key} className="border-ink-100 shrink-0 rounded-xl border px-2 py-1.5">
              <p className="text-ink-400 mb-1 text-[10px] font-semibold uppercase tracking-wide">
                {w.label}
              </p>
              <div className="flex gap-1">
                {w.days.map((d) => {
                  const on = d.key === activeDay
                  return (
                    <button
                      key={d.key}
                      onClick={() => setPickedDay(d.key)}
                      aria-pressed={on}
                      data-day-chip={d.key}
                      className={`rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-semibold transition-colors ${
                        on
                          ? "border-play-500 bg-play-600 text-white"
                          : "border-ink-200 bg-white text-ink-600 hover:border-ink-300"
                      }`}
                    >
                      {format(d.date, "EEE d")}
                      <span className={on ? "block text-white/80" : "text-ink-400 block"}>
                        {d.games} game{d.games === 1 ? "" : "s"}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gyms on the chosen day. */}
      {gyms.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setPickedGym(ALL_GYMS)}
            aria-pressed={activeGym === ALL_GYMS}
            data-gym-chip={ALL_GYMS}
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
              activeGym === ALL_GYMS
                ? "border-ink-900 bg-ink-950 text-white"
                : "border-ink-200 bg-white text-ink-600 hover:border-ink-300"
            }`}
          >
            All gyms
          </button>
          {gyms.map((v) => {
            const key = v.venueId ?? NO_GYM
            const on = activeGym === key
            return (
              <button
                key={key}
                onClick={() => setPickedGym(on ? ALL_GYMS : key)}
                aria-pressed={on}
                data-gym-chip={key}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                  on
                    ? "border-ink-900 bg-ink-950 text-white"
                    : "border-ink-200 bg-white text-ink-600 hover:border-ink-300"
                }`}
              >
                {v.venueName}
                <span className={on ? "text-white/70" : "text-ink-400"}> · {v.games}</span>
              </button>
            )
          })}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-ink-500 text-sm">No games this day.</p>
      ) : (
        <div className="border-ink-100 overflow-x-auto rounded-2xl border">
          <div
            className="grid"
            style={{ gridTemplateColumns: gridTemplate, minWidth: gridMinWidth }}
            data-schedule-board=""
          >
            {/* Gym header row: one spanning cell per gym, its courts beneath. */}
            {showGymHeaders && (
              <>
                <div className="bg-ink-50 sticky left-0 z-10" />
                {groups.map((g) => (
                  <div
                    key={g.key}
                    data-gym-header={g.key}
                    className="border-ink-100 bg-ink-50 text-ink-700 truncate border-l px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide"
                    style={{ gridColumn: `span ${g.columns.length}` }}
                    title={g.venueName}
                  >
                    {g.venueName}
                    <span className="text-ink-400 font-semibold"> · {g.games}</span>
                  </div>
                ))}
              </>
            )}

            {/* Court header row. */}
            <div className="border-ink-100 text-ink-400 sticky left-0 z-10 border-b bg-white px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide">
              Time
            </div>
            {columns.map((c) => (
              <div
                key={c.key}
                data-court-column={c.key}
                className="border-ink-100 text-ink-700 truncate border-b border-l bg-white px-2 py-1.5 text-[11px] font-semibold"
                title={c.key === UNASSIGNED_COLUMN ? "Games with no court assigned" : `${c.venueName} · ${c.courtName}`}
              >
                {c.courtName}
                <span className="text-ink-400 font-normal"> · {c.games}</span>
              </div>
            ))}

            {/* One row per tip-off time. */}
            {rows.map((row) => (
              <div key={row.minute} className="contents">
                <div
                  data-time-row={row.minute}
                  className="border-ink-100 text-ink-500 sticky left-0 z-10 border-t bg-white px-2 py-1.5 text-[11px] font-semibold"
                >
                  {format(row.at, "h:mm a")}
                </div>
                {columns.map((c) => {
                  const cell = row.cells[c.key] ?? []
                  return (
                    <div
                      key={c.key}
                      className={`border-ink-100 space-y-1 border-l border-t p-1 ${
                        cell.length > 1 ? "bg-amber-50" : ""
                      }`}
                    >
                      {cell.map((g) => (
                        <GameChip key={g.id} game={g} repeats={repeats} />
                      ))}
                      {cell.length > 1 && (
                        <p className="text-amber-700 px-1 pb-0.5 text-[10px] font-semibold">
                          {cell.length} games on this court at once
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-ink-400 text-[11px]">
        Colors group grades. Tap a game for its box score.
        {hasRepeats ? " A small ² marks a team's second game of the day." : ""}
      </p>
    </div>
  )
}

function GameChip({ game, repeats }: { game: BoardGame; repeats: Map<string, number> }) {
  const tone = TONE_CLASS[boardTone(game.unitLabel)]
  const off = game.status === "CANCELLED"
  const home = abbrevTeamName(game.homeTeamName ?? "Home")
  const away = abbrevTeamName(game.awayTeamName ?? "Away")
  const homeMark = SUPERSCRIPT[repeats.get(`${game.id}:${game.homeTeamId}`) ?? 0] ?? ""
  const awayMark = SUPERSCRIPT[repeats.get(`${game.id}:${game.awayTeamId}`) ?? 0] ?? ""
  const scored =
    game.status === "COMPLETED" && game.homeScore != null && game.awayScore != null
      ? `${game.homeScore}–${game.awayScore}`
      : null

  return (
    <Link
      href={`/live/${game.id}`}
      data-game-chip={game.id}
      title={`${game.homeTeamName ?? "Home"} vs ${game.awayTeamName ?? "Away"} · ${format(
        new Date(game.scheduledAt),
        "EEE MMM d · h:mm a"
      )} · ${game.venueName ?? "Gym not set"}${game.courtName ? ` ${game.courtName}` : ""}${
        game.unitLabel ? ` · ${game.unitLabel}` : ""
      }`}
      className={`flex min-h-[44px] flex-col justify-center rounded-lg border border-l-4 px-1.5 py-1 transition-colors ${tone} ${
        off ? "opacity-60" : ""
      }`}
    >
      <span className="flex items-center justify-between gap-1 text-[10px] font-bold uppercase tracking-wide">
        <span className="truncate">
          {format(new Date(game.scheduledAt), "h:mm")}
          {game.unitLabel ? ` · ${game.unitLabel}` : ""}
        </span>
        {scored ? (
          <span className="shrink-0 tabular-nums">{scored}</span>
        ) : off ? (
          <span className="shrink-0">off</span>
        ) : !game.publishedAt ? (
          <span
            className="bg-ink-400 h-1.5 w-1.5 shrink-0 rounded-full"
            title="Draft, not published yet"
            aria-label="Draft"
          />
        ) : null}
      </span>
      <span className={`truncate text-[11px] font-medium leading-tight ${off ? "line-through" : ""}`}>
        {home}
        {homeMark}
        <span className="opacity-50"> v </span>
        {away}
        {awayMark}
      </span>
    </Link>
  )
}
