"use client"

/**
 * Chapter 3 (part 2) — Offers: templates, the bulk send, the family's accept
 * flow with sizes/jersey prefs/payment plan, tracking, and roster finalize.
 * Mirrors /clubs/[id]/offer-templates, the offer composer, /offers (parent),
 * /clubs/[id]/offers and /clubs/[id]/teams/[teamId]/roster.
 */

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PanelHeader } from "@/components/ui/panel-header"
import { cn } from "@/components/ui/cn"
import { Advance } from "../advance"
import { KID, OFFER, ROSTER, TEAM, TRYOUT, fmt } from "../data"
import { AreaBox, CheckRow, Field, OperatorPage, PhonePage, RadioRow, SelectBox, Td, Th, TxtInput } from "./shared"

/* Step 17 — Offer templates */
export function SceneOfferTemplates() {
  return (
    <OperatorPage
      title="Offer Templates"
      subtitle="Create reusable templates for sending offers to players. All teams in the club share these templates."
    >
      <div className="grid grid-cols-[1.2fr_1fr] gap-5">
        <Panel>
          <PanelHeader title="New offer template" />
          <div className="space-y-4">
            <Field label="Template Name" required>
              <TxtInput value="New Player" placeholder="e.g. Competitive Package, Development Package" />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Season Fee ($)">
                <TxtInput value="3000" />
              </Field>
              <Field label="Installments">
                <SelectBox value="4 installments" />
              </Field>
              <Field label="Practice Sessions">
                <TxtInput value="0" />
              </Field>
            </div>
            <Field label="Included Items">
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Uniform", "Shirt + Shorts", true],
                  ["Tracksuit", "Jacket + Pants", false],
                  ["Shoes", "Basketball shoes", false],
                  ["Basketball", "Game ball", false],
                  ["Bag", "Equipment bag", false],
                ].map(([label, desc, on]) => (
                  <div
                    key={label as string}
                    className={cn(
                      "rounded-xl border p-3",
                      on ? "border-play-300 bg-play-50/50" : "border-ink-200"
                    )}
                  >
                    <CheckRow checked={!!on} label={<span className="font-semibold">{label}</span>} sub={desc} />
                  </div>
                ))}
              </div>
            </Field>
            <div className="flex gap-3">
              <Button variant="subtle">Cancel</Button>
              <Advance block className="flex-1">
                <Button block>Create Template</Button>
              </Advance>
            </div>
          </div>
        </Panel>
        <Card>
          <div className="flex items-start justify-between">
            <h4 className="text-ink-900 text-base font-bold">Returning Player</h4>
            <div className="flex gap-2 text-xs font-semibold">
              <span className="text-play-700">Edit</span>
              <span className="text-hoop-600">Archive</span>
            </div>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-500">Season Fee</span>
              <span className="text-ink-900 font-semibold">{fmt(2700)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500">Payment</span>
              <span className="text-ink-900 font-semibold">4 installments</span>
            </div>
          </div>
          <div className="border-ink-100 mt-4 border-t pt-3">
            <p className="text-ink-400 mb-2 text-[10px] font-bold uppercase tracking-[0.12em]">Includes</p>
            <Badge tone="neutral">Uniform</Badge>
          </div>
        </Card>
      </div>
    </OperatorPage>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return <Card>{children}</Card>
}

