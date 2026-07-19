"use client"

/**
 * Act 7 — The league opens: create the league, build the season (fees,
 * deadline, guaranteed games), lay out sessions with dates/times, pick the
 * gyms, and open registration. Mirrors /manage/leagues/* and the season
 * manage tabs (docs/demo-inventory/league.md).
 */

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/components/ui/cn"
import { LEAGUE, SESSIONS, VENUES, fmt } from "../data"
import { Field, OperatorPage, Panel } from "../scenes/shared"
import { LiveInput, LiveSelect } from "./anim"
import type { LiveScene } from "./engine"
import { pick, typeIn } from "./helpers"

const OFFICE = "League office"

const Hold = ({ id, children, block }: { id: string; children: React.ReactNode; block?: boolean }) => (
  <span data-live-id={id} className={cn("rounded-xl", block ? "block" : "inline-block")}>
    {children}
  </span>
)

/* L1 — Create the league */
const createLeague: LiveScene = {
  id: "l-league-create",
  act: "league",
  persona: "league",
  personaLabel: OFFICE,
  frame: "desktop",
  url: "/manage/leagues/create",
  caption:
    "While the Force built its team, the league office was setting up. A league starts as one form.",
  script: [
    { zoom: "form", scale: 1.25 },
    ...typeIn("name", "name", LEAGUE.name, 26),
    ...typeIn("desc", "desc", "Toronto's summer circuit for competitive club teams, grades 8 to 11.", 40),
    { zoom: null },
    { hold: "createBtn" },
  ],
  render: (g) => (
    <OperatorPage
      narrow
      title="Create League"
      subtitle="A league is the persistent parent. You'll add seasons (Fall 2026, Winter 2026-27, etc.) on the next screen."
    >
      <div data-live-id="form">
        <Card>
          <div className="space-y-4">
            <Field label="League Name" required>
              <LiveInput id="name" value={g("name") as string} caret={!!g("name:caret")} placeholder="e.g. NPH Showcase League" />
            </Field>
            <Field label="Description">
              <LiveInput id="desc" value={g("desc") as string} caret={!!g("desc:caret")} placeholder="About this league..." />
            </Field>
          </div>
        </Card>
      </div>
      <div className="mt-4 flex gap-3">
        <Button variant="subtle">Cancel</Button>
        <span data-live-id="createBtn" className="block flex-1 rounded-xl">
          <Button block>Create League</Button>
        </span>
      </div>
    </OperatorPage>
  ),
}

/* L2 — Create the season: dates, deadline, fee, guaranteed games */
const createSeason: LiveScene = {
  id: "l-season-create",
  act: "league",
  persona: "league",
  personaLabel: OFFICE,
  frame: "desktop",
  url: "/manage/leagues/nph-summer-league",
  caption:
    "The season carries the money and the rules: dates, the registration deadline for teams, the team fee, and guaranteed games.",
  script: [
    { zoom: "form", scale: 1.18 },
    ...typeIn("label", "label", "Summer 2026", 20),
    ...pick("typeSel", "stype", 2, "Summer"),
    ...typeIn("start", "start", "2026-05-30", 22),
    ...typeIn("end", "end", "2026-06-28", 22),
    ...typeIn("deadline", "deadline", "2026-05-15", 22),
    ...typeIn("fee", "fee", "3990", 12),
    ...typeIn("games", "games", "10", 8),
    { zoom: null },
    { hold: "createBtn" },
  ],
  render: (g) => (
    <div className="px-10 py-8">
      <p className="text-ink-500 mb-3 text-sm font-medium">&larr; Back to Leagues</p>
      <Card className="mb-5">
        <Badge tone="play">League</Badge>
        <h1 className="font-condensed text-ink-950 mt-2 text-3xl font-bold uppercase tracking-wide">
          {LEAGUE.name}
        </h1>
        <p className="text-ink-500 mt-1 text-sm">
          Toronto&apos;s summer circuit for competitive club teams, grades 8 to 11.
        </p>
      </Card>
      <div data-live-id="form">
        <Panel title="Create a season">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Label" required>
              <LiveInput id="label" value={g("label") as string} caret={!!g("label:caret")} placeholder="e.g. Fall 2026, Winter 2026-27" />
            </Field>
            <Field label="Season Type">
              <LiveSelect
                id="typeSel"
                value={g("stype") as string}
                placeholder="Fall / Winter"
                open={!!g("stype:open")}
                options={["Fall / Winter", "Spring", "Summer", "Custom"]}
                highlight={g("stype:hi") as number}
              />
            </Field>
            <Field label="Start Date">
              <LiveInput id="start" value={g("start") as string} caret={!!g("start:caret")} placeholder="Pick a date" />
            </Field>
            <Field label="End Date">
              <LiveInput id="end" value={g("end") as string} caret={!!g("end:caret")} placeholder="Pick a date" />
            </Field>
            <Field label="Registration Deadline">
              <LiveInput id="deadline" value={g("deadline") as string} caret={!!g("deadline:caret")} placeholder="Pick a date" />
            </Field>
            <Field label="Team Fee ($)">
              <LiveInput id="fee" value={g("fee") as string} caret={!!g("fee:caret")} placeholder="e.g. 3500" />
            </Field>
            <Field label="Games Guaranteed">
              <LiveInput id="games" value={g("games") as string} caret={!!g("games:caret")} placeholder="e.g. 10" />
            </Field>
          </div>
          <p className="text-ink-400 mt-3 text-xs">
            You&apos;ll configure divisions, venues, sessions, and scheduling on the next screen.
          </p>
          <div className="mt-4">
            <Hold id="createBtn">
              <Button>Create Season</Button>
            </Hold>
          </div>
        </Panel>
      </div>
    </div>
  ),
}

