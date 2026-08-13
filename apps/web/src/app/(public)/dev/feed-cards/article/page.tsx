import Link from "next/link"
import { notFound } from "next/navigation"

/**
 * DESIGN PREVIEW — a full generated preview article (2026-08-13). Dev-only.
 *
 * This is what an "upcoming game" post opens INTO. The feed teaser exists to
 * earn this click; this page has to reward it, which a schedule line never
 * could. Layout follows long-form research:
 *   · body constrained to ~65–75 characters (max-w-[68ch]) — full-width prose
 *     on a desktop monitor is the fastest way to lose a reader
 *   · 1.75 line-height on body copy
 *   · pull quote in a distinct face to break the wall of text and give the
 *     eye a rest point; it is a real <blockquote> for screen readers
 *   · never paginated — one scroll, no "next page"
 *   · byline + read time up top, because authority and cost decide reading
 */

const IRONWOOD = "#16a34a"
const HARBOUR = "#a16642"

export default function PreviewArticle() {
  if (process.env.NODE_ENV === "production") notFound()

  return (
    <main className="bg-white">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <header
        className="relative overflow-hidden px-5 pb-10 pt-12 text-white sm:px-8"
        style={{ background: `linear-gradient(125deg, ${IRONWOOD}, #0d1526 60%, ${HARBOUR})` }}
      >
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="relative mx-auto w-full max-w-[68ch]">
          <Link
            href="/dev/feed-cards"
            className="text-[12.5px] font-bold text-white/70 hover:text-white"
          >
            ← Back to the card set
          </Link>
          <p className="mt-6 inline-block rounded-full bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] backdrop-blur-sm">
            Matchup of the week
          </p>
          <h1 className="font-display mt-4 text-[2.1rem] font-black leading-[1.08] sm:text-[3rem]">
            Unbeaten and unconvincing: Ironwood face the one team that has already
            taken them to the wire
          </h1>
          <p className="mt-4 text-[16px] leading-8 text-white/80">
            Ten wins, no losses, and a growing sense that the record flatters them.
            Harbour City arrive on Saturday with a two-point defeat still fresh and
            the personnel to repeat it.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-semibold text-white/70">
            <span className="text-white">SportsHub One</span>
            <span>·</span>
            <span>Maple Court League</span>
            <span>·</span>
            <span>4 min read</span>
          </div>
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-[68ch] px-5 py-10 sm:px-8">
        <p className="text-ink-800 text-[17px] leading-[1.75]">
          Ironwood Elite have not lost a game since October. That is the headline, and
          it is true, and it is also the least interesting thing about them right now.
          Four of their last six wins were decided by a single possession, and the
          margin that once averaged fourteen points has shrunk to under five.
        </p>
        <p className="text-ink-800 mt-5 text-[17px] leading-[1.75]">
          Harbour City are the reason the question exists at all. Back in November they
          held Ironwood to 48 — still the only time anyone has kept them under fifty —
          and lost by two on a possession that ended with a contested three. Since then
          they have won seven of nine and quietly climbed to second.
        </p>

        {/* Team form — a scannable break in the prose */}
        <div className="my-8 grid gap-3 sm:grid-cols-2">
          {[
            { name: "Ironwood Elite", color: IRONWOOD, record: "10-0", form: "W W W W W", note: "Avg margin 4.8 in last six" },
            { name: "Harbour City", color: HARBOUR, record: "8-2", form: "W W L W W", note: "Held Ironwood to a season-low 48" },
          ].map((t) => (
            <div
              key={t.name}
              className="rounded-2xl border p-4"
              style={{ borderColor: `${t.color}33`, backgroundColor: `${t.color}0d` }}
            >
              <div className="flex items-center justify-between">
                <p className="text-ink-950 text-[14.5px] font-extrabold">{t.name}</p>
                <span
                  className="font-condensed text-[19px] font-black tabular-nums"
                  style={{ color: t.color }}
                >
                  {t.record}
                </span>
              </div>
              <p className="text-ink-500 mt-1.5 text-[12px] font-black uppercase tracking-wider">
                {t.form}
              </p>
              <p className="text-ink-600 mt-2 text-[13px] leading-6">{t.note}</p>
            </div>
          ))}
        </div>

        <h2 className="font-display text-ink-950 mt-9 text-[1.45rem] font-black leading-tight">
          The matchup that decides it
        </h2>
        <p className="text-ink-800 mt-3 text-[17px] leading-[1.75]">
          Kwame Osei is the tallest player on the floor and the reason Ironwood&apos;s
          defence holds up when their shooting does not. He is averaging 3.2 blocks and
          10.8 rebounds, and in November he kept Harbour City to nine second-chance
          points across the whole game.
        </p>

        {/* Pull quote — semantic blockquote, distinct face, breathing room */}
        <figure className="border-hoop-400 my-8 border-l-4 pl-5">
          <blockquote className="font-display text-ink-950 text-[1.35rem] font-black leading-[1.35]">
            &ldquo;They have won ten games without ever looking comfortable. Saturday is
            the first time that stops being a curiosity and starts being a
            problem.&rdquo;
          </blockquote>
          <figcaption className="text-ink-500 mt-2.5 text-[12.5px] font-semibold">
            <cite className="not-italic">Maple Court League notebook</cite>
          </figcaption>
        </figure>

        <p className="text-ink-800 text-[17px] leading-[1.75]">
          The counter is Tyrell Munro, who leads the league in assists at 8.1 and has
          spent the season pulling bigger defenders away from the rim. If he draws Osei
          out on to the perimeter, Harbour City get the lane they were denied in
          November.
        </p>

        {/* Players to watch — inline, not a sidebar */}
        <div className="border-ink-100 my-8 rounded-2xl border p-4">
          <p className="text-ink-400 mb-3 text-[11px] font-black uppercase tracking-[0.16em]">
            Players to watch
          </p>
          <div className="space-y-3">
            {[
              { name: "Kwame Osei", team: "Ironwood Elite", jersey: "15", color: IRONWOOD, line: "10.8 REB · 3.2 BLK · 62% at the rim" },
              { name: "Tyrell Munro", team: "Harbour City", jersey: "7", color: HARBOUR, line: "18.1 PTS · 8.1 AST · league leader in assists" },
            ].map((p) => (
              <div key={p.name} className="flex items-center gap-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[13px] font-black text-white"
                  style={{ backgroundColor: p.color }}
                >
                  {p.jersey}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-ink-950 truncate text-[14.5px] font-extrabold leading-tight">
                    {p.name}
                  </p>
                  <p className="text-ink-500 truncate text-[12.5px] font-semibold">{p.team}</p>
                  <p className="text-ink-600 mt-0.5 truncate text-[12.5px]">{p.line}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-ink-800 text-[17px] leading-[1.75]">
          A Harbour City win pulls them level at the top with three games to play and
          hands them the head-to-head tiebreaker. An Ironwood win, however narrow,
          makes the rest of the season a formality.
        </p>

        {/* Fixture footer */}
        <div className="bg-ink-950 mt-9 rounded-2xl px-5 py-4 text-white">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/60">
            The game
          </p>
          <p className="mt-1.5 text-[16px] font-extrabold">
            Ironwood Elite vs Harbour City · Saturday 2:30 PM
          </p>
          <p className="mt-0.5 text-[13px] font-semibold text-white/70">
            Six Park East · Court 3 · Grade 10
          </p>
        </div>
      </div>
    </main>
  )
}
