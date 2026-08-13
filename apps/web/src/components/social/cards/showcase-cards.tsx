/**
 * Feed card designs — proposal set (2026-08-13).
 *
 * The feed today is almost entirely POST-game: a result, a recap, a POTG.
 * Between games it goes quiet, which is why nobody comes back midweek. These
 * are the card types that fill that gap, each with a DELIBERATELY different
 * shape so the feed reads as varied rather than one template repeating:
 *
 *   LeaderboardCard  — top five in a stat, after a session/weekend
 *   MatchupCard      — game of the week, published midweek
 *   RivalryCard      — rematch with the series record as the hook
 *   PlayOfGameCard   — the go-ahead basket, pulled from play-by-play
 *   PlayerOfGameCard — the POTG card, rebuilt
 *   FinalCard        — the result card, rebuilt
 *
 * All are self-contained and take plain props, so wiring them to real posts
 * later is a data exercise, not a redesign. Every one is built mobile-first
 * and tested down to 360px.
 */

const shell =
  "ring-ink-950/10 overflow-hidden rounded-3xl bg-white shadow-[0_24px_60px_-18px_rgba(30,41,59,0.45)] ring-1"

function Crest({ color, label, size = "h-11 w-11 text-[13px]" }: { color: string; label: string; size?: string }) {
  return (
    <span
      className={`${size} flex shrink-0 items-center justify-center rounded-xl font-extrabold text-white shadow-sm`}
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  )
}

/* ─────────────────────────── 1. LEADERBOARD ─────────────────────────── */

export interface LeaderRow {
  rank: number
  name: string
  team: string
  teamColor: string
  jersey: string
  value: number
}

