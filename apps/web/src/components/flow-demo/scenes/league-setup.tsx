"use client"

/**
 * Chapter 1 — League setup (steps 1-6 of the flow).
 * Every screen mirrors its real counterpart under /manage/leagues; labels,
 * options, helper copy and button strings are transcribed from the product
 * (docs/demo-inventory/league.md).
 */

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { StatTile } from "@/components/ui/stat-tile"
import { cn } from "@/components/ui/cn"
import { Advance } from "../advance"
import { DIVISIONS, LEAGUE, REFS, SESSIONS, VENUES, fmt } from "../data"
import { AreaBox, CheckRow, Field, OperatorPage, Panel, RadioRow, SelectBox, TxtInput } from "./shared"

const TABS = [
  "Overview",
  "Divisions",
  "Venues",
  "Sessions",
  "Scheduling",
  "Tiebreakers",
  "Teams",
  "Referees",
  "Schedule",
  "Standings",
  "Playoffs",
]

export function SeasonHeader({
  status,
  statusTone,
  lifecycle,
  lifecycleHighlight,
  lifecycleConfirm,
}: {
  status: string
  statusTone: "neutral" | "court" | "play" | "hoop"
  lifecycle?: string
  lifecycleHighlight?: boolean
  lifecycleConfirm?: string
}) {
  const btn = lifecycle && (
    <Button tone="ink" size="sm">
      {lifecycle}
    </Button>
  )
  return (
    <>
      <p className="text-ink-500 mb-3 text-sm font-medium">&larr; Back to {LEAGUE.name}</p>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-condensed text-ink-950 text-3xl font-bold uppercase tracking-wide">
            {LEAGUE.season}
          </h1>
          <Badge tone={statusTone}>{status}</Badge>
        </div>
        {lifecycle &&
          (lifecycleHighlight ? <Advance confirm={lifecycleConfirm}>{btn}</Advance> : btn)}
      </div>
      <p className="text-ink-500 -mt-4 mb-5 text-sm">{LEAGUE.name}</p>
    </>
  )
}

export function SeasonTabs({ active }: { active: string }) {
  return (
    <div className="border-ink-200 mb-6 flex flex-wrap gap-1 border-b" role="tablist">
      {TABS.map((t) => (
        <span
          key={t}
          role="tab"
          className={cn(
            "rounded-t-lg px-3.5 py-2 text-sm font-semibold",
            t === active
              ? "border-ink-200 text-ink-950 -mb-px border border-b-white bg-white"
              : "text-ink-500"
          )}
        >
          {t}
        </span>
      ))}
    </div>
  )
}

function SeasonManagePage({ active, children, header }: { active: string; children: React.ReactNode; header?: React.ReactNode }) {
  return (
    <div className="px-10 py-8">
      {header ?? <SeasonHeader status="Draft" statusTone="neutral" lifecycle="Open Registration" />}
      <SeasonTabs active={active} />
      {children}
    </div>
  )
}

/* Step 1 — Create League */
export function SceneCreateLeague() {
  return (
    <OperatorPage
      narrow
      title="Create League"
      subtitle="A league is the persistent parent. You'll add seasons (Fall 2026, Winter 2026-27, etc.) on the next screen."
    >
      <Card>
        <div className="space-y-4">
          <Field label="League Name" required>
            <TxtInput value={LEAGUE.name} />
          </Field>
          <Field label="Description">
            <AreaBox value="Toronto's summer circuit for competitive club teams, grades 8 to 11. Weekend sessions across the GTA." />
          </Field>
        </div>
      </Card>
      <div className="mt-4 flex gap-3">
        <Button variant="subtle" className="flex-none">
          Cancel
        </Button>
        <Advance>
          <Button className="w-full" block>
            Create League
          </Button>
        </Advance>
      </div>
    </OperatorPage>
  )
}

