"use client"

/**
 * Act 8 — Teams enter: the Force registers into the league before the
 * deadline, the league watches submissions land (like tryout signups, but
 * teams), approves them, and finalizes the season. Mirrors /browse-leagues
 * and the season-manage Teams/Overview tabs.
 */

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/components/ui/cn"
import { LEAGUE, ROSTER, TEAM, fmt } from "../data"
import { Field, Panel } from "../scenes/shared"
import { LiveCheck, LiveSelect } from "./anim"
import type { LiveScene, Step } from "./engine"
import { pick } from "./helpers"
import { LeagueHold as Hold, SeasonShell } from "./act6-league"

const OFFICE = "League office"

/* R1 — The club registers the Force into the league */
const rosterTicks: Step[] = [0, 1, 2, 3, 4, 5].flatMap((i) => [
  { set: { [`p${i}`]: true } } as Step,
  { wait: 120 } as Step,
])

const registerTeam: LiveScene = {
  id: "l-register-team",
  act: "register",
  persona: "club",
  personaLabel: "Burlington Force (club)",
  frame: "desktop",
  url: "/browse-leagues/summer-2026",
  caption:
    "Back at the club: the owner registers the team before May 15, picking exactly which players the league sees.",
  script: [
    { zoom: "regPanel", scale: 1.2 },
    ...pick("teamSel", "team", 0, `${TEAM.name} (U16 Male)`),
    ...pick("divSel", "div", 0, "Grade 10 Boys (U16)"),
    { set: { roster: true } },
    { wait: 400 },
    { cursor: "rosterList" },
    ...rosterTicks,
    { set: { allTicked: true } },
    { wait: 400 },
    { zoom: null },
    { hold: "submitBtn" },
    { confirm: "Team submitted successfully!" },
  ],
  render: (g) => (
    <div className="px-10 py-8">
      <p className="text-ink-500 mb-3 text-sm font-medium">&larr; Back to Leagues</p>
      <div className="grid grid-cols-[1.4fr_1fr] gap-5">
        <div className="space-y-4">
          <Card>
            <div className="flex items-center gap-2.5">
              <h1 className="font-condensed text-ink-950 text-2xl font-bold uppercase tracking-wide">
                {LEAGUE.name}
              </h1>
              <Badge tone="court">Open</Badge>
            </div>
            <p className="text-ink-500 text-sm">{LEAGUE.season}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                ["Season", "May 30 - Jun 28, 2026"],
                ["Games Guaranteed", "10 regular season"],
                ["Registration Deadline", "May 15, 2026"],
                ["Game Format", "40min (4 quarters)"],
              ].map(([k, v]) => (
                <div key={k} className="bg-ink-50 rounded-xl p-3">
                  <p className="text-ink-400 text-[10px] font-bold uppercase tracking-[0.12em]">{k}</p>
                  <p className="text-ink-900 mt-1 text-sm font-semibold">{v}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card size="sm">
            <p className="text-ink-900 mb-2 text-sm font-bold">Divisions</p>
            <div className="flex flex-wrap gap-2">
              {["Grade 8 Boys", "Grade 9 Boys", "Grade 10 Boys", "Grade 11 Boys"].map((d) => (
                <span key={d} className="border-ink-200 text-ink-700 rounded-full border px-3 py-1 text-xs font-semibold">
                  {d}
                </span>
              ))}
            </div>
          </Card>
          <Card size="sm">
            <p className="text-ink-900 mb-2 text-sm font-bold">Registered Teams (7)</p>
            <div className="divide-ink-50 divide-y">
              {["Royal Crown Grade 10", "North Toronto Huskies Grade 10", "West United Prep Grade 10"].map((t) => (
                <div key={t} className="flex items-center justify-between py-2">
                  <span className="text-ink-800 text-sm font-semibold">{t}</span>
                  <Badge tone="gold">pending</Badge>
                </div>
              ))}
              <p className="text-ink-400 py-2 text-center text-xs">+ 4 more</p>
            </div>
          </Card>
        </div>
        <div data-live-id="regPanel">
          <Card>
            <p className="text-ink-950 text-center text-3xl font-bold">{fmt(LEAGUE.teamFee)}</p>
            <p className="text-ink-400 mb-4 text-center text-xs">per team</p>
            <div className="space-y-3.5">
              <Field label="Select Team">
                <LiveSelect
                  id="teamSel"
                  value={g("team") as string}
                  placeholder="Choose team..."
                  open={!!g("team:open")}
                  options={[`${TEAM.name} (U16 Male)`]}
                  highlight={g("team:hi") as number}
                />
              </Field>
              <Field label="Select Division">
                <LiveSelect
                  id="divSel"
                  value={g("div") as string}
                  placeholder="Choose division..."
                  open={!!g("div:open")}
                  options={["Grade 10 Boys (U16)"]}
                  highlight={g("div:hi") as number}
                />
              </Field>
              {!!g("roster") && (
                <div className="live-row-in" data-live-id="rosterList">
                  <p className="text-ink-700 mb-2 text-sm font-semibold">
                    League roster version ({g("allTicked") ? 12 : [0, 1, 2, 3, 4, 5].filter((i) => g(`p${i}`)).length}/12 selected)
                  </p>
                  <div className="border-ink-100 max-h-56 space-y-1.5 overflow-hidden rounded-xl border p-3">
                    {ROSTER.slice(0, 6).map((p, i) => (
                      <LiveCheck key={p.name} on={!!g(`p${i}`)} label={`#${p.jersey} ${p.name}`} />
                    ))}
                    {!!g("allTicked") && (
                      <p className="text-ink-400 live-row-in text-xs">+ 6 more selected</p>
                    )}
                  </div>
                </div>
              )}
              <Hold id="submitBtn" block>
                <Button block>Submit Team</Button>
              </Hold>
              <p className="text-ink-400 text-xs">
                Only the selected players are submitted. The league sees this version, not your
                full club roster.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  ),
}

/* R2 — Submissions land on the league's Teams tab */
const TEAMS_IN = [TEAM.name, "Royal Crown Grade 10", "North Toronto Huskies Grade 10", "West United Prep Grade 10", "North York Lions Grade 10"]
const landSteps: Step[] = TEAMS_IN.flatMap((_, i) => [
  { set: { [`t${i}`]: true } } as Step,
  { wait: 300 } as Step,
])

const teamsLand: LiveScene = {
  id: "l-teams-land",
  act: "register",
  persona: "league",
  personaLabel: OFFICE,
  frame: "desktop",
  url: "/manage/leagues/nph-summer-league/seasons/summer-2026/manage",
  caption:
    "Like tryout signups, but teams: submissions land here as clubs register, each with its payment state. The Force gets approved.",
  script: [
    { wait: 400 },
    ...landSteps,
    { set: { more: true } },
    { wait: 500 },
    { hold: "approveBtn" },
    { set: { approved: true } },
    { wait: 450 },
    { confirm: "Approved" },
    { wait: 300 },
  ],
  render: (g) => (
    <SeasonShell active="Teams" status="Open for Registration" statusTone="court">
      <Panel title="Registered teams" action={<Badge tone="neutral">Deadline May 15, 2026</Badge>}>
        <div className="mb-3 flex flex-wrap gap-2">
          {["All (8)", "Pending", "Approved", "Rejected (0)", "Unpaid", "Paid"].map((p, i) => (
            <span
              key={p}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold",
                i === 0 ? "bg-ink-900 text-white" : "bg-white text-ink-600 border-ink-200 border"
              )}
            >
              {p}
            </span>
          ))}
        </div>
        <div className="divide-ink-50 divide-y">
          {TEAMS_IN.map(
            (t, i) =>
              !!g(`t${i}`) && (
                <div key={t} data-live-id={i === 0 ? "row0" : undefined} className="live-row-in flex items-center justify-between py-2.5">
                  <span className="text-ink-900 text-sm font-bold">{t}</span>
                  <div className="flex items-center gap-2">
                    {i === 0 && g("approved") ? (
                      <span className="live-pop inline-block">
                        <Badge tone="court">approved</Badge>
                      </span>
                    ) : (
                      <Badge tone="gold">pending</Badge>
                    )}
                    <Badge tone={i < 2 ? "success" : "warning"}>{i < 2 ? "paid (stripe)" : "unpaid"}</Badge>
                    {i === 0 && !g("approved") ? (
                      <>
                        <Hold id="approveBtn">
                          <Button size="sm" tone="court">
                            Approve
                          </Button>
                        </Hold>
                        <Button size="sm" variant="subtle">
                          Reject
                        </Button>
                      </>
                    ) : (
                      <span className="text-ink-400 text-xs font-semibold">Approve · Reject</span>
                    )}
                  </div>
                </div>
              )
          )}
          {!!g("more") && (
            <p className="text-ink-400 live-row-in py-2.5 text-center text-xs">+ 3 more submissions</p>
          )}
        </div>
      </Panel>
    </SeasonShell>
  ),
}