function PackageCard({
  n,
  name,
  fee,
  deposit,
  monthly,
}: {
  n: number
  name: string
  fee: number
  deposit: number
  monthly: number
}) {
  return (
    <div className="border-ink-200 rounded-xl border p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="bg-ink-100 text-ink-600 rounded-full px-2 py-0.5 text-[10px] font-bold">
          Option {n}
        </span>
        <span className="text-ink-900 text-sm font-bold">{name}</span>
        {n > 1 && <span className="text-ink-400 ml-auto">×</span>}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Fee $">
          <TxtInput value={String(fee)} />
        </Field>
        <Field label="Installments">
          <TxtInput value="4" />
        </Field>
        <Field label="Practices">
          <TxtInput value="0" />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {["Uniform", "Tracksuit", "Shoes", "Basketball", "Bag"].map((i) => (
          <CheckRow key={i} checked={i === "Uniform"} label={i} />
        ))}
      </div>
      <div className="border-ink-100 mt-3 border-t pt-3">
        <div className="flex flex-wrap gap-4">
          <CheckRow checked label="Pay in full" />
          <CheckRow checked label="Payment plan (deposit + installments)" />
        </div>
        <div className="mt-2 grid grid-cols-4 items-end gap-2">
          <Field label="Deposit (due on accept) $">
            <TxtInput value={String(deposit)} />
          </Field>
          {OFFER.installmentDates.map((d, i) => (
            <div key={d} className="flex items-center gap-1.5">
              <span className="text-ink-400 text-xs">#{i + 1}</span>
              <TxtInput value={`${monthly} · ${d}`} />
            </div>
          ))}
        </div>
        <p className="text-court-700 mt-2 text-xs font-semibold">
          Deposit ${deposit} + installments ${monthly * 3} = ${fee} ✓
        </p>
      </div>
    </div>
  )
}

/* Step 18 — Send offers (bulk) */
export function SceneBulkOffer() {
  return (
    <div className="bg-ink-900/40 px-10 py-8">
      <Card className="mx-auto max-w-3xl">
        <h3 className="text-ink-950 text-lg font-bold">Send Offers — {TEAM.name}</h3>
        <p className="text-ink-500 mt-0.5 text-sm">
          Compose the packages once; everyone you tick gets the same offer.
        </p>
        <div className="border-ink-100 mt-4 grid grid-cols-3 gap-x-4 gap-y-2 rounded-xl border p-4">
          {["Jayden Thompson", "Marcus Chen", "Malik Osei", "Ethan Patel", "Owen Campbell", "Isaiah Grant"].map((p) => (
            <CheckRow key={p} checked label={p} />
          ))}
          <p className="text-ink-400 col-span-3 text-xs">
            + 12 more · 18 of {TRYOUT.eligible} eligible selected
          </p>
        </div>
        <div className="mt-4 space-y-3">
          <PackageCard n={1} name="New Player" fee={3000} deposit={750} monthly={750} />
          <PackageCard n={2} name="Returning Player" fee={2700} deposit={675} monthly={675} />
        </div>
        <p className="text-ink-400 mt-3 text-xs">
          The family picks ONE of these when they accept — sizes are only asked for what their
          chosen package includes.
        </p>
        <div className="mt-4 grid grid-cols-[2fr_1fr] gap-3">
          <TxtInput value="Congrats! We would love to have you on the Force this summer." placeholder="Congrats — we'd love to have you!" />
          <SelectBox value="7 days" />
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="subtle">Cancel</Button>
          <Advance confirm="18 offers sent">
            <Button>Send to 18 players</Button>
          </Advance>
        </div>
      </Card>
    </div>
  )
}

/* Step 19a — The family's pending offer (phone) */
export function SceneParentOffer() {
  return (
    <PhonePage>
      <Badge tone="play">Offers</Badge>
      <h1 className="text-ink-950 mt-2 text-xl font-bold">My Offers</h1>
      <p className="text-ink-600 mt-4 text-sm font-bold">Pending (1)</p>
      <Card size="sm" className="mt-2">
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
          <Advance block className="flex-1">
            <Button block tone="court">
              Accept Offer
            </Button>
          </Advance>
          <Button variant="secondary" tone="hoop">
            Decline
          </Button>
        </div>
      </Card>
      <p className="text-ink-600 mt-5 text-sm font-bold">Past Offers (0)</p>
    </PhonePage>
  )
}

