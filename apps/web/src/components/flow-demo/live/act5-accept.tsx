"use client"

/**
 * Acts 5 and 6 — Maria accepts the offer (package, uniform size, jersey
 * numbers, payment plan), then the club watches acceptances land and
 * finalizes the team. Mirrors /offers (parent), /clubs/[id]/offers and
 * /clubs/[id]/teams/[teamId]/roster.
 */

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/components/ui/cn"
import { KID, OFFER, ROSTER, TEAM, fmt } from "../data"
import { Field, PhonePage, Td, Th } from "../scenes/shared"
import { LiveInput, LiveRadio, LiveSelect } from "./anim"
import type { LiveScene, Step } from "./engine"
import { pick, typeIn } from "./helpers"

const MARIA = "Maria (parent)"
const COACH = "Coach David (Force)"

const Hold = ({ id, children, block }: { id: string; children: React.ReactNode; block?: boolean }) => (
  <span data-live-id={id} className={cn("rounded-xl", block ? "block" : "inline-block")}>
    {children}
  </span>
)

/* 18 — The offer lands */
const offerLands: LiveScene = {
  id: "l-offer-lands",
  act: "accept",
  persona: "parent",
  personaLabel: MARIA,
  frame: "phone",
  caption: "The offer lands on Maria's phone with both packages, the coach's message and an expiry date.",
  script: [{ wait: 400 }, { set: { card: true } }, { wait: 1000 }, { hold: "acceptBtn" }],
  render: (g) => (
    <PhonePage>
      <Badge tone="play">Offers</Badge>
      <h1 className="text-ink-950 mt-2 text-xl font-bold">My Offers</h1>
      <p className="text-ink-600 mt-4 text-sm font-bold">Pending (1)</p>
      {!!g("card") && (
        <Card size="sm" className="live-row-in mt-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-ink-900 text-sm font-bold">{TEAM.name}</p>
              <p className="text-ink-500 text-xs">Burlington Force · for {KID.name}</p>
            </div>
            <div className="text-right">
              <p className="text-ink-900 text-sm font-bold">from {fmt(2700)}</p>
              <p className="text-ink-400 text-xs">2 package options</p>
            </div>
          </div>
          <div className="bg-ink-50 mt-3 rounded-xl p-3">
            <p className="text-ink-400 mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em]">
              Your package choices:
            </p>
            <p className="text-ink-700 text-xs">New Player — {fmt(3000)} · Uniform</p>
            <p className="text-ink-700 mt-1 text-xs">Returning Player — {fmt(2700)} · Uniform</p>
          </div>
          <p className="text-ink-600 mt-3 text-xs italic">&quot;{OFFER.message}&quot;</p>
          <p className="text-ink-400 mt-2 text-xs">
            Received {OFFER.received} · Expires {OFFER.expires}
          </p>
          <div className="mt-4 flex gap-2">
            <Hold id="acceptBtn" block>
              <Button block tone="court">
                Accept Offer
              </Button>
            </Hold>
            <Button variant="secondary" tone="hoop">
              Decline
            </Button>
          </div>
        </Card>
      )}
      <p className="text-ink-600 mt-5 text-sm font-bold">Past Offers (0)</p>
    </PhonePage>
  ),
}

/* 19 — Accept: package, size, numbers, plan, pay */
const SIZES = ["Youth Medium", "Youth Large", "Adult Small", "Adult Medium"]

