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

// The console as shipped (manage/page.tsx, IA redesign 2026-07-30).
const TABS = [
  "Overview",
  "Clubs",
  "Teams",
  "Plan Your Season",
  "Schedule",
  "Standings",
  "Playoffs",
  "Referees",
  "\u2699 Settings",
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
          <Advance confirm="Season created">
            <Button>Create Season</Button>
          </Advance>
        </div>
      </Panel>
    </div>
  )
}

/* Step 1c — Divisions tab */

/* The demo gyms wearing the one-word-per-gym palette (plan-shared VENUE_HUES):
   home green, second gym pink, third blue. */
const PLAN_GYMS = [
  { name: "Pan Am Sports", full: VENUES[0].name, home: true, dot: "bg-court-500", nameCls: "text-court-700", box: "border-court-300", chip: "border-court-200 bg-court-50 text-court-800" },
  { name: "Humber Athletic", full: VENUES[1].name, home: false, dot: "bg-fuchsia-600", nameCls: "text-fuchsia-700", box: "border-fuchsia-300", chip: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800" },
  { name: "Haber Rec", full: VENUES[2].name, home: false, dot: "bg-blue-600", nameCls: "text-blue-700", box: "border-blue-300", chip: "border-blue-200 bg-blue-50 text-blue-800" },
]

/* Wizard chrome for the plan steps, static. */
function PlanWizardFrame({ step, children }: { step: number; children: React.ReactNode }) {
  const STEPS = ["Teams", "Your buildings", "Your calendar", "Publish", "Schedule"]
  return (
    <div className="px-10 py-8">
      <p className="text-ink-500 mb-2 text-sm font-medium">&larr; Back to the season</p>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-ink-950 text-xl font-bold">Plan your season</h1>
          <p className="text-ink-500 text-xs">{LEAGUE.name} · {LEAGUE.season}</p>
        </div>
        <div className="border-ink-200 flex items-center gap-1 rounded-full border bg-white px-2 py-1.5">
          {STEPS.map((st, i) => (
            <span key={st} className="flex items-center gap-1">
              {i > 0 && <span className="bg-ink-200 h-px w-4" />}
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                  i + 1 === step ? "bg-court-600 text-white" : "bg-ink-100 text-ink-500"
                )}
              >
                {i + 1}
              </span>
              <span className={cn("text-xs font-semibold", i + 1 === step ? "text-ink-950" : "text-ink-400")}>{st}</span>
            </span>
          ))}
        </div>
      </div>
      {children}
    </div>
  )
}

