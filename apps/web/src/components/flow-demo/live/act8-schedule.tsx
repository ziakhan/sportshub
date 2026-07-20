"use client"

/**
 * Act 9 — Schedule out, referees booked, everyone told: the league commits
 * the schedule, broadcasts a day offer to its referee pool, Mike accepts and
 * gets the whole day, and every family and staff member gets the bell, the
 * email, and the games on their calendar. Mirrors the season Referees tab,
 * /referee/requests, /notifications and /calendar.
 */

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/components/ui/cn"
import { LEAGUE, REFS, TEAM } from "../data"
import { Field, Panel, PhonePage } from "../scenes/shared"
import { LiveInput, LiveSelect } from "./anim"
import type { LiveScene } from "./engine"
import { pick } from "./helpers"
import { LeagueHold as Hold, SeasonShell } from "./act6-league"
import { SCENE_COMMIT } from "./act7-register"

/* S2 — Broadcast a day offer to the referee pool */
const refOffer: LiveScene = {
  id: "l-ref-offer",
  act: "schedule",
  persona: "league",
  personaLabel: "League office",
  frame: "desktop",
  url: "/manage/leagues/nph-summer-league/seasons/summer-2026/manage",
  caption:
    "Referees are booked by the day, not per game. One offer covers the whole slate; broadcast it and the first taker gets it.",
  script: [
    { zoom: "bookPanel", scale: 1.18 },
    ...pick("daySel", "day", 0, "Week 1 · Sat, May 30"),
    ...pick("toSel", "to", 0, "📢 All league referees (first accept wins)"),
    { zoom: null },
    { hold: "sendBtn" },
    { confirm: "Offer broadcast to 4 referees. First to accept gets the day." },
  ],
  render: (g) => (
    <SeasonShell active="Referees" status="Finalized" statusTone="hoop">
      <div className="space-y-5">
        <div data-live-id="bookPanel">
          <Panel title="Book a referee for a session day">
            <p className="text-ink-500 mb-4 text-sm">
              Pick a day and shift, then target a referee you know, or broadcast to your whole
              pool and let the first taker have it. Accepting auto-assigns them to every game in
              the window.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Session day">
                <LiveSelect
                  id="daySel"
                  value={g("day") as string}
                  placeholder="Choose day…"
                  open={!!g("day:open")}
                  options={["Week 1 · Sat, May 30", "Week 1 · Sun, May 31", "Week 2 · Sat, Jun 6"]}
                  highlight={g("day:hi") as number}
                />
              </Field>
              <Field label="Shift">
                <div className="flex items-center gap-2">
                  <LiveInput value="09:00" />
                  <LiveInput value="18:00" />
                </div>
              </Field>
            </div>
            <div className="mt-4 grid grid-cols-[1fr_1fr_auto] items-end gap-3">
              <Field label="Send to">
                <LiveSelect
                  id="toSel"
                  value={g("to") as string}
                  placeholder="Choose…"
                  open={!!g("to:open")}
                  options={["📢 All league referees (first accept wins)", "Mike Ferreira", "Sarah Whitlock"]}
                  highlight={g("to:hi") as number}
                />
              </Field>
              <LiveInput placeholder="Message (optional)" />
              <Hold id="sendBtn">
                <Button>Send offer</Button>
              </Hold>
            </div>
          </Panel>
        </div>
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
                <Badge tone={i === 3 ? "neutral" : "court"}>{i === 3 ? "no availability set" : "available"}</Badge>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </SeasonShell>
  ),
}

