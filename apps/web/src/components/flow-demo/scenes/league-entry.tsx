"use client"

/**
 * Chapter 4 — League entry (steps 22-26): the club submits a roster version
 * and pays the team fee; rosters lock at the deadline; the league reviews
 * payments, approves changes, finalizes, and generates the schedule.
 * Mirrors /clubs/[id]/teams/[teamId]/league-rosters, /payments,
 * /manage/leagues/[id]/payments and the season-manage Teams/Overview/Schedule
 * tabs (docs/demo-inventory/club.md + league.md).
 */

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PanelHeader } from "@/components/ui/panel-header"
import { cn } from "@/components/ui/cn"
import { Advance } from "../advance"
import { EXTRA_PLAYER, LEAGUE, ROSTER, SESSIONS, TEAM, fmt } from "../data"
import { CheckRow, Field, OperatorPage, Panel, SelectBox, Td, Th, TxtInput } from "./shared"
import { SeasonHeader, SeasonTabs } from "./league-setup"

function LeagueRostersShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-10 py-8">
      <p className="text-ink-500 mb-3 text-sm font-medium">&larr; Back to Team Dashboard</p>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-condensed text-ink-950 text-3xl font-bold uppercase tracking-wide">
            {TEAM.name} · League Rosters
          </h1>
          <p className="text-ink-500 mt-1 text-sm">
            Each league only sees the version you submitted to it. Your club roster of 13 stays
            yours.
          </p>
        </div>
        <Button variant="subtle">Add this team to a league</Button>
      </div>
      {children}
    </div>
  )
}

/* Step 22a — Pick this league's roster version */
export function SceneRosterVersion() {
  return (
    <LeagueRostersShell>
      <Card className="overflow-hidden p-0">
        <PanelHeader
          variant="band"
          title={`${LEAGUE.name} · ${LEAGUE.season} · Grade 10 Boys`}
          action={<Button size="sm" variant="subtle">Cancel</Button>}
        />
        <div className="px-6 py-4">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
            <Badge tone="court" dot>
              Open
            </Badge>
            <span className="bg-ink-50 text-ink-500 rounded-full px-2 py-0.5 font-semibold">
              changes by league approval
            </span>
            <span className="text-ink-400">submitted May 1, 2026</span>
          </div>
          <p className="text-ink-700 mb-3 text-sm font-semibold">
            Pick this league&apos;s version from your club roster (12/13 selected)
          </p>
          <div className="grid grid-cols-3 gap-x-4 gap-y-2">
            {ROSTER.map((p) => (
              <CheckRow key={p.name} checked label={`#${p.jersey} ${p.name} · ${p.pos}`} />
            ))}
            <CheckRow label={`#${EXTRA_PLAYER.jersey} ${EXTRA_PLAYER.name} · ${EXTRA_PLAYER.pos}`} />
          </div>
          <div className="mt-5 flex gap-3">
            <Advance confirm="Roster saved (12 players).">
              <Button>Save version (12 players)</Button>
            </Advance>
            <Button variant="subtle">Cancel</Button>
          </div>
        </div>
      </Card>
    </LeagueRostersShell>
  )
}

/* Step 22b — The club pays the team fee */
export function SceneTeamFeeDue() {
  return (
    <OperatorPage title="My Payments" subtitle={`1 open item, ${fmt(LEAGUE.teamFee)} outstanding.`}>
      <Card className="overflow-hidden p-0">
        <table className="w-full">
          <thead className="border-ink-100 border-b">
            <tr>
              <Th>To</Th>
              <Th>For</Th>
              <Th right>Amount</Th>
              <Th right>Paid</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-ink-50 divide-y">
            <tr>
              <Td>
                <span className="text-play-700 font-semibold">{LEAGUE.name}</span>
              </Td>
              <Td>
                <span className="font-semibold">
                  {LEAGUE.season} · {TEAM.name}
                </span>
                <span className="bg-ink-50 text-ink-500 ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                  Team fee
                </span>
              </Td>
              <Td right>{fmt(LEAGUE.teamFee)}</Td>
              <Td right>$0.00</Td>
              <Td>
                <Badge tone="gold">Owed</Badge>
              </Td>
              <Td right>
                <Advance>
                  <Button size="sm">Pay online</Button>
                </Advance>
              </Td>
            </tr>
          </tbody>
        </table>
      </Card>
      <p className="text-ink-400 mt-4 text-xs">
        Need a refund or a correction? Contact the club or league directly. They manage payments
        on their side.
      </p>
    </OperatorPage>
  )
}