/* Step 19b — Accepting: package, sizes, jersey prefs, payment plan (phone) */
export function SceneAcceptOffer() {
  return (
    <PhonePage>
      <Card size="sm">
        <p className="text-ink-900 text-sm font-bold">{TEAM.name}</p>
        <p className="text-ink-500 text-xs">Accepting for {KID.name}</p>
        <div className="mt-4 space-y-4">
          <Field label="Choose your package" required>
            <div className="space-y-2">
              <div className="border-play-300 bg-play-50/50 rounded-xl border p-3">
                <RadioRow checked label={<span className="font-bold">New Player — {fmt(3000)}</span>} sub="Includes Uniform" />
              </div>
              <div className="border-ink-200 rounded-xl border p-3">
                <RadioRow label={<span className="font-bold">Returning Player — {fmt(2700)}</span>} sub="Includes Uniform" />
              </div>
            </div>
          </Field>
          <Field label="Uniform Size" required>
            <SelectBox value="Youth Large" placeholder="Select..." />
          </Field>
          <Field label="Jersey Number Preferences" required>
            <div className="grid grid-cols-3 gap-2">
              {KID.prefs.map((p, i) => (
                <div key={p}>
                  <TxtInput value={`#${p}`} />
                  <p className="text-ink-400 mt-1 text-center text-[10px]">
                    {["1st Choice", "2nd Choice", "3rd Choice"][i]}
                  </p>
                </div>
              ))}
            </div>
          </Field>
          <div className="space-y-2">
            <RadioRow label={<span>Pay in full — <strong>{fmt(3000)}</strong> now</span>} />
            <RadioRow
              checked
              label={
                <span>
                  Payment plan — <strong>{fmt(750)}</strong> deposit now, then{" "}
                  {OFFER.installmentDates.map((d) => `${fmt(750)} on ${d}`).join(", ")}
                </span>
              }
              sub="Auto-charged to your card on file."
            />
          </div>
          <div className="space-y-1.5">
            <RadioRow checked label={<span>visa •••• 4242 (default)</span>} />
            <p className="text-play-700 text-xs font-semibold">Use a different card</p>
          </div>
          <p className="text-ink-900 text-sm">
            Due now: <strong>{fmt(750)}</strong>
          </p>
          <div className="flex gap-2">
            <Button variant="subtle">Cancel</Button>
            <Advance block className="flex-1" confirm="✓ Payment received">
              <Button block tone="court">
                Pay {fmt(750)} &amp; Accept
              </Button>
            </Advance>
          </div>
        </div>
      </Card>
    </PhonePage>
  )
}

/* Step 20 — It submits back to the club */
export function SceneClubOffers() {
  const rows = [
    { name: "Jayden Thompson", status: "accepted", extra: `Size: Youth Large | Pref: #23, #11, #8` },
    { name: "Marcus Chen", status: "accepted", extra: "Size: Youth Medium | Pref: #7, #10, #12" },
    { name: "Malik Osei", status: "accepted", extra: "Size: Adult Small | Pref: #11, #21, #32" },
    { name: "Isaiah Grant", status: "pending", extra: null },
    { name: "Kai Nguyen", status: "declined", extra: null },
  ]
  return (
    <OperatorPage
      title="Offers"
      subtitle="Manage offers sent to players from tryouts"
      actions={<Button variant="subtle">Order Sheet</Button>}
    >
      <div className="mb-5 grid grid-cols-4 gap-4">
        {[
          ["Pending", 4, "gold"],
          ["Accepted", 12, "court"],
          ["Declined", 1, "hoop"],
          ["Expired", 1, "ink"],
        ].map(([label, n, tone]) => (
          <Card key={label as string} size="sm" className="text-center">
            <p
              className={cn(
                "font-condensed text-3xl font-bold",
                tone === "gold" && "text-gold-600",
                tone === "court" && "text-court-700",
                tone === "hoop" && "text-hoop-600",
                tone === "ink" && "text-ink-700"
              )}
            >
              {n}
            </p>
            <p className="text-ink-500 text-sm font-medium">{label}</p>
          </Card>
        ))}
      </div>
      <Card className="overflow-hidden p-0">
        <div className="border-l-4 px-6 py-4" style={{ borderColor: "#16a34a" }}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-ink-950 text-base font-bold">{TEAM.name}</h3>
              <p className="text-ink-500 text-sm">18 offers · 12 accepted</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="subtle">
                Team Dashboard
              </Button>
              <Advance>
                <Button size="sm">View Roster</Button>
              </Advance>
            </div>
          </div>
        </div>
        <div className="divide-ink-50 divide-y">
          {rows.map((r) => (
            <div key={r.name} className="flex items-center justify-between px-6 py-3">
              <div>
                <p className="text-ink-900 text-sm font-bold">{r.name}</p>
                <p className="text-ink-400 text-xs">
                  {fmt(3000)} (4 installments)
                  {r.extra && <span> · {r.extra}</span>}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={r.status === "accepted" ? "court" : r.status === "pending" ? "gold" : "hoop"}>
                  {r.status}
                </Badge>
                {r.status === "pending" && (
                  <span className="text-hoop-600 text-xs font-semibold">Rescind</span>
                )}
                <span className="text-ink-400 text-xs">Apr 10</span>
              </div>
            </div>
          ))}
          <p className="text-ink-400 px-6 py-3 text-center text-xs">+ 13 more offers</p>
        </div>
      </Card>
    </OperatorPage>
  )
}