function SeasonShell({
  active,
  lifecycle,
  children,
  status = "Draft",
  statusTone = "neutral",
}: {
  active: string
  lifecycle?: React.ReactNode
  children: React.ReactNode
  status?: string
  statusTone?: "neutral" | "court" | "play" | "hoop"
}) {
  const TABS = ["Overview", "Divisions", "Venues", "Sessions", "Scheduling", "Tiebreakers", "Teams", "Referees", "Schedule", "Standings", "Playoffs"]
  return (
    <div className="px-10 py-8">
      <p className="text-ink-500 mb-3 text-sm font-medium">&larr; Back to {LEAGUE.name}</p>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-condensed text-ink-950 text-3xl font-bold uppercase tracking-wide">
            {LEAGUE.season}
          </h1>
          <Badge tone={statusTone}>{status}</Badge>
        </div>
        {lifecycle}
      </div>
      <p className="text-ink-500 mb-5 text-sm">{LEAGUE.name}</p>
      <div className="border-ink-200 mb-6 flex flex-wrap gap-1 border-b" role="tablist">
        {TABS.map((t) => (
          <span
            key={t}
            className={cn(
              "rounded-t-lg px-3.5 py-2 text-sm font-semibold",
              t === active ? "border-ink-200 text-ink-950 -mb-px border border-b-white bg-white" : "text-ink-500"
            )}
          >
            {t}
          </span>
        ))}
      </div>
      {children}
    </div>
  )
}

/* L3 — Sessions: dates and times for game days */
const addSession: LiveScene = {
  id: "l-sessions",
  act: "league",
  persona: "league",
  personaLabel: OFFICE,
  frame: "desktop",
  url: "/manage/leagues/nph-summer-league/seasons/summer-2026/manage",
  caption: "Five weekend sessions define exactly when games can happen. Week 5 gets its two days and times.",
  script: [
    { zoom: "addForm", scale: 1.2 },
    ...typeIn("slabel", "slabel", "Week 5", 14),
    ...typeIn("d1", "d1", "2026-06-27", 22),
    ...typeIn("t1a", "t1a", "09:00", 14),
    ...typeIn("t1b", "t1b", "18:00", 14),
    { press: "addDay" },
    { set: { day2: true } },
    { wait: 350 },
    ...typeIn("d2", "d2", "2026-06-28", 22),
    { zoom: null },
    { hold: "addBtn" },
  ],
  render: (g) => (
    <SeasonShell active="Sessions">
      <Panel title="Sessions (game days)">
        <div className="divide-ink-100 divide-y">
          {SESSIONS.slice(0, 4).map((s) => (
            <div key={s.label} className="flex items-center justify-between py-3">
              <div>
                <p className="text-ink-900 text-sm font-bold">{s.label}</p>
                <p className="text-ink-500 text-xs">{s.days.map((d) => `${d} 09:00-18:00`).join(" · ")}</p>
              </div>
              <span className="text-hoop-600 text-xs font-semibold">Remove</span>
            </div>
          ))}
        </div>
        <div data-live-id="addForm" className="border-ink-100 mt-4 space-y-3 border-t pt-4">
          <LiveInput id="slabel" value={g("slabel") as string} caret={!!g("slabel:caret")} placeholder="Label (e.g. Week 1)" />
          <div className="grid grid-cols-[2fr_1fr_1fr_auto] items-center gap-3">
            <LiveInput id="d1" value={g("d1") as string} caret={!!g("d1:caret")} placeholder="Pick a date" />
            <LiveInput id="t1a" value={g("t1a") as string} caret={!!g("t1a:caret")} placeholder="09:00" />
            <LiveInput id="t1b" value={g("t1b") as string} caret={!!g("t1b:caret")} placeholder="17:00" />
            <span className="text-ink-400">×</span>
          </div>
          {!!g("day2") && (
            <div className="live-row-in grid grid-cols-[2fr_1fr_1fr_auto] items-center gap-3">
              <LiveInput id="d2" value={g("d2") as string} caret={!!g("d2:caret")} placeholder="Pick a date" />
              <LiveInput value="09:00" />
              <LiveInput value="18:00" />
              <span className="text-ink-400">×</span>
            </div>
          )}
          <p data-live-id="addDay" className="text-play-700 inline-block text-xs font-semibold">
            + Add another day
          </p>
          <Hold id="addBtn" block>
            <Button block>Add Session</Button>
          </Hold>
        </div>
      </Panel>
    </SeasonShell>
  ),
}

