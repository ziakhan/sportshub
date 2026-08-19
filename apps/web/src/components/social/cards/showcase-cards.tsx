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
 *
 * NEUTRAL BY DEFAULT (owner ruling 2026-08-14). These cards used to fill their
 * stages, crests, tint blocks and handle pills with each club's colour. Almost
 * every club is wearing a colour the importer assigned, so the feed read as the
 * same three hues shuffled, and the colour carried no information. Crests are
 * ink, stages are the arena navy, and the amber highlight is reserved for the
 * one thing worth marking. The `teamColor` / `color` fields stay in the prop
 * types because stored post payloads still carry them; nothing renders them.
 */

import Link from "next/link"

const shell =
  "ring-ink-950/10 overflow-hidden rounded-3xl bg-white shadow-[0_24px_60px_-18px_rgba(30,41,59,0.45)] ring-1"

/** Ink crest tile. `surface` picks the tone: dark stages versus white bodies. */
function Crest({
  label,
  size = "h-11 w-11 text-[13px]",
  surface = "light",
}: {
  label: string
  size?: string
  surface?: "light" | "dark"
}) {
  return (
    <span
      className={`${size} ${
        surface === "dark"
          ? "bg-white/12 text-white ring-1 ring-inset ring-white/20"
          : "bg-ink-100 text-ink-700"
      } flex shrink-0 items-center justify-center rounded-xl font-extrabold shadow-sm`}
    >
      {label}
    </span>
  )
}

/* ─────────────────────────── 1. LEADERBOARD ─────────────────────────── */

/** The five stats every session posts. Threes and more can follow. */
export const LEADER_STATS = ["Points", "Rebounds", "Assists", "Steals", "Blocks"] as const

export interface LeaderRow {
  rank: number
  name: string
  team: string
  teamColor: string
  jersey: string
  value: number
  /** Present on real posts — makes the name and @handle link to the player. */
  playerId?: string
  handle?: string
}