/* Step 21 — Finalizing the roster */
export function SceneRoster({ finalized }: { finalized?: boolean }) {
  return (
    <div className="px-10 py-8">
      <p className="text-ink-500 mb-3 text-sm font-medium">
        {finalized ? (
          <Advance>
            <span className="text-play-700 font-semibold">&larr; Back to Team Dashboard</span>
          </Advance>
        ) : (
          <>&larr; Back to Team Dashboard</>
        )}
      </p>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-condensed text-ink-950 text-3xl font-bold uppercase tracking-wide">
            {TEAM.name} - Roster
          </h1>
          <p className="text-ink-500 mt-1 text-sm">U16 Male - Summer 2026</p>
        </div>
        {!finalized && (
          <Advance>
            <Button>Finalize Roster</Button>
          </Advance>
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
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-ink-50 divide-y">
            {ROSTER.map((p, i) => (
              <tr key={p.name}>
                <Td>
                  {finalized ? (
                    <span className="bg-ink-900 rounded-md px-2 py-0.5 text-xs font-bold text-white">
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
                  {finalized ? (
                    <Badge tone="court">Finalized</Badge>
                  ) : (
                    <Badge tone="gold">Pending finalization</Badge>
                  )}
                </Td>
                <Td>
                  <span className="text-play-700 text-xs font-semibold">Edit #</span>
                  <span className="text-hoop-600 ml-3 text-xs font-semibold">Release</span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {!finalized && (
        <Card size="sm" className="mt-4">
          <PanelHeader title="Jersey Preferences (Accepted Offers)" />
          <div className="grid grid-cols-3 gap-x-6 gap-y-1.5 text-sm">
            {ROSTER.slice(0, 6).map((p) => (
              <div key={p.name} className="flex justify-between">
                <span className="text-ink-700">{p.name}</span>
                <span className="text-ink-400">
                  {p.name === KID.name
                    ? `Prefs: #${KID.prefs[0]}, #${KID.prefs[1]}, #${KID.prefs[2]}`
                    : `Prefs: #${p.jersey}, #${(p.jersey + 4) % 45}, #${(p.jersey + 9) % 45}`}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

export function SceneRosterPending() {
  return <SceneRoster />
}
export function SceneRosterFinalized() {
  return <SceneRoster finalized />
}

/* The finalize confirmation modal (real copy) */
export function SceneFinalizeModal() {
  return (
    <div className="bg-ink-900/40 flex justify-center px-10 py-24">
      <Card className="w-full max-w-md">
        <h3 className="text-ink-950 text-lg font-bold">Finalize {TEAM.name} Roster?</h3>
        <p className="text-ink-600 mt-2 text-sm">
          This will assign jersey numbers based on player preferences (first-come, first-served)
          and expire all remaining pending offers.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="subtle">Cancel</Button>
          <Advance confirm="Roster Finalized!">
            <Button>Confirm &amp; Finalize</Button>
          </Advance>
        </div>
      </Card>
    </div>
  )
}
