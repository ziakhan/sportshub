"use client"

/**
 * Parent-cut game day: no scoring console, just the public game page the way
 * a family actually watches it. The page is mirrored from /live/[gameId]
 * through the shared game-page.tsx pieces (score hero, Game/Stats/Plays tabs,
 * linescore, two-sided leaders, team-stats bars, box score), and updates
 * itself cell by cell with the product's green flash.
 */

import { cn } from "@/components/ui/cn"
import { GAME, KID } from "../data"
import {
  BoxRow,
  BoxScoreCard,
  GameHero,
  GameTabs,
  LeadersCard,
  LinescoreCard,
  SectionH3,
  TeamStatsCard,
} from "../scenes/game-page"
import type { LiveScene } from "./engine"

const MARIA = "Maria (parent)"

const Hold = ({ id, children, block }: { id: string; children: React.ReactNode; block?: boolean }) => (
  <span data-live-id={id} className={cn("rounded-xl", block ? "block" : "inline-block")}>
    {children}
  </span>
)

/* Box rows just before the closing run; Jayden/Marcus/Malik move during it. */
const STARTERS: BoxRow[] = [
  { jersey: 23, name: "Jayden T.", pts: 18, reb: 6, ast: 3, stl: 1, to: 2, floor: true, top: true },
  { jersey: 7, name: "Marcus C.", pts: 11, reb: 2, ast: 4, stl: 0, to: 1, floor: true },
  { jersey: 11, name: "Malik O.", pts: 9, reb: 7, ast: 1, stl: 0, to: 1, floor: true },
  { jersey: 4, name: "Ethan P.", pts: 6, reb: 1, ast: 2, stl: 2, to: 0, floor: true },
  { jersey: 15, name: "Owen C.", pts: 5, reb: 4, ast: 0, stl: 0, to: 1, floor: true },
]
const BENCH: BoxRow[] = [
  { jersey: 21, name: "Isaiah G.", pts: 4, reb: 5, ast: 0, stl: 0, to: 0 },
  { jersey: 9, name: "Andre B.", pts: 3, reb: 1, ast: 1, stl: 1, to: 1 },
  { jersey: 33, name: "Kai N.", pts: 2, reb: 2, ast: 0, stl: 0, to: 0 },
  { jersey: 12, name: "Darius B.", pts: 1, reb: 0, ast: 1, stl: 0, to: 0 },
  { jersey: 5, name: "Amir K.", pts: 0, reb: 1, ast: 0, stl: 0, to: 1 },
  { jersey: 30, name: "Cole A.", pts: 0, reb: 2, ast: 0, stl: 0, to: 0 },
]

