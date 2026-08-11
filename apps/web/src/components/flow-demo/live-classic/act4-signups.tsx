"use client"

/**
 * Act 4 — The club watches signups land, runs tryout-night check-in, then
 * selects everyone who made the cut and sends offers in one go. Mirrors
 * /clubs/[id]/tryouts/[id]/signups, /check-in and the bulk offer composer.
 */

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PanelHeader } from "@/components/ui/panel-header"
import { cn } from "@/components/ui/cn"
import { SIGNUPS, TEAM, TRYOUT, fmt } from "../data"
import { Td, Th } from "../scenes/shared"
import { LiveCheck } from "./anim"
import type { LiveScene } from "./engine"
import type { Step } from "./engine"

const COACH = "Coach David (Force)"

const Hold = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <span data-live-id={id} className="inline-block rounded-xl">
    {children}
  </span>
)

/* 15 — Signups roll in */
const signupRows: Step[] = SIGNUPS.slice(0, 6).flatMap((_, i) => [
  { set: { [`r${i}`]: true } } as Step,
  { wait: 260 } as Step,
])

const signupsTable: LiveScene = {
  id: "l-signups",
  act: "signups",
  persona: "club",
  personaLabel: COACH,
  frame: "desktop",
  url: "/clubs/burlington-force/tryouts/spring-g10/signups",
  caption: "Signups land here as parents register, with parent contact and payment status attached.",
  script: [{ wait: 400 }, ...signupRows, { set: { more: true } }, { wait: 600 }, { hold: "checkinBtn" }],
  render: (g) => (
    <div className="px-10 py-8">
      <p className="text-ink-500 mb-3 text-sm font-medium">&larr; Back to Tryouts</p>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-condensed text-ink-950 text-3xl font-bold uppercase tracking-wide">
            {TRYOUT.title} - Signups
          </h1>
          <p className="text-ink-500 mt-1 text-sm">
            {TRYOUT.dateShort} · {TRYOUT.location} · <Badge tone="play">{TEAM.name}</Badge>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="subtle">Send Offers (0)</Button>
          <Hold id="checkinBtn">
            <Button>Check-in (0/21)</Button>
          </Hold>
        </div>
      </div>
      <Card className="overflow-hidden p-0">
        <PanelHeader
          variant="band"
          title="Signups"
          action={<span className="text-ink-600 text-sm">{g("more") ? "21 signups" : "…"}</span>}
        />
        <table className="w-full">
          <thead className="border-ink-100 border-b">
            <tr>
              <Th>Player</Th>
              <Th>Parent</Th>
              <Th>Age / Gender</Th>
              <Th>Status</Th>
              <Th>Signed Up</Th>
            </tr>
          </thead>
          <tbody className="divide-ink-50 divide-y">
            {SIGNUPS.slice(0, 6).map(
              (s, i) =>
                !!g(`r${i}`) && (
                  <tr key={s.player} className="live-row-in">
                    <Td>
                      <span className="font-bold">{s.player}</span>
                    </Td>
                    <Td>
                      <span>{s.parent}</span>
                      <span className="text-ink-400 block text-xs">{s.email}</span>
                    </Td>
                    <Td>{s.age} / Male</Td>
                    <Td>
                      <Badge tone={i === 0 ? "court" : "gold"}>{i === 0 ? "confirmed" : "pending"}</Badge>
                    </Td>
                    <Td>Mar {22 + i}, 2026</Td>
                  </tr>
                )
            )}
            {!!g("more") && (
              <tr className="live-row-in">
                <td colSpan={5} className="text-ink-400 px-3 py-3 text-center text-xs">
                  + 15 more signups
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  ),
}

/* 16 — Tryout night: check-in */
const checkSteps: Step[] = [0, 1, 2, 3].flatMap((i) => [
  { press: `chk${i}` } as Step,
  { set: { [`in${i}`]: true } } as Step,
  { wait: 320 } as Step,
])

const checkIn: LiveScene = {
  id: "l-check-in",
  act: "signups",
  persona: "club",
  personaLabel: COACH,
  frame: "desktop",
  url: "/clubs/burlington-force/tryouts/spring-g10/check-in",
  caption: "Tryout night. One tap per player as they walk in; the count updates live for the whole staff.",
  script: [
    { wait: 400 },
    { zoom: "list", scale: 1.15 },
    ...checkSteps,
    { zoom: null },
    { wait: 400 },
    { hold: "backBtn" },
  ],
  render: (g) => {
    const done = [0, 1, 2, 3].filter((i) => g(`in${i}`)).length
    const count = 14 + done
    return (
      <div className="px-10 py-8">
        <p className="text-ink-500 mb-3 text-sm font-medium">
          <Hold id="backBtn">
            <span className="text-play-700 font-semibold">&larr; Back to Signups</span>
          </Hold>
        </p>
        <div className="mx-auto max-w-2xl">
          <h1 className="font-condensed text-ink-950 text-3xl font-bold uppercase tracking-wide">
            {TRYOUT.title} · Check-in
          </h1>
          <p className="text-ink-500 mb-4 mt-1 text-sm">
            {TRYOUT.dateShort} • {TRYOUT.location} • {TEAM.name}
          </p>
          <Card size="sm" className="mb-4">
            <p className="text-ink-950 text-3xl font-bold tabular-nums">{count} / 21</p>
            <p className="text-ink-500 text-sm">checked in</p>
            <div className="bg-ink-100 mt-3 h-2 overflow-hidden rounded-full">
              <div
                className="bg-court-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${(count / 21) * 100}%` }}
              />
            </div>
          </Card>
          <div className="space-y-2" data-live-id="list">
            {SIGNUPS.slice(0, 6).map((s, i) => {
              const isIn = i >= 4 || !!g(`in${i}`)
              return (
                <div
                  key={s.player}
                  data-live-id={`chk${i}`}
                  className="border-ink-100 flex items-center justify-between rounded-xl border bg-white px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    {isIn ? (
                      <span className="bg-court-500 live-pop flex h-6 w-6 items-center justify-center rounded-full text-white">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3.5 w-3.5">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    ) : (
                      <span className="border-ink-300 h-6 w-6 rounded-full border" />
                    )}
                    <div>
                      <p className="text-ink-900 text-sm font-bold">{s.player}</p>
                      <p className="text-ink-500 text-xs">
                        {s.age} • male • {s.parent}
                      </p>
                    </div>
                  </div>
                  <span className={cn("text-xs font-semibold", isIn ? "text-court-600" : "text-ink-400")}>
                    {isIn ? `6:${(11 + i).toString().padStart(2, "0")} PM` : "Tap to check in"}
                  </span>
                </div>
              )
            })}
            <p className="text-ink-400 pt-1 text-center text-xs">+ 15 more signed up</p>
          </div>
        </div>
      </div>
    )
  },
}