export function SceneStripeTeamFee() {
  return (
    <div className="bg-ink-900/40 flex justify-center px-10 py-16">
      <Card className="w-full max-w-md">
        <p className="text-ink-950 text-lg font-bold">Pay {fmt(LEAGUE.teamFee)}</p>
        <div className="mt-4 space-y-3">
          <Field label="Card number">
            <TxtInput value="5454 5454 5454 5454" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Expiry">
              <TxtInput value="09 / 27" />
            </Field>
            <Field label="CVC">
              <TxtInput value="•••" />
            </Field>
          </div>
          <p className="text-ink-400 text-xs">Payments are processed securely by Stripe.</p>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="subtle">Cancel</Button>
          <Advance confirm="✓ Payment received">
            <Button>Pay {fmt(LEAGUE.teamFee)}</Button>
          </Advance>
        </div>
      </Card>
    </div>
  )
}

/* Step 23 — Rosters lock at the deadline */
export function SceneRosterLocked() {
  return (
    <LeagueRostersShell>
      <Card className="overflow-hidden p-0">
        <PanelHeader
          variant="band"
          title={`${LEAGUE.name} · ${LEAGUE.season} · Grade 10 Boys`}
          action={
            <Advance>
              <Button size="sm">Request change</Button>
            </Advance>
          }
        />
        <div className="px-6 py-4">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <Badge tone="warning" dot>
              Locked
            </Badge>
            <span className="bg-ink-50 text-ink-500 rounded-full px-2 py-0.5 font-semibold">
              changes by league approval
            </span>
            <span className="text-ink-400">submitted May 1, 2026</span>
            <span className="text-ink-400">12 players</span>
          </div>
          <p className="text-ink-400 mb-4 text-xs">
            The roster locked when the season finalized. Changes go through the league from
            here.
          </p>
          <table className="w-full max-w-xl">
            <thead className="border-ink-100 border-b">
              <tr>
                <Th>#</Th>
                <Th>Player</Th>
                <Th>Position</Th>
              </tr>
            </thead>
            <tbody className="divide-ink-50 divide-y">
              {ROSTER.slice(0, 5).map((p) => (
                <tr key={p.name}>
                  <Td>{p.jersey}</Td>
                  <Td>
                    <span className="font-semibold">{p.name}</span>
                  </Td>
                  <Td>{p.pos}</Td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} className="text-ink-400 px-3 py-2.5 text-xs">
                  + 7 more players
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </LeagueRostersShell>
  )
}

/* Step 23b — Request a change against the locked roster */
export function SceneRosterChangeRequest() {
  return (
    <LeagueRostersShell>
      <Card className="overflow-hidden p-0">
        <PanelHeader variant="band" title={`${LEAGUE.name} · ${LEAGUE.season} · Grade 10 Boys`} />
        <div className="px-6 py-4">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-ink-700 mb-2 text-sm font-semibold">Remove from league roster (12)</p>
              <div className="space-y-1.5">
                {ROSTER.slice(0, 4).map((p) => (
                  <CheckRow key={p.name} label={`#${p.jersey} ${p.name}`} />
                ))}
                <p className="text-ink-400 text-xs">+ 8 more</p>
              </div>
            </div>
            <div>
              <p className="text-ink-700 mb-2 text-sm font-semibold">Add from club roster (1)</p>
              <CheckRow checked label={`#${EXTRA_PLAYER.jersey} ${EXTRA_PLAYER.name}`} />
            </div>
          </div>
          <div className="mt-4">
            <Field label="Note for the league (optional)">
              <TxtInput
                value="Calling up Theo Martinez after an ankle injury opened a spot."
                placeholder="e.g. Two call-ups from our Grade 8 squad after an injury"
              />
            </Field>
            <p className="text-ink-400 mt-2 text-xs">
              Nothing changes until the league approves. Approval applies these adds/removes to
              the locked roster.
            </p>
          </div>
          <div className="mt-4 flex gap-3">
            <Advance confirm="Request sent. The league will review it.">
              <Button>Send request (+1)</Button>
            </Advance>
            <Button variant="subtle">Cancel</Button>
          </div>
        </div>
      </Card>
    </LeagueRostersShell>
  )
}

/* Step 24 — League reviews the payments */
export function SceneLeaguePayments() {
  const rows = [
    { from: "Burlington Force", team: TEAM.name, paid: LEAGUE.teamFee, status: "Paid", method: "Card (online)" },
    { from: "Royal Crown", team: "Royal Crown Grade 10", paid: LEAGUE.teamFee, status: "Paid", method: "e-Transfer" },
    { from: "North Toronto Huskies", team: "North Toronto Huskies Grade 10", paid: LEAGUE.teamFee, status: "Paid", method: "Card (online)" },
    { from: "North York Lions", team: "North York Lions Grade 10", paid: LEAGUE.teamFee, status: "Paid", method: "Cheque" },
    { from: "City Above Elite", team: "City Above Elite Grade 10", paid: LEAGUE.teamFee, status: "Paid", method: "Card (online)" },
    { from: "Oakville Panthers", team: "Oakville Panthers Grade 10", paid: LEAGUE.teamFee, status: "Paid", method: "Cash" },
    { from: "West United Prep", team: "West United Prep Grade 10", paid: 0, status: "Owed", method: null },
    { from: "Polaris Prep", team: "Polaris Prep Grade 10", paid: 0, status: "Owed", method: null },
  ]
  return (
    <div className="px-10 py-8">
      <p className="text-ink-500 mb-3 text-sm font-medium">&larr; {LEAGUE.name}</p>
      <h1 className="font-condensed text-ink-950 mb-5 text-3xl font-bold uppercase tracking-wide">
        Team fees &amp; payments
      </h1>
      <div className="mb-5 grid grid-cols-3 gap-4">
        {[
          ["Collected", fmt(23940), "text-court-700"],
          ["Outstanding", fmt(7980), "text-hoop-600"],
          ["Waived", fmt(0), "text-ink-700"],
        ].map(([label, v, cls]) => (
          <Card key={label} size="sm" className="text-center">
            <p className={cn("font-condensed text-3xl font-bold", cls)}>{v}</p>
            <p className="text-ink-500 text-sm font-medium">{label}</p>
          </Card>
        ))}
      </div>
      <Card className="overflow-hidden p-0">
        <div className="border-ink-100 flex gap-2 border-b px-5 py-3">
          {["All", "Open", "Paid"].map((p, i) => (
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
        <table className="w-full">
          <thead className="border-ink-100 border-b">
            <tr>
              <Th>From</Th>
              <Th>For</Th>
              <Th right>Amount</Th>
              <Th right>Paid</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-ink-50 divide-y">
            {rows.map((r, i) => (
              <tr key={r.from}>
                <Td>
                  <span className="font-semibold">{r.from}</span>
                </Td>
                <Td>
                  {LEAGUE.season} · {r.team}
                  <span className="bg-ink-50 text-ink-500 ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                    Team fee
                  </span>
                </Td>
                <Td right>{fmt(LEAGUE.teamFee)}</Td>
                <Td right>{fmt(r.paid)}</Td>
                <Td>
                  <Badge tone={r.status === "Paid" ? "court" : "gold"}>{r.status}</Badge>
                </Td>
                <Td right className="whitespace-nowrap">
                  {r.status === "Owed" &&
                    (i === 6 ? (
                      <Advance>
                        <Button size="sm" variant="subtle">
                          Record payment
                        </Button>
                      </Advance>
                    ) : (
                      <>
                        <Button size="sm" variant="subtle">
                          Record payment
                        </Button>
                        <span className="text-ink-400 ml-2 text-xs font-semibold">Waive</span>
                      </>
                    ))}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

/* Step 24b — Record an offline payment */
export function SceneRecordPayment() {
  return (
    <div className="bg-ink-900/40 flex justify-center px-10 py-16">
      <Card className="w-full max-w-md">
        <h3 className="text-ink-950 text-lg font-bold">Record a payment</h3>
        <p className="text-ink-500 mt-0.5 text-sm">
          {LEAGUE.season} · West United Prep Grade 10 · {fmt(LEAGUE.teamFee)} remaining
        </p>
        <div className="mt-4 space-y-3">
          <Field label="Amount received">
            <TxtInput value="3990.00" />
          </Field>
          <Field label="Method">
            <SelectBox value="e-Transfer" />
          </Field>
          <Field label="Note (optional)">
            <TxtInput value="Sent by the club treasurer, May 12" placeholder="e.g. paid at the door" />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="subtle">Cancel</Button>
          <Advance confirm="Payment recorded">
            <Button>Record payment</Button>
          </Advance>
        </div>
      </Card>
    </div>
  )
}

/* Step 25a — Teams tab: roster policy + approving the change request */
export function SceneTeamsTab() {
  return (
    <div className="px-10 py-8">
      <SeasonHeader status="Registration Closed" statusTone="play" lifecycle="Finalize Season" />
      <SeasonTabs active="Teams" />
      <div className="space-y-5">
        <Panel title="Roster changes" action={<Badge tone="warning">1 pending</Badge>}>
          <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
            <Field label="After rosters lock">
              <SelectBox value="Changes need my approval" />
            </Field>
            <div />
            <Button size="sm" variant="subtle">
              Save policy
            </Button>
          </div>
          <div className="border-ink-100 mt-4 rounded-xl border p-4">
            <p className="text-ink-900 text-sm font-bold">{TEAM.name}</p>
            <p className="text-ink-600 mt-1 text-sm">
              Add #{EXTRA_PLAYER.jersey} {EXTRA_PLAYER.name}: &quot;Calling up Theo Martinez after
              an ankle injury opened a spot.&quot;
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1">
                <TxtInput placeholder="Note back to the club (optional)" />
              </div>
              <Advance confirm="Approved. Changes applied to the roster.">
                <Button size="sm" tone="court">
                  Approve
                </Button>
              </Advance>
              <Button size="sm" variant="subtle">
                Deny
              </Button>
            </div>
          </div>
        </Panel>
        <Panel title="Registered teams">
          <div className="mb-3 flex flex-wrap gap-2">
            {["All (8)", "Pending (0)", "Approved (8)", "Rejected (0)", "Any payment", "Unpaid (1)", "Paid (7)"].map(
              (p, i) => (
                <span
                  key={p}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold",
                    i === 0 || i === 4 ? "bg-ink-900 text-white" : "bg-white text-ink-600 border-ink-200 border"
                  )}
                >
                  {p}
                </span>
              )
            )}
          </div>
          <div className="divide-ink-50 divide-y">
            {[
              [TEAM.name, "paid (stripe)"],
              ["Royal Crown Grade 10", "paid"],
              ["North Toronto Huskies Grade 10", "paid (stripe)"],
              ["West United Prep Grade 10", "paid"],
              ["North York Lions Grade 10", "paid"],
            ].map(([t, pay]) => (
              <div key={t} className="flex items-center justify-between py-2.5">
                <span className="text-ink-900 text-sm font-bold">{t}</span>
                <div className="flex items-center gap-2">
                  <Badge tone="court">approved</Badge>
                  <Badge tone="success">{pay}</Badge>
                  <span className="text-ink-500 text-xs font-semibold">Withdraw</span>
                </div>
              </div>
            ))}
            <p className="text-ink-400 py-2.5 text-center text-xs">+ 3 more teams</p>
          </div>
        </Panel>
      </div>
    </div>
  )
}

/* Step 25b — Finalize on the deadline */
export function SceneFinalizeSeason() {
  const checks = [
    "At least one division created",
    "At least one game session scheduled",
    "Every session has a day with venue + court",
    "At least one venue assigned",
    "No teams pending approval",
    "Max games per season defined",
    "Period / half length defined",
    "Tiebreaker order configured",
  ]
  return (
    <div className="px-10 py-8">
      <SeasonHeader
        status="Registration Closed"
        statusTone="play"
        lifecycle="Finalize Season"
        lifecycleHighlight
        lifecycleConfirm="Season finalized. Rosters locked"
      />
      <SeasonTabs active="Overview" />
      <Card className="border-court-200 bg-court-50/40 mb-5">
        <p className="text-court-700 text-sm font-bold">✓ Ready to finalize</p>
        <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1.5">
          {checks.map((c) => (
            <p key={c} className="text-ink-700 text-sm">
              <span className="text-court-600 font-bold">✓</span> {c}
            </p>
          ))}
        </div>
      </Card>
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
    </div>
  )
}

/* Step 26a — Capacity planner + preview */
export function SceneCapacityPlanner() {
  return (
    <div className="px-10 py-8">
      <SeasonHeader status="Finalized" statusTone="hoop" lifecycle="Start Season" />
      <SeasonTabs active="Schedule" />
      <Panel
        title="Schedule"
        action={
          <div className="flex gap-2">
            <Advance>
              <Button size="sm">Preview schedule</Button>
            </Advance>
            <Button size="sm" variant="subtle" disabled>
              Commit schedule
            </Button>
          </div>
        }
      >
        <p className="text-ink-500 mb-4 text-sm">
          Preview the scheduler&apos;s proposal, then commit to persist games. Season must be finalized
          before you can commit.
        </p>
        <p className="text-ink-700 mb-1 text-sm font-bold">Capacity planner</p>
        <p className="text-ink-400 mb-3 text-xs">
          What each session can hold vs what your divisions need. Untick a division to leave it
          out of a session. The preview and commit follow this plan.
        </p>
        <div className="space-y-2.5">
          {SESSIONS.map((s) => (
            <div key={s.label} className="border-ink-100 rounded-xl border p-3.5">
              <div className="flex items-center justify-between">
                <p className="text-ink-900 text-sm font-bold">
                  {s.label} · 2 day(s) · 2 court(s) · 2 game(s)/team
                </p>
                <p className="text-court-700 text-xs font-semibold">30 of 36 slots needed · 6 spare</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {["Grade 8 Boys · 8 teams · 8 games", "Grade 9 Boys · 8 teams · 8 games", "Grade 10 Boys · 8 teams · 8 games", "Grade 11 Boys · 6 teams · 6 games"].map((u) => (
                  <span key={u} className="border-play-200 bg-play-50 text-play-700 rounded-full border px-2.5 py-1 text-xs font-semibold">
                    ✓ {u}
                  </span>
                ))}
              </div>
              <p className="text-ink-400 mt-2 text-xs">
                This session can carry up to 36 teams at 2 game(s) each.
              </p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

/* Step 26b — Preview then commit */
export function SceneSchedulePreview() {
  const games = [
    ["Sat May 30 · 9:00 am", TEAM.name, "North Toronto Huskies Grade 10"],
    ["Sat May 30 · 9:00 am", "Royal Crown Grade 10", "West United Prep Grade 10"],
    ["Sat May 30 · 10:30 am", "North York Lions Grade 10", "City Above Elite Grade 10"],
    ["Sat May 30 · 10:30 am", "Oakville Panthers Grade 10", "Polaris Prep Grade 10"],
    ["Sat May 30 · 12:00 pm", TEAM.name, "Royal Crown Grade 10"],
    ["Sun May 31 · 9:00 am", "West United Prep Grade 10", "North York Lions Grade 10"],
  ]
  return (
    <div className="px-10 py-8">
      <SeasonHeader status="Finalized" statusTone="hoop" lifecycle="Start Season" />
      <SeasonTabs active="Schedule" />
      <Panel
        title="Schedule"
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="subtle">
              Preview schedule
            </Button>
            <Advance confirm="Schedule committed: 150 games created">
              <Button size="sm">Commit schedule</Button>
            </Advance>
          </div>
        }
      >
        <div className="border-court-200 bg-court-50/40 rounded-xl border p-4">
          <p className="text-ink-900 text-sm font-bold">Preview: 150 game(s)</p>
          <p className="text-ink-500 mt-1 text-xs">Slots used: 150 / 180</p>
          <table className="mt-3 w-full">
            <thead className="border-ink-100 border-b">
              <tr>
                <Th>When</Th>
                <Th>Home</Th>
                <Th>Away</Th>
              </tr>
            </thead>
            <tbody className="divide-ink-50 divide-y">
              {games.map(([w, h, a]) => (
                <tr key={w + h}>
                  <Td>{w}</Td>
                  <Td>
                    <span className="font-semibold">{h}</span>
                  </Td>
                  <Td>{a}</Td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} className="text-ink-400 px-3 py-2.5 text-center text-xs">
                  + 144 more games across Weeks 1-5
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
