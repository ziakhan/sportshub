"use client"

/**
 * Act — Plan the season (added 2026-08-11, owner: "update the demo to the new
 * UI, show as much as you can"). Mirrors the five-step plan wizard and the
 * slim calendar board as shipped: colored gym identities (one colour word per
 * gym), draggable grade chips, live courts math, divisions created at
 * scheduling time behind their own door, and the draft to publish layer.
 * Replicas follow apps/web .../seasons/[seasonId]/plan and the Schedule tab.
 */

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/components/ui/cn"
import { LEAGUE, VENUES } from "../data"
import { Panel } from "../scenes/shared"
import { LiveCheck, LiveSelect } from "./anim"
import type { LiveScene } from "./engine"
import { pick } from "./helpers"
import { LeagueHold as Hold, SeasonShell } from "./act6-league"

const OFFICE = "League office"

/* The demo league's gyms wearing the one-word-per-gym palette: the home gym
   is green, the second gym pink, the third blue. Same families the product
   deals (VENUE_HUES in plan-shared.ts). */
const GYMS = [
  {
    name: "Pan Am Sports",
    full: VENUES[0].name,
    home: true,
    courts: 2,
    dot: "bg-court-500",
    nameCls: "text-court-700",
    box: "border-court-300",
    chip: "border-court-200 bg-court-50 text-court-800",
    action: "border-court-300 text-court-700",
  },
  {
    name: "Humber Athletic",
    full: VENUES[1].name,
    home: false,
    courts: 2,
    dot: "bg-fuchsia-600",
    nameCls: "text-fuchsia-700",
    box: "border-fuchsia-300",
    chip: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
    action: "border-fuchsia-300 text-fuchsia-700",
  },
  {
    name: "Haber Rec",
    full: VENUES[2].name,
    home: false,
    courts: 2,
    dot: "bg-blue-600",
    nameCls: "text-blue-700",
    box: "border-blue-300",
    chip: "border-blue-200 bg-blue-50 text-blue-800",
    action: "border-blue-300 text-blue-700",
  },
]

const GRADES = [
  { label: "Grade 8", teams: 8 },
  { label: "Grade 9", teams: 8 },
  { label: "Grade 10", teams: 8 },
  { label: "Grade 11", teams: 6 },
]

/* ── Wizard chrome: the five steps as shipped ──────────────────────────── */

function WizardShell({
  step,
  children,
  next,
}: {
  step: number
  children: React.ReactNode
  next?: React.ReactNode
}) {
  const STEPS = ["Teams", "Your buildings", "Your calendar", "Publish", "Schedule"]
  return (
    <div className="px-8 py-6">
      <p className="text-ink-500 mb-2 text-sm font-medium">&larr; Back to the season</p>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-ink-950 text-xl font-bold">Plan your season</h1>
          <p className="text-ink-500 text-xs">
            {LEAGUE.name} · {LEAGUE.season}
          </p>
        </div>
        <div className="border-ink-200 flex items-center gap-1 rounded-full border bg-white px-2 py-1.5">
          {STEPS.map((s, i) => (
            <span key={s} className="flex items-center gap-1">
              {i > 0 && <span className="bg-ink-200 h-px w-4" />}
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                  i + 1 === step ? "bg-court-600 text-white" : "bg-ink-100 text-ink-500"
                )}
              >
                {i + 1}
              </span>
              <span
                className={cn(
                  "text-xs font-semibold",
                  i + 1 === step ? "text-ink-950" : "text-ink-400"
                )}
              >
                {s}
              </span>
            </span>
          ))}
        </div>
      </div>
      {children}
      {next && <div className="mt-5 flex justify-end">{next}</div>}
    </div>
  )
}

/* ── Board pieces: the slim weekend card as shipped ────────────────────── */

function GradeChip({ label, teams, chip }: { label: string; teams: number; chip: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-[24px] items-center gap-1 rounded-[7px] border py-[3px] pl-1.5 pr-2 text-[11.5px] font-bold",
        chip
      )}
    >
      <span className="inline-grid grid-cols-2 gap-[2px] opacity-55" aria-hidden>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <i key={i} className="h-[2px] w-[2px] rounded-full bg-current" />
        ))}
      </span>
      {label} <span className="font-semibold opacity-75">({teams})</span>
    </span>
  )
}