/* R3 — Deadline passes, preflight is green, finalize */
const finalizeSeason: LiveScene = {
  id: "l-finalize-season",
  act: "register",
  persona: "league",
  personaLabel: OFFICE,
  frame: "desktop",
  url: "/manage/leagues/nph-summer-league/seasons/summer-2026/manage",
  caption:
    "May 15, the deadline. Eight teams in, all approved and paid. The preflight is green, and finalizing locks every roster.",
  script: [
    { wait: 500 },
    { set: { checks: true } },
    { wait: 900 },
    { hold: "finalizeBtn" },
    { set: { finalized: true } },
    { wait: 400 },
    { confirm: "Season finalized. Rosters locked" },
  ],
  render: (g) => (
    <SeasonShell
      active="Overview"
      status={g("finalized") ? "Finalized" : "Registration Closed"}
      statusTone={g("finalized") ? "hoop" : "play"}
      lifecycle={
        !g("finalized") ? (
          <Hold id="finalizeBtn">
            <Button tone="ink" size="sm">
              Finalize Season
            </Button>
          </Hold>
        ) : undefined
      }
    >
      {!!g("checks") && (
        <Card className="border-court-200 bg-court-50/40 live-row-in mb-5">
          <p className="text-court-700 text-sm font-bold">✓ Ready to finalize</p>
          <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1.5">
            {[
              "At least one division created",
              "At least one game session scheduled",
              "Every session has a day with venue + court",
              "At least one venue assigned",
              "No teams pending approval",
              "Max games per season defined",
              "Period / half length defined",
              "Tiebreaker order configured",
            ].map((c) => (
              <p key={c} className="text-ink-700 text-sm">
                <span className="text-court-600 font-bold">✓</span> {c}
              </p>
            ))}
          </div>
        </Card>
      )}
      <div className="grid grid-cols-4 gap-4">
        {[
          ["4", "Divisions"],
          ["30", "Teams"],
          ["5", "Sessions"],
          ["4", "Venues"],
        ].map(([v, l]) => (
          <Card key={l} size="sm" className="text-center">
            <p className="font-condensed text-ink-950 text-3xl font-bold">{v}</p>
            <p className="text-ink-500 text-sm font-medium">{l}</p>
          </Card>
        ))}
      </div>
    </SeasonShell>
  ),
}