/* S3 — Mike the referee logs in and takes the day */
const refAccept: LiveScene = {
  id: "l-ref-accept",
  act: "schedule",
  persona: "referee",
  personaLabel: "Mike (referee)",
  frame: "desktop",
  url: "/referee/requests",
  caption:
    "Mike Ferreira logs in to his shift inbox. First accept wins the whole day, and accepting assigns him every game in the window.",
  script: [
    { wait: 500 },
    { set: { offer: true } },
    { wait: 900 },
    { hold: "acceptBtn" },
    { set: { accepted: true } },
    { wait: 400 },
    { confirm: "You're booked. Assigned to 6 games that day." },
  ],
  render: (g) => (
    <div className="px-10 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h1 className="font-condensed text-ink-950 text-3xl font-bold uppercase tracking-wide">
              Shifts &amp; availability
            </h1>
            <p className="text-ink-500 mt-1 text-sm">
              Leagues book you by the day. Keep your availability current and answer offers here.
            </p>
          </div>
          <span className="text-play-700 text-sm font-semibold">My profile &rarr;</span>
        </div>
        <Card>
          <p className="text-ink-900 mb-3 text-sm font-bold">{g("accepted") ? "Offers" : "Offers (1)"}</p>
          {!g("accepted") && !!g("offer") && (
            <div className="border-ink-100 live-row-in flex items-center justify-between rounded-xl border p-4">
              <div>
                <p className="text-ink-900 text-sm font-bold">
                  {LEAGUE.name} · Sat, May 30 · 09:00-18:00
                </p>
                <p className="text-ink-500 text-xs">{LEAGUE.season} · Week 1</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-hoop-100 text-hoop-700 rounded-full px-2 py-0.5 text-[10px] font-bold">
                  first accept wins
                </span>
                <Hold id="acceptBtn">
                  <Button size="sm" tone="court">
                    Accept
                  </Button>
                </Hold>
                <Button size="sm" variant="subtle">
                  Decline
                </Button>
              </div>
            </div>
          )}
          {!!g("accepted") && (
            <p className="text-ink-400 live-row-in text-sm">No open offers right now.</p>
          )}
          <p className="text-ink-400 mt-5 text-xs font-bold uppercase tracking-[0.14em]">Your booked shifts</p>
          {g("accepted") ? (
            <div className="live-row-in mt-2 flex items-center gap-2">
              <span className="bg-court-100 text-court-700 live-pop rounded-full px-2 py-0.5 text-[10px] font-bold">
                booked
              </span>
              <span className="text-ink-800 text-sm font-semibold">
                {LEAGUE.name} · Sat, May 30 · 09:00-18:00
              </span>
            </div>
          ) : (
            <p className="text-ink-400 mt-2 text-sm">No upcoming availability declared.</p>
          )}
        </Card>
      </div>
    </div>
  ),
}

/* N1 — The bell: schedule published, everyone in the team circle gets it */
const notifBell: LiveScene = {
  id: "l-notify",
  act: "schedule",
  persona: "parent",
  personaLabel: "Maria (parent)",
  frame: "phone",
  caption:
    "The commit fans out: head coach, assistant, team manager, every parent and player gets the bell and the email. Maria taps hers.",
  script: [
    { wait: 500 },
    { set: { row: true } },
    { wait: 1100 },
    { hold: "notifRow" },
  ],
  render: (g) => (
    <PhonePage>
      <Badge tone="play">Inbox</Badge>
      <h1 className="text-ink-950 mt-2 text-xl font-bold">Notifications (1 unread)</h1>
      <div className="mt-3 flex gap-2">
        <span className="text-play-700 text-xs font-semibold">Mark all as read</span>
      </div>
      {!!g("row") && (
        <div data-live-id="notifRow" className="live-row-in bg-play-50/40 border-play-100 mt-3 rounded-xl border p-3.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-ink-950 text-sm font-bold">Game schedule published</p>
            <span className="bg-play-600 mt-1 h-2 w-2 shrink-0 rounded-full" />
          </div>
          <p className="text-ink-600 mt-1 text-xs">
            {TEAM.name}: 10 games scheduled in {LEAGUE.name} {LEAGUE.season}. See them on your
            team calendar.
          </p>
          <p className="text-ink-400 mt-1.5 text-[11px]">May 16, 9:02 AM</p>
        </div>
      )}
      <div className="border-ink-100 mt-3 rounded-xl border bg-white p-3.5">
        <p className="text-ink-900 text-sm font-semibold">Final Score</p>
        <p className="text-ink-500 mt-1 text-xs">Final: Toronto Lords Grade 9 55-51 Royal Crown Grade 9</p>
        <p className="text-ink-400 mt-1.5 text-[11px]">May 3, 4:41 PM</p>
      </div>
    </PhonePage>
  ),
}

