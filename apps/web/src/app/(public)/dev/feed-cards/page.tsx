import { notFound } from "next/navigation"
import {
  ClutchPlayCard,
  DualPlayerOfGameCard,
  FinalCard,
  GameWinnerCard,
  LeaderboardCard,
  MatchupCard,
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

/** All five stats run every session — five names each means 25 kids featured
 *  per week, not one. Threes and other splits can follow the same shape. */
const LEADERBOARDS = [
  {
    statLabel: "Points",
    unit: "Points",
    rows: [
      { rank: 1, name: "Marcus Reid", team: "Summit Select", teamColor: LAKESIDE, jersey: "12", value: 24.6 },
      { rank: 2, name: "Elijah Carter", team: "Lakeside Storm", teamColor: IRONWOOD, jersey: "4", value: 21.2 },
      { rank: 3, name: "Andre Boateng", team: "Northgate Wolves", teamColor: NORTHGATE, jersey: "23", value: 19.8 },
      { rank: 4, name: "Tyrell Munro", team: "Harbour City", teamColor: HARBOUR, jersey: "7", value: 18.1 },
      { rank: 5, name: "Devon Clarke", team: "Ironwood Elite", teamColor: IRONWOOD, jersey: "31", value: 17.4 },
    ],
  },
  {
    statLabel: "Rebounds",
    unit: "Rebounds",
    rows: [
      { rank: 1, name: "Elijah Carter", team: "Lakeside Storm", teamColor: IRONWOOD, jersey: "4", value: 12.4 },
      { rank: 2, name: "Kwame Osei", team: "Ironwood Elite", teamColor: IRONWOOD, jersey: "15", value: 10.8 },
      { rank: 3, name: "Andre Boateng", team: "Northgate Wolves", teamColor: NORTHGATE, jersey: "23", value: 9.9 },
      { rank: 4, name: "Marcus Reid", team: "Summit Select", teamColor: LAKESIDE, jersey: "12", value: 8.6 },
      { rank: 5, name: "Sam Whitfield", team: "Harbour City", teamColor: HARBOUR, jersey: "9", value: 8.2 },
    ],
  },
  {
    statLabel: "Assists",
    unit: "Assists",
    rows: [
      { rank: 1, name: "Tyrell Munro", team: "Harbour City", teamColor: HARBOUR, jersey: "7", value: 8.1 },
      { rank: 2, name: "Marcus Reid", team: "Summit Select", teamColor: LAKESIDE, jersey: "12", value: 6.9 },
      { rank: 3, name: "Jaden Cole", team: "Lakeside Storm", teamColor: LAKESIDE, jersey: "3", value: 6.2 },
      { rank: 4, name: "Devon Clarke", team: "Ironwood Elite", teamColor: IRONWOOD, jersey: "31", value: 5.4 },
      { rank: 5, name: "Noah Adeyemi", team: "Northgate Wolves", teamColor: NORTHGATE, jersey: "8", value: 4.8 },
    ],
  },
  {
    statLabel: "Steals",
    unit: "Steals",
    rows: [
      { rank: 1, name: "Jaden Cole", team: "Lakeside Storm", teamColor: LAKESIDE, jersey: "3", value: 3.6 },
      { rank: 2, name: "Noah Adeyemi", team: "Northgate Wolves", teamColor: NORTHGATE, jersey: "8", value: 3.1 },
      { rank: 3, name: "Tyrell Munro", team: "Harbour City", teamColor: HARBOUR, jersey: "7", value: 2.8 },
      { rank: 4, name: "Marcus Reid", team: "Summit Select", teamColor: LAKESIDE, jersey: "12", value: 2.4 },
      { rank: 5, name: "Kwame Osei", team: "Ironwood Elite", teamColor: IRONWOOD, jersey: "15", value: 2.1 },
    ],
  },
  {
    statLabel: "Blocks",
    unit: "Blocks",
    rows: [
      { rank: 1, name: "Kwame Osei", team: "Ironwood Elite", teamColor: IRONWOOD, jersey: "15", value: 3.2 },
      { rank: 2, name: "Elijah Carter", team: "Lakeside Storm", teamColor: IRONWOOD, jersey: "4", value: 2.7 },
      { rank: 3, name: "Sam Whitfield", team: "Harbour City", teamColor: HARBOUR, jersey: "9", value: 2.0 },
      { rank: 4, name: "Andre Boateng", team: "Northgate Wolves", teamColor: NORTHGATE, jersey: "23", value: 1.6 },
      { rank: 5, name: "Devon Clarke", team: "Ironwood Elite", teamColor: IRONWOOD, jersey: "31", value: 1.3 },
    ],
  },
]

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
            <div className="space-y-5">
              {LEADERBOARDS.map((b) => (
                <LeaderboardCard key={b.statLabel} {...b} period="Week 6 · Grade 10" />
              ))}
            </div>
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
              note="Ironwood have not lost since October, and they have done it the hard way — four of their last six were decided by a single possession. Harbour City arrive as the only side to hold them under fifty, back in the November meeting Ironwood escaped 48–46. Win here and Harbour City draw level at the top with three to play."
              watch={[
                { name: "Kwame Osei", jersey: "15", color: IRONWOOD, line: "10.8 REB · 3.2 BLK" },
                { name: "Devon Clarke", jersey: "31", color: IRONWOOD, line: "17.4 PTS · 5.4 AST" },
                { name: "Tyrell Munro", jersey: "7", color: HARBOUR, line: "18.1 PTS · 8.1 AST" },
                { name: "Sam Whitfield", jersey: "9", color: HARBOUR, line: "8.2 REB · 2.0 BLK" },
              ]}
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
              headline="Third time settles it: Lakeside and Northgate meet with the season series level"
              lede="They have split the year so far, and neither night looked like the other. Lakeside controlled the November meeting on the glass; Northgate answered in January by turning it into a track meet and winning the second half by fourteen. Both sit 7-3, both need this to stay in touch with Ironwood, and the winner takes the tiebreaker into seeding."
              meetings={[
                {
                  date: "Nov 9",
                  result: "Lakeside 58 — 52 Northgate",
                  winnerColor: LAKESIDE,
                  note: "Lakeside +11 on the boards; Carter with 14 rebounds.",
                },
                {
                  date: "Jan 18",
                  result: "Northgate 61 — 49 Lakeside",
                  winnerColor: NORTHGATE,
                  note: "Northgate scored 34 after half-time; Boateng 24 points.",
                },
              ]}
              keyPlayers={[
                { name: "Elijah Carter", jersey: "4", color: LAKESIDE, line: "14 REB in the first meeting" },
                { name: "Andre Boateng", jersey: "23", color: NORTHGATE, line: "24 PTS in the rematch" },
              ]}
              stakes="Winner holds the head-to-head tiebreaker and stays within two of first place with three games to play."
              when="Sunday · 11:00 AM · Six Park East"
            />
          </Section>

          <Section
            title="Game winner"
            when="Only when a game turns on one moment"
            why="Renamed from 'play of the game' — posting one after every routine final would devalue it. Scarcity is what makes this worth opening. The play-by-play already flags scoring plays with a running score, so the go-ahead bucket is findable automatically."
          >
            <GameWinnerCard
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
              gameLine="A double-double in a six-point win, and the block with eleven seconds left that ended Northgate's last possession. Carter has now grabbed double-figure rebounds in five straight, and Lakeside are 6-1 when he does."
              seasonNote="It is his third Player of the Game this season — only Marcus Reid has more."
              seasonContext={[
                { label: "PPG", value: "16.4" },
                { label: "RPG", value: "12.4" },
              ]}
              opponentAward={{
                playerName: "Andre Boateng",
                jersey: "23",
                team: "Northgate Wolves",
                teamColor: NORTHGATE,
                stat: "19 PTS",
              }}
            />
          </Section>

          <Section
            title="Players of the game — both sides"
            when="When the league honours one per team"
            why="The other half of the proposed league setting. A head-to-head split rather than a winner plus a footnote, so both clubs get something worth resharing."
          >
            <DualPlayerOfGameCard
              home={{
                playerName: "Elijah Carter",
                jersey: "4",
                team: "Lakeside Storm",
                teamColor: LAKESIDE,
                tag: "Lakeside",
                line: [
                  { value: 24, unit: "PTS" },
                  { value: 11, unit: "REB" },
                  { value: 5, unit: "AST" },
                ],
              }}
              away={{
                playerName: "Andre Boateng",
                jersey: "23",
                team: "Northgate Wolves",
                teamColor: NORTHGATE,
                tag: "Northgate",
                line: [
                  { value: 19, unit: "PTS" },
                  { value: 7, unit: "REB" },
                  { value: 3, unit: "STL" },
                ],
              }}
              note="Carter's double-double edged it, but Boateng kept Northgate within a possession until the final minute."
            />
          </Section>

          <Section
            title="Clutch stop"
            when="When a game ends on defence"
            why="Not every game turns on a shot — a block, a charge, a steal on the inbound. Different shape from the game-winner card: this one shows the closing sequence, so you see how the game actually ended."
          >
            <ClutchPlayCard
              playerName="Kwame Osei"
              jersey="15"
              team="Ironwood Elite"
              teamColor={IRONWOOD}
              playType="Game-saving stop"
              headline="Osei blocks it at the rim with four seconds left to save the unbeaten run"
              sequence={[
                { clock: "0:26", text: "Harbour City inbound trailing by one.", color: HARBOUR },
                { clock: "0:11", text: "Munro drives the right side and draws two defenders.", color: HARBOUR },
                { clock: "0:04", text: "Osei rotates over and blocks the layup off the glass.", color: IRONWOOD },
                { clock: "0:00", text: "Ironwood rebound, run out the clock.", color: IRONWOOD },
              ]}
              finalScore="Ironwood 54 — 53 Harbour City"
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
