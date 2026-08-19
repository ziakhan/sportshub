import { notFound } from "next/navigation"
import { prisma } from "@youthbasketballhub/db"
import { getSeasonLeaders } from "@/lib/queries/season-stats"
import Link from "next/link"
import { PlayerMug } from "@/components/ui"
import {
  ArticleTeaserCard,
  ClutchPlayCard,
  DualPlayerOfGameCard,
  FinalCard,
  GameWinnerCard,
  LeaderboardCard,
  MatchupCard,
  PlayerOfGameCard,
  RecapBlowoutCard,
  RecapScorelineCard,
  RecapThrillerCard,
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

/** Deterministic colour per team when a club hasn't set branding. */
const PALETTE = ["#4f46e5", "#f24e1e", "#16a34a", "#a16642", "#0891b2", "#c026d3", "#ca8a04"]
function colorFor(teamId: string, branded?: string | null) {
  if (branded) return branded
  let h = 0
  for (let i = 0; i < teamId.length; i++) h = (h * 31 + teamId.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

/**
 * REAL leaderboards from the database (2026-08-13). The season with the most
 * completed games wins, and `getSeasonLeaders` — the same query the public
 * league leaders page uses — supplies points/rebounds/assists/steals/blocks.
 * So these cards carry actual players, actual clubs and actual numbers, which
 * is the point: they have to look right for every team, not for sample data.
 */
async function realLeaderboards() {
  const season = await (prisma as any).game.groupBy({
    by: ["seasonId"],
    where: { status: "COMPLETED", seasonId: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { seasonId: "desc" } },
    take: 1,
  })
  const seasonId: string | undefined = season?.[0]?.seasonId
  if (!seasonId) return null
  const leaders = await getSeasonLeaders(seasonId, 5)
  if (!leaders) return null

  const teamIds = [...new Set(leaders.categories.flatMap((c: any) => c.rows.map((r: any) => r.teamId)))]
  const teams = await (prisma as any).team.findMany({
    where: { id: { in: teamIds } },
    select: { id: true, tenant: { select: { branding: { select: { primaryColor: true } } } } },
  })
  const colors = new Map<string, string>(
    teams.map((t: any) => [t.id, colorFor(t.id, t.tenant?.branding?.primaryColor)])
  )

  const jerseys = await (prisma as any).teamPlayer.findMany({
    where: { teamId: { in: teamIds } },
    select: { teamId: true, playerId: true, jerseyNumber: true },
  })
  const jerseyOf = new Map<string, string>(
    jerseys.map((j: any) => [`${j.teamId}:${j.playerId}`, j.jerseyNumber ? String(j.jerseyNumber) : "–"])
  )

  return {
    label: `${leaders.season.leagueName} · ${leaders.season.label}`,
    boards: leaders.categories.map((cat: any) => ({
      statLabel: cat.label,
      unit: cat.label,
      rows: cat.rows.slice(0, 5).map((r: any, i: number) => ({
        rank: i + 1,
        name: `${r.firstName} ${r.lastName}`.trim(),
        team: r.teamName,
        teamColor: colors.get(r.teamId) ?? PALETTE[0],
        jersey: jerseyOf.get(`${r.teamId}:${r.playerId}`) ?? "–",
        value: Math.round(r.value * 10) / 10,
      })),
    })),
  }
}

export default async function FeedCardsPreview() {
  // Belt and braces: `/dev` is already a DEV_ONLY_PREFIX in public-paths, so
  // middleware gates it too. This makes the page itself refuse to render live.
  if (process.env.NODE_ENV === "production") notFound()

  const live = await realLeaderboards()

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
            {/* BOTH, deliberately: the sample set is the one to show people
                (clean names, tidy numbers), the live set proves it works
                against real data. Neither replaces the other. */}
            <div className="space-y-8">
              <div className="space-y-5">
                <p className="border-play-200 bg-play-50 text-play-800 rounded-xl border px-3 py-2 text-[12.5px] font-bold">
                  Sample data — the demo set, safe to show anyone
                </p>
                {LEADERBOARDS.map((b) => (
                  <LeaderboardCard key={`sample-${b.statLabel}`} {...b} period="Week 6 · Grade 10" />
                ))}
              </div>

              {live && (
                <div className="space-y-5">
                  <p className="border-court-200 bg-court-50 text-court-800 rounded-xl border px-3 py-2 text-[12.5px] font-bold">
                    Live data — real players, clubs and averages from {live.label}
                  </p>
                  {live.boards.map((b: any) => (
                    <LeaderboardCard key={`live-${b.statLabel}`} {...b} period={live.label} />
                  ))}
                </div>
              )}
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
                { label: "APG", value: "3.1" },
                { label: "Double-doubles", value: "7" },
                { label: "Team record", value: "7-3" },
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
            title="Player of the game — v2 concepts"
            when="Three to choose from"
            why="The card above is a photo frame with a stat strip under it, and it reads plain: nothing on it says broadcast, trophy or keepsake. These three take the same night and give it three different silhouettes — a broadcast stage, a torn ticket, a lower third — so the choice is about which one a family actually wants on their phone, not about which shade of grey the stat row is."
          >
            <div className="space-y-8">
              <p className="border-play-200 bg-play-50 text-play-800 rounded-xl border px-3 py-2 text-[12.5px] font-bold">
                Sample data — the demo set, safe to show anyone
              </p>

              <Variant
                tag="v2a"
                name="Broadcast mug"
                caption="Emphasises the PLAYER: the mug is the biggest thing on the card, and the score is demoted to a footer."
              >
                <PotgBroadcastCard />
              </Variant>

              <Variant
                tag="v2b"
                name="Ticket stub"
                caption="Emphasises the OCCASION: a specific night at a specific gym, printed and torn, with the stat line on the half you keep."
              >
                <PotgTicketCard />
              </Variant>

              <Variant
                tag="v2c"
                name="Lower third"
                caption="Emphasises the GAME: the quarters are on it, so the award arrives attached to the scoreboard it came out of."
              >
                <PotgLowerThirdCard />
              </Variant>
            </div>
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
            title="Article teaser → full article"
            when="For any written piece: previews, features, season notebooks"
            why="A schedule line gives nobody a reason to stay. This card's only job is to earn the click — kicker, headline, a written standfirst, byline and read time — and it opens into a real article with background, form and players. Tap it to see the article page."
          >
            <Link href="/dev/feed-cards/article" className="block">
              <ArticleTeaserCard
                kicker="Matchup of the week"
                headline="Unbeaten and unconvincing: Ironwood face the one team that has already taken them to the wire"
                dek="Ten wins, no losses, and a growing sense that the record flatters them. Harbour City arrive on Saturday with a two-point defeat still fresh and the personnel to repeat it."
                byline="SportsHub One"
                readMinutes={4}
                publishedAt="Thursday"
                accentFrom={IRONWOOD}
                accentTo={HARBOUR}
                tags={["Grade 10", "Ironwood Elite", "Harbour City"]}
              />
            </Link>
          </Section>

          <Section
            title="Recap — three variants"
            when="Replaces today's single recap layout"
            why="Right now every recap looks identical whether the game was a one-point thriller or a forty-point walkover: a grey chip, a headline, a paragraph. These read the RESULT first and dress the story to match, so a feed of recaps stops looking like one template repeating."
          >
            <div className="space-y-5">
              <RecapScorelineCard
                home={{ name: "Lakeside Storm", color: LAKESIDE, crest: "LS", score: 58 }}
                away={{ name: "Northgate Wolves", color: NORTHGATE, crest: "NW", score: 52 }}
                headline="Carter's double-double carries Lakeside past Northgate"
                body="Lakeside controlled the glass all afternoon and never trailed after half-time, though Northgate cut it to three with under two minutes left before Carter's block ended the comeback."
                topPerformer={{ name: "Elijah Carter", line: "24 PTS · 11 REB · 5 AST", color: LAKESIDE, jersey: "4" }}
                meta="Grade 10 · Saturday"
              />
              <RecapBlowoutCard
                winner={{ name: "Ironwood Elite", color: IRONWOOD, crest: "IE", score: 71 }}
                loser={{ name: "Eastfield Eagles", color: HARBOUR, crest: "EE", score: 40 }}
                headline="Ironwood stay unbeaten with their most complete performance yet"
                body="A 22-2 run spanning the first and second quarters put this out of reach before half-time, and Ironwood emptied the bench for the last six minutes."
                meta="Grade 10 · Sunday"
              />
              <RecapThrillerCard
                home={{ name: "Harbour City", color: HARBOUR, crest: "HC", score: 53 }}
                away={{ name: "Summit Select", color: LAKESIDE, crest: "SS", score: 54 }}
                headline="Summit steal it at the buzzer after trailing the whole second half"
                body="Harbour City led by as many as nine and still had the ball with thirty seconds left, but two empty possessions opened the door."
                closing="Reid tied it with 0:18 on the clock, Harbour City turned it over on the inbound, and Reid hit the go-ahead jumper with four seconds left."
                meta="Grade 10 · Saturday"
              />
            </div>
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

/* ══════════════════ PLAYER OF THE GAME — v2 CONCEPTS ══════════════════════
 *
 * Three templates for the SAME night (2026-08-19), because the shipped POTG
 * card reads plain: a photo frame, three numbers, a paragraph. Not one of
 * these is wired to anything — they live on this preview page only, so the
 * demo directory and the real feed keep showing the shipped card until one of
 * these is chosen.
 *
 * ONE NIGHT, THREE SILHOUETTES. Same player, same line, same final, so the
 * comparison is about the template rather than about the data. The sample is
 * the page's own Maple Court set: Elijah Carter, the card directly above.
 *
 * DESIGN CONSULT (ui-ux-pro-max, 2026-08-19) — what it changed:
 *   · every text/ground pair is checked against 4.5:1. On light grounds that
 *     retires `ink-400` for labels (3.0:1) and `ink-500` for small caps
 *     (4.4:1) in favour of `ink-600` (5.9:1). On the navy stage white stays
 *     at 70% or above and the gold eyebrow is `gold-400` (9.5:1);
 *   · ink on gold is the `highlight-on` token (#3b2a06, 8:1), never
 *     `gold-600` on `gold-400`, which is 1.9:1 and unreadable;
 *   · the winner is never marked by colour ALONE — gold always arrives with
 *     a caret or the word FINAL beside it;
 *   · one type scale across all three (10.5 / 12.5 / 14 / 24 / 32 / 40),
 *     not per-card sizes.
 *
 * PRODUCT-UI LAW: every mark here is hand-authored DOM/SVG — the mug, the
 * ribbon notch, the perforation, the barcode. No images, no emoji as icons.
 */

/** House number style: 1.2K, never 1234. Applied to every value rendered. */
function abbrev(n: number): string {
  if (Math.abs(n) < 1000) return String(n)
  const k = n / 1000
  return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}K`
}

/** The shipped card shell — same ring, radius and drop as showcase-cards. */
const V2_SHELL =
  "ring-ink-950/10 relative overflow-hidden rounded-3xl bg-white shadow-[0_24px_60px_-18px_rgba(30,41,59,0.45)] ring-1"

/**
 * The arena, lit from above: score-hero's radial highlight over the stage
 * gradient. Tokens only, so an admin palette swap takes these with it.
 */
const STAGE_BG =
  "radial-gradient(120% 150% at 50% -20%, rgba(255,255,255,0.10) 0%, transparent 60%), linear-gradient(160deg, var(--stage-2), var(--stage))"

/** One night out of the Maple Court demo world, shared by all three. */
const POTG = {
  player: "Elijah Carter",
  jersey: "4",
  /** PlayerMug hashes its accent tone off this in production. */
  accentKey: "sample-elijah-carter",
  team: "Lakeside Storm",
  teamShort: "Lakeside",
  teamColor: LAKESIDE,
  opponent: "Northgate Wolves",
  opponentShort: "Northgate",
  teamScore: 58,
  opponentScore: 52,
  line: [
    { unit: "PTS", value: 24 },
    { unit: "REB", value: 11 },
    { unit: "AST", value: 5 },
  ],
  competition: "Maple Court · Grade 10",
  date: "Sat 8 Feb",
  venue: "Six Park East · Court 3",
  serial: "MC-2602-0458",
  /** Quarters, home first — the same shape the FinalCard below is given. */
  quarters: [
    [14, 12],
    [16, 11],
    [12, 17],
    [16, 12],
  ] as Array<[number, number]>,
}

/** Label + caption around each concept, so the owner can name what they pick. */
function Variant({
  tag,
  name,
  caption,
  children,
}: {
  tag: string
  name: string
  caption: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="mb-2 flex items-baseline gap-2">
        <span className="bg-ink-950 rounded-md px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.14em] text-white">
          {tag}
        </span>
        <span className="text-ink-900 text-[14px] font-bold">{name}</span>
      </p>
      {children}
      <p className="text-ink-600 mt-2 text-[13px] leading-5">{caption}</p>
    </div>
  )
}

/* ── v2a. Broadcast mug ──────────────────────────────────────────────────── */

/**
 * The player at broadcast scale. The mug is the composition rather than a
 * thumbnail beside a headline, the ribbon is a real notched flag, and the
 * final is demoted to a footer strip — this card's job is "look who this was",
 * not "here is a result".
 */
function PotgBroadcastCard() {
  return (
    <article className={V2_SHELL}>
      {/* Thin team-colour edge — the ONLY club colour on the card, and it
          never carries text, so an importer-assigned hue cannot hurt. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 z-10 w-1.5"
        style={{ backgroundColor: POTG.teamColor }}
      />

      <div className="relative pl-7 pr-5 pt-6 sm:pl-8 sm:pr-6" style={{ backgroundImage: STAGE_BG }}>
        <div className="flex items-center gap-4 sm:gap-5">
          <PlayerMug
            name={POTG.player}
            jerseyNumber={POTG.jersey}
            accentKey={POTG.accentKey}
            surface="dark"
            sizeClassName="h-[88px] w-[88px] rounded-2xl sm:h-[104px] sm:w-[104px]"
            frameClassName="bg-white/[0.06] ring-2 ring-inset ring-gold-400/55"
            className="shadow-lg"
          />
          <div className="min-w-0 flex-1">
            {/* Notched gold flag, cut in CSS rather than drawn as an image. */}
            <span
              className="bg-gold-400 inline-block py-1 pl-2.5 pr-5 text-[10.5px] font-black uppercase tracking-[0.18em] text-[#0b1628]"
              style={{ clipPath: "polygon(0 0, 100% 0, calc(100% - 11px) 50%, 100% 100%, 0 100%)" }}
            >
              Player of the game
            </span>
            <h3 className="font-display mt-2 text-[24px] font-black leading-[1.02] text-white sm:text-[32px]">
              {POTG.player}
            </h3>
            <p className="mt-1.5 text-[12.5px] font-semibold text-white/70">
              #{POTG.jersey} · {POTG.team}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2.5 pb-5">
          {POTG.line.map((s) => (
            <div
              key={s.unit}
              className="rounded-2xl bg-white/[0.08] py-3 text-center ring-1 ring-inset ring-white/15"
            >
              <p className="font-condensed text-[2.1rem] font-bold leading-none tabular-nums text-white">
                {abbrev(s.value)}
              </p>
              <p className="text-gold-400 mt-1 text-[10.5px] font-black uppercase tracking-[0.18em]">
                {s.unit}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer strip: the result, kept deliberately small. Painted with the
          stage's own darkest stop rather than a black alpha — an alpha here
          would composite against the card's WHITE body, not the navy. */}
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-white/10 py-3 pl-7 pr-5 sm:pl-8 sm:pr-6"
        style={{ backgroundColor: "var(--stage)" }}
      >
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/80 ring-1 ring-inset ring-white/20">
          Final
        </span>
        <span className="text-gold-400 flex items-center gap-1.5 text-[13px] font-bold">
          {/* A caret, so the winner is not marked by colour alone. */}
          <svg viewBox="0 0 10 10" className="h-2 w-2 fill-current" aria-hidden="true">
            <path d="M5 0l5 10H0z" />
          </svg>
          {POTG.team}
          <span className="font-condensed text-[17px] font-bold tabular-nums">
            {abbrev(POTG.teamScore)}
          </span>
        </span>
        <span className="text-[13px] font-semibold text-white/60">
          {POTG.opponent}{" "}
          <span className="font-condensed text-[17px] font-bold tabular-nums">
            {abbrev(POTG.opponentScore)}
          </span>
        </span>
      </div>
    </article>
  )
}

/* ── v2b. Ticket stub ────────────────────────────────────────────────────── */

/**
 * The night as a printed object. Main panel plus a torn-off stub, split by a
 * real perforation — two notches punched out of the card edge and a dashed
 * rule between them. The stat line lives on the stub, which is the half a
 * person keeps, and the barcode is drawn rather than fetched.
 */
function PotgTicketCard() {
  return (
    <article className={`${V2_SHELL} flex`}>
      {/* The punched notches. Filled with the page ground (ink-50 at 70% over
          white = #f9f9fa) so the card genuinely looks bitten into. */}
      <span
        aria-hidden="true"
        className="absolute right-[104px] top-0 z-20 h-3.5 w-3.5 -translate-y-1/2 translate-x-1/2 rounded-full bg-[#f9f9fa] sm:right-[122px]"
      />
      <span
        aria-hidden="true"
        className="absolute bottom-0 right-[104px] z-20 h-3.5 w-3.5 translate-x-1/2 translate-y-1/2 rounded-full bg-[#f9f9fa] sm:right-[122px]"
      />

      {/* ── main panel ── */}
      <div className="min-w-0 flex-1">
        {/* The one gold accent: a foil band across the head of the ticket. */}
        <div className="from-gold-500 via-gold-400 to-gold-500 bg-gradient-to-r px-4 py-1.5 sm:px-5">
          <p className="text-highlight-on text-[10.5px] font-black uppercase tracking-[0.2em]">
            Player of the game
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <h3 className="font-condensed text-ink-950 text-[28px] font-black uppercase leading-[0.94] tracking-[-0.005em] sm:text-[34px]">
            {POTG.player}
          </h3>
          <p className="text-ink-600 mt-1.5 text-[12.5px] font-semibold">
            #{POTG.jersey} · {POTG.team}
          </p>

          <div className="border-ink-200 mt-3.5 border-t border-dashed pt-3.5">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-4">
              {[
                ["League", "Maple Court"],
                ["Grade", "Grade 10"],
                ["Date", POTG.date],
                ["Venue", "Six Park East"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-ink-600 text-[9px] font-black uppercase tracking-[0.16em]">
                    {label}
                  </dt>
                  <dd className="text-ink-950 mt-0.5 text-[12px] font-bold leading-tight">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <p className="border-ink-200 mt-3.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-dashed pt-3 text-[12.5px]">
            <span className="text-ink-600 text-[9px] font-black uppercase tracking-[0.16em]">
              Final
            </span>
            <span className="text-ink-950 font-bold">
              {POTG.teamShort}{" "}
              <span className="font-condensed text-[16px] tabular-nums">
                {abbrev(POTG.teamScore)}
              </span>
            </span>
            <span className="text-ink-600 font-semibold">
              {POTG.opponentShort}{" "}
              <span className="font-condensed text-[16px] tabular-nums">
                {abbrev(POTG.opponentScore)}
              </span>
            </span>
          </p>
        </div>
      </div>

      {/* ── stub ── */}
      <div className="bg-ink-100 border-ink-300 relative w-[104px] shrink-0 border-l border-dashed sm:w-[122px]">
        <div className="px-3 py-4">
          {POTG.line.map((s, i) => (
            <div
              key={s.unit}
              className={
                i === 0
                  ? "text-center"
                  : "border-ink-300 mt-2.5 border-t border-dashed pt-2.5 text-center"
              }
            >
              <p className="font-condensed text-ink-950 text-[26px] font-black leading-none tabular-nums">
                {abbrev(s.value)}
              </p>
              <p className="text-ink-600 mt-0.5 text-[9px] font-black uppercase tracking-[0.16em]">
                {s.unit}
              </p>
            </div>
          ))}

          <div className="mt-4">
            <Barcode seed={POTG.serial} />
            <p className="text-ink-600 mt-1 text-center text-[8px] font-bold uppercase tracking-[0.12em]">
              {POTG.serial}
            </p>
          </div>
        </div>
      </div>
    </article>
  )
}

/** Hand-drawn barcode: bar widths derived from the serial, so it is stable. */
function Barcode({ seed }: { seed: string }) {
  const bars: Array<[number, number]> = []
  let x = 0
  for (let i = 0; i < seed.length * 2 && x < 96; i++) {
    const code = seed.charCodeAt(i % seed.length)
    const w = 1 + ((code + i * 7) % 3)
    bars.push([x, w])
    x += w + 1 + ((code + i) % 2)
  }
  return (
    <svg viewBox="0 0 96 26" className="h-[26px] w-full" role="img" aria-label="Ticket barcode">
      {bars.map(([bx, bw]) => (
        <rect key={bx} x={bx} y="0" width={bw} height="26" className="fill-ink-900" />
      ))}
    </svg>
  )
}

/* ── v2c. Lower third ────────────────────────────────────────────────────── */

/**
 * The television cut. The quarters ride the top in score-hero's own frosted
 * strip, and the award arrives as a gold lower-third bar over the navy with
 * the stat chips riding its right end — so the card carries the shape of the
 * game, not just its result.
 */
function PotgLowerThirdCard() {
  const totals = POTG.quarters.reduce(
    (t, [h, a]) => [t[0] + h, t[1] + a] as [number, number],
    [0, 0] as [number, number]
  )
  const rows: Array<[string, string, number[], number, boolean]> = [
    [POTG.teamShort, "LS", POTG.quarters.map((q) => q[0]), totals[0], true],
    [POTG.opponentShort, "NW", POTG.quarters.map((q) => q[1]), totals[1], false],
  ]

  return (
    <article className={V2_SHELL}>
      <div className="relative" style={{ backgroundImage: STAGE_BG }}>
        <div className="px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5">
          <p className="text-center text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/70">
            {POTG.competition} · {POTG.date}
          </p>

          {/* score-hero's linescore, verbatim in look: frosted glass, tabular
              numbers, the total column carrying the highlight. */}
          <div className="mt-3 overflow-x-auto rounded-2xl bg-white/[0.08] ring-1 ring-inset ring-white/15">
            <table className="w-full text-center tabular-nums">
              <caption className="sr-only">Scoring by period</caption>
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">
                  <th className="py-1.5 pl-3 text-left" />
                  {[1, 2, 3, 4].map((p) => (
                    <th key={p} className="px-2 py-1.5 sm:px-4">
                      {p}
                    </th>
                  ))}
                  <th className="px-2.5 py-1.5 pr-3 text-white/85 sm:px-3">Tot</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([name, crest, periods, total, won]) => (
                  <tr key={name} className="border-t border-white/10">
                    <td className="py-1.5 pl-3 text-left">
                      <span className="flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/[0.14] text-[10px] font-extrabold text-white ring-1 ring-inset ring-white/20">
                          {crest}
                        </span>
                        <span className="whitespace-nowrap text-[12.5px] font-semibold text-white/90">
                          {name}
                        </span>
                      </span>
                    </td>
                    {periods.map((v, i) => (
                      <td
                        key={i}
                        className="font-condensed px-2 py-1.5 text-[17px] font-medium leading-none text-white/85 sm:px-4 sm:text-[19px]"
                      >
                        {abbrev(v)}
                      </td>
                    ))}
                    <td
                      className={`font-condensed px-2.5 py-1.5 pr-3 text-[19px] font-bold leading-none sm:px-3 sm:text-[21px] ${
                        won ? "text-highlight" : "text-white/85"
                      }`}
                    >
                      {abbrev(total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* The lower third itself, seated on the bottom edge of the stage. */}
        <div className="bg-gold-400 flex items-stretch">
          <span className="flex shrink-0 items-center bg-[#0b1628] px-2.5 sm:px-3">
            <span className="font-condensed text-gold-400 text-[18px] font-bold leading-none tabular-nums sm:text-[22px]">
              #{POTG.jersey}
            </span>
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 sm:gap-3 sm:px-4">
            <div className="min-w-0 flex-1">
              <p className="text-highlight-on whitespace-nowrap text-[8.5px] font-black uppercase tracking-[0.14em] sm:text-[9.5px] sm:tracking-[0.2em]">
                Player of the game
              </p>
              <p className="font-condensed truncate text-[20px] font-black uppercase leading-[1.05] text-[#0b1628] sm:text-[28px]">
                {POTG.player}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              {POTG.line.map((s) => (
                <span
                  key={s.unit}
                  className="flex w-[40px] flex-col items-center rounded-lg bg-[#0b1628] px-1 py-1.5 sm:w-[52px]"
                >
                  <span className="font-condensed text-[15px] font-bold leading-none tabular-nums text-white sm:text-[18px]">
                    {abbrev(s.value)}
                  </span>
                  <span className="text-gold-400 mt-0.5 text-[8px] font-black uppercase tracking-[0.1em] sm:text-[9px]">
                    {s.unit}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
        <p className="bg-[#0b1628] px-4 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/70 sm:px-5">
          {POTG.team} · {POTG.venue}
        </p>
      </div>
    </article>
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
