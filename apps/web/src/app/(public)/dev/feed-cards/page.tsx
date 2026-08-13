import { notFound } from "next/navigation"
import {
  FinalCard,
  LeaderboardCard,
  MatchupCard,
  PlayOfGameCard,
  PlayerOfGameCard,
  RivalryCard,
} from "@/components/social/cards/showcase-cards"

/**
 * DESIGN PREVIEW — not a product surface (2026-08-13).
 *
 * Renders every proposed feed card with sample data so the designs can be
 * judged before any of the content pipeline gets built. Dev-only: it 404s in
 * production so it can never leak. Sample names come from the fictional Maple
 * Court demo world; nothing here reads the database.
 */

const LAKESIDE = "#4f46e5"
const NORTHGATE = "#f24e1e"
const IRONWOOD = "#16a34a"
const HARBOUR = "#a16642"

export default function FeedCardsPreview() {
  // Belt and braces: `/dev` is already a DEV_ONLY_PREFIX in public-paths, so
  // middleware gates it too. This makes the page itself refuse to render live.
  if (process.env.NODE_ENV === "production") notFound()

  return (
    <main className="bg-ink-50/70 min-h-screen py-10">
      <div className="mx-auto w-full max-w-xl px-4">
        <header className="mb-8">
          <p className="text-ink-400 font-condensed text-[12px] font-black uppercase tracking-[0.2em]">
            Design preview
          </p>
          <h1 className="text-ink-950 mt-1 text-3xl font-black">Feed card concepts</h1>
          <p className="text-ink-600 mt-2 text-[14px] leading-6">
            Six layouts, deliberately different shapes so the feed never reads as one template
            repeating. Sample data only — nothing here is wired to real posts yet.
          </p>
        </header>

        <div className="space-y-8">
          <Section
            title="Leaderboard"
            when="Posts after each session or weekend"
            why="Turns the whole league into a competition instead of spotlighting one player. Five names per post, six stats to run — that is thirty kids featured a week, not one."
          >
            <LeaderboardCard
              statLabel="Points"
              unit="Points"
              period="Week 6 · Grade 10"
              rows={[
                { rank: 1, name: "Marcus Reid", team: "Summit Select", teamColor: LAKESIDE, jersey: "12", value: 24.6 },
                { rank: 2, name: "Elijah Carter", team: "Lakeside Storm", teamColor: IRONWOOD, jersey: "4", value: 21.2 },
                { rank: 3, name: "Andre Boateng", team: "Northgate Wolves", teamColor: NORTHGATE, jersey: "23", value: 19.8 },
                { rank: 4, name: "Tyrell Munro", team: "Harbour City", teamColor: HARBOUR, jersey: "7", value: 18.1 },
                { rank: 5, name: "Devon Clarke", team: "Ironwood Elite", teamColor: IRONWOOD, jersey: "31", value: 17.4 },
              ]}
            />
          </Section>

          <Section
            title="Matchup of the week"
            when="Posts midweek, before the games"
            why="The feed is almost entirely post-game today, so it goes silent exactly when people have nothing to look forward to. This gives them something to anticipate."
          >
            <MatchupCard
              home={{ name: "Ironwood Elite", short: "Ironwood Elite", record: "10-0", color: IRONWOOD, crest: "IE" }}
              away={{ name: "Harbour City Hoops", short: "Harbour City", record: "8-2", color: HARBOUR, crest: "HC" }}
              when="Saturday · 2:30 PM"
              venue="Six Park East · Court 3"
              note="First against second, and the only unbeaten record in Grade 10 is on the line."
            />
          </Section>

          <Section
            title="Rivalry / rematch"
            when="Posts when two teams meet again"
            why="Your data already knows they have played before. A tied season series is the most compelling story youth sport generates, and it writes itself."
          >
            <RivalryCard
              home={{ name: "Lakeside Storm", short: "Lakeside", record: "7-3", color: LAKESIDE, crest: "LS" }}
              away={{ name: "Northgate Wolves", short: "Northgate", record: "7-3", color: NORTHGATE, crest: "NW" }}
              seriesLine="Series tied 1–1"
              meetings={[
                { date: "Nov 9", result: "Lakeside 58 — 52 Northgate", winnerColor: LAKESIDE },
                { date: "Jan 18", result: "Northgate 61 — 49 Lakeside", winnerColor: NORTHGATE },
              ]}
              when="Sunday · 11:00 AM"
            />
          </Section>

          <Section
            title="Play of the game"
            when="Posts after a final"
            why="The play-by-play already flags scoring plays with a running score, so the go-ahead basket can be found automatically — no extra data entry."
          >
            <PlayOfGameCard
              playerName="Marcus Reid"
              jersey="12"
              teamColor={LAKESIDE}
              team="Summit Select"
              description="Reid pulls up from the wing and puts them ahead with 42 seconds left."
              clock="Q4 · 0:42"
              scoreAfter="58–56"
            />
          </Section>

          <Section
            title="Player of the game"
            when="Rebuilt from the current card"
            why="The stat line now rides up over the hero instead of sitting in a list — it reads like a trading card, which is what a family actually wants to share."
          >
            <PlayerOfGameCard
              playerName="Elijah Carter"
              jersey="4"
              team="Lakeside Storm"
              teamColor={IRONWOOD}
              line={[
                { value: 24, unit: "PTS" },
                { value: 11, unit: "REB" },
                { value: 5, unit: "AST" },
              ]}
              gameLine="A double-double in a six-point win, plus the block that ended it."
            />
          </Section>

          <Section
            title="Final"
            when="Rebuilt from the current result card"
            why="Winner is tinted in its own colour with a WIN chip, and the quarter strip along the bottom tells the shape of the game without opening it."
          >
            <FinalCard
              home={{ name: "Lakeside Storm", short: "Lakeside Storm", record: "7-3", color: LAKESIDE, crest: "LS" }}
              away={{ name: "Northgate Wolves", short: "Northgate Wolves", record: "7-3", color: NORTHGATE, crest: "NW" }}
              homeScore={58}
              awayScore={52}
              quarters={[
                { home: 14, away: 12 },
                { home: 16, away: 11 },
                { home: 12, away: 17 },
                { home: 16, away: 12 },
              ]}
              note="Grade 10 · Six Park East"
            />
          </Section>
        </div>
      </div>
    </main>
  )
}

function Section({
  title,
  when,
  why,
  children,
}: {
  title: string
  when: string
  why: string
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-ink-950 text-[19px] font-black">{title}</h2>
          <span className="bg-play-50 text-play-700 rounded-full px-2.5 py-0.5 text-[11px] font-bold">
            {when}
          </span>
        </div>
        <p className="text-ink-500 mt-1.5 text-[13px] leading-5">{why}</p>
      </div>
      {children}
    </section>
  )
}