/* 17 — Select everyone, send the offers */
const RECIPIENTS = ["Jayden Thompson", "Marcus Chen", "Malik Osei", "Ethan Patel", "Owen Campbell", "Isaiah Grant"]
const tickSteps: Step[] = RECIPIENTS.flatMap((_, i) => [
  { set: { [`t${i}`]: true } } as Step,
  { wait: 150 } as Step,
])

const bulkOffer: LiveScene = {
  id: "l-bulk-offer",
  act: "signups",
  persona: "club",
  personaLabel: COACH,
  frame: "desktop",
  url: "/clubs/burlington-force/tryouts/spring-g10/signups",
  caption:
    "After the tryout: tick everyone who made the cut, attach the packages, one send. Each family picks their package when they accept.",
  script: [
    { wait: 500 },
    { zoom: "recipients", scale: 1.2 },
    { cursor: "recipients" },
    ...tickSteps,
    { set: { count: true } },
    { wait: 400 },
    { zoom: "packages", scale: 1.18 },
    { wait: 1100 },
    { zoom: null },
    { hold: "sendBtn" },
    { confirm: "18 offer(s) sent" },
  ],
  render: (g) => (
    <div className="bg-ink-900/40 px-10 py-8">
      <Card className="live-pop mx-auto max-w-3xl">
        <h3 className="text-ink-950 text-lg font-bold">Send Offers · {TEAM.name}</h3>
        <p className="text-ink-500 mt-0.5 text-sm">
          Compose the packages once; everyone you tick gets the same offer.
        </p>
        <div data-live-id="recipients" className="border-ink-100 mt-4 grid grid-cols-3 gap-x-4 gap-y-2 rounded-xl border p-4">
          {RECIPIENTS.map((p, i) => (
            <LiveCheck key={p} on={!!g(`t${i}`)} label={p} />
          ))}
          <p className="text-ink-400 col-span-3 text-xs">
            {g("count") ? `+ 12 more · 18 of ${TRYOUT.eligible} eligible selected` : "Tick the players who made the cut"}
          </p>
        </div>
        <div data-live-id="packages" className="mt-4 space-y-3">
          {[
            ["New Player", 3000, 750],
            ["Returning Player", 2700, 675],
          ].map(([name, fee, dep], i) => (
            <div key={String(name)} className="border-ink-200 rounded-xl border p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="bg-ink-100 text-ink-600 rounded-full px-2 py-0.5 text-[10px] font-bold">
                  Option {i + 1}
                </span>
                <span className="text-ink-900 text-sm font-bold">{name}</span>
                <span className="text-ink-500 ml-auto text-sm font-semibold">{fmt(fee as number)}</span>
              </div>
              <p className="text-ink-500 text-xs">
                4 installments · Includes Uniform · Pay in full or {fmt(dep as number)} deposit + 3 monthly
              </p>
            </div>
          ))}
        </div>
        <p className="text-ink-400 mt-3 text-xs">
          The family picks ONE of these when they accept. Sizes are only asked for what their
          chosen package includes.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="subtle">Cancel</Button>
          <Hold id="sendBtn">
            <Button>Send to 18 players</Button>
          </Hold>
        </div>
      </Card>
    </div>
  ),
}

export const ACT4: LiveScene[] = [signupsTable, checkIn, bulkOffer]
