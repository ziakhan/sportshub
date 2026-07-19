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
const FINAL_TITLE = `${GAME.home} ${GAME.finalHome} — ${GAME.finalAway} ${GAME.away}`

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
    "The horn sounds and the console flips to review. This league requires referee approval: Mike signs off with his PIN, the strongest form, or a signature works too.",
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
              The assigned referee enters their personal PIN — verified against their account, the
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
const SHEET_ROWS: [number, string, string, string, string, number, number, number][] = [
  [23, "Jayden Thompson", "☒☒☐☐☐", "2 3 ●", "2 2 3 ●●", 6, 3, 21],
  [7, "Marcus Chen", "☒☐☐☐☐", "2 ●●", "2 2", 2, 5, 11],
  [11, "Malik Osei", "☒☒☒☐☐", "2 2", "2 ●", 8, 1, 9],
  [4, "Ethan Patel", "☒☒☐☐☐", "2", "2 ●●", 1, 2, 6],
  [15, "Owen Campbell", "☒☒☒☒☐", "2 ●", "2", 4, 0, 5],
]

const scoresheet: LiveScene = {
  id: "l-scoresheet",
  act: "final",
  persona: "club",
  personaLabel: TABLE,
  frame: "desktop",
  url: "/scoresheet/g10-w1-force-huskies",
  caption:
    "The official scoresheet: one page, landscape, every mark in game order, the referee's PIN-verified sign-off stamped on it. Download it as a PDF or print it.",
  script: [
    { wait: 700 },
    { zoom: "sigRow", scale: 1.35 },
    { wait: 1400 },
    { zoom: null },
    { hold: "pdfBtn" },
    { confirm: "PDF downloaded" },
  ],
  render: () => (
    <div className="bg-ink-50 min-h-[560px] px-10 py-8">
      <div className="mx-auto max-w-3xl border-2 border-black bg-white p-5">
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
        <div className="mt-4 flex items-center justify-center gap-6">
          <div className="text-center">
            <p className="text-ink-900 text-sm font-bold">{GAME.home.slice(0, 12)}</p>
            <p className="text-ink-950 text-4xl font-bold tabular-nums">{GAME.finalHome}</p>
          </div>
          <table className="border border-black text-center text-xs">
            <thead>
              <tr>
                {["", "Q1", "Q2", "Q3", "Q4", "F"].map((h) => (
                  <th key={h} className="border border-black px-2 py-1 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black px-2 py-1 font-bold">{GAME.homeShort}</td>
                {[...GAME.lines.home, GAME.finalHome].map((n, i) => (
                  <td key={i} className="border border-black px-2 py-1 tabular-nums">
                    {n}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border border-black px-2 py-1 font-bold">{GAME.awayShort}</td>
                {[...GAME.lines.away, GAME.finalAway].map((n, i) => (
                  <td key={i} className="border border-black px-2 py-1 tabular-nums">
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
        <table className="mt-4 w-full text-xs">
          <thead>
            <tr className="border-b border-black text-left">
              <th className="py-1 pr-2 font-bold" colSpan={2}>
                {GAME.home}
              </th>
              <th className="px-2 py-1 font-bold">Fouls</th>
              <th className="px-2 py-1 font-bold">Q1</th>
              <th className="px-2 py-1 font-bold">Q4</th>
              <th className="px-2 py-1 text-center font-bold">REB</th>
              <th className="px-2 py-1 text-center font-bold">AST</th>
              <th className="px-2 py-1 text-center font-bold">PTS</th>
            </tr>
          </thead>
          <tbody>
            {SHEET_ROWS.map(([j, n, f, q1, q4, reb, ast, pts]) => (
              <tr key={j} className="border-ink-200 border-b">
                <td className="py-1 pr-1 font-bold tabular-nums">{j}</td>
                <td className="py-1 pr-2">{n}</td>
                <td className="px-2 py-1">{f}</td>
                <td className="px-2 py-1 font-semibold">{q1}</td>
                <td className="px-2 py-1 font-semibold">{q4}</td>
                <td className="px-2 py-1 text-center tabular-nums">{reb}</td>
                <td className="px-2 py-1 text-center tabular-nums">{ast}</td>
                <td className="px-2 py-1 text-center font-bold tabular-nums">{pts}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={2} className="py-1 pr-2 text-[10px] font-bold uppercase">
                Totals (+ 7 bench)
              </td>
              <td className="px-2 py-1">14</td>
              <td className="px-2 py-1 font-semibold">16</td>
              <td className="px-2 py-1 font-semibold">17</td>
              <td className="px-2 py-1 text-center font-bold">31</td>
              <td className="px-2 py-1 text-center font-bold">14</td>
              <td className="px-2 py-1 text-center font-bold">62</td>
            </tr>
          </tbody>
        </table>
        <p className="text-ink-500 mt-2 text-[10px]">
          Scoring marks per quarter, in game order: <strong>2</strong>/<strong>3</strong> = made
          field goal · <span className="line-through">2</span> = missed (where tracked) · ● made
          free throw · ○ missed free throw. Fouls: ☒ personal · Ⓣ technical.
        </p>
        <div data-live-id="sigRow" className="mt-4 grid grid-cols-2 gap-6 text-xs">
          <div className="border-t border-black pt-1">
            Referee: Mike Ferreira <strong>✓ PIN-verified</strong> — signed 5/30/2026, 3:41 PM
          </div>
          <div className="border-t border-black pt-1">Scorekeeper — finalized 5/30/2026, 3:41 PM</div>
        </div>
      </div>
      <div className="mx-auto mt-4 flex max-w-3xl justify-center gap-3">
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
    "The moment it's final, it ships itself: both clubs' front offices and the league get the scoresheet by email, and every parent and player gets the final score in the app.",
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