const acceptOffer: LiveScene = {
  id: "l-accept",
  act: "accept",
  persona: "parent",
  personaLabel: MARIA,
  frame: "phone",
  caption:
    "Package, uniform size, jersey number preferences, payment plan. The deposit charges on accept; the rest auto-charges monthly.",
  script: [
    { wait: 400 },
    { press: "pkgNew" },
    { set: { pkg: true } },
    { wait: 450 },
    ...pick("sizeSel", "size", 1, "Youth Large"),
    ...typeIn("pref1", "p1", "#23", 8),
    ...typeIn("pref2", "p2", "#11", 8),
    ...typeIn("pref3", "p3", "#8", 8),
    { press: "planRadio" },
    { set: { plan: true } },
    { wait: 450 },
    { set: { due: true } },
    { wait: 600 },
    { hold: "payAccept" },
    { confirm: "✓ Payment received" },
  ],
  render: (g) => (
    <PhonePage>
      <Card size="sm">
        <p className="text-ink-900 text-sm font-bold">{TEAM.name}</p>
        <p className="text-ink-500 text-xs">Accepting for {KID.name}</p>
        <div className="mt-4 space-y-4">
          <Field label="Choose your package" required>
            <div className="space-y-2">
              <LiveRadio
                id="pkgNew"
                boxed
                on={!!g("pkg")}
                label={<span className="font-bold">New Player — {fmt(3000)}</span>}
                sub="Includes Uniform"
              />
              <LiveRadio boxed label={<span className="font-bold">Returning Player — {fmt(2700)}</span>} sub="Includes Uniform" />
            </div>
          </Field>
          <Field label="Uniform Size" required>
            <LiveSelect
              id="sizeSel"
              value={g("size") as string}
              placeholder="Select..."
              open={!!g("size:open")}
              options={SIZES}
              highlight={g("size:hi") as number}
            />
          </Field>
          <Field label="Jersey Number Preferences" required>
            <div className="grid grid-cols-3 gap-2">
              {(["p1", "p2", "p3"] as const).map((k, i) => (
                <div key={k}>
                  <LiveInput id={`pref${i + 1}`} value={g(k) as string} caret={!!g(`${k}:caret`)} placeholder="#" />
                  <p className="text-ink-400 mt-1 text-center text-[10px]">
                    {["1st Choice", "2nd Choice", "3rd Choice"][i]}
                  </p>
                </div>
              ))}
            </div>
          </Field>
          <div className="space-y-2">
            <LiveRadio label={<span>Pay in full — <strong>{fmt(3000)}</strong> now</span>} />
            <LiveRadio
              id="planRadio"
              on={!!g("plan")}
              label={
                <span>
                  Payment plan — <strong>{fmt(750)}</strong> deposit now, then{" "}
                  {OFFER.installmentDates.map((d) => `${fmt(750)} on ${d}`).join(", ")}
                </span>
              }
              sub="Auto-charged to your card on file."
            />
          </div>
          <LiveRadio on label={<span>visa •••• 4242 (default)</span>} />
          {!!g("due") && (
            <p className="text-ink-900 live-row-in text-sm">
              Due now: <strong>{fmt(750)}</strong>
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="subtle">Cancel</Button>
            <Hold id="payAccept" block>
              <Button block tone="court">
                Pay {fmt(750)} &amp; Accept
              </Button>
            </Hold>
          </div>
        </div>
      </Card>
    </PhonePage>
  ),
}

/* 20 — Acceptances land at the club */
const acceptRows = ["Jayden Thompson", "Marcus Chen", "Malik Osei"]
const landSteps: Step[] = acceptRows.flatMap((_, i) => [
  { set: { [`a${i}`]: true } } as Step,
  { wait: 380 } as Step,
])
const countSteps: Step[] = Array.from({ length: 12 }, (_, i) => [
  { set: { acc: i + 1 } } as Step,
  { wait: 90 } as Step,
]).flat()

const clubOffers: LiveScene = {
  id: "l-club-offers",
  act: "finalize",
  persona: "club",
  personaLabel: COACH,
  frame: "desktop",
  url: "/clubs/burlington-force/offers",
  caption: "Acceptances flow back with sizes and jersey preferences attached. No forms, no spreadsheets.",
  script: [
    { wait: 400 },
    ...landSteps,
    { zoom: "tiles", scale: 1.2 },
    ...countSteps,
    { wait: 400 },
    { zoom: null },
    { hold: "rosterBtn" },
  ],
  render: (g) => {
    const acc = (g("acc", 0) as number) ?? 0
    return (
      <div className="px-10 py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-condensed text-ink-950 text-3xl font-bold uppercase tracking-wide">Offers</h1>
            <p className="text-ink-500 mt-1 text-sm">Manage offers sent to players from tryouts</p>
          </div>
          <Button variant="subtle">Order Sheet</Button>
        </div>
        <div data-live-id="tiles" className="mb-5 grid grid-cols-4 gap-4">
          {[
            ["Pending", 18 - acc - 2, "text-gold-600"],
            ["Accepted", acc, "text-court-700"],
            ["Declined", acc > 6 ? 1 : 0, "text-hoop-600"],
            ["Expired", acc > 10 ? 1 : 0, "text-ink-700"],
          ].map(([label, n, cls]) => (
            <Card key={label as string} size="sm" className="text-center">
              <p className={cn("font-condensed text-3xl font-bold tabular-nums", cls as string)}>{n as number}</p>
              <p className="text-ink-500 text-sm font-medium">{label}</p>
            </Card>
          ))}
        </div>
        <Card className="overflow-hidden p-0">
          <div className="border-l-4 px-6 py-4" style={{ borderColor: "#16a34a" }}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-ink-950 text-base font-bold">{TEAM.name}</h3>
                <p className="text-ink-500 text-sm">18 offers · {acc} accepted</p>
              </div>
              <Hold id="rosterBtn">
                <Button size="sm">View Roster</Button>
              </Hold>
            </div>
          </div>
          <div className="divide-ink-50 divide-y">
            {acceptRows.map(
              (name, i) =>
                !!g(`a${i}`) && (
                  <div key={name} className="live-row-in flex items-center justify-between px-6 py-3">
                    <div>
                      <p className="text-ink-900 text-sm font-bold">{name}</p>
                      <p className="text-ink-400 text-xs">
                        {fmt(3000)} (4 installments) · Size:{" "}
                        {["Youth Large", "Youth Medium", "Adult Small"][i]} | Pref: #
                        {[`23, #11, #8`, `7, #10, #12`, `11, #21, #32`][i]}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="live-pop inline-block">
                        <Badge tone="court">accepted</Badge>
                      </span>
                      <span className="text-ink-400 text-xs">Apr 12</span>
                    </div>
                  </div>
                )
            )}
            {acc >= 12 && (
              <p className="text-ink-400 live-row-in px-6 py-3 text-center text-xs">+ 9 more accepted offers</p>
            )}
          </div>
        </Card>
      </div>
    )
  },
}

/* 21 — Finalize the team */
const jerseySteps: Step[] = ROSTER.slice(0, 8).flatMap((_, i) => [
  { set: { [`j${i}`]: true } } as Step,
  { wait: 200 } as Step,
])

const finalize: LiveScene = {
  id: "l-finalize",
  act: "finalize",
  persona: "club",
  personaLabel: COACH,
  frame: "desktop",
  url: "/clubs/burlington-force/teams/g10/roster",
  caption:
    "Everyone who accepted is on the roster. Finalizing assigns jersey numbers from their preferences and expires anything still pending.",
  script: [
    { wait: 500 },
    { hold: "finalizeBtn" },
    { set: { modal: true } },
    { wait: 600 },
    { hold: "confirmBtn" },
    { set: { modal: false, finalizing: true } },
    { wait: 400 },
    ...jerseySteps,
    { wait: 400 },
    { confirm: "Roster Finalized!" },
    { wait: 500 },
  ],
  render: (g) => (
    <div className="relative px-10 py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-condensed text-ink-950 text-3xl font-bold uppercase tracking-wide">
            {TEAM.name} - Roster
          </h1>
          <p className="text-ink-500 mt-1 text-sm">U16 Male - Summer 2026</p>
        </div>
        {!g("finalizing") && (
          <Hold id="finalizeBtn">
            <Button>Finalize Roster</Button>
          </Hold>
        )}
      </div>
      <Card className="overflow-hidden p-0">
        <table className="w-full">
          <thead className="border-ink-100 border-b">
            <tr>
              <Th>#</Th>
              <Th>Player</Th>
              <Th>Position</Th>
              <Th>Uniform</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody className="divide-ink-50 divide-y">
            {ROSTER.slice(0, 8).map((p, i) => (
              <tr key={p.name}>
                <Td>
                  {g(`j${i}`) ? (
                    <span className="bg-ink-900 live-pop inline-block rounded-md px-2 py-0.5 text-xs font-bold text-white">
                      {p.jersey}
                    </span>
                  ) : (
                    "-"
                  )}
                </Td>
                <Td>
                  <span className="text-play-700 font-bold">{p.name}</span>
                </Td>
                <Td>{p.pos}</Td>
                <Td>{["Youth Large", "Youth Medium", "Adult Small", "Adult Medium"][i % 4]}</Td>
                <Td>
                  {g(`j${i}`) ? (
                    <span className="live-pop inline-block">
                      <Badge tone="court">Finalized</Badge>
                    </span>
                  ) : (
                    <Badge tone="gold">Pending finalization</Badge>
                  )}
                </Td>
              </tr>
            ))}
            <tr>
              <td colSpan={5} className="text-ink-400 px-3 py-3 text-center text-xs">
                + 4 more players
              </td>
            </tr>
          </tbody>
        </table>
      </Card>
      {!!g("modal") && (
        <div className="absolute inset-0 z-20 flex items-start justify-center bg-ink-900/40 pt-24">
          <Card className="live-pop w-full max-w-md">
            <h3 className="text-ink-950 text-lg font-bold">Finalize {TEAM.name} Roster?</h3>
            <p className="text-ink-600 mt-2 text-sm">
              This will assign jersey numbers based on player preferences (first-come,
              first-served) and expire all remaining pending offers.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="subtle">Cancel</Button>
              <Hold id="confirmBtn">
                <Button>Confirm &amp; Finalize</Button>
              </Hold>
            </div>
          </Card>
        </div>
      )}
    </div>
  ),
}

export const ACT5: LiveScene[] = [offerLands, acceptOffer]
export const ACT6: LiveScene[] = [clubOffers, finalize]