/* Step 1b — New season on the league dashboard */
export function SceneCreateSeason() {
  return (
    <div className="px-10 py-8">
      <p className="text-ink-500 mb-3 text-sm font-medium">&larr; Back to Leagues</p>
      <Card className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Badge tone="play">League</Badge>
            <h1 className="font-condensed text-ink-950 mt-2 text-3xl font-bold uppercase tracking-wide">
              {LEAGUE.name}
            </h1>
            <p className="text-ink-500 mt-1 text-sm">
              Toronto&apos;s summer circuit for competitive club teams, grades 8 to 11.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="subtle" size="sm">Public hub</Button>
            <Button variant="subtle" size="sm">Customize page</Button>
            <Button variant="subtle" size="sm">Payments</Button>
            <Button variant="subtle" size="sm">Messages</Button>
            <Button variant="secondary" size="sm">Cancel</Button>
          </div>
        </div>
      </Card>
      <Panel title="Create a season">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Label" required>
            <TxtInput value={LEAGUE.season} placeholder="e.g. Fall 2026, Winter 2026-27" />
          </Field>
          <Field label="Season Type">
            <SelectBox value="Summer" />
          </Field>
          <Field label="Start Date">
            <TxtInput value="2026-05-30" />
          </Field>
          <Field label="End Date">
            <TxtInput value="2026-06-28" />
          </Field>
          <Field label="Registration Deadline">
            <TxtInput value="2026-05-15" />
          </Field>
          <Field label="Team Fee ($)">
            <TxtInput value="3990" placeholder="e.g. 3500" />
          </Field>
          <Field label="Games Guaranteed">
            <TxtInput value="10" placeholder="e.g. 10" />
          </Field>
        </div>
        <p className="text-ink-400 mt-3 text-xs">
          You&apos;ll configure divisions, venues, sessions, and scheduling on the next screen.
        </p>
        <div className="mt-4">
          <Advance>
            <Button>Create Season</Button>
          </Advance>
        </div>
      </Panel>
    </div>
  )
}

/* Step 1c — Divisions tab */
export function SceneDivisions() {
  return (
    <SeasonManagePage active="Divisions">
      <Panel title="Divisions">
        <div className="divide-ink-100 divide-y">
          {DIVISIONS.slice(0, 3).map((d) => (
            <div key={d.name} className="flex items-center justify-between py-3">
              <div>
                <p className="text-ink-900 text-sm font-bold">{d.name}</p>
                <p className="text-ink-500 text-xs">
                  {d.ageGroup} · Boys · Capacity: unlimited
                </p>
              </div>
              <div className="text-ink-500 flex items-center gap-3 text-xs">
                <span>0 teams</span>
                <span aria-label={`Rename ${d.name}`}>✎</span>
                <span className="text-hoop-600 font-semibold">Remove</span>
              </div>
            </div>
          ))}
        </div>
        <div className="border-ink-100 mt-4 grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 border-t pt-4">
          <TxtInput value="Grade 11 Boys" placeholder="Division name" />
          <SelectBox value="U18" placeholder="Age group..." />
          <SelectBox value="Boys" />
          <SelectBox value="Tier 1 (Top)" />
          <TxtInput placeholder="Max teams (optional)" />
        </div>
        <div className="mt-3">
          <Advance block>
            <Button block>Add Division</Button>
          </Advance>
        </div>
      </Panel>
    </SeasonManagePage>
  )
}

/* Step 2 — Sessions and session dates */
export function SceneSessions() {
  return (
    <SeasonManagePage active="Sessions">
      <Panel title="Sessions (game days)">
        <div className="divide-ink-100 divide-y">
          {SESSIONS.slice(0, 4).map((s) => (
            <div key={s.label} className="flex items-center justify-between py-3">
              <div>
                <p className="text-ink-900 text-sm font-bold">{s.label}</p>
                <p className="text-ink-500 text-xs">
                  {s.days.map((d) => `${d} 09:00-18:00`).join(" · ")}
                </p>
              </div>
              <span className="text-hoop-600 text-xs font-semibold">Remove</span>
            </div>
          ))}
        </div>
        <div className="border-ink-100 mt-4 space-y-3 border-t pt-4">
          <TxtInput value="Week 5" placeholder="Label (e.g. Week 1)" />
          <div className="grid grid-cols-[2fr_1fr_1fr_auto] items-center gap-3">
            <TxtInput value="2026-06-27" />
            <TxtInput value="09:00" />
            <TxtInput value="18:00" />
            <span className="text-ink-400">×</span>
          </div>
          <div className="grid grid-cols-[2fr_1fr_1fr_auto] items-center gap-3">
            <TxtInput value="2026-06-28" />
            <TxtInput value="09:00" />
            <TxtInput value="18:00" />
            <span className="text-ink-400">×</span>
          </div>
          <p className="text-play-700 text-xs font-semibold">+ Add another day</p>
          <Advance block>
            <Button block>Add Session</Button>
          </Advance>
        </div>
      </Panel>
    </SeasonManagePage>
  )
}

