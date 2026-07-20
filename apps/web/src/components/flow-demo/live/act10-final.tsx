"use client"

/**
 * Act 11 — The whistle and the sheet: referee sign-off by PIN, the game goes
 * final, the one-page official scoresheet (with PDF download), and the
 * automatic distribution: scoresheet email to both clubs' managers and the
 * league office, Final Score bell to every family. Mirrors the console review
 * state, /scoresheet/[gameId], and the finalize route's real templates.
 */

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/components/ui/cn"
import { GAME, LEAGUE } from "../data"
import { LiveInput } from "./anim"
import type { LiveScene } from "./engine"
import { typeIn } from "./helpers"

const TABLE = "Scorer's table"
const FINAL_TITLE = `${GAME.home} ${GAME.finalHome}-${GAME.finalAway} ${GAME.away}`

const Hold = ({ id, children, block }: { id: string; children: React.ReactNode; block?: boolean }) => (
  <span data-live-id={id} className={cn("rounded-xl", block ? "block" : "inline-block")}>
    {children}
  </span>
)

/* F1 — Review and referee sign-off */
const review: LiveScene = {
  id: "l-review",
  act: "final",
  persona: "club",
  personaLabel: TABLE,
  frame: "desktop",
  url: "/games/g10-w1-force-huskies/score",
  caption:
    "The horn sounds; the console flips to review. This league requires referee sign-off: Mike enters his PIN.",
  script: [
    { wait: 500 },
    { press: "pinToggle" },
    { set: { pin: true } },
    { wait: 400 },
    { press: "refPill" },
    { set: { ref: true } },
    { wait: 400 },
    ...typeIn("pinInput", "pinVal", "••••", 8),
    { hold: "markFinal" },
    { set: { done: true } },
    { wait: 400 },
    { confirm: "Final. Scoresheet on its way" },
  ],
  render: (g) => (
    <div className="bg-ink-50 min-h-[560px] px-10 py-10">
      <h2 className="text-ink-950 text-center text-2xl font-bold">Review: {FINAL_TITLE}</h2>
      <div className="mx-auto mt-5 grid max-w-3xl grid-cols-2 gap-4">
        {[
          [GAME.home, [["Jayden T.", 21, 6, 3], ["Marcus C.", 11, 2, 5], ["Malik O.", 9, 8, 1]]],
          [GAME.away, [["Noah S.", 18, 5, 2], ["Lucas K.", 12, 3, 4], ["Ibrahim H.", 9, 7, 1]]],
        ].map(([team, rows]) => (
          <Card key={String(team)} size="sm" className="overflow-hidden p-0">
            <p className="bg-ink-50 text-ink-900 px-4 py-2 text-sm font-bold">{String(team)}</p>
            <table className="w-full">
              <thead className="border-ink-100 border-b">
                <tr>
                  {["Player", "PTS", "REB", "AST"].map((h) => (
                    <th key={h} className="text-ink-500 px-3 py-1.5 text-left text-[10px] font-extrabold uppercase tracking-[0.12em]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-ink-50 divide-y">
                {(rows as [string, number, number, number][]).map(([n, p, r, a]) => (
                  <tr key={n}>
                    <td className="text-ink-800 px-3 py-1.5 text-sm">{n}</td>
                    <td className="text-ink-900 px-3 py-1.5 text-sm font-bold">{p}</td>
                    <td className="text-ink-800 px-3 py-1.5 text-sm">{r}</td>
                    <td className="text-ink-800 px-3 py-1.5 text-sm">{a}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}
      </div>
      <Card className="mx-auto mt-5 max-w-3xl">
        <div className="flex items-center justify-between">
          <p className="text-ink-900 text-sm font-bold">Referee approval (required by this league)</p>
          <div className="flex gap-1.5 text-xs font-semibold">
            <span className="border-ink-200 text-ink-500 rounded-full border px-3 py-1">Signature</span>
            <span
              data-live-id="pinToggle"
              className={cn(
                "rounded-full border px-3 py-1 transition-colors",
                g("pin") ? "border-play-300 bg-play-50 text-play-700" : "border-ink-200 text-ink-500"
              )}
            >
              Referee PIN
            </span>
          </div>
        </div>
        {!!g("pin") && (
          <div className="live-row-in">
            <p className="text-ink-500 mt-2 text-sm">
              The assigned referee enters their personal PIN, verified against their account, the
              strongest form of approval.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <span
                data-live-id="refPill"
                className={cn(
                  "rounded-full border px-3 py-1 text-sm font-semibold transition-colors",
                  g("ref") ? "border-play-300 bg-play-50 text-play-700" : "border-ink-200 text-ink-600"
                )}
              >
                Mike Ferreira
              </span>
              <div className="w-40">
                <LiveInput id="pinInput" value={g("pinVal") as string} caret={!!g("pinVal:caret")} placeholder="Referee PIN" />
              </div>
            </div>
          </div>
        )}
      </Card>
      <div className="mx-auto mt-5 flex max-w-3xl items-center justify-between">
        <span className="text-ink-500 text-sm font-semibold">&larr; Back to scoring</span>
        <Hold id="markFinal">
          <Button>Mark final</Button>
        </Hold>
      </div>
    </div>
  ),
}

/* F2 — The official scoresheet, one page, print-ready */
type SheetRow = [number, string, number, string, string, string, string, number, number, number]
// jersey, name, fouls, Q1..Q4 marks, REB, AST, PTS
const HOME_SHEET: SheetRow[] = [
  [23, "Jayden Thompson", 2, "3 2", "2 2 ●●", "2 3", "3 2", 6, 3, 21],
  [7, "Marcus Chen", 1, "2 ●", "2", "2 ●●", "2", 2, 5, 11],
  [11, "Malik Osei", 3, "2", "2 ●", "2", "2", 8, 1, 9],
  [4, "Ethan Patel", 2, "2", "", "2", "2", 1, 2, 6],
  [15, "Owen Campbell", 4, "2", "3", "", "", 4, 0, 5],
  [21, "Isaiah Grant", 1, "", "", "2", "2", 5, 0, 4],
  [9, "Andre Baptiste", 0, "", "", "", "3", 1, 1, 3],
  [33, "Kai Nguyen", 1, "2", "", "", "", 2, 0, 2],
  [12, "Darius Brown", 0, "", "", "", "●", 0, 1, 1],
  [5, "Amir Khan", 1, "", "", "", "", 1, 0, 0],
  [30, "Cole Anderson", 2, "", "miss2", "", "", 2, 0, 0],
]
const AWAY_SHEET: SheetRow[] = [
  [10, "Noah Sinclair", 3, "3 2", "2 3", "2 2", "2 2", 5, 2, 18],
  [3, "Lucas Kim", 2, "2 2", "3", "2 ●", "2", 3, 4, 12],
  [24, "Ibrahim Hassan", 1, "2", "3", "●", "3", 7, 1, 9],
  [8, "Felix Wong", 2, "2", "2", "2", "2", 2, 2, 8],
  [14, "Santiago Silva", 4, "2", "2", "", "2", 4, 0, 6],
  [5, "Theo Boateng", 1, "", "", "3", "", 2, 1, 3],
  [30, "Aiden Mensah", 2, "", "●", "", "●", 1, 1, 2],
  [21, "Josiah Clarke", 1, "", "", "", "", 0, 0, 0],
  [17, "Zion Walker", 0, "", "", "", "", 0, 0, 0],
]

function foulBoxes(n: number) {
  return "☒".repeat(n) + "☐".repeat(5 - n)
}

function Mark({ m }: { m: string }) {
  if (m === "miss2")
    return (
      <span className="text-ink-400">
        <span className="line-through">2</span>
      </span>
    )
  if (!m) return <span className="text-ink-300">·</span>
  return <span className="font-semibold">{m}</span>
}

function SheetTable({
  team,
  rows,
  dnp,
  absent,
  totals,
  extras,
}: {
  team: string
  rows: SheetRow[]
  dnp?: [number, string]
  absent?: [number, string]
  totals: [number, string, string, string, string, number, number, number]
  extras: string
}) {
  return (
    <table className="mt-4 w-full text-[11px] leading-tight">
      <thead>
        <tr className="border-b-2 border-black text-left">
          <th className="w-7 py-1 pr-1 font-bold">#</th>
          <th className="py-1 pr-2 font-bold">{team}</th>
          <th className="w-16 px-1.5 py-1 font-bold">Fouls</th>
          <th className="px-1.5 py-1 font-bold">Q1</th>
          <th className="px-1.5 py-1 font-bold">Q2</th>
          <th className="px-1.5 py-1 font-bold">Q3</th>
          <th className="px-1.5 py-1 font-bold">Q4</th>
          <th className="w-9 px-1.5 py-1 text-center font-bold">REB</th>
          <th className="w-9 px-1.5 py-1 text-center font-bold">AST</th>
          <th className="w-9 px-1.5 py-1 text-center font-bold">PTS</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([j, n, f, q1, q2, q3, q4, reb, ast, pts]) => (
          <tr key={j} className="border-ink-200 border-b">
            <td className="py-[3px] pr-1 font-bold tabular-nums">{j}</td>
            <td className="py-[3px] pr-2">{n}</td>
            <td className="px-1.5 py-[3px] tracking-tight">{foulBoxes(f)}</td>
            <td className="px-1.5 py-[3px]"><Mark m={q1} /></td>
            <td className="px-1.5 py-[3px]"><Mark m={q2} /></td>
            <td className="px-1.5 py-[3px]"><Mark m={q3} /></td>
            <td className="px-1.5 py-[3px]"><Mark m={q4} /></td>
            <td className="px-1.5 py-[3px] text-center tabular-nums">{reb}</td>
            <td className="px-1.5 py-[3px] text-center tabular-nums">{ast}</td>
            <td className="px-1.5 py-[3px] text-center font-bold tabular-nums">{pts}</td>
          </tr>
        ))}
        {dnp && (
          <tr className="border-ink-200 border-b">
            <td className="py-[3px] pr-1 font-bold tabular-nums">{dnp[0]}</td>
            <td className="py-[3px] pr-2">{dnp[1]}</td>
            <td colSpan={8} className="text-ink-400 px-1.5 py-[3px]">
              DNP, did not play
            </td>
          </tr>
        )}
        {absent && (
          <tr className="border-ink-200 text-ink-400 border-b">
            <td className="py-[3px] pr-1 font-bold tabular-nums">{absent[0]}</td>
            <td className="py-[3px] pr-2">{absent[1]}</td>
            <td colSpan={8} className="px-1.5 py-[3px]">
              Absent
            </td>
          </tr>
        )}
        <tr className="border-t-2 border-black">
          <td colSpan={2} className="py-1 pr-2 text-[10px] font-bold uppercase">
            Totals
          </td>
          <td className="px-1.5 py-1 font-bold tabular-nums">{totals[0]}</td>
          <td className="px-1.5 py-1 font-bold tabular-nums">{totals[1]}</td>
          <td className="px-1.5 py-1 font-bold tabular-nums">{totals[2]}</td>
          <td className="px-1.5 py-1 font-bold tabular-nums">{totals[3]}</td>
          <td className="px-1.5 py-1 font-bold tabular-nums">{totals[4]}</td>
          <td className="px-1.5 py-1 text-center font-bold tabular-nums">{totals[5]}</td>
          <td className="px-1.5 py-1 text-center font-bold tabular-nums">{totals[6]}</td>
          <td className="px-1.5 py-1 text-center font-bold tabular-nums">{totals[7]}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={10} className="text-ink-600 py-1 text-[10px]">
            {extras}
          </td>
        </tr>
      </tfoot>
    </table>
  )
}

const scoresheet: LiveScene = {
  id: "l-scoresheet",
  act: "final",
  persona: "club",
  personaLabel: TABLE,
  frame: "desktop",
  url: "/scoresheet/g10-w1-force-huskies",
  caption:
    "The official scoresheet: both rosters, every quarter, fouls, DNPs, the referee's verified sign-off. PDF or print.",
  script: [
    { wait: 700 },
    { zoom: "homeTable", scale: 1.15 },
    { wait: 1600 },
    { zoom: "sigRow", scale: 1.3 },
    { wait: 1400 },
    { zoom: null },
    { hold: "pdfBtn" },
    { confirm: "PDF downloaded" },
  ],
  render: () => (
    <div className="bg-ink-50 min-h-[560px] px-8 py-8">
      <div className="mx-auto max-w-5xl border-2 border-black bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-ink-950 text-lg font-bold uppercase">Official Scoresheet</p>
            <p className="text-ink-600 text-xs">
              {LEAGUE.name} · {LEAGUE.season}
            </p>
          </div>
          <div className="text-right text-xs">
            <p className="text-ink-900 font-semibold">5/30/2026, 2:00 PM</p>
            <p className="text-ink-600">Pan Am Sports Centre · Court 1</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-center gap-8">
          <div className="text-center">
            <p className="text-ink-900 text-sm font-bold">{GAME.home.slice(0, 12)}</p>
            <p className="text-ink-950 text-4xl font-bold tabular-nums">{GAME.finalHome}</p>
          </div>
          <table className="border border-black text-center text-xs">
            <thead>
              <tr>
                {["", "Q1", "Q2", "Q3", "Q4", "F"].map((h) => (
                  <th key={h} className="border border-black px-2.5 py-1 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black px-2.5 py-1 font-bold">{GAME.homeShort}</td>
                {[...GAME.lines.home, GAME.finalHome].map((n, i) => (
                  <td key={i} className="border border-black px-2.5 py-1 tabular-nums">
                    {n}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border border-black px-2.5 py-1 font-bold">{GAME.awayShort}</td>
                {[...GAME.lines.away, GAME.finalAway].map((n, i) => (
                  <td key={i} className="border border-black px-2.5 py-1 tabular-nums">
                    {n}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <div className="text-center">
            <p className="text-ink-900 text-sm font-bold">{GAME.away.slice(0, 12)}</p>
            <p className="text-ink-950 text-4xl font-bold tabular-nums">{GAME.finalAway}</p>
          </div>
        </div>
        <div data-live-id="homeTable">
          <SheetTable
            team={GAME.home}
            rows={HOME_SHEET}
            dnp={[26, "Theo Martinez"]}
            absent={[18, "Xavier Reid"]}
            totals={[17, "16", "14", "15", "17", 32, 13, 62]}
            extras="Team: 4 STL · 1 BLK · 7 TO"
          />
        </div>
        <SheetTable
          team={GAME.away}
          rows={AWAY_SHEET}
          totals={[16, "15", "16", "13", "14", 24, 11, 58]}
          extras="Team: 3 STL · 2 BLK · 9 TO"
        />
        <p className="text-ink-500 mt-3 text-[10px]">
          Scoring marks per quarter, in game order: <strong>2</strong>/<strong>3</strong> = made
          field goal · <span className="line-through">2</span> = missed (where tracked) · ● made
          free throw · ○ missed free throw. Fouls: ☒ personal · Ⓣ technical.
        </p>
        <div data-live-id="sigRow" className="mt-5 grid grid-cols-2 gap-8 text-xs">
          <div className="border-t border-black pt-1">
            Referee: Mike Ferreira <strong>✓ PIN-verified</strong>, signed 5/30/2026, 3:41 PM
          </div>
          <div className="border-t border-black pt-1">Scorekeeper, finalized 5/30/2026, 3:41 PM</div>
        </div>
      </div>
      <div className="mx-auto mt-4 flex max-w-5xl justify-center gap-3">
        <Hold id="pdfBtn">
          <Button size="sm">Download PDF (landscape)</Button>
        </Hold>
        <Button size="sm" variant="subtle">
          Print / Save as PDF
        </Button>
        <Button size="sm" variant="subtle">
          Box score &amp; play-by-play
        </Button>
      </div>
    </div>
  ),
}

/* F3 — Distribution: the sheet by email, the final on every phone */
const distribution: LiveScene = {
  id: "l-distribution",
  act: "final",
  persona: "league",
  personaLabel: "Everyone",
  frame: "plain",
  caption:
    "Final means final: the scoresheet emails itself to both clubs and the league; every family gets the score in the app.",
  script: [
    { wait: 500 },
    { set: { mail: true } },
    { wait: 1000 },
    { set: { bell: true } },
    { wait: 900 },
    { hold: "doneBtn" },
  ],
  render: (g) => (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      {!!g("mail") ? (
        <Card className="live-row-in">
          <div className="border-ink-100 flex items-center gap-2 border-b pb-3">
            <span className="bg-play-50 text-play-700 flex h-9 w-9 items-center justify-center rounded-full">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m2 7 10 6L22 7" />
              </svg>
            </span>
            <div>
              <p className="text-ink-900 text-sm font-bold">Final: {FINAL_TITLE}</p>
              <p className="text-ink-400 text-xs">
                To: both clubs&apos; managers + the league office
              </p>
            </div>
          </div>
          <div className="text-ink-700 mt-3 space-y-2 text-sm">
            <p className="text-ink-950 text-base font-bold">Final: {FINAL_TITLE}</p>
            <p>
              {LEAGUE.name} {LEAGUE.season} · 5/30/2026
            </p>
            <p>
              Referee: <strong>Mike Ferreira</strong> (PIN-verified)
            </p>
            <p className="text-play-700 font-semibold">View / print the official scoresheet</p>
            <p className="text-play-700 font-semibold">Box score &amp; play-by-play</p>
          </div>
        </Card>
      ) : (
        <div />
      )}
      <div className="space-y-4">
        {!!g("bell") && (
          <Card size="sm" className="live-row-in">
            <div className="flex items-start gap-2.5">
              <span className="bg-court-50 text-court-700 live-pop flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
              </span>
              <div>
                <p className="text-ink-900 text-sm font-bold">Final Score</p>
                <p className="text-ink-600 text-xs">Final: {FINAL_TITLE}</p>
                <p className="text-ink-400 mt-1 text-[10px]">
                  To every family and staff member on both teams, in the app
                </p>
              </div>
            </div>
          </Card>
        )}
        {!!g("bell") && (
          <div className="live-row-in text-center">
            <Hold id="doneBtn">
              <Button size="lg">That&apos;s the whole loop</Button>
            </Hold>
          </div>
        )}
      </div>
    </div>
  ),
}

export const ACT_FINAL: LiveScene[] = [review, scoresheet, distribution]