export function LeaderboardCard({
  statLabel,
  unit,
  period,
  rows,
}: {
  statLabel: string
  unit: string
  period: string
  rows: LeaderRow[]
}) {
  const [first, ...rest] = rows
  return (
    <article className={shell}>
      {/* Dark stage header — the stat name IS the artwork */}
      <div
        className="relative overflow-hidden px-5 py-5 text-white sm:px-6"
        style={{ background: "linear-gradient(135deg, var(--stage-2), var(--stage))" }}
      >
        <div className="bg-highlight/25 pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl" />
        <p className="text-highlight relative text-[11px] font-black uppercase tracking-[0.22em]">
          {period}
        </p>
        <h3 className="font-condensed relative mt-1 text-[2.5rem] font-black uppercase leading-[0.9] sm:text-[3rem]">
          {statLabel}
          <span className="text-highlight"> leaders</span>
        </h3>
      </div>

      {/* #1 gets a podium treatment, the rest are a tight list */}
      {first && (
        <div
          className="flex items-center gap-4 px-5 py-4 sm:px-6"
          style={{ backgroundColor: `${first.teamColor}14` }}
        >
          <span className="font-condensed text-highlight text-[2.6rem] font-black leading-none">
            1
          </span>
          <Crest color={first.teamColor} label={first.jersey} size="h-12 w-12 text-[15px]" />
          <div className="min-w-0 flex-1">
            <p className="text-ink-950 truncate text-[16px] font-extrabold leading-tight">
              {first.name}
            </p>
            <p className="text-ink-500 truncate text-[12.5px] font-semibold">{first.team}</p>
          </div>
          <span className="font-condensed text-ink-950 shrink-0 text-[2.6rem] font-black leading-none tabular-nums">
            {first.value}
          </span>
        </div>
      )}
      <ol className="divide-ink-50 divide-y">
        {rest.map((r) => (
          <li key={r.rank} className="flex items-center gap-3 px-5 py-2.5 sm:px-6">
            <span className="text-ink-400 font-condensed w-5 shrink-0 text-[18px] font-black">
              {r.rank}
            </span>
            <span
              className="h-7 w-7 shrink-0 rounded-lg text-center text-[11px] font-extrabold leading-7 text-white"
              style={{ backgroundColor: r.teamColor }}
            >
              {r.jersey}
            </span>
            <span className="text-ink-900 min-w-0 flex-1 truncate text-[14px] font-bold">
              {r.name}
              <span className="text-ink-400 ml-1.5 font-semibold">· {r.team}</span>
            </span>
            <span className="font-condensed text-ink-900 shrink-0 text-[20px] font-black tabular-nums">
              {r.value}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-ink-400 border-ink-50 border-t px-5 py-2.5 text-[11.5px] font-bold uppercase tracking-widest sm:px-6">
        {unit} · per game
      </p>
    </article>
  )
}

/* ──────────────────────── 2. MATCHUP OF THE WEEK ─────────────────────── */

export interface MatchupSide {
  name: string
  short: string
  record: string
  color: string
  crest: string
}

export function MatchupCard({
  home,
  away,
  when,
  venue,
  note,
  eyebrow = "Matchup of the week",
}: {
  home: MatchupSide
  away: MatchupSide
  when: string
  venue: string
  note?: string
  eyebrow?: string
}) {
  return (
    <article className={shell}>
      {/* Both teams' colours split the stage diagonally */}
      <div
        className="relative px-5 py-6 text-white sm:px-6"
        style={{
          background: `linear-gradient(110deg, ${home.color} 0%, ${home.color} 42%, ${away.color} 58%, ${away.color} 100%)`,
        }}
      >
        <div className="absolute inset-0 bg-black/45" />
        <p className="relative text-center text-[11px] font-black uppercase tracking-[0.22em] text-white/80">
          {eyebrow}
        </p>
        <div className="relative mt-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <Crest color={home.color} label={home.crest} size="h-14 w-14 text-base sm:h-16 sm:w-16 sm:text-lg" />
            <p className="w-full truncate text-center text-[13.5px] font-extrabold sm:text-[15px]">
              {home.short}
            </p>
            <p className="text-[12px] font-semibold text-white/70">{home.record}</p>
          </div>
          <span className="font-condensed shrink-0 text-[1.75rem] font-black italic text-white/70 sm:text-[2.25rem]">
            VS
          </span>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <Crest color={away.color} label={away.crest} size="h-14 w-14 text-base sm:h-16 sm:w-16 sm:text-lg" />
            <p className="w-full truncate text-center text-[13.5px] font-extrabold sm:text-[15px]">
              {away.short}
            </p>
            <p className="text-[12px] font-semibold text-white/70">{away.record}</p>
          </div>
        </div>
      </div>
      <div className="px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
          <span className="text-ink-950 font-extrabold">{when}</span>
          <span className="text-ink-500 font-semibold">{venue}</span>
        </div>
        {note && <p className="text-ink-600 mt-2 text-[13.5px] leading-6">{note}</p>}
      </div>
    </article>
  )
}

/* ───────────────────────────── 3. RIVALRY ────────────────────────────── */

export function RivalryCard({
  home,
  away,
  seriesLine,
  meetings,
  when,
}: {
  home: MatchupSide
  away: MatchupSide
  seriesLine: string
  meetings: { date: string; result: string; winnerColor: string }[]
  when: string
}) {
  return (
    <article className={shell}>
      <div className="bg-ink-950 relative overflow-hidden px-5 py-5 text-white sm:px-6">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-1/2 opacity-30"
          style={{ background: `linear-gradient(90deg, ${home.color}, transparent)` }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-30"
          style={{ background: `linear-gradient(270deg, ${away.color}, transparent)` }}
        />
        <p className="text-hoop-400 relative text-[11px] font-black uppercase tracking-[0.22em]">
          Rematch
        </p>
        <h3 className="font-condensed relative mt-1 text-[1.9rem] font-black uppercase leading-tight sm:text-[2.3rem]">
          {home.short} <span className="text-white/40">vs</span> {away.short}
        </h3>
        <p className="relative mt-2 inline-block rounded-full bg-white/15 px-3 py-1 text-[12px] font-extrabold uppercase tracking-wider">
          {seriesLine}
        </p>
      </div>
      <ul className="divide-ink-50 divide-y">
        {meetings.map((m, i) => (
          <li key={i} className="flex items-center gap-3 px-5 py-3 sm:px-6">
            <span
              className="h-8 w-1 shrink-0 rounded-full"
              style={{ backgroundColor: m.winnerColor }}
            />
            <span className="text-ink-500 w-24 shrink-0 text-[12.5px] font-bold">{m.date}</span>
            <span className="text-ink-900 flex-1 text-[14px] font-bold tabular-nums">{m.result}</span>
          </li>
        ))}
      </ul>
      <p className="bg-ink-50 text-ink-700 px-5 py-3 text-[13px] font-extrabold sm:px-6">
        Next: {when}
      </p>
    </article>
  )
}

/* ─────────────────────── 4. PLAY OF THE GAME ─────────────────────────── */

export function PlayOfGameCard({
  playerName,
  jersey,
  teamColor,
  team,
  description,
  clock,
  scoreAfter,
}: {
  playerName: string
  jersey: string
  teamColor: string
  team: string
  description: string
  clock: string
  scoreAfter: string
}) {
  return (
    <article className={shell}>
      <div className="relative overflow-hidden px-5 py-6 sm:px-6" style={{ backgroundColor: teamColor }}>
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/15 blur-2xl" />
        <p className="relative text-[11px] font-black uppercase tracking-[0.22em] text-white/80">
          Play of the game
        </p>
        <p className="font-display relative mt-2 text-[1.5rem] font-black leading-tight text-white sm:text-[1.75rem]">
          &ldquo;{description}&rdquo;
        </p>
      </div>
      <div className="flex items-center gap-3 px-5 py-4 sm:px-6">
        <Crest color={teamColor} label={jersey} />
        <div className="min-w-0 flex-1">
          <p className="text-ink-950 truncate text-[15px] font-extrabold leading-tight">
            {playerName}
          </p>
          <p className="text-ink-500 truncate text-[12.5px] font-semibold">{team}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-ink-400 text-[11px] font-bold uppercase tracking-wider">{clock}</p>
          <p className="font-condensed text-ink-950 text-[19px] font-black tabular-nums">
            {scoreAfter}
          </p>
        </div>
      </div>
    </article>
  )
}

/* ────────────────────── 5. PLAYER OF THE GAME ────────────────────────── */

export function PlayerOfGameCard({
  playerName,
  jersey,
  team,
  teamColor,
  line,
  gameLine,
}: {
  playerName: string
  jersey: string
  team: string
  teamColor: string
  line: { value: number; unit: string }[]
  gameLine: string
}) {
  return (
    <article className={shell}>
      <div
        className="relative overflow-hidden px-5 pb-16 pt-5 sm:px-6"
        style={{ background: `linear-gradient(140deg, ${teamColor}, rgba(0,0,0,0.85))` }}
      >
        <p className="text-highlight text-[11px] font-black uppercase tracking-[0.22em]">
          Player of the game
        </p>
        <h3 className="font-condensed mt-1 text-[2.4rem] font-black uppercase leading-[0.92] text-white sm:text-[2.9rem]">
          {playerName}
        </h3>
        <p className="mt-1 text-[13px] font-bold text-white/75">
          #{jersey} · {team}
        </p>
      </div>
      {/* Stat line rides up over the hero — the signature of this card */}
      <div className="-mt-12 px-4 sm:px-5">
        <div className="ring-ink-950/5 grid grid-cols-3 gap-2 rounded-2xl bg-white p-3 shadow-lg ring-1">
          {line.map((s) => (
            <div key={s.unit} className="bg-ink-50 rounded-xl py-2.5 text-center">
              <p className="font-condensed text-ink-950 text-[1.9rem] font-black leading-none tabular-nums">
                {s.value}
              </p>
              <p className="text-ink-500 mt-1 text-[10.5px] font-black uppercase tracking-wider">
                {s.unit}
              </p>
            </div>
          ))}
        </div>
      </div>
      <p className="text-ink-600 px-5 py-4 text-[13.5px] font-semibold sm:px-6">{gameLine}</p>
    </article>
  )
}

/* ───────────────────────────── 6. FINAL ──────────────────────────────── */

export function FinalCard({
  home,
  away,
  homeScore,
  awayScore,
  quarters,
  note,
}: {
  home: MatchupSide
  away: MatchupSide
  homeScore: number
  awayScore: number
  quarters: { home: number; away: number }[]
  note?: string
}) {
  const homeWon = homeScore > awayScore
  return (
    <article className={shell}>
      <div className="border-ink-100 flex items-center justify-between border-b px-5 py-2.5 sm:px-6">
        <span className="text-ink-500 text-[11px] font-black uppercase tracking-[0.2em]">Final</span>
        <span className="text-ink-400 text-[12px] font-semibold">{note}</span>
      </div>
      {(
        [
          [home, homeScore, homeWon],
          [away, awayScore, !homeWon],
        ] as Array<[MatchupSide, number, boolean]>
      ).map(([side, score, won]) => (
        <div
          key={side.short}
          className="flex items-center gap-3 px-5 py-3.5 sm:px-6"
          style={won ? { backgroundColor: `${side.color}0f` } : undefined}
        >
          <Crest color={side.color} label={side.crest} />
          <div className="min-w-0 flex-1">
            <p
              className={`truncate text-[15px] leading-tight ${won ? "text-ink-950 font-extrabold" : "text-ink-600 font-bold"}`}
            >
              {side.short}
            </p>
            <p className="text-ink-400 text-[12px] font-semibold">{side.record}</p>
          </div>
          {won && (
            <span className="text-court-700 bg-court-50 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
              Win
            </span>
          )}
          <span
            className={`font-condensed shrink-0 text-[2.1rem] font-black leading-none tabular-nums ${
              won ? "text-ink-950" : "text-ink-400"
            }`}
          >
            {score}
          </span>
        </div>
      ))}
      <div className="bg-ink-50 flex items-center gap-1 overflow-x-auto px-5 py-2.5 sm:px-6">
        {quarters.map((q, i) => (
          <div key={i} className="min-w-[46px] flex-1 text-center">
            <p className="text-ink-400 text-[10px] font-black uppercase tracking-wider">Q{i + 1}</p>
            <p className="font-condensed text-ink-800 text-[14px] font-black tabular-nums">
              {q.home}-{q.away}
            </p>
          </div>
        ))}
      </div>
    </article>
  )
}