/* L4 — Venues: the gyms games run in */
const addVenue: LiveScene = {
  id: "l-venues",
  act: "league",
  persona: "league",
  personaLabel: OFFICE,
  frame: "desktop",
  url: "/manage/leagues/nph-summer-league/seasons/summer-2026/manage",
  caption: "Real gyms with real courts. Court counts and hours feed straight into the scheduler.",
  script: [
    { wait: 400 },
    ...pick("venueSel", "venue", 0, "Paramount Fine Foods Centre · 5500 Rose Cherry Pl, Mississauga"),
    { hold: "addBtn" },
    { set: { added: true } },
    { wait: 600 },
    { confirm: "Venue added" },
  ],
  render: (g) => (
    <SeasonShell active="Venues">
      <Panel title="Venues">
        <div className="divide-ink-100 divide-y">
          {VENUES.slice(0, 3).map((v) => (
            <div key={v.name} className="flex items-center justify-between py-3">
              <div>
                <p className="text-ink-900 text-sm font-bold">{v.name}</p>
                <p className="text-ink-500 text-xs">
                  {v.address}, {v.city} · {v.courts} courts
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-play-700 font-semibold">Edit courts &amp; hours</span>
                <span className="text-hoop-600 font-semibold">Remove</span>
              </div>
            </div>
          ))}
          {!!g("added") && (
            <div className="live-row-in flex items-center justify-between py-3">
              <div>
                <p className="text-ink-900 text-sm font-bold">Paramount Fine Foods Centre</p>
                <p className="text-ink-500 text-xs">5500 Rose Cherry Pl, Mississauga · 2 courts</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-play-700 font-semibold">Edit courts &amp; hours</span>
                <span className="text-hoop-600 font-semibold">Remove</span>
              </div>
            </div>
          )}
        </div>
        <div className="border-ink-100 mt-4 flex items-center gap-3 border-t pt-4">
          <div className="flex-1">
            <LiveSelect
              id="venueSel"
              value={g("venue") as string}
              placeholder="Search venues…"
              open={!!g("venue:open")}
              options={[
                "Paramount Fine Foods Centre · 5500 Rose Cherry Pl, Mississauga",
                "Central Arena · 519 Drury Ln, Burlington",
              ]}
              highlight={g("venue:hi") as number}
            />
          </div>
          <Hold id="addBtn">
            <Button>Add to League</Button>
          </Hold>
        </div>
      </Panel>
    </SeasonShell>
  ),
}

/* L5 — Publish: open registration */
const openRegistration: LiveScene = {
  id: "l-open-reg",
  act: "league",
  persona: "league",
  personaLabel: OFFICE,
  frame: "desktop",
  url: "/manage/leagues/nph-summer-league/seasons/summer-2026/manage",
  caption:
    "Fees set, sessions dated, gyms booked. Opening registration notifies every club that has played this league before. Referees can wait until the schedule exists.",
  script: [
    { wait: 600 },
    { hold: "openBtn" },
    { set: { open: true } },
    { wait: 400 },
    { confirm: "NPH Summer League Summer 2026 is open for team registration" },
  ],
  render: (g) => (
    <SeasonShell
      active="Overview"
      status={g("open") ? "Open for Registration" : "Draft"}
      statusTone={g("open") ? "court" : "neutral"}
      lifecycle={
        !g("open") ? (
          <Hold id="openBtn">
            <Button tone="ink" size="sm">
              Open Registration
            </Button>
          </Hold>
        ) : undefined
      }
    >
      <div className="mb-5 grid grid-cols-4 gap-4">
        {[
          ["4", "Divisions"],
          ["0", "Teams"],
          ["5", "Sessions"],
          ["4", "Venues"],
        ].map(([v, l]) => (
          <Card key={l} size="sm" className="text-center">
            <p className="font-condensed text-ink-950 text-3xl font-bold">{v}</p>
            <p className="text-ink-500 text-sm font-medium">{l}</p>
          </Card>
        ))}
      </div>
      <Panel title="Season summary">
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          {[
            ["Start:", "May 30, 2026"],
            ["End:", "Jun 28, 2026"],
            ["Registration Deadline:", "May 15, 2026"],
            ["Team Fee:", fmt(LEAGUE.teamFee)],
            ["Games Guaranteed:", "10"],
            ["Playoffs:", "SINGLE ELIMINATION"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-ink-500">{k}</span>
              <span className="text-ink-900 font-semibold">{v}</span>
            </div>
          ))}
        </div>
      </Panel>
    </SeasonShell>
  ),
}

export const ACT_LEAGUE: LiveScene[] = [createLeague, createSeason, addSession, addVenue, openRegistration]
export { SeasonShell, Hold as LeagueHold }