/* Step 3 — Venues */
export function SceneVenues() {
  return (
    <SeasonManagePage active="Venues">
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
        </div>
        <div className="border-ink-100 mt-4 flex items-center gap-3 border-t pt-4">
          <div className="flex-1">
            <SelectBox value="Paramount Fine Foods Centre · 5500 Rose Cherry Pl, Mississauga" />
          </div>
          <Advance>
            <Button>Add to League</Button>
          </Advance>
        </div>
      </Panel>
    </SeasonManagePage>
  )
}

/* Step 4 — Referees */
export function SceneReferees() {
  return (
    <SeasonManagePage active="Referees">
      <div className="space-y-5">
        <Panel title="Book a referee for a session day">
          <p className="text-ink-500 mb-4 text-sm">
            Pick a day and shift, then target a referee you know — or broadcast to your whole
            pool and let the first taker have it. Accepting auto-assigns them to every game in
            the window.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Session day">
              <SelectBox value="Week 1 — Sat, May 30" placeholder="Choose day…" />
            </Field>
            <Field label="Shift">
              <div className="flex items-center gap-2">
                <TxtInput value="09:00" />
                <TxtInput value="18:00" />
              </div>
            </Field>
          </div>
          <div className="mt-3 flex gap-2">
            {["Full day (9–6)", "Morning 6h (9–3)", "Afternoon (12–6)"].map((p, i) => (
              <span
                key={p}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold",
                  i === 0 ? "border-play-200 bg-play-50 text-play-700" : "border-ink-200 text-ink-600"
                )}
              >
                {p}
              </span>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-[1fr_1fr_auto] items-end gap-3">
            <Field label="Send to">
              <SelectBox value="📢 All league referees (first accept wins)" />
            </Field>
            <TxtInput placeholder="Message (optional)" />
            <Advance confirm="Offer broadcast to 4 referees — first to accept gets the day.">
              <Button>Send offer</Button>
            </Advance>
          </div>
        </Panel>
        <Panel title="League referee pool" action={<Badge tone="neutral">4 referees</Badge>}>
          <div className="divide-ink-100 divide-y">
            {REFS.map((r, i) => (
              <div key={r.name} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-ink-900 text-sm font-bold">{r.name}</p>
                  <p className="text-ink-500 text-xs">
                    {r.cert} · {r.games} games
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={i === 3 ? "neutral" : "court"}>
                    {i === 3 ? "no availability set" : "available"}
                  </Badge>
                  <span className="text-hoop-600 text-xs font-semibold">Remove</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </SeasonManagePage>
  )
}

/* Step 5 — Scheduling rules, fees are on the season; roster lock policy in ch4 */
export function SceneScheduling() {
  return (
    <SeasonManagePage active="Scheduling">
      <div className="space-y-5">
        <Panel title="Scheduling approach">
          <div className="grid grid-cols-2 gap-3">
            <div className="border-play-300 bg-play-50/50 rounded-xl border p-4">
              <RadioRow
                checked
                label={<span className="font-bold">Family-friendly</span>}
                sub="Pack each team's games into fewer days so families spend less time at venues."
              />
            </div>
            <div className="border-ink-200 rounded-xl border p-4">
              <RadioRow
                label={<span className="font-bold">Spread days</span>}
                sub="Distribute each team's games across more session days for more player rest."
              />
            </div>
          </div>
          <CheckRow
            className="mt-4"
            label="Allow cross-division scheduling"
            sub="When enabled, the scheduler may place games between teams in different divisions (within a scheduling group) to fill the slate."
          />
        </Panel>
        <Panel
          title="Scheduling Settings"
          action={
            <Advance>
              <Button size="sm">Save Settings</Button>
            </Advance>
          }
        >
          <p className="text-ink-400 mb-4 text-xs">
            Fields marked <span className="text-hoop-600">*</span> are required before the league
            can be finalized
          </p>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Max games per team per season" required>
              <TxtInput value="10" placeholder="e.g. 10" />
            </Field>
            <Field label="Games per session per team">
              <TxtInput value="2" />
            </Field>
            <Field label="Ideal games per day per team" helper="Scheduler only exceeds this if unavoidable">
              <TxtInput value="1" />
            </Field>
            <Field label="Game format">
              <SelectBox value="4 Quarters" />
            </Field>
            <Field label="Half / quarter length (min)" required>
              <TxtInput value="10" placeholder="e.g. 20 for halves, 10 for quarters" />
            </Field>
            <Field label="Game length (min)">
              <TxtInput value="40" />
            </Field>
            <Field label="Game slot length (min)" helper="Includes warmup + transition buffer">
              <TxtInput value="90" />
            </Field>
            <Field label="Default courts per venue" required helper="Can be overridden per venue in the Venues panel">
              <TxtInput value="2" placeholder="e.g. 2" />
            </Field>
            <Field label="Default venue hours" helper="Session-day times override these defaults">
              <div className="flex items-center gap-2">
                <TxtInput value="09:00" />
                <TxtInput value="18:00" />
              </div>
            </Field>
          </div>
          <div className="border-ink-100 mt-5 border-t pt-4">
            <p className="text-ink-700 mb-3 text-sm font-bold">Playoffs (optional — can be set later)</p>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Playoff format">
                <SelectBox value="Single Elimination" />
              </Field>
              <Field label="Teams advancing to playoffs">
                <TxtInput value="4" placeholder="e.g. 8" />
              </Field>
            </div>
          </div>
        </Panel>
      </div>
    </SeasonManagePage>
  )
}

/* Step 5b — Tiebreakers */
export function SceneTiebreakers() {
  const order = ["Head-to-head record", "Point differential", "Points scored"]
  return (
    <SeasonManagePage active="Tiebreakers">
      <Panel title="Tiebreaker order">
        <p className="text-ink-500 mb-4 text-sm">
          Used to rank teams with identical records. Applied top-to-bottom until one team wins
          the tiebreaker.
        </p>
        <div className="divide-ink-100 divide-y">
          {order.map((t, i) => (
            <div key={t} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <span className="bg-ink-100 text-ink-700 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold">
                  {i + 1}
                </span>
                <span className="text-ink-900 text-sm font-semibold">{t}</span>
              </div>
              <div className="text-ink-400 flex items-center gap-3 text-sm">
                <span>↑</span>
                <span>↓</span>
                <span className="text-hoop-600 text-xs font-semibold">Remove</span>
              </div>
            </div>
          ))}
        </div>
        <div className="border-ink-100 mt-4 flex flex-wrap gap-2 border-t pt-4">
          {["Points allowed (fewest)", "Total wins"].map((t) => (
            <span key={t} className="border-ink-200 text-ink-600 rounded-full border px-3 py-1 text-xs font-semibold">
              + {t}
            </span>
          ))}
          <Advance>
            <span className="border-ink-200 text-ink-600 inline-block rounded-full border bg-white px-3 py-1 text-xs font-semibold">
              + Coin flip (last resort)
            </span>
          </Advance>
        </div>
      </Panel>
    </SeasonManagePage>
  )
}

/* Step 6 — Publish: open registration */
export function SceneOpenRegistration() {
  return (
    <SeasonManagePage
      active="Overview"
      header={
        <SeasonHeader
          status="Draft"
          statusTone="neutral"
          lifecycle="Open Registration"
          lifecycleHighlight
          lifecycleConfirm="NPH Summer League — Summer 2026 is open for team registration"
        />
      }
    >
      <div className="mb-5 grid grid-cols-4 gap-4">
        <StatTile value={4} label="Divisions" tone="play" />
        <StatTile value={0} label="Teams" tone="court" />
        <StatTile value={5} label="Sessions" tone="gold" />
        <StatTile value={4} label="Venues" tone="ink" />
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
    </SeasonManagePage>
  )
}