/* N2 — The games land on the calendar, straight to the phone */
const calendarScene: LiveScene = {
  id: "l-calendar",
  act: "schedule",
  persona: "parent",
  personaLabel: "Maria (parent)",
  frame: "phone",
  caption:
    "Every game lands on the calendar with RSVP built in; one tap subscribes the phone. Changes update themselves.",
  script: [
    { wait: 600 },
    { press: "goingBtn" },
    { set: { going: true } },
    { wait: 600 },
    { press: "addPhone" },
    { set: { panel: true } },
    { wait: 900 },
    { hold: "appleBtn" },
  ],
  render: (g) => (
    <PhonePage>
      <h1 className="text-ink-950 text-xl font-bold">My Calendar</h1>
      <p className="text-ink-500 mt-1 text-sm">
        Every game, practice and event across all your teams. Answer Going or Can&apos;t go right
        here.
      </p>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-1.5">
          <span className="bg-ink-900 rounded-full px-3 py-1 text-xs font-semibold text-white">Agenda</span>
        </div>
        <span data-live-id="addPhone" className="border-ink-200 text-ink-700 inline-block rounded-full border bg-white px-3 py-1 text-xs font-semibold">
          📅 Add to phone
        </span>
      </div>
      {!!g("panel") && (
        <Card size="sm" className="live-pop mt-3">
          <p className="text-ink-900 text-sm font-bold">Opening Apple Calendar…</p>
          <p className="text-ink-500 mt-1 text-xs">
            Confirm the subscription there and every practice, game and event stays in sync.
            Didn&apos;t open? Use the buttons below.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Hold id="appleBtn">
              <Button size="sm">iPhone / Apple Calendar</Button>
            </Hold>
            <Button size="sm" variant="subtle">
              Google Calendar (Android)
            </Button>
            <Button size="sm" variant="subtle">
              Copy feed URL
            </Button>
          </div>
        </Card>
      )}
      <p className="text-ink-400 mt-4 text-[11px] font-bold uppercase tracking-[0.14em]">May 2026</p>
      <Card size="sm" className="mt-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-ink-900 text-sm font-bold">vs North Toronto Huskies Grade 10</p>
            <p className="text-ink-500 text-xs">Sat May 30 · 9:00-10:30 AM · Pan Am Sports Centre</p>
          </div>
          <span className="text-ink-400 text-[10px] font-bold">GAME</span>
        </div>
        <div className="mt-2.5 flex gap-1.5">
          <span
            data-live-id="goingBtn"
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              g("going") ? "bg-court-600 text-white" : "border-ink-200 text-ink-600 border bg-white"
            )}
          >
            ✓ Going
          </span>
          <span className="border-ink-200 text-ink-600 rounded-full border bg-white px-3 py-1 text-xs font-semibold">
            ? Maybe
          </span>
          <span className="border-ink-200 text-ink-600 rounded-full border bg-white px-3 py-1 text-xs font-semibold">
            ✕ Can&apos;t go
          </span>
        </div>
        <p className="text-ink-400 mt-2 text-[11px]">Jayden Thompson</p>
      </Card>
      <Card size="sm" className="mt-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-ink-900 text-sm font-bold">vs Royal Crown Grade 10</p>
            <p className="text-ink-500 text-xs">Sat May 30 · 12:00-1:30 PM · Pan Am Sports Centre</p>
          </div>
          <span className="text-ink-400 text-[10px] font-bold">GAME</span>
        </div>
      </Card>
      <Card size="sm" className="mt-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-ink-900 text-sm font-bold">Practice</p>
            <p className="text-ink-500 text-xs">Tue Jun 2 · 6:30-8:00 PM · Haber Recreation Centre</p>
          </div>
          <span className="text-ink-400 text-[10px] font-bold">PRACTICE</span>
        </div>
      </Card>
    </PhonePage>
  ),
}