function GymBox({
  gym,
  liveId,
  courtsLine,
  free,
  children,
  target,
}: {
  gym: (typeof GYMS)[number]
  liveId?: string
  courtsLine: string
  free?: number
  children?: React.ReactNode
  target?: boolean
}) {
  return (
    <div
      data-live-id={liveId}
      className={cn(
        "rounded-lg border bg-white/70 px-1.5 py-1",
        gym.box,
        target && "ring-court-500 ring-2"
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-ink-400 inline-grid grid-cols-2 gap-[2px]" aria-hidden>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <i key={i} className="h-[2px] w-[2px] rounded-full bg-current" />
          ))}
        </span>
        <i className={cn("h-2.5 w-2.5 flex-none rounded-full", gym.dot)} aria-hidden />
        <span className={cn("min-w-0 flex-1 truncate text-[12.5px] font-bold", gym.nameCls)}>
          {gym.name}
        </span>
        <span
          className={cn(
            "rounded-[7px] border bg-white px-1.5 py-0.5 text-[10px] font-bold",
            gym.action
          )}
        >
          Move
        </span>
        <span
          className={cn(
            "rounded-[7px] border bg-white px-1.5 py-0.5 text-[10px] font-bold",
            gym.action
          )}
        >
          &#8943;
        </span>
      </div>
      <div className="mt-0.5 pl-3.5 text-[11px] font-bold tabular-nums">
        <span className="text-ink-600">{courtsLine}</span>
        {typeof free === "number" && free > 0 && (
          <span className="text-court-700"> · {free} free</span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-start gap-1">{children}</div>
    </div>
  )
}

function WeekendCard({
  dates,
  pill,
  tight,
  children,
}: {
  dates: string
  pill: string
  tight?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-2",
        tight ? "border-gold-500 bg-gold-50" : "border-ink-200"
      )}
    >
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-ink-950 text-[13px] font-bold underline decoration-dotted underline-offset-2">
          {dates}
        </span>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10.5px] font-bold",
            tight
              ? "border-gold-500 bg-white text-gold-600"
              : "border-court-200 bg-court-50 text-court-800"
          )}
        >
          {pill}
        </span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