/* The one parent game-day scene: the page scores itself */
const parentBoxScore: LiveScene = {
  id: "l-parent-boxscore",
  act: "pgame",
  persona: "parent",
  personaLabel: MARIA,
  frame: "phone",
  caption:
    "Game day, from the stands or from work. This is the live game page every family gets: score up top, leaders and team stats below, and every number keeps itself current. Watch Jayden's three, the Huskies' answer, and Malik's rebound land the second they happen.",
  script: [
    { wait: 1600 },
    // Jayden hits a three, Marcus assists: hero, linescore and leaders flash
    { set: { three: true } },
    { wait: 2600 },
    // Huskies answer inside
    { set: { answer: true } },
    { wait: 2400 },
    // Over to the Stats tab for the full box score
    { press: "tabStats" },
    { set: { tab: "box" } },
    { wait: 1000 },
    // Malik rips the defensive board off a Huskies miss
    { set: { board: true } },
    { wait: 2200 },
    { set: { final: true } },
    { wait: 900 },
    { hold: "boxCard" },
  ],
  render: (g) => {
    const three = !!g("three")
    const answer = !!g("answer")
    const board = !!g("board")
    const fin = !!g("final")
    const tab = g("tab") === "box" ? ("box" as const) : ("game" as const)
    const homeScore = three ? 62 : 59
    const awayScore = answer ? 58 : 56
    const jaydenPts = three ? 21 : 18
    const marcusAst = three ? 5 : 4
    const malikReb = board ? 8 : 7
    const starters = STARTERS.map((p) =>
      p.jersey === 23
        ? { ...p, pts: jaydenPts, flashPts: three, floor: !fin }
        : p.jersey === 7
          ? { ...p, ast: marcusAst, flashAst: three, floor: !fin }
          : p.jersey === 11
            ? { ...p, reb: malikReb, flashReb: board, floor: !fin }
            : { ...p, floor: !fin }
    )
    return (
      <div className="min-h-full bg-white pb-6">
        <GameHero
          homeScore={homeScore}
          awayScore={awayScore}
          state={fin ? "final" : "live"}
          clock={three ? "0:41" : "1:58"}
          flashHome={three}
          flashAway={answer && !fin}
        />
        <div className="px-3">
          <GameTabs active={tab} statsHoldId="tabStats" />
          {tab === "game" ? (
            <div className="mt-3">
              <LinescoreCard
                rows={[
                  {
                    color: GAME.homeColor,
                    short: GAME.homeShort,
                    quarters: [16, 14, 15, three ? 17 : 14],
                    total: homeScore,
                    flashQ4: three,
                    flashTotal: three,
                  },
                  {
                    color: GAME.awayColor,
                    short: GAME.awayShort,
                    quarters: [15, 16, 13, answer ? 14 : 12],
                    total: awayScore,
                    flashQ4: answer,
                    flashTotal: answer,
                  },
                ]}
              />
              <SectionH3>Game leaders</SectionH3>
              <LeadersCard
                sections={[
                  {
                    label: "Points",
                    home: {
                      jersey: 23,
                      name: KID.short,
                      value: jaydenPts,
                      unit: "PTS",
                      sub: "6 REB · 3 AST",
                      flash: three,
                    },
                    away: { jersey: 10, name: "Noah S.", value: answer ? 18 : 16, unit: "PTS", sub: "5 REB · 2 AST", flash: answer },
                  },
                  {
                    label: "Rebounds",
                    home: {
                      jersey: 11,
                      name: "Malik O.",
                      value: malikReb,
                      unit: "REB",
                      sub: board ? "6 DReb · 2 OReb" : "5 DReb · 2 OReb",
                      flash: board,
                    },
                    away: { jersey: 8, name: "Ibrahim H.", value: 7, unit: "REB", sub: "5 DReb · 2 OReb" },
                  },
                  {
                    label: "Assists",
                    home: {
                      jersey: 7,
                      name: "Marcus C.",
                      value: marcusAst,
                      unit: "AST",
                      sub: "11 PTS · 1 TO",
                      flash: three,
                    },
                    away: { jersey: 3, name: "Lucas K.", value: 4, unit: "AST", sub: "12 PTS · 2 TO" },
                  },
                  {
                    label: "Defense",
                    home: { jersey: 4, name: "Ethan P.", value: 2, unit: "STL", sub: "2 STL · 0 BLK" },
                    away: { jersey: 6, name: "Felix W.", value: 2, unit: "STL", sub: "2 STL · 0 BLK" },
                  },
                ]}
              />
              <SectionH3>Team stats</SectionH3>
              <TeamStatsCard
                rows={[
                  {
                    label: "Field goals",
                    home: three ? 24 / 51 : 23 / 50,
                    away: answer ? 22 / 54 : 21 / 53,
                    displayHome: three ? "24-51 · 47%" : "23-50 · 46%",
                    displayAway: answer ? "22-54 · 41%" : "21-53 · 40%",
                    flashHome: three,
                    flashAway: answer,
                  },
                  {
                    label: "3-pointers",
                    home: three ? 5 / 14 : 4 / 13,
                    away: 4 / 16,
                    displayHome: three ? "5-14 · 36%" : "4-13 · 31%",
                    displayAway: "4-16 · 25%",
                    flashHome: three,
                  },
                  { label: "Free throws", home: 9 / 12, away: 10 / 15, displayHome: "9-12 · 75%", displayAway: "10-15 · 67%" },
                  { label: "Rebounds", home: board ? 32 : 31, away: 29 },
                  { label: "Assists", home: three ? 13 : 12, away: 11, flashHome: three },
                  { label: "Steals", home: 4, away: 5 },
                  { label: "Blocks", home: 1, away: 2 },
                  { label: "Turnovers", home: 7, away: 9 },
                  { label: "Fouls", home: 17, away: 14 },
                ]}
              />
            </div>
          ) : (
            <div className="mt-3">
              <Hold id="boxCard" block>
                <BoxScoreCard
                  starters={starters}
                  bench={BENCH}
                  live={!fin}
                  totals={{
                    pts: homeScore,
                    reb: 31 + (board ? 1 : 0),
                    ast: 12 + (three ? 1 : 0),
                    stl: 4,
                    to: 7,
                  }}
                />
              </Hold>
            </div>
          )}
        </div>
      </div>
    )
  },
}