/* S4 — Life happens: the league moves one game and cancels another */
const gameChanges: LiveScene = {
  id: "l-game-changes",
  act: "schedule",
  persona: "league",
  personaLabel: "League office",
  frame: "desktop",
  url: "/manage/leagues/nph-summer-league/seasons/summer-2026/manage",
  caption:
    "Mid-season reality: a gym conflict. The league moves one game, cancels another; everyone affected hears instantly.",
  script: [
    { wait: 500 },
    { press: "findAlt" },
    { set: { alts: true } },
    { wait: 1000 },
    { press: "moveHere" },
    { set: { moved: true, alts: false } },
    { wait: 400 },
    { confirm: "Game Rescheduled" },
    { wait: 500 },
    { hold: "cancelBtn" },
    { set: { cancelled: true } },
    { wait: 400 },
    { confirm: "Game Cancelled" },
    { wait: 300 },
  ],
  render: (g) => (
    <SeasonShell active="Schedule" status="In Progress" statusTone="play">
      <Panel title="Committed games" action={<Badge tone="neutral">150 games</Badge>}>
        <div className="divide-ink-50 divide-y">
          <div className="py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-ink-900 text-sm font-bold">
                  {TEAM.name} vs West United Prep Grade 10
                </p>
                <p className="text-ink-500 text-xs">
                  {g("moved") ? (
                    <span className="live-row-in font-semibold text-court-700">
                      Sun Jun 7 · 12:00 pm · Haber Recreation Centre (Court 2)
                    </span>
                  ) : (
                    "Sat Jun 6 · 10:30 am · Pan Am Sports Centre (Court 1)"
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="play">SCHEDULED</Badge>
                <span data-live-id="findAlt" className="text-play-700 text-xs font-semibold">
                  {g("alts") ? "Hide alternates" : "Find alternates"}
                </span>
              </div>
            </div>
            {!!g("alts") && (
              <div className="border-ink-100 live-row-in mt-3 rounded-xl border p-3.5">
                <p className="text-ink-700 mb-2 text-xs font-bold">Suggested alternate slots</p>
                <div className="divide-ink-50 divide-y">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-ink-800 text-sm">
                      Sat Jun 6 · 4:30 pm · Humber Athletic Centre (Court 1){" "}
                      <span className="bg-court-50 text-court-700 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                        same day
                      </span>
                    </span>
                    <Button size="sm" variant="subtle">
                      Move here
                    </Button>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-ink-800 text-sm">
                      Sun Jun 7 · 12:00 pm · Haber Recreation Centre (Court 2)
                    </span>
                    <span data-live-id="moveHere" className="inline-block rounded-xl">
                      <Button size="sm">Move here</Button>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className={cn("text-ink-900 text-sm font-bold", !!g("cancelled") && "text-ink-400 line-through")}>
                {TEAM.name} vs Polaris Prep Grade 10
              </p>
              <p className={cn("text-ink-500 text-xs", !!g("cancelled") && "line-through")}>
                Sat Jun 13 · 9:00 am · Paramount Fine Foods Centre (Court 1)
              </p>
            </div>
            <div className="flex items-center gap-2">
              {g("cancelled") ? (
                <span className="live-pop inline-block">
                  <Badge tone="danger">CANCELLED</Badge>
                </span>
              ) : (
                <Badge tone="play">SCHEDULED</Badge>
              )}
              {!g("cancelled") && (
                <Hold id="cancelBtn">
                  <span className="text-hoop-600 text-xs font-semibold">Cancel game</span>
                </Hold>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-ink-900 text-sm font-bold">Royal Crown Grade 10 vs North York Lions Grade 10</p>
              <p className="text-ink-500 text-xs">Sat Jun 6 · 12:00 pm · Pan Am Sports Centre (Court 2)</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="play">SCHEDULED</Badge>
              <span className="text-play-700 text-xs font-semibold">Find alternates</span>
            </div>
          </div>
          <p className="text-ink-400 py-2.5 text-center text-xs">+ 147 more games</p>
        </div>
      </Panel>
    </SeasonShell>
  ),
}

/* S5 — The family hears about both, instantly */
const changeAlerts: LiveScene = {
  id: "l-change-alerts",
  act: "schedule",
  persona: "parent",
  personaLabel: "Maria (parent)",
  frame: "phone",
  caption:
    "Both changes land on every family's phone the moment they happen, with the new time or the cancellation spelled out.",
  script: [
    { wait: 500 },
    { set: { r1: true } },
    { wait: 900 },
    { set: { r2: true } },
    { wait: 1100 },
    { hold: "notifRow" },
  ],
  render: (g) => (
    <PhonePage>
      <Badge tone="play">Inbox</Badge>
      <h1 className="text-ink-950 mt-2 text-xl font-bold">Notifications (2 unread)</h1>
      <div className="mt-3 flex gap-2">
        <span className="text-play-700 text-xs font-semibold">Mark all as read</span>
      </div>
      {!!g("r2") && (
        <div className="live-row-in bg-hoop-50/40 border-hoop-100 mt-3 rounded-xl border p-3.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-ink-950 text-sm font-bold">Game Cancelled</p>
            <span className="bg-hoop-500 mt-1 h-2 w-2 shrink-0 rounded-full" />
          </div>
          <p className="text-ink-600 mt-1 text-xs">
            {TEAM.name} vs Polaris Prep Grade 10 on Sat, Jun 13, 9:00 AM has been cancelled by the
            league.
          </p>
          <p className="text-ink-400 mt-1.5 text-[11px]">Jun 4, 5:18 PM</p>
        </div>
      )}
      {!!g("r1") && (
        <div data-live-id="notifRow" className="live-row-in bg-play-50/40 border-play-100 mt-3 rounded-xl border p-3.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-ink-950 text-sm font-bold">Game Rescheduled</p>
            <span className="bg-play-600 mt-1 h-2 w-2 shrink-0 rounded-full" />
          </div>
          <p className="text-ink-600 mt-1 text-xs">
            {TEAM.name} vs West United Prep Grade 10 has moved to Sun, Jun 7, 12:00 PM at Haber
            Recreation Centre (Court 2).
          </p>
          <p className="text-ink-400 mt-1.5 text-[11px]">Jun 4, 5:12 PM</p>
        </div>
      )}
      <div className="border-ink-100 mt-3 rounded-xl border bg-white p-3.5">
        <p className="text-ink-900 text-sm font-semibold">Game schedule published</p>
        <p className="text-ink-500 mt-1 text-xs">
          {TEAM.name}: 10 games scheduled in {LEAGUE.name} {LEAGUE.season}.
        </p>
        <p className="text-ink-400 mt-1.5 text-[11px]">May 16, 9:02 AM</p>
      </div>
    </PhonePage>
  ),
}

/* S6 — The calendar tells the truth: new time in, cancelled game struck out */
const calendarChanges: LiveScene = {
  id: "l-calendar-changes",
  act: "schedule",
  persona: "parent",
  personaLabel: "Maria (parent)",
  frame: "phone",
  caption:
    "The calendar keeps it straight: the moved game at its new time, the cancelled one struck out. Nobody drives to a dead gym.",
  script: [
    { wait: 700 },
    { set: { struck: true } },
    { wait: 900 },
    { press: "goingBtn" },
    { set: { going: true } },
    { wait: 500 },
    { hold: "movedCard" },
  ],
  render: (g) => (
    <PhonePage>
      <h1 className="text-ink-950 text-xl font-bold">My Calendar</h1>
      <p className="text-ink-400 mt-3 text-[11px] font-bold uppercase tracking-[0.14em]">June 2026</p>
      <Hold id="movedCard" block>
        <Card size="sm" className="mt-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-ink-900 text-sm font-bold">vs West United Prep Grade 10</p>
              <p className="text-court-700 text-xs font-semibold">
                Sun Jun 7 · 12:00-1:30 PM · Haber Recreation Centre (Court 2)
              </p>
            </div>
            <span className="text-ink-400 text-[10px] font-bold">GAME</span>
          </div>
          <div className="mt-2.5 flex gap-1.5">
            <span
              data-live-id="goingBtn"
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                g("going") ? "bg-court-600 text-white" : "border-ink-200 text-ink-600 border bg-white"
              )}
            >
              ✓ Going
            </span>
            <span className="border-ink-200 text-ink-600 rounded-full border bg-white px-3 py-1 text-xs font-semibold">
              ? Maybe
            </span>
            <span className="border-ink-200 text-ink-600 rounded-full border bg-white px-3 py-1 text-xs font-semibold">
              ✕ Can&apos;t go
            </span>
          </div>
          <p className="text-ink-400 mt-2 text-[11px]">Jayden Thompson</p>
        </Card>
      </Hold>
      <Card size="sm" className={cn("mt-2", !!g("struck") && "opacity-70")}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className={cn("text-ink-900 text-sm font-bold", !!g("struck") && "text-ink-400 line-through")}>
              vs Polaris Prep Grade 10
            </p>
            <p className={cn("text-ink-500 text-xs", !!g("struck") && "line-through")}>
              Sat Jun 13 · 9:00-10:30 AM · Paramount Fine Foods Centre
            </p>
          </div>
          {g("struck") ? (
            <span className="live-pop inline-block">
              <span className="border-hoop-300 text-hoop-600 rounded-full border px-2 py-0.5 text-[10px] font-bold">
                Cancelled
              </span>
            </span>
          ) : (
            <span className="text-ink-400 text-[10px] font-bold">GAME</span>
          )}
        </div>
      </Card>
      <Card size="sm" className="mt-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-ink-900 text-sm font-bold">vs North Toronto Huskies Grade 10</p>
            <p className="text-ink-500 text-xs">Sat Jun 20 · 2:00-3:30 PM · Haber Recreation Centre</p>
          </div>
          <span className="text-ink-400 text-[10px] font-bold">GAME</span>
        </div>
      </Card>
    </PhonePage>
  ),
}

export const ACT_SCHEDULE: LiveScene[] = [
  SCENE_COMMIT,
  refOffer,
  refAccept,
  notifBell,
  calendarScene,
  gameChanges,
  changeAlerts,
  calendarChanges,
]