/* P1 — Step 1, Teams: the plan starts from real registrations */
const planTeams: LiveScene = {
  id: "l-plan-teams",
  act: "plan",
  persona: "league",
  personaLabel: OFFICE,
  frame: "desktop",
  url: "/manage/leagues/nph-summer-league/seasons/summer-2026/plan",
  caption:
    "Rosters are locked, so planning starts from reality: the wizard reads every registered grade and how many teams it brought. Nothing is typed twice.",
  script: [
    { zoom: "gradeList", scale: 1.18 },
    { wait: 1400 },
    { zoom: null },
    { hold: "nextBtn" },
  ],
  render: () => (
    <WizardShell
      step={1}
      next={
        <Hold id="nextBtn">
          <Button>Next: Your buildings &rarr;</Button>
        </Hold>
      }
    >
      <Panel title="Who plays this season">
        <p className="text-ink-500 mb-3 text-sm">
          These came from registration. Every grade plays {LEAGUE.gamesGuaranteed} games.
        </p>
        <div data-live-id="gradeList" className="divide-ink-100 divide-y">
          {GRADES.map((gr) => (
            <div key={gr.label} className="flex items-center justify-between py-2.5">
              <p className="text-ink-900 text-sm font-bold">{gr.label}</p>
              <div className="flex items-center gap-4">
                <span className="text-ink-500 text-xs">{gr.teams} teams</span>
                <span className="text-ink-500 text-xs">
                  {(gr.teams * LEAGUE.gamesGuaranteed) / 2} games
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-ink-400 mt-3 text-xs">30 teams · 150 games to place</p>
      </Panel>
    </WizardShell>
  ),
}

/* P2 — Step 2, Your buildings: gyms get their identity colour here */
const planBuildings: LiveScene = {
  id: "l-plan-buildings",
  act: "plan",
  persona: "league",
  personaLabel: OFFICE,
  frame: "desktop",
  url: "/manage/leagues/nph-summer-league/seasons/summer-2026/plan",
  caption:
    "The buildings step: a home gym plus any gym the league can rent. Each gym gets its own colour and keeps it everywhere, on every screen.",
  script: [
    { wait: 500 },
    ...pick("gymSel", "gym", 1, `${VENUES[2].name} · ${VENUES[2].city} · 2 courts`),
    { press: "addGym" },
    { set: { added: true } },
    { wait: 700 },
    { hold: "nextBtn" },
  ],
  render: (g) => (
    <WizardShell
      step={2}
      next={
        <Hold id="nextBtn">
          <Button>Next: Your calendar &rarr;</Button>
        </Hold>
      }
    >
      <Panel title="Your buildings">
        <div className="space-y-2">
          {GYMS.slice(0, 2).map((gym) => (
            <div
              key={gym.name}
              className={cn("flex items-center gap-2.5 rounded-xl border bg-white p-3", gym.box)}
            >
              <i className={cn("h-3 w-3 rounded-full", gym.dot)} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm font-bold", gym.nameCls)}>{gym.full}</p>
                <p className="text-ink-500 text-xs">{gym.courts} courts · 09:00 to 18:00</p>
              </div>
              {gym.home && <Badge tone="court">Home gym</Badge>}
            </div>
          ))}
          {!!g("added") && (
            <div
              className={cn(
                "live-row-in flex items-center gap-2.5 rounded-xl border bg-white p-3",
                GYMS[2].box
              )}
            >
              <i className={cn("h-3 w-3 rounded-full", GYMS[2].dot)} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm font-bold", GYMS[2].nameCls)}>{GYMS[2].full}</p>
                <p className="text-ink-500 text-xs">2 courts · 09:00 to 18:00</p>
              </div>
              <Badge tone="neutral">Rented</Badge>
            </div>
          )}
        </div>
        <div className="border-ink-100 mt-4 flex items-center gap-3 border-t pt-4">
          <div className="flex-1">
            <LiveSelect
              id="gymSel"
              value={g("gym") as string}
              placeholder="Add a building this league can use…"
              open={!!g("gym:open")}
              options={[
                `${VENUES[3].name} · ${VENUES[3].city} · 2 courts`,
                `${VENUES[2].name} · ${VENUES[2].city} · 2 courts`,
              ]}
              highlight={g("gym:hi") as number}
            />
          </div>
          <span data-live-id="addGym" className="inline-block rounded-xl">
            <Button>Add gym</Button>
          </span>
        </div>
      </Panel>
    </WizardShell>
  ),
}

/* P3 — Step 3, the calendar board: the flagship. A grade chip moves between
   coloured gym boxes and the courts math answers live. */
const planBoard: LiveScene = {
  id: "l-plan-board",
  act: "plan",
  persona: "league",
  personaLabel: OFFICE,
  frame: "desktop",
  url: "/manage/leagues/nph-summer-league/seasons/summer-2026/plan",
  caption:
    "The calendar board. Every weekend is a card, every gym a coloured box, every grade a chip you can drag. Watch Grade 9 move to Haber: the courts count answers before the mouse is released.",
  script: [
    { wait: 700 },
    { zoom: "week2", scale: 1.35 },
    { wait: 900 },
    { press: "gr9chip" },
    { wait: 500 },
    { cursor: "haberBox" },
    { set: { moved: true } },
    { wait: 500 },
    { confirm: "Grade 9 plays at Haber Rec on Jun 6 and 7. The math updated live." },
    { wait: 400 },
    { zoom: null },
    { hold: "generateBtn" },
  ],
  render: (g) => {
    const moved = !!g("moved")
    return (
      <div className="px-8 py-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-ink-950 text-xl font-bold">Your calendar</h1>
            <p className="text-ink-500 text-xs">Drag a grade to move it · math updates live</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="border-play-300 text-play-700 bg-play-50 rounded-lg border px-2.5 py-1 text-xs font-bold">
              Redraw &#9662;
            </span>
            <span className="border-ink-200 rounded-lg border bg-white px-2.5 py-1 text-xs font-bold">
              <span className="bg-court-600 mr-1 rounded px-1.5 py-0.5 text-[10px] text-white">
                Board
              </span>
              <span className="text-ink-400">Strip</span>
            </span>
            <Hold id="generateBtn">
              <Button size="sm">Use this calendar and generate the schedule</Button>
            </Hold>
          </div>
        </div>

        <div className="border-ink-200 mb-3 flex flex-wrap items-center gap-2 rounded-xl border bg-white p-2">
          <span className="text-ink-400 text-[10px] font-bold uppercase tracking-[0.12em]">
            Your gyms
          </span>
          {GYMS.map((gym) => (
            <span
              key={gym.name}
              className="border-ink-200 flex items-center gap-1.5 rounded-lg border bg-white px-2 py-1 text-[11.5px] font-bold"
            >
              <i className={cn("h-2 w-2 rounded-full", gym.dot)} aria-hidden />
              <span className={gym.nameCls}>{gym.name}</span>
              {gym.home && (
                <span className="border-ink-200 text-ink-500 rounded border px-1 text-[9px]">
                  Home gym
                </span>
              )}
              <span className="text-ink-400 font-medium">On 5 weekends</span>
            </span>
          ))}
          <span className="border-gold-500 text-gold-600 ml-auto rounded-full border bg-white px-2 py-0.5 text-[10.5px] font-bold">
            1 weekend tight
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-ink-50/60 border-ink-100 rounded-xl border p-2">
            <p className="text-ink-400 mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em]">
              Session 1 · May
            </p>
            <WeekendCard dates="May 30&ndash;31" pill="30/30 games">
              <GymBox gym={GYMS[0]} courtsLine="2/2 courts">
                <GradeChip label="Gr 8" teams={8} chip={GYMS[0].chip} />
                <GradeChip label="Gr 9" teams={8} chip={GYMS[0].chip} />
              </GymBox>
              <GymBox gym={GYMS[1]} courtsLine="2/2 courts">
                <GradeChip label="Gr 10" teams={8} chip={GYMS[1].chip} />
              </GymBox>
              <GymBox gym={GYMS[2]} courtsLine="1/2 courts" free={1}>
                <GradeChip label="Gr 11" teams={6} chip={GYMS[2].chip} />
              </GymBox>
            </WeekendCard>
          </div>

          <div className="bg-ink-50/60 border-ink-100 rounded-xl border p-2" data-live-id="week2">
            <p className="text-ink-400 mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em]">
              Session 2 · Jun
            </p>
            <WeekendCard dates="Jun 6&ndash;7" pill="30/30 games">
              <GymBox gym={GYMS[0]} courtsLine={moved ? "1/2 courts" : "2/2 courts"} free={moved ? 1 : 0}>
                <GradeChip label="Gr 8" teams={8} chip={GYMS[0].chip} />
                {!moved && (
                  <span data-live-id="gr9chip" className="inline-block">
                    <GradeChip label="Gr 9" teams={8} chip={GYMS[0].chip} />
                  </span>
                )}
              </GymBox>
              <GymBox gym={GYMS[1]} courtsLine="2/2 courts">
                <GradeChip label="Gr 10" teams={8} chip={GYMS[1].chip} />
              </GymBox>
              <GymBox
                gym={GYMS[2]}
                liveId="haberBox"
                courtsLine={moved ? "2/2 courts" : "1/2 courts"}
                free={moved ? 0 : 1}
                target={!moved && !!g("gr9chip:armed")}
              >
                <GradeChip label="Gr 11" teams={6} chip={GYMS[2].chip} />
                {moved && (
                  <span className="live-pop inline-block">
                    <GradeChip label="Gr 9" teams={8} chip={GYMS[2].chip} />
                  </span>
                )}
              </GymBox>
            </WeekendCard>
          </div>

          <div className="bg-ink-50/60 border-ink-100 rounded-xl border p-2">
            <p className="text-ink-400 mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em]">
              Session 5 · Jun
            </p>
            <WeekendCard dates="Jun 27&ndash;28" pill="29/30 games · tight" tight>
              <GymBox gym={GYMS[0]} courtsLine="2/2 courts">
                <GradeChip label="Gr 8" teams={8} chip={GYMS[0].chip} />
                <GradeChip label="Gr 9" teams={8} chip={GYMS[0].chip} />
              </GymBox>
              <GymBox gym={GYMS[1]} courtsLine="2/2 courts">
                <GradeChip label="Gr 10" teams={8} chip={GYMS[1].chip} />
                <GradeChip label="Gr 11" teams={6} chip={GYMS[1].chip} />
              </GymBox>
            </WeekendCard>
          </div>
        </div>
      </div>
    )
  },
}

/* P4 — Divisions live behind their own door on the Schedule tab */
const planDivisions: LiveScene = {
  id: "l-plan-divisions",
  act: "plan",
  persona: "league",
  personaLabel: OFFICE,
  frame: "desktop",
  url: "/manage/leagues/nph-summer-league/seasons/summer-2026/manage",
  caption:
    "Divisions are made here, from real teams, only if you want them. Half the Grade 8 sides are east enders, so one checkbox and a drag board split them, and the two halves stay apart all season.",
  script: [
    { wait: 600 },
    ...(
      [
        { press: "gr8check" },
        { set: { checked: true } },
        { wait: 500 },
        { press: "dealBtn" },
        { set: { dealt: true } },
        { wait: 900 },
        { press: "noCross" },
        { set: { cross: "no" } },
        { wait: 500 },
      ] as const
    ),
    { hold: "createBtn" },
    { confirm: "Grade 8 East and Grade 8 West created. They will not cross over in the regular season." },
  ],
  render: (g) => (
    <SeasonShell active="Schedule" status="Planning" statusTone="play">
      <Panel title="Create divisions for teams">
        <p className="text-ink-500 mb-3 text-sm">
          Pick the grades to split. Grades you leave alone play as one group.
        </p>
        <LiveCheck
          id="gr8check"
          on={!!g("checked")}
          label={<b>Grade 8 · 8 teams</b>}
          sub="Four of the eight are east-end clubs"
        />
        {!!g("checked") && (
          <div className="live-row-in mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-ink-900 text-sm font-bold">Split Grade 8</p>
              <span data-live-id="dealBtn" className="inline-block">
                <Button size="sm" variant="subtle">
                  Deal randomly
                </Button>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(["Grade 8 East", "Grade 8 West"] as const).map((d, di) => (
                <div key={d} className="border-ink-200 rounded-xl border bg-white p-3">
                  <p className="text-ink-900 mb-2 text-xs font-bold">
                    <span
                      className={cn(
                        "mr-1.5 inline-block h-2 w-2 rounded-full",
                        di === 0 ? "bg-fuchsia-600" : "bg-court-500"
                      )}
                    />
                    {d}
                  </p>
                  {g("dealt") ? (
                    <div className="space-y-1">
                      {(di === 0
                        ? ["Scarborough Blues", "East York Eagles", "Ajax Attack", "Pickering Panthers"]
                        : ["Burlington Force", "Oakville Panthers", "West United Prep", "Polaris Prep"]
                      ).map((t) => (
                        <p key={t} className="border-ink-100 live-row-in rounded-lg border px-2 py-1 text-xs font-semibold">
                          ⠿ {t} Grade 8
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-ink-400 text-xs">Drag teams here</p>
                  )}
                </div>
              ))}
            </div>
            {!!g("dealt") && (
              <div className="live-row-in border-ink-100 mt-3 border-t pt-3">
                <p className="text-ink-900 text-sm font-semibold">
                  Do Grade 8 East and West play each other in the regular season?
                </p>
                <div className="mt-2 flex gap-2">
                  <span
                    className={cn(
                      "rounded-lg border px-3 py-1 text-xs font-bold",
                      g("cross") === "no"
                        ? "border-play-400 bg-play-50 text-play-800"
                        : "border-ink-200 text-ink-500"
                    )}
                  >
                    <span data-live-id="noCross">No, keep them apart</span>
                  </span>
                  <span className="border-ink-200 text-ink-500 rounded-lg border px-3 py-1 text-xs font-bold">
                    Yes, they can mix
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="mt-4">
          <Hold id="createBtn" block>
            <Button block disabled={!g("dealt")}>
              Create divisions
            </Button>
          </Hold>
        </div>
      </Panel>
    </SeasonShell>
  ),
}

/* P5 — Generate, then publish: drafts are private until the button */
const planPublish: LiveScene = {
  id: "l-plan-publish",
  act: "plan",
  persona: "league",
  personaLabel: OFFICE,
  frame: "desktop",
  url: "/manage/leagues/nph-summer-league/seasons/summer-2026/manage",
  caption:
    "The engine writes every game inside the plan and audits itself: every team exactly 10 games, zero back to backs. It stays a private draft until Publish, and publishing tells every family at once.",
  script: [
    { wait: 500 },
    { press: "genBtn" },
    { set: { generated: true } },
    { wait: 1400 },
    { hold: "publishBtn" },
    { set: { published: true } },
    { wait: 400 },
    { confirm: "Schedule published. 150 games are live for every team, family and referee." },
  ],
  render: (g) => (
    <SeasonShell
      active="Schedule"
      status={g("published") ? "Published" : "Planning"}
      statusTone={g("published") ? "court" : "play"}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-500 text-sm">
          Built on plan <b className="text-ink-900">Summer draw</b> · change
        </p>
        {!g("generated") ? (
          <span data-live-id="genBtn" className="inline-block rounded-xl">
            <Button>Generate the schedule</Button>
          </span>
        ) : (
          <Hold id="publishBtn">
            <Button tone="court" disabled={!!g("published")}>
              {g("published") ? "Published" : "Publish schedule"}
            </Button>
          </Hold>
        )}
      </div>
      {!!g("generated") && (
        <div className="border-court-200 bg-court-50/40 live-row-in mb-4 rounded-xl border p-3">
          <p className="text-court-700 text-sm font-bold">
            ✓ 150 games placed. Every team plays exactly 10. Zero back to backs, zero gym
            conflicts.
          </p>
        </div>
      )}
      <Panel
        title="Week 1 · Sat, May 30"
        action={
          g("generated") ? (
            <Badge tone={g("published") ? "court" : "neutral"}>
              {g("published") ? "Live" : "Draft, only you can see this"}
            </Badge>
          ) : undefined
        }
      >
        {g("generated") ? (
          <div className="divide-ink-100 divide-y">
            {[
              ["9:00 am", "Burlington Force Grade 8", "Oakville Panthers Grade 8", "Pan Am Sports · Court 1"],
              ["9:00 am", "Scarborough Blues Grade 8", "East York Eagles Grade 8", "Pan Am Sports · Court 2"],
              ["10:30 am", "Royal Crown Grade 10", "West United Prep Grade 10", "Humber Athletic · Court 1"],
              ["12:00 pm", "North York Lions Grade 11", "City Above Elite Grade 11", "Haber Rec · Court 1"],
            ].map(([t, h, a, v]) => (
              <div key={`${t}${h}`} className="live-row-in flex items-center justify-between py-2.5">
                <div>
                  <p className="text-ink-900 text-sm font-semibold">
                    {h} <span className="text-ink-400">vs</span> {a}
                  </p>
                  <p className="text-ink-500 text-xs">
                    {t} · {v}
                  </p>
                </div>
                {!g("published") && (
                  <span className="border-ink-200 text-ink-500 rounded border px-1.5 py-0.5 text-[10px] font-bold">
                    DRAFT
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-ink-400 text-sm">No games yet. Generate from the plan above.</p>
        )}
      </Panel>
    </SeasonShell>
  ),
}

export const ACT_PLAN: LiveScene[] = [planTeams, planBuildings, planBoard, planDivisions, planPublish]