export function SceneDivisions() {
  return (
    <SeasonManagePage active="Schedule">
      <Panel title="Create divisions for teams">
        <p className="text-ink-500 mb-3 text-sm">
          Divisions are made at scheduling time, from real teams, only if you want them. Pick the
          grades to split; grades you leave alone play as one group.
        </p>
        <CheckRow checked label={<b>Grade 8 · 8 teams</b>} sub="Four of the eight are east-end clubs" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            { name: "Grade 8 East", dot: "bg-fuchsia-600", teams: ["Scarborough Blues", "East York Eagles", "Ajax Attack", "Pickering Panthers"] },
            { name: "Grade 8 West", dot: "bg-court-500", teams: ["Burlington Force", "Oakville Panthers", "West United Prep", "Polaris Prep"] },
          ].map((d) => (
            <div key={d.name} className="border-ink-200 rounded-xl border bg-white p-3">
              <p className="text-ink-900 mb-2 text-xs font-bold">
                <span className={cn("mr-1.5 inline-block h-2 w-2 rounded-full", d.dot)} />
                {d.name}
              </p>
              <div className="space-y-1">
                {d.teams.map((t) => (
                  <p key={t} className="border-ink-100 rounded-lg border px-2 py-1 text-xs font-semibold">
                    ⠿ {t} Grade 8
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="border-ink-100 mt-3 border-t pt-3">
          <p className="text-ink-900 text-sm font-semibold">
            Do Grade 8 East and West play each other in the regular season?
          </p>
          <div className="mt-2 flex gap-2">
            <span className="border-play-400 bg-play-50 text-play-800 rounded-lg border px-3 py-1 text-xs font-bold">
              No, keep them apart
            </span>
            <span className="border-ink-200 text-ink-500 rounded-lg border px-3 py-1 text-xs font-bold">
              Yes, they can mix
            </span>
          </div>
        </div>
        <div className="mt-4">
          <Advance confirm="Grade 8 East and West created. They will not cross over in the regular season." block>
            <Button block>Create divisions</Button>
          </Advance>
        </div>
      </Panel>
    </SeasonManagePage>
  )
}

/* Step 2 — Sessions and session dates */
export function SceneSessions() {
  return (
    <PlanWizardFrame step={3}>
      <Panel title="Your weekends">
        <p className="text-ink-500 mb-3 text-sm">
          The wizard turns dates into game weekends. Both days or one, with the hours each gym
          really has.
        </p>
        <div className="divide-ink-100 divide-y">
          {SESSIONS.map((se) => (
            <div key={se.label} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-ink-900 text-sm font-bold">{se.label}</p>
                <p className="text-ink-500 text-xs">{se.days.join(" + ")} · 09:00 to 18:00</p>
              </div>
              <span className="border-court-200 bg-court-50 text-court-800 rounded-full border px-2 py-0.5 text-[10px] font-bold">
                Sat + Sun
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Advance confirm="Five weekends set" block>
            <Button block>These are my weekends</Button>
          </Advance>
        </div>
      </Panel>
    </PlanWizardFrame>
  )
}

/* Step 3 — Venues */
export function SceneVenues() {
  return (
    <PlanWizardFrame step={2}>
      <Panel title="Your buildings">
        <p className="text-ink-500 mb-3 text-sm">
          A home gym plus any gym the league can rent. Each gym gets its own colour and keeps it
          on every screen.
        </p>
        <div className="space-y-2">
          {PLAN_GYMS.map((gym) => (
            <div key={gym.name} className={cn("flex items-center gap-2.5 rounded-xl border bg-white p-3", gym.box)}>
              <i className={cn("h-3 w-3 rounded-full", gym.dot)} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm font-bold", gym.nameCls)}>{gym.full}</p>
                <p className="text-ink-500 text-xs">2 courts · 09:00 to 18:00</p>
              </div>
              <Badge tone={gym.home ? "court" : "neutral"}>{gym.home ? "Home gym" : "Rented"}</Badge>
            </div>
          ))}
        </div>
        <div className="border-ink-100 mt-4 flex items-center gap-3 border-t pt-4">
          <div className="flex-1">
            <SelectBox value="Paramount Fine Foods Centre · 5500 Rose Cherry Pl, Mississauga" />
          </div>
          <Advance confirm="Gym added, wearing the next free colour">
            <Button>Add gym</Button>
          </Advance>
        </div>
      </Panel>
    </PlanWizardFrame>
  )
}

/* Step 4 — Referees */
export function SceneReferees() {
  return (
    <SeasonManagePage active="Referees">
      <div className="space-y-5">
        <Panel title="Book a referee for a session day">
          <p className="text-ink-500 mb-4 text-sm">
            Pick a day and shift, then target a referee you know, or broadcast to your whole
            pool and let the first taker have it. Accepting auto-assigns them to every game in
            the window.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Session day">
              <SelectBox value="Week 1 · Sat, May 30" placeholder="Choose day…" />
            </Field>
            <Field label="Shift">
              <div className="flex items-center gap-2">
                <TxtInput value="09:00" />
                <TxtInput value="18:00" />
              </div>
            </Field>
          </div>
          <div className="mt-3 flex gap-2">
            {["Full day (9-6)", "Morning 6h (9-3)", "Afternoon (12-6)"].map((p, i) => (
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
            <Advance confirm="Offer broadcast to 4 referees. First to accept gets the day.">
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
    <SeasonManagePage active="\u2699 Settings">
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
            <Advance confirm="Settings saved">
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
            <p className="text-ink-700 mb-3 text-sm font-bold">Playoffs (optional, can be set later)</p>
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
    <SeasonManagePage active="\u2699 Settings">
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
          lifecycleConfirm="NPH Summer League Summer 2026 is open for team registration"
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


/* The calendar board, static: the slim weekend card as shipped. */
export function ScenePlanBoard() {
  const chip = (label: string, cls: string) => (
    <span className={cn("inline-flex min-h-[24px] items-center gap-1 rounded-[7px] border py-[3px] pl-1.5 pr-2 text-[11.5px] font-bold", cls)}>
      <span className="inline-grid grid-cols-2 gap-[2px] opacity-55" aria-hidden>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <i key={i} className="h-[2px] w-[2px] rounded-full bg-current" />
        ))}
      </span>
      {label}
    </span>
  )
  const gymBox = (gi: number, courts: string, free: number, chips: string[]) => {
    const gym = PLAN_GYMS[gi]
    return (
      <div className={cn("rounded-lg border bg-white/70 px-1.5 py-1", gym.box)}>
        <div className="flex items-center gap-1.5">
          <i className={cn("h-2.5 w-2.5 flex-none rounded-full", gym.dot)} aria-hidden />
          <span className={cn("min-w-0 flex-1 truncate text-[12.5px] font-bold", gym.nameCls)}>{gym.name}</span>
          <span className="border-ink-200 text-ink-500 rounded-[7px] border bg-white px-1.5 py-0.5 text-[10px] font-bold">Move</span>
          <span className="border-ink-200 text-ink-500 rounded-[7px] border bg-white px-1.5 py-0.5 text-[10px] font-bold">&#8943;</span>
        </div>
        <div className="mt-0.5 pl-3.5 text-[11px] font-bold tabular-nums">
          <span className="text-ink-600">{courts}</span>
          {free > 0 && <span className="text-court-700"> · {free} free</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-start gap-1">{chips.map((c) => <span key={c}>{chip(c, gym.chip)}</span>)}</div>
      </div>
    )
  }
  return (
    <PlanWizardFrame step={3}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {PLAN_GYMS.map((gym) => (
          <span key={gym.name} className="border-ink-200 flex items-center gap-1.5 rounded-lg border bg-white px-2 py-1 text-[11.5px] font-bold">
            <i className={cn("h-2 w-2 rounded-full", gym.dot)} aria-hidden />
            <span className={gym.nameCls}>{gym.name}</span>
            {gym.home && <span className="border-ink-200 text-ink-500 rounded border px-1 text-[9px]">Home gym</span>}
          </span>
        ))}
        <span className="border-gold-500 text-gold-600 ml-auto rounded-full border bg-white px-2 py-0.5 text-[10.5px] font-bold">1 weekend tight</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-ink-50/60 border-ink-100 rounded-xl border p-2">
          <p className="text-ink-400 mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em]">Session 1 · May</p>
          <div className="border-ink-200 rounded-xl border bg-white p-2">
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-ink-950 text-[13px] font-bold underline decoration-dotted underline-offset-2">May 30&ndash;31</span>
              <span className="border-court-200 bg-court-50 text-court-800 rounded-full border px-2 py-0.5 text-[10.5px] font-bold">30/30 games</span>
            </div>
            <div className="space-y-1.5">
              {gymBox(0, "2/2 courts", 0, ["Gr 8 (8)", "Gr 9 (8)"])}
              {gymBox(1, "2/2 courts", 0, ["Gr 10 (8)"])}
              {gymBox(2, "1/2 courts", 1, ["Gr 11 (6)"])}
            </div>
          </div>
        </div>
        <div className="bg-ink-50/60 border-ink-100 rounded-xl border p-2">
          <p className="text-ink-400 mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em]">Session 2 · Jun</p>
          <div className="border-ink-200 rounded-xl border bg-white p-2">
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-ink-950 text-[13px] font-bold underline decoration-dotted underline-offset-2">Jun 6&ndash;7</span>
              <span className="border-court-200 bg-court-50 text-court-800 rounded-full border px-2 py-0.5 text-[10.5px] font-bold">30/30 games</span>
            </div>
            <div className="space-y-1.5">
              {gymBox(0, "2/2 courts", 0, ["Gr 8 (8)", "Gr 9 (8)"])}
              {gymBox(1, "2/2 courts", 0, ["Gr 10 (8)"])}
              {gymBox(2, "1/2 courts", 1, ["Gr 11 (6)"])}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4">
        <Advance confirm="Calendar locked in. Generating the schedule from this plan." block>
          <Button block>Use this calendar and generate the schedule</Button>
        </Advance>
      </div>
    </PlanWizardFrame>
  )
}