export function LeaderboardCard({
  statLabel,
  unit,
  period,
  rows,
  caption,
}: {
  statLabel: string
  unit: string
  period: string
  rows: LeaderRow[]
  /** The written post. A card with no words is a graphic, not a post. */
  caption?: string
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
        <div className="bg-ink-50 flex items-center gap-4 px-5 py-4 sm:px-6">
          <span className="font-condensed text-highlight text-[2.6rem] font-black leading-none">
            1
          </span>
          <Crest label={first.jersey} size="h-12 w-12 text-[15px]" />
          <div className="min-w-0 flex-1">
            {first.playerId ? (
              <Link
                href={`/player/${first.playerId}`}
                className="text-ink-950 hover:text-play-600 block truncate text-[16px] font-extrabold leading-tight transition-colors"
              >
                {first.name}
              </Link>
            ) : (
              <p className="text-ink-950 truncate text-[16px] font-extrabold leading-tight">
                {first.name}
              </p>
            )}
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
            <span className="bg-ink-100 text-ink-700 h-7 w-7 shrink-0 rounded-lg text-center text-[11px] font-extrabold leading-7">
              {r.jersey}
            </span>
            <span className="text-ink-900 min-w-0 flex-1 truncate text-[14px] font-bold">
              {r.playerId ? (
                <Link href={`/player/${r.playerId}`} className="hover:text-play-600 transition-colors">
                  {r.name}
                </Link>
              ) : (
                r.name
              )}
              <span className="text-ink-400 ml-1.5 font-semibold">· {r.team}</span>
            </span>
            <span className="font-condensed text-ink-900 shrink-0 text-[20px] font-black tabular-nums">
              {r.value}
            </span>
          </li>
        ))}
      </ol>
      {/* The written post — what a human would say about these numbers. */}
      {caption && (
        <p className="text-ink-700 border-ink-50 border-t px-5 py-3.5 text-[14px] leading-6 sm:px-6">
          {caption}
        </p>
      )}

      {/* Every listed player is TAGGED (PostTag carries playerId), so the post
          lands on their profile and they can reshare it to their own story —
          five kids amplifying each post instead of one. The handles are real
          links; a mention that goes nowhere is just decoration. */}
      <div className="border-ink-50 flex flex-wrap items-center gap-1.5 border-t px-5 py-3 sm:px-6">
        <span className="text-ink-400 mr-1 text-[11px] font-black uppercase tracking-widest">
          {unit} · per game
        </span>
        <span className="flex-1" />
        {rows.slice(0, 5).map((r) => {
          const handle = `@${r.handle ?? r.name.split(" ")[0].toLowerCase()}`
          const pill =
            "bg-ink-100 text-ink-700 rounded-full px-2 py-0.5 text-[11px] font-bold transition hover:brightness-95"
          return r.playerId ? (
            <Link key={r.rank} href={`/player/${r.playerId}`} className={pill}>
              {handle}
            </Link>
          ) : (
            <span key={r.rank} className={pill}>
              {handle}
            </span>
          )
        })}
      </div>
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
  watch,
  href,
  eyebrow = "Matchup of the week",
}: {
  home: MatchupSide
  away: MatchupSide
  when: string
  venue: string
  note?: string
  watch?: { name: string; jersey: string; color: string; line: string }[]
  /** Post permalink. Omitted on the design preview, set on real posts. */
  href?: string
  eyebrow?: string
}) {
  return (
    <article className={shell}>
      {/* The arena stage, not a two-tone colour split (owner ruling
          2026-08-14): the two sides are told apart by position and name. */}
      <div
        className="relative px-5 py-6 text-white sm:px-6"
        style={{ background: "linear-gradient(110deg, var(--stage-2), var(--stage))" }}
      >
        <div className="absolute inset-0 bg-black/20" />
        <p className="relative text-center text-[11px] font-black uppercase tracking-[0.22em] text-white/80">
          {eyebrow}
        </p>
        <div className="relative mt-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <Crest label={home.crest} size="h-14 w-14 text-base sm:h-16 sm:w-16 sm:text-lg" surface="dark" />
            <p className="w-full truncate text-center text-[13.5px] font-extrabold sm:text-[15px]">
              {home.short}
            </p>
            <p className="text-[12px] font-semibold text-white/70">{home.record}</p>
          </div>
          <span className="font-condensed shrink-0 text-[1.75rem] font-black italic text-white/70 sm:text-[2.25rem]">
            VS
          </span>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <Crest label={away.crest} size="h-14 w-14 text-base sm:h-16 sm:w-16 sm:text-lg" surface="dark" />
            <p className="w-full truncate text-center text-[13.5px] font-extrabold sm:text-[15px]">
              {away.short}
            </p>
            <p className="text-[12px] font-semibold text-white/70">{away.record}</p>
          </div>
        </div>
      </div>
      {/* ARTICLE BODY (2026-08-13): a card alone gives nobody a reason to open
          it. Written lede + players to watch turns "matchup of the week" into
          something worth reading — the generative layer already exists for
          recaps (lib/content/recap-claude.ts), so this is the same engine
          pointed at a fixture instead of a result. */}
      <div className="px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
          <span className="text-ink-950 font-extrabold">{when}</span>
          <span className="text-ink-500 font-semibold">{venue}</span>
        </div>
        {note && <p className="text-ink-700 mt-3 text-[14.5px] leading-7">{note}</p>}
        {watch && watch.length > 0 && (
          <div className="mt-4">
            <p className="text-ink-400 mb-2 text-[11px] font-black uppercase tracking-[0.16em]">
              Players to watch
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {watch.map((p) => (
                <div key={p.name} className="bg-ink-50 flex items-center gap-2.5 rounded-xl p-2.5">
                  <Crest label={p.jersey} size="h-9 w-9 text-[11.5px]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-ink-950 truncate text-[13.5px] font-bold leading-tight">
                      {p.name}
                    </p>
                    <p className="text-ink-500 truncate text-[11.5px] font-semibold">{p.line}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {href ? (
          <Link
            href={href}
            className="text-play-700 hover:text-play-800 mt-4 inline-block text-[13.5px] font-extrabold"
          >
            Read the full preview →
          </Link>
        ) : (
          <span className="text-ink-300 mt-4 inline-block text-[13.5px] font-extrabold">
            Read the full preview →
          </span>
        )}
      </div>
    </article>
  )
}

/* ───────────────────────────── 3. RIVALRY ────────────────────────────── */

/**
 * RIVALRY — rebuilt as an ARTICLE (tester 2026-08-13). The first version was
 * a scoreline list, which told you what happened without telling you why it
 * matters. A rematch is the best story youth sport generates for free, so it
 * gets a headline, a written lede, the series as evidence, what is at stake,
 * and the players who decided the earlier meetings.
 */
export function RivalryCard({
  home,
  away,
  seriesLine,
  headline,
  lede,
  meetings,
  stakes,
  keyPlayers,
  when,
  href,
}: {
  home: MatchupSide
  away: MatchupSide
  seriesLine: string
  headline: string
  lede: string
  meetings: { date: string; result: string; winnerColor: string; note?: string }[]
  stakes?: string
  keyPlayers?: { name: string; jersey: string; color: string; line: string }[]
  when: string
  /** Post permalink. Omitted on the design preview, set on real posts. */
  href?: string
}) {
  return (
    <article className={shell}>
      <div className="bg-ink-950 relative overflow-hidden px-5 py-6 text-white sm:px-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{ background: "linear-gradient(100deg, var(--stage-2), transparent 55%, var(--stage-2))" }}
        />
        <div className="relative flex items-center justify-between gap-3">
          <p className="text-hoop-400 text-[11px] font-black uppercase tracking-[0.22em]">Rivalry</p>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider">
            {seriesLine}
          </span>
        </div>
        {/* Headline, not a fixture label — this is a story */}
        <h3 className="font-display relative mt-3 text-[1.55rem] font-black leading-tight sm:text-[1.9rem]">
          {headline}
        </h3>
        <div className="relative mt-3 flex items-center gap-2 text-[12.5px] font-bold text-white/70">
          <Crest label={home.crest} size="h-7 w-7 text-[10px]" surface="dark" />
          <span className="truncate">{home.short}</span>
          <span className="text-white/40">vs</span>
          <Crest label={away.crest} size="h-7 w-7 text-[10px]" surface="dark" />
          <span className="truncate">{away.short}</span>
        </div>
      </div>

      <div className="px-5 pt-4 sm:px-6">
        <p className="text-ink-700 text-[14.5px] leading-7">{lede}</p>
      </div>

      <div className="px-5 pt-4 sm:px-6">
        <p className="text-ink-400 mb-2 text-[11px] font-black uppercase tracking-[0.16em]">
          The series so far
        </p>
      </div>
      <ul className="divide-ink-50 divide-y">
        {meetings.map((m, i) => (
          <li key={i} className="flex items-start gap-3 px-5 py-3 sm:px-6">
            {/* Which club won the meeting is in the result text beside it, so
                the rail is a neutral tick. */}
            <span className="bg-ink-300 mt-0.5 h-9 w-1 shrink-0 rounded-full" />
            <span className="text-ink-500 w-20 shrink-0 text-[12.5px] font-bold">{m.date}</span>
            <span className="min-w-0 flex-1">
              <span className="text-ink-900 block text-[14px] font-bold tabular-nums">
                {m.result}
              </span>
              {m.note && <span className="text-ink-500 block text-[12.5px]">{m.note}</span>}
            </span>
          </li>
        ))}
      </ul>

      {keyPlayers && keyPlayers.length > 0 && (
        <div className="px-5 pt-4 sm:px-6">
          <p className="text-ink-400 mb-2 text-[11px] font-black uppercase tracking-[0.16em]">
            Who decided it last time
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {keyPlayers.map((p) => (
              <div key={p.name} className="bg-ink-50 flex items-center gap-2.5 rounded-xl p-2.5">
                <Crest label={p.jersey} size="h-9 w-9 text-[11.5px]" />
                <div className="min-w-0 flex-1">
                  <p className="text-ink-950 truncate text-[13.5px] font-bold leading-tight">
                    {p.name}
                  </p>
                  <p className="text-ink-500 truncate text-[11.5px] font-semibold">{p.line}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stakes && (
        <div className="border-hoop-100 bg-hoop-50 mx-5 mt-4 rounded-xl border px-3.5 py-3 sm:mx-6">
          <p className="text-hoop-700 text-[11px] font-black uppercase tracking-[0.16em]">
            What&apos;s at stake
          </p>
          <p className="text-ink-800 mt-1 text-[13.5px] font-semibold leading-6">{stakes}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
        <span className="text-ink-950 text-[13px] font-extrabold">{when}</span>
        {/* A real link when the post has a slug. It was a <span> — decorative
            on the preview page, but a dead end once these became real posts
            (tester 2026-08-13). */}
        {href ? (
          <Link href={href} className="text-play-700 hover:text-play-800 text-[13.5px] font-extrabold">
            Read the full story →
          </Link>
        ) : (
          <span className="text-ink-300 text-[13.5px] font-extrabold">Read the full story →</span>
        )}
      </div>
    </article>
  )
}

/* ─────────────────────── 4. PLAY OF THE GAME ─────────────────────────── */

/**
 * GAME WINNER, not "play of the game" (tester 2026-08-13). This only fires
 * when a game actually turned on one moment — a go-ahead bucket late, or the
 * stop that sealed it. Posting a "play of the game" after every routine final
 * would devalue it; scarcity is what makes this card worth opening.
 */
export function GameWinnerCard({
  playerName,
  jersey,
  teamColor,
  team,
  description,
  clock,
  scoreAfter,
  label = "Game winner",
}: {
  playerName: string
  jersey: string
  teamColor: string
  team: string
  description: string
  clock: string
  scoreAfter: string
  label?: string
}) {
  return (
    <article className={shell}>
      <div
        className="relative overflow-hidden px-5 py-6 sm:px-6"
        style={{ background: "linear-gradient(135deg, var(--stage-2), var(--stage))" }}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/15 blur-2xl" />
        <p className="relative text-[11px] font-black uppercase tracking-[0.22em] text-white/80">
          {label}
        </p>
        <p className="font-display relative mt-2 text-[1.5rem] font-black leading-tight text-white sm:text-[1.75rem]">
          &ldquo;{description}&rdquo;
        </p>
      </div>
      <div className="flex items-center gap-3 px-5 py-4 sm:px-6">
        <Crest label={jersey} />
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

/**
 * PHOTO-LED (2026-08-13 rebuild). The first version was a name and three
 * numbers on a gradient — too thin for the card families most want to share.
 * `Game.potgPhotoUrl` already exists (media-consent gated), so this leads with
 * the photo and falls back to a bold jersey plate when there isn't one. Stats
 * sit on solid white below the image so nothing gets washed out by the hero.
 *
 * `bothTeams` reflects the proposed league setting: award POTG from the
 * winning side only, or one from each team.
 */
export function PlayerOfGameCard({
  playerName,
  jersey,
  team,
  teamColor,
  line,
  gameLine,
  photoUrl,
  seasonNote,
  seasonContext,
  opponentAward,
}: {
  playerName: string
  jersey: string
  team: string
  teamColor: string
  line: { value: number; unit: string }[]
  gameLine: string
  photoUrl?: string | null
  /** One more beat of narrative — season arc, streak, first time, etc. */
  seasonNote?: string
  /** Small season-to-date strip so the night has context. */
  seasonContext?: { label: string; value: string }[]
  /** Set when the league awards one from each side. */
  opponentAward?: { playerName: string; jersey: string; team: string; teamColor: string; stat: string }
}) {
  return (
    <article className={shell}>
      <div className="relative">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="h-64 w-full object-cover sm:h-72" />
        ) : (
          <div
            className="relative flex h-56 w-full items-center justify-center overflow-hidden sm:h-64"
            style={{ background: "linear-gradient(140deg, var(--stage-2), rgba(10,16,30,0.92))" }}
          >
            <div className="pointer-events-none absolute -right-12 -top-12 h-52 w-52 rounded-full bg-white/10 blur-2xl" />
            <span className="font-condensed relative text-[7rem] font-black leading-none text-white/90">
              {jersey}
            </span>
          </div>
        )}
        {/* Legible scrim so the name never fights the photo */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-5 pb-4 pt-14 sm:px-6">
          <span className="bg-highlight text-highlight-on inline-block rounded-full px-2.5 py-1 text-[10.5px] font-black uppercase tracking-[0.18em]">
            Player of the game
          </span>
          <h3 className="font-condensed mt-2 text-[2.5rem] font-black uppercase leading-[0.9] text-white sm:text-[3rem]">
            {playerName}
          </h3>
          {/* Dropped clear of the name — it was crowding it (tester) */}
          <p className="mt-2 text-[13px] font-bold text-white/75">
            #{jersey} · {team}
          </p>
        </div>
      </div>

      {/* Stats on solid white — the old version buried them in the gradient */}
      <div className="border-ink-100 grid grid-cols-3 divide-x divide-ink-100 border-b">
        {line.map((s) => (
          <div key={s.unit} className="py-3.5 text-center">
            <p className="font-condensed text-ink-950 text-[2.1rem] font-black leading-none tabular-nums">
              {s.value}
            </p>
            <p className="text-ink-500 mt-1 text-[10.5px] font-black uppercase tracking-wider">
              {s.unit}
            </p>
          </div>
        ))}
      </div>

      {/* Written, not just a stat dump — the card should say what the night
          MEANT for this kid, and where it sits in their season (tester). */}
      <div className="px-5 py-4 sm:px-6">
        <p className="text-ink-800 text-[14.5px] leading-7">{gameLine}</p>
        {seasonNote && (
          <p className="text-ink-500 mt-2 text-[13px] leading-6">{seasonNote}</p>
        )}
        {seasonContext && seasonContext.length > 0 && (
          <div className="border-ink-100 mt-3.5 flex flex-wrap gap-x-5 gap-y-2 rounded-xl border px-3.5 py-2.5">
            {seasonContext.map((s) => (
              <div key={s.label}>
                <p className="text-ink-400 text-[10.5px] font-black uppercase tracking-wider">
                  {s.label}
                </p>
                <p className="font-condensed text-ink-900 text-[17px] font-black tabular-nums">
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {opponentAward && (
        <div className="border-ink-100 bg-ink-50 flex items-center gap-3 border-t px-5 py-3 sm:px-6">
          <span className="text-ink-400 text-[10.5px] font-black uppercase tracking-[0.16em]">
            Also honoured
          </span>
          <Crest label={opponentAward.jersey} size="h-8 w-8 text-[11px]" />
          <div className="min-w-0 flex-1">
            <p className="text-ink-900 truncate text-[13.5px] font-bold">{opponentAward.playerName}</p>
            <p className="text-ink-500 truncate text-[11.5px] font-semibold">{opponentAward.team}</p>
          </div>
          <span className="font-condensed text-ink-800 shrink-0 text-[15px] font-black">
            {opponentAward.stat}
          </span>
        </div>
      )}
    </article>
  )
}

/* ────────────────── 5b. PLAYERS OF THE GAME — BOTH SIDES ─────────────── */

export interface DualPotgSide {
  playerName: string
  jersey: string
  team: string
  teamColor: string
  tag: string
  line: { value: number; unit: string }[]
}

/**
 * The both-teams variant of the league setting: one honoured player per side,
 * shown as a genuine head-to-head rather than a winner plus a footnote. Each
 * half wears its own club colour so the split reads instantly; on phones they
 * stack, because two three-stat blocks cannot share 390px.
 */
/**
 * PlayerOfGameCompactCard - one game, three numbers, one line of meaning.
 *
 * The sibling of PlayerOfGameCard. That one is the feature: full-bleed photo,
 * narrative, season context. This is the one you post every night - the game
 * line and a single sentence naming what the kid actually did ("game high in
 * assists", "team high 24"). Nothing seasonal, nothing averaged.
 *
 * COLOUR: unlike the rest of the deck this defaults to the SportsHub brand
 * rather than ink. These are OUR posts - we publish them so families and clubs
 * can repost - so a generic branded look is correct when the club has no colour
 * of its own. Pass `accent` to fly the club's palette where one genuinely
 * exists; that still honours the 2026-08-14 ruling, which governs the club's
 * OWN surfaces, not cards we author.
 */
export function PlayerOfGameCompactCard({
  playerName,
  jersey,
  team,
  photoUrl,
  accent,
  line,
  achievement,
  gameLabel,
  handle,
  href,
}: {
  playerName: string
  jersey: string
  team: string
  photoUrl?: string | null
  /** Club colour when one exists. Defaults to the SportsHub brand. */
  accent?: string
  /** THIS GAME's line - three numbers, no averages. */
  line: { value: string; unit: string }[]
  /** The one sentence: what they led, what they set, what they won. */
  achievement: string
  /** e.g. "Gr 10 - Summit Select 61, Ironwood 58" */
  gameLabel?: string
  handle?: string
  href?: string
}) {
  const tint = accent ?? "#4f46e5" // play-600, the house purple
  const nameClass =
    "font-condensed block truncate text-[2.1rem] font-black uppercase leading-[0.95] text-white sm:text-[2.5rem]"
  return (
    <article className={shell}>
      <div
        className="relative flex items-center gap-4 px-5 py-5 sm:px-6"
        style={{ background: `linear-gradient(118deg, ${tint}, ${tint}cc 44%, rgba(11,17,30,0.95))` }}
      >
        <span className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-white/12 blur-3xl" />
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt=""
            className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-2xl object-cover ring-2 ring-white/30 sm:h-[5.5rem] sm:w-[5.5rem]"
          />
        ) : (
          <span className="font-condensed flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-2xl bg-white/12 text-[2.3rem] font-black leading-none text-white ring-2 ring-white/30 sm:h-[5.5rem] sm:w-[5.5rem]">
            {jersey}
          </span>
        )}
        <span className="relative min-w-0 flex-1">
          <span className="inline-block rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white backdrop-blur-sm">
            Player of the game
          </span>
          {href ? (
            <Link href={href} className={`${nameClass} mt-1.5 hover:underline`}>
              {playerName}
            </Link>
          ) : (
            <span className={`${nameClass} mt-1.5`}>{playerName}</span>
          )}
          <span className="mt-1 block truncate text-[12.5px] font-bold text-white/75">
            #{jersey} &middot; {team}
            {handle ? ` · @${handle}` : ""}
          </span>
        </span>
      </div>

      {/* This game only. */}
      <div className="border-ink-100 grid grid-cols-3 divide-x divide-ink-100 border-b">
        {line.map((s) => (
          <div key={s.unit} className="py-4 text-center">
            <p className="font-condensed text-ink-950 text-[2.2rem] font-black leading-none tabular-nums">
              {s.value}
            </p>
            <p className="text-ink-500 mt-1 text-[10.5px] font-black uppercase tracking-wider">
              {s.unit}
            </p>
          </div>
        ))}
      </div>

      {/* The line that says why this card exists. Tinted in the same colour as
          the band so the card reads as one object, with a rule the eye can
          follow from the numbers down to the sentence. */}
      <div
        className="border-l-[3px] px-5 py-3.5 sm:px-6"
        style={{ borderColor: tint, backgroundColor: `${tint}0f` }}
      >
        <p className="text-ink-900 text-[14.5px] font-semibold leading-6">{achievement}</p>
        {gameLabel && (
          <p className="text-ink-500 mt-1 text-[12px] font-medium">{gameLabel}</p>
        )}
      </div>
    </article>
  )
}

/**
 * PlayersOfTheGameRoundupCard — one graphic, a whole round of games.
 *
 * Modelled on the format leagues actually publish (owner reference: an Arete
 * Conference round-up, 2026): a locked masthead, then one row per fixture with
 * the two award winners facing each other across the final score. The value is
 * not any single game — it is that a parent sees the WHOLE round in one image,
 * and every club in it has a reason to repost.
 *
 * League-template conventions applied: the brand chrome is fixed and only the
 * variable fields change (round, fixtures, names, lines); a display face
 * carries names and numbers while a plain sans carries the stat labels.
 */
export function PlayersOfTheGameRoundupCard({
  eyebrow,
  competition,
  accent,
  games,
}: {
  /** e.g. "2026 Grade 9 · Round 1" */
  eyebrow: string
  /** e.g. "Arete Conference" */
  competition?: string
  accent?: string
  games: {
    home: { crest: string; score: number; player: { name: string; line: string[]; photoUrl?: string | null } }
    away: { crest: string; score: number; player: { name: string; line: string[]; photoUrl?: string | null } }
  }[]
}) {
  const tint = accent ?? "#4f46e5"
  const Face = ({
    p,
    side,
  }: {
    p: { name: string; line: string[]; photoUrl?: string | null }
    side: "l" | "r"
  }) => (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2.5 ${
        side === "r" ? "flex-row-reverse text-right" : ""
      }`}
    >
      {p.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={p.photoUrl}
          alt=""
          className="h-14 w-12 shrink-0 rounded-lg object-cover ring-1 ring-white/25 sm:h-16 sm:w-14"
        />
      ) : (
        <span className="flex h-14 w-12 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20 sm:h-16 sm:w-14">
          <span className="font-condensed text-[15px] font-black text-white/70">
            {p.name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)}
          </span>
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-[8.5px] font-black uppercase tracking-[0.16em] text-white/40">
          Player of the game
        </span>
        <span className="font-condensed mt-0.5 block truncate text-[15px] font-black uppercase leading-tight text-white sm:text-[17px]">
          {p.name}
        </span>
        <span className="mt-0.5 block text-[11px] font-bold tabular-nums text-white/60">
          {p.line.join("   ")}
        </span>
      </span>
    </div>
  )

  return (
    <article className="overflow-hidden rounded-3xl shadow-[0_24px_60px_-18px_rgba(30,41,59,0.55)]">
      {/* Masthead — the locked chrome. Only the round line ever changes. */}
      <div
        className="relative px-5 pb-5 pt-6 text-center sm:px-8"
        style={{ background: `linear-gradient(160deg, ${tint}, rgba(10,15,28,0.97) 62%)` }}
      >
        <span className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <p className="relative text-[9.5px] font-black uppercase tracking-[0.34em] text-white/60 sm:text-[11px]">
          {eyebrow}
        </p>
        <h3 className="font-condensed relative mt-1.5 text-[2.1rem] font-black uppercase leading-[0.92] tracking-tight text-white sm:text-[2.9rem]">
          Players of the game
        </h3>
        {competition && (
          <p className="relative mt-1.5 text-[12px] font-black uppercase tracking-[0.2em] text-white/70">
            ★&nbsp; {competition} &nbsp;★
          </p>
        )}
      </div>

      <div className="divide-y divide-white/10 bg-[#0b111e]">
        {games.map((g, i) => (
          <div key={i} className="px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <Face p={g.home.player} side="l" />
              <div className="shrink-0 text-center">
                <div className="flex items-center gap-2">
                  <span className="font-condensed text-[1.9rem] font-black leading-none tabular-nums text-white sm:text-[2.4rem]">
                    {g.home.score}
                  </span>
                  <span
                    className="rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white"
                    style={{ backgroundColor: tint }}
                  >
                    vs
                  </span>
                  <span className="font-condensed text-[1.9rem] font-black leading-none tabular-nums text-white/85 sm:text-[2.4rem]">
                    {g.away.score}
                  </span>
                </div>
                <p className="mt-1 truncate text-[9.5px] font-bold uppercase tracking-wider text-white/45">
                  {g.home.crest} · {g.away.crest}
                </p>
              </div>
              <Face p={g.away.player} side="r" />
            </div>
          </div>
        ))}
      </div>

      {/* Footer rule — where a league drops its sponsor lockups. */}
      <div
        className="flex items-center justify-center px-5 py-3"
        style={{ background: `linear-gradient(0deg, ${tint}, rgba(10,15,28,0.97))` }}
      >
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/70">
          SportsHub&nbsp;ONE
        </span>
      </div>
    </article>
  )
}

/**
 * PlayerOfGameSpotlightCard — the broadcast treatment.
 *
 * The league conventions applied straight: an oversized jersey number as
 * architecture behind the subject, the surname in a display face at a size that
 * would be absurd anywhere else, and the line as a banded stat block sitting ON
 * the stage rather than below it. Layered light — two blurred glows — instead
 * of a flat fill, which is what separates broadcast graphics from clip art.
 *
 * Use where the compact card is too quiet: a championship night, a career high,
 * the one a family would print.
 */
export function PlayerOfGameSpotlightCard({
  playerName,
  jersey,
  team,
  photoUrl,
  accent,
  line,
  achievement,
  gameLabel,
  href,
}: {
  playerName: string
  jersey: string
  team: string
  photoUrl?: string | null
  accent?: string
  line: { value: string; unit: string }[]
  achievement?: string
  gameLabel?: string
  href?: string
}) {
  const tint = accent ?? "#4f46e5"
  const parts = playerName.split(" ")
  const first = parts[0]
  const rest = parts.slice(1).join(" ")
  const NameBlock = (
    <>
      <span className="font-condensed block truncate text-[1.5rem] font-black uppercase leading-[0.9] text-white/70 sm:text-[1.9rem]">
        {first}
      </span>
      <span className="font-condensed block truncate text-[2.6rem] font-black uppercase leading-[0.88] text-white sm:text-[3.4rem]">
        {rest || first}
      </span>
    </>
  )
  return (
    <article className="overflow-hidden rounded-3xl shadow-[0_28px_70px_-20px_rgba(15,23,42,0.6)]">
      <div
        className="relative isolate overflow-hidden px-5 pb-5 pt-6 sm:px-7"
        style={{
          background: `linear-gradient(125deg, ${tint} 0%, rgba(14,20,36,0.96) 58%, rgba(8,12,22,0.99) 100%)`,
        }}
      >
        <span className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-white/12 blur-3xl" />
        <span
          className="pointer-events-none absolute -bottom-24 -left-20 h-64 w-64 rounded-full blur-3xl"
          style={{ backgroundColor: `${tint}55` }}
        />
        {/* The number as architecture. */}
        <span className="font-condensed pointer-events-none absolute -right-3 top-1/2 -translate-y-1/2 text-[11rem] font-black leading-none text-white/[0.07] sm:text-[15rem]">
          {jersey}
        </span>

        <p className="relative text-[10px] font-black uppercase tracking-[0.3em] text-white/65">
          Player of the game
        </p>

        <div className="relative mt-3 flex items-end gap-4">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt=""
              className="h-28 w-24 shrink-0 rounded-2xl object-cover ring-2 ring-white/25 sm:h-36 sm:w-32"
            />
          ) : null}
          <div className="min-w-0 flex-1 pb-1">
            {href ? (
              <Link href={href} className="block hover:underline">
                {NameBlock}
              </Link>
            ) : (
              NameBlock
            )}
            <p className="mt-2 truncate text-[12px] font-bold uppercase tracking-wider text-white/60">
              #{jersey} · {team}
            </p>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-3 overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur-sm">
          {line.map((s, i) => (
            <div
              key={s.unit}
              className={`py-3 text-center ${i > 0 ? "border-l border-white/15" : ""}`}
            >
              <p className="font-condensed text-[1.8rem] font-black leading-none tabular-nums text-white sm:text-[2.1rem]">
                {s.value}
              </p>
              <p className="mt-1 text-[9.5px] font-black uppercase tracking-[0.14em] text-white/55">
                {s.unit}
              </p>
            </div>
          ))}
        </div>
      </div>

      {achievement && (
        <div className="border-l-[3px] bg-white px-5 py-3.5 sm:px-7" style={{ borderColor: tint }}>
          <p className="text-ink-900 text-[14.5px] font-semibold leading-6">{achievement}</p>
          {gameLabel && <p className="text-ink-500 mt-1 text-[12px] font-medium">{gameLabel}</p>}
        </div>
      )}
    </article>
  )
}

export function DualPlayerOfGameCard({
  home,
  away,
  eyebrow = "Players of the game",
  note,
}: {
  home: DualPotgSide
  away: DualPotgSide
  eyebrow?: string
  note?: string
}) {
  const side = (p: DualPotgSide) => (
    <div className="bg-ink-50 relative flex-1 overflow-hidden p-5">
      <span className="bg-navy-900 absolute inset-x-0 top-0 h-1" />
      <span className="bg-ink-800 inline-block rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">
        {p.tag}
      </span>
      <div className="mt-3 flex items-center gap-3">
        <Crest label={p.jersey} size="h-12 w-12 text-[15px]" />
        <div className="min-w-0">
          <p className="text-ink-950 truncate text-[16px] font-extrabold leading-tight">
            {p.playerName}
          </p>
          <p className="text-ink-500 truncate text-[12.5px] font-semibold">{p.team}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {p.line.map((s) => (
          <div key={s.unit} className="rounded-xl bg-white/80 py-2.5 text-center shadow-sm">
            <p className="font-condensed text-ink-950 text-[1.6rem] font-black leading-none tabular-nums">
              {s.value}
            </p>
            <p className="text-ink-500 mt-1 text-[10px] font-black uppercase tracking-wider">
              {s.unit}
            </p>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <article className={shell}>
      <div className="bg-ink-950 px-5 py-3.5 text-center sm:px-6">
        <p className="text-highlight text-[11px] font-black uppercase tracking-[0.22em]">{eyebrow}</p>
      </div>
      <div className="flex flex-col sm:flex-row">
        {side(home)}
        <div className="bg-ink-100 h-px w-full sm:h-auto sm:w-px" />
        {side(away)}
      </div>
      {note && (
        <p className="text-ink-600 border-ink-100 border-t px-5 py-3.5 text-[13.5px] leading-6 sm:px-6">
          {note}
        </p>
      )}
    </article>
  )
}

/* ─────────────── 4b. CLUTCH STOP — the play that wasn't a bucket ───────── */

/**
 * Not every game turns on a shot. A charge taken, a block at the rim, a steal
 * on the inbound — those decide youth games constantly and currently go
 * unrecorded in the feed. Different shape from the game-winner card on
 * purpose: this one shows the closing SEQUENCE, so you see how the game
 * actually ended rather than a single line.
 */
export function ClutchPlayCard({
  playerName,
  jersey,
  team,
  teamColor,
  headline,
  playType,
  sequence,
  finalScore,
}: {
  playerName: string
  jersey: string
  team: string
  teamColor: string
  headline: string
  playType: string
  sequence: { clock: string; text: string; color?: string }[]
  finalScore: string
}) {
  return (
    <article className={shell}>
      <div className="bg-ink-950 relative overflow-hidden px-5 py-6 sm:px-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{ background: "radial-gradient(120% 100% at 100% 0%, var(--stage-2), transparent 60%)" }}
        />
        <span className="bg-highlight text-highlight-on relative inline-block rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]">
          {playType}
        </span>
        <h3 className="font-display relative mt-3 text-[1.45rem] font-black leading-tight text-white sm:text-[1.7rem]">
          {headline}
        </h3>
        <div className="relative mt-3.5 flex items-center gap-2.5">
          <Crest label={jersey} size="h-9 w-9 text-[12px]" surface="dark" />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-extrabold text-white">{playerName}</p>
            <p className="truncate text-[12px] font-semibold text-white/60">{team}</p>
          </div>
        </div>
      </div>

      {/* The closing sequence — what this card has that the winner card doesn't */}
      <div className="px-5 py-4 sm:px-6">
        <p className="text-ink-400 mb-2.5 text-[11px] font-black uppercase tracking-[0.16em]">
          How it ended
        </p>
        <ol className="relative space-y-3 pl-5">
          <span className="bg-ink-100 absolute bottom-2 left-[5px] top-2 w-px" />
          {sequence.map((s, i) => (
            <li key={i} className="relative">
              <span className="bg-ink-300 absolute -left-5 top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white" />
              <p className="text-ink-400 text-[11px] font-black uppercase tracking-wider">
                {s.clock}
              </p>
              <p className="text-ink-800 text-[13.5px] font-semibold leading-6">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
      <p className="bg-ink-50 text-ink-800 px-5 py-3 text-[13px] font-extrabold sm:px-6">
        Final · {finalScore}
      </p>
    </article>
  )
}

/* ──────────────── 7. RECAP VARIANTS — one story, three shapes ────────── */

export interface RecapSide {
  name: string
  color: string
  crest: string
  score: number
}

function Scoreline({ home, away }: { home: RecapSide; away: RecapSide }) {
  const homeWon = home.score > away.score
  return (
    <div className="divide-ink-50 border-ink-100 divide-y border-b">
      {(
        [
          [home, homeWon],
          [away, !homeWon],
        ] as Array<[RecapSide, boolean]>
      ).map(([s, won]) => (
        <div key={s.name} className="flex items-center gap-3 px-5 py-2.5 sm:px-6">
          <Crest label={s.crest} size="h-8 w-8 text-[11px]" />
          <span
            className={`min-w-0 flex-1 truncate text-[14px] ${won ? "text-ink-950 font-extrabold" : "text-ink-500 font-semibold"}`}
          >
            {s.name}
          </span>
          <span
            className={`font-condensed shrink-0 text-[1.5rem] font-black tabular-nums ${won ? "text-ink-950" : "text-ink-400"}`}
          >
            {s.score}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * A recap today is a chip, a headline and a paragraph — identical whether the
 * game was a one-point thriller or a forty-point walkover. These three read
 * the result first and dress the story to match, so a feed of recaps stops
 * looking like one template repeating.
 */

/** A. SCORELINE LEAD — the default. Result first, then the story. */
export function RecapScorelineCard({
  home,
  away,
  headline,
  body,
  topPerformer,
  meta,
}: {
  home: RecapSide
  away: RecapSide
  headline: string
  body: string
  topPerformer?: { name: string; line: string; color: string; jersey: string }
  meta: string
}) {
  return (
    <article className={shell}>
      <div className="border-ink-100 flex items-center justify-between border-b px-5 py-2.5 sm:px-6">
        <span className="text-ink-400 text-[11px] font-black uppercase tracking-[0.18em]">Recap</span>
        <span className="text-ink-400 text-[12px] font-semibold">{meta}</span>
      </div>
      <Scoreline home={home} away={away} />
      <div className="px-5 py-4 sm:px-6">
        <h3 className="font-display text-ink-950 text-[1.3rem] font-black leading-tight">
          {headline}
        </h3>
        <p className="text-ink-600 mt-2 text-[14px] leading-6">{body}</p>
        {topPerformer && (
          <div className="bg-ink-50 mt-3.5 flex items-center gap-2.5 rounded-xl p-2.5">
            <Crest label={topPerformer.jersey} size="h-9 w-9 text-[11.5px]" />
            <div className="min-w-0 flex-1">
              <p className="text-ink-950 truncate text-[13.5px] font-bold leading-tight">
                {topPerformer.name}
              </p>
              <p className="text-ink-500 truncate text-[11.5px] font-semibold">{topPerformer.line}</p>
            </div>
          </div>
        )}
      </div>
    </article>
  )
}

/** B. BLOWOUT — the margin IS the headline. */
export function RecapBlowoutCard({
  winner,
  loser,
  headline,
  body,
  meta,
}: {
  winner: RecapSide
  loser: RecapSide
  headline: string
  body: string
  meta: string
}) {
  const margin = winner.score - loser.score
  return (
    <article className={shell}>
      <div
        className="relative overflow-hidden px-5 py-6 text-white sm:px-6"
        style={{ background: "linear-gradient(130deg, var(--stage-2), rgba(10,16,30,0.9))" }}
      >
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <p className="relative text-[11px] font-black uppercase tracking-[0.22em] text-white/75">
          {meta}
        </p>
        <div className="relative mt-2 flex items-end gap-3">
          <span className="font-condensed text-[4.5rem] font-black leading-[0.8]">+{margin}</span>
          <span className="pb-2 text-[13px] font-black uppercase tracking-wider text-white/75">
            point win
          </span>
        </div>
        <p className="relative mt-3 text-[14px] font-bold">
          {winner.name} {winner.score} — {loser.score} {loser.name}
        </p>
      </div>
      <div className="px-5 py-4 sm:px-6">
        <h3 className="font-display text-ink-950 text-[1.3rem] font-black leading-tight">
          {headline}
        </h3>
        <p className="text-ink-600 mt-2 text-[14px] leading-6">{body}</p>
      </div>
    </article>
  )
}

/** C. THRILLER — close game, so the finish leads. */
export function RecapThrillerCard({
  home,
  away,
  headline,
  body,
  closing,
  meta,
}: {
  home: RecapSide
  away: RecapSide
  headline: string
  body: string
  closing: string
  meta: string
}) {
  const margin = Math.abs(home.score - away.score)
  return (
    <article className={shell}>
      <div className="bg-ink-950 relative overflow-hidden px-5 py-5 sm:px-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-45"
          style={{ background: "linear-gradient(100deg, var(--stage-2), transparent 45%, var(--stage-2))" }}
        />
        <div className="relative flex items-center justify-between">
          <span className="bg-live-600 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">
            Decided by {margin}
          </span>
          <span className="text-[12px] font-semibold text-white/60">{meta}</span>
        </div>
        <p className="font-condensed relative mt-3 text-[2rem] font-black leading-none text-white sm:text-[2.4rem]">
          {home.score} — {away.score}
        </p>
        <p className="relative mt-1.5 text-[13px] font-bold text-white/75">
          {home.name} vs {away.name}
        </p>
      </div>
      <div className="px-5 py-4 sm:px-6">
        <h3 className="font-display text-ink-950 text-[1.3rem] font-black leading-tight">
          {headline}
        </h3>
        <p className="text-ink-600 mt-2 text-[14px] leading-6">{body}</p>
        <div className="border-hoop-100 bg-hoop-50 mt-3.5 rounded-xl border px-3.5 py-2.5">
          <p className="text-hoop-700 text-[10.5px] font-black uppercase tracking-[0.16em]">
            How it finished
          </p>
          <p className="text-ink-800 mt-1 text-[13.5px] font-semibold leading-6">{closing}</p>
        </div>
      </div>
    </article>
  )
}

/* ─────────────── 8. ARTICLE TEASER — the feed's doorway to prose ──────── */

/**
 * A written article's card in the feed. Its ONLY job is to make someone open
 * it, so it carries the four things that decide that: a kicker saying what
 * kind of piece it is, a headline, a dek (the standfirst — a real sentence,
 * not a truncated paragraph), and the cost of reading it. Research on
 * long-form: summaries let readers assess a piece quickly, and byline plus
 * affiliation is what communicates authority.
 */
export function ArticleTeaserCard({
  kicker,
  headline,
  dek,
  byline,
  readMinutes,
  publishedAt,
  accentFrom,
  accentTo,
  tags,
}: {
  kicker: string
  headline: string
  dek: string
  byline: string
  readMinutes: number
  publishedAt: string
  accentFrom: string
  accentTo: string
  tags?: string[]
}) {
  return (
    <article className={shell}>
      {/* Colour band stands in for the hero image these will eventually carry */}
      <div
        className="relative h-28 overflow-hidden sm:h-32"
        style={{ background: `linear-gradient(115deg, ${accentFrom}, ${accentTo})` }}
      >
        <div className="pointer-events-none absolute -right-10 -top-14 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
        <div className="absolute inset-x-0 bottom-0 px-5 pb-3 sm:px-6">
          <span className="inline-block rounded-full bg-black/35 px-2.5 py-1 text-[10.5px] font-black uppercase tracking-[0.18em] text-white backdrop-blur-sm">
            {kicker}
          </span>
        </div>
      </div>

      <div className="px-5 py-4 sm:px-6">
        <h3 className="font-display text-ink-950 text-[1.35rem] font-black leading-[1.2] sm:text-[1.5rem]">
          {headline}
        </h3>
        {/* The dek — a written standfirst, not a chopped-off first paragraph */}
        <p className="text-ink-600 mt-2.5 text-[14.5px] leading-7">{dek}</p>

        {tags && tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="bg-ink-50 text-ink-600 ring-ink-100 rounded-full px-2.5 py-1 text-[11.5px] font-bold ring-1 ring-inset"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="border-ink-100 mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3">
          <span className="text-ink-800 text-[12.5px] font-bold">{byline}</span>
          <span className="text-ink-300">·</span>
          <span className="text-ink-500 text-[12.5px] font-semibold">{publishedAt}</span>
          <span className="text-ink-300">·</span>
          <span className="text-ink-500 text-[12.5px] font-semibold">{readMinutes} min read</span>
          <span className="text-play-700 ml-auto text-[13px] font-extrabold">Read →</span>
        </div>
      </div>
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
          className={`flex items-center gap-3 px-5 py-3.5 sm:px-6 ${won ? "bg-ink-50" : ""}`}
        >
          <Crest label={side.crest} />
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