/* S1 — One button schedules the season (or one session at a time) */
const GAMES = [
  ["Sat May 30 · 9:00 am", TEAM.name, "North Toronto Huskies Grade 10"],
  ["Sat May 30 · 9:00 am", "Royal Crown Grade 10", "West United Prep Grade 10"],
  ["Sat May 30 · 10:30 am", "North York Lions Grade 10", "City Above Elite Grade 10"],
  ["Sat May 30 · 12:00 pm", TEAM.name, "Royal Crown Grade 10"],
]

const commitSchedule: LiveScene = {
  id: "l-commit-schedule",
  act: "register",
  persona: "league",
  personaLabel: OFFICE,
  frame: "desktop",
  url: "/manage/leagues/nph-summer-league/seasons/summer-2026/manage",
  caption:
    "One button proposes every game inside the rules, one session or the whole season. Committing publishes it, and every team is told.",
  script: [
    { wait: 400 },
    { press: "previewBtn" },
    { set: { preview: true } },
    { wait: 900 },
    { hold: "commitBtn" },
    { set: { committed: true } },
    { wait: 400 },
    { confirm: "Season Schedule Published" },
  ],
  render: (g) => (
    <SeasonShell active="Schedule" status="Finalized" statusTone="hoop">
      <Panel
        title="Schedule"
        action={
          <div className="flex gap-2">
            <span data-live-id="previewBtn" className="inline-block rounded-xl">
              <Button size="sm" variant={g("preview") ? "subtle" : "primary"}>
                Preview schedule
              </Button>
            </span>
            <Hold id="commitBtn">
              <Button size="sm" variant={g("preview") ? "primary" : "subtle"}>
                Commit schedule
              </Button>
            </Hold>
          </div>
        }
      >
        <p className="text-ink-500 mb-4 text-sm">
          Preview the scheduler&apos;s proposal, then commit to persist games. Season must be
          finalized before you can commit.
        </p>
        {!g("preview") ? (
          <p className="text-ink-400 text-sm">
            No games committed yet. Preview then commit once the season is finalized.
          </p>
        ) : (
          <div className="border-court-200 bg-court-50/40 live-row-in rounded-xl border p-4">
            <p className="text-ink-900 text-sm font-bold">Preview: 150 game(s)</p>
            <p className="text-ink-500 mt-1 text-xs">Slots used: 150 / 180</p>
            <table className="mt-3 w-full">
              <thead className="border-ink-100 border-b">
                <tr>
                  {["When", "Home", "Away"].map((h) => (
                    <th key={h} className="text-ink-500 px-3 py-2 text-left text-[11px] font-extrabold uppercase tracking-[0.12em]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-ink-50 divide-y">
                {GAMES.map(([w, h, a]) => (
                  <tr key={w + h}>
                    <td className="text-ink-800 px-3 py-2 text-sm">{w}</td>
                    <td className="text-ink-900 px-3 py-2 text-sm font-semibold">{h}</td>
                    <td className="text-ink-800 px-3 py-2 text-sm">{a}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} className="text-ink-400 px-3 py-2 text-center text-xs">
                    + 146 more games across Weeks 1-5
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </SeasonShell>
  ),
}

export const ACT_REGISTER_LEAGUE: LiveScene[] = [registerTeam, teamsLand, finalizeSeason]
export const SCENE_COMMIT = commitSchedule