/* Team chat: the coach posts, the poll runs, Maria votes without leaving */
const liveChat: LiveScene = {
  id: "l-parent-chat",
  act: "schedule",
  persona: "parent",
  personaLabel: MARIA,
  frame: "phone",
  caption:
    "Team chat lives next to the calendar: pinned notes from the coach, and quick polls the whole team answers in a tap. Maria votes on the team dinner.",
  script: [
    { wait: 800 },
    { set: { msg2: true } },
    { wait: 1400 },
    { press: "pollOpt" },
    { set: { voted: true } },
    { wait: 900 },
    { hold: "pollsLink" },
  ],
  render: (g) => (
    <div className="bg-ink-50/60 min-h-full px-4 pb-10 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-ink-950 text-base font-bold">Burlington Force Grade 10</p>
          <p className="text-ink-400 text-xs">Burlington Force · Team chat</p>
        </div>
        <Hold id="pollsLink">
          <span className="text-play-700 text-xs font-bold">Polls</span>
        </Hold>
      </div>
      <div className="border-ink-100 mt-3 rounded-2xl border bg-white">
        <div className="border-ink-100 flex items-center gap-2 border-b px-3 py-2">
          <span className="text-xs">📌</span>
          <p className="text-ink-600 flex-1 truncate text-xs">
            <span className="font-bold">David Okafor:</span> Practice moves to Haber Rec on
            Thursday, 7pm, Court 2.
          </p>
        </div>
        <div className="space-y-3 px-3 py-3">
          <p className="text-ink-400 text-center text-[10px] font-bold uppercase">Today</p>
          <div className="max-w-[85%]">
            <p className="text-ink-400 mb-0.5 text-[10px] font-semibold">
              David Okafor{" "}
              <span className="bg-play-50 text-play-700 rounded px-1 py-px text-[8px] font-bold">STAFF</span>
              <span className="ml-1">4:12 PM</span>
            </p>
            <div className="bg-ink-50 text-ink-800 rounded-2xl px-3 py-2 text-xs">
              Great win Saturday. Film session before Thursday practice, doors at 6:40.
            </div>
          </div>
          {!!g("msg2") && (
            <div className="live-row-in ml-auto max-w-[85%]">
              <p className="text-ink-400 mb-0.5 text-right text-[10px] font-semibold">You · 4:20 PM</p>
              <div className="bg-play-600 rounded-2xl px-3 py-2 text-xs text-white">
                Jayden will be there. Is the team dinner still on after the last session?
              </div>
            </div>
          )}
          <div className="border-ink-100 max-w-[92%] rounded-2xl border p-3">
            <p className="text-ink-900 text-xs font-bold">📊 Team dinner spot for June 28?</p>
            <div className="mt-2 space-y-1.5">
              {[
                { label: "Boston Pizza on Fairview", count: g("voted") ? 9 : 8, mine: !!g("voted") },
                { label: "The Works Burlington", count: 4 },
                { label: "Potluck at the gym", count: 1 },
              ].map((o, i) => {
                const total = g("voted") ? 14 : 13
                const row = (
                  <div className="border-ink-100 relative overflow-hidden rounded-lg border px-2.5 py-1.5">
                    <div
                      className={cn("absolute inset-y-0 left-0", o.mine ? "bg-court-100" : "bg-ink-50")}
                      style={{ width: `${Math.round((o.count / total) * 100)}%` }}
                    />
                    <div className="relative flex items-center justify-between text-[11px]">
                      <span className="text-ink-800 font-semibold">
                        {o.label}{" "}
                        {o.mine && <span className="text-court-700 live-pop inline-block">✓ your pick</span>}
                      </span>
                      <span className="text-ink-500">
                        {o.count} · {Math.round((o.count / total) * 100)}%
                      </span>
                    </div>
                  </div>
                )
                return i === 0 ? (
                  <div key={o.label} data-live-id="pollOpt">
                    {row}
                  </div>
                ) : (
                  <div key={o.label}>{row}</div>
                )
              })}
            </div>
            <p className="text-ink-400 mt-1.5 text-[10px]">
              {g("voted") ? "14 votes" : "13 votes · tap to vote"}
            </p>
          </div>
        </div>
        <div className="border-ink-100 flex items-center gap-2 border-t px-3 py-2.5">
          <span>📊</span>
          <div className="border-ink-200 text-ink-400 flex-1 rounded-full border px-3 py-1.5 text-xs">
            Message the team…
          </div>
          <span className="bg-play-600 rounded-xl px-3 py-1.5 text-xs font-bold text-white">Send</span>
        </div>
      </div>
    </div>
  ),
}

export const ACT_PARENT_GAMEDAY: LiveScene[] = [liveChat, parentBoxScore]
