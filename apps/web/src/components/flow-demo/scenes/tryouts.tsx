"use client"

/**
 * Chapter 3 (part 1) — Tryouts: create + publish (club, desktop), discover +
 * sign up + pay the fee (parent, phone), check-in and signup status (club).
 * Mirrors /clubs/[id]/tryouts/*, /events, /tryout/[id], /tryouts/[id] and
 * /payments (docs/demo-inventory/club.md + parent.md).
 */

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PanelHeader } from "@/components/ui/panel-header"
import { cn } from "@/components/ui/cn"
import { Advance } from "../advance"
import { CLUB, KID, SIGNUPS, TEAM, TRYOUT, fmt } from "../data"
import {
  AreaBox,
  CheckRow,
  Field,
  OperatorPage,
  PhonePage,
  SelectBox,
  SuccessPanel,
  Td,
  Th,
  TxtInput,
} from "./shared"

/* Step 10 — Create a tryout */
export function SceneCreateTryout() {
  return (
    <OperatorPage
      narrow
      back="Back to Tryouts"
      title="Create Tryout"
      subtitle="Set up a tryout for your club. You can publish it to the marketplace after creation."
    >
      <Card>
        <PanelHeader title="Tryout details" />
        <div className="space-y-4">
          <Field label="Team" required>
            <SelectBox value={`${TEAM.name} (U16 / Boys)`} placeholder="Select a team" />
          </Field>
          <div className="flex gap-2">
            <Badge tone="play">Age group · U16</Badge>
            <Badge tone="play">Boys</Badge>
          </div>
          <Field label="Title" required>
            <TxtInput value={TRYOUT.title} placeholder="Spring 2026 U12 Boys Tryout" />
          </Field>
          <Field label="Description">
            <AreaBox value="Full-court scrimmages and skills stations. Bring indoor shoes, a water bottle, and a reversible if you have one." />
          </Field>
          <Field label="Location" required>
            <TxtInput value={TRYOUT.location} placeholder="Main Gym, 123 Court Ave" />
          </Field>
        </div>
        <PanelHeader title="Schedule" className="mt-6" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Date & Time" required>
            <TxtInput value="2026-04-07 6:30 PM" />
          </Field>
          <Field label="Duration (minutes)">
            <TxtInput value="90" placeholder="90" />
          </Field>
        </div>
        <PanelHeader title="Fee & capacity" className="mt-6" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Fee ($)" required>
            <TxtInput value="25.00" placeholder="0.00" />
          </Field>
          <Field label="Max Participants">
            <TxtInput value="40" placeholder="No limit" />
          </Field>
        </div>
        <CheckRow checked className="mt-4" label="Public tryout (visible on marketplace when published)" />
        <p className="text-ink-400 mt-3 text-xs">
          Tryouts are saved as drafts. You can publish them to the marketplace from the tryouts
          list.
        </p>
      </Card>
      <div className="mt-4 flex gap-3">
        <Button variant="subtle">Cancel</Button>
        <Advance block className="flex-1">
          <Button block>Create Tryout</Button>
        </Advance>
      </div>
    </OperatorPage>
  )
}

export function SceneTryoutCreated() {
  return (
    <OperatorPage narrow back="Back to Tryouts" title="Create Tryout" subtitle="Set up a tryout for your club.">
      <SuccessPanel
        title="Tryout Created!"
        actions={
          <>
            <Advance>
              <Button>View Tryouts</Button>
            </Advance>
            <Button variant="subtle">Create Another Tryout</Button>
          </>
        }
      >
        <p>
          <strong>{TRYOUT.title}</strong> has been created as a draft.
        </p>
        <p className="mt-1">You can publish it to the marketplace from the tryouts list.</p>
      </SuccessPanel>
    </OperatorPage>
  )
}

/* Step 11 — Publish to the marketplace */
export function SceneTryoutsList() {
  return (
    <div className="px-10 py-8">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-condensed text-ink-950 text-3xl font-bold uppercase tracking-wide">Tryouts</h2>
        <Button size="sm">Create Tryout</Button>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {["All (2)", "Published (1)", "Draft (1)", "Needs Offer (0)", "Past (0)"].map((p, i) => (
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
        <div className="ml-auto flex items-center gap-2">
          <div className="w-44">
            <SelectBox placeholder="All Teams" />
          </div>
          <div className="w-52">
            <TxtInput placeholder="Search tryouts..." />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <Card size="sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <p className="text-ink-900 text-base font-bold">{TRYOUT.title}</p>
                <Badge tone="hoop">Draft</Badge>
                <Badge tone="play">{TEAM.name}</Badge>
              </div>
              <p className="text-ink-500 mt-1 text-sm">
                Apr 7, 2026 at 6:30 PM · {TRYOUT.location} · U16
              </p>
              <p className="text-ink-500 mt-1 text-sm">0 / 40 signups</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="subtle">Signups</Button>
              <Button size="sm" variant="subtle">Edit</Button>
              <Button size="sm" variant="subtle">Public listing</Button>
              <Advance>
                <Button size="sm">Publish</Button>
              </Advance>
            </div>
          </div>
        </Card>
        <Card size="sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <p className="text-ink-900 text-base font-bold">Grade 9 Boys Spring Assessment</p>
                <Badge tone="court">Published</Badge>
              </div>
              <p className="text-ink-500 mt-1 text-sm">
                Apr 9, 2026 at 6:30 PM · {TRYOUT.location} · U16
              </p>
              <p className="text-ink-500 mt-1 text-sm">14 / 40 signups</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="subtle">Signups</Button>
              <Button size="sm" variant="subtle">Edit</Button>
              <Button size="sm" variant="subtle">Public listing</Button>
              <Button size="sm" variant="subtle">Unpublish</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

/* Step 12 — Parents discover the tryout (phone, /events) */
export function SceneEvents() {
  const others = [
    {
      type: "Tryout",
      title: "Grade 9 Boys Spring Tryout",
      club: "Royal Crown",
      meta: "Apr 11, 2026 · Scarborough",
      spots: "18/40 signed up",
      fee: "FREE",
      color: "#9333ea",
    },
    {
      type: "Camp",
      title: "Summer Skills Camp",
      club: "City Above Elite",
      meta: "Jul 6, 2026 · Summer • 6 weeks",
      spots: "31 registered",
      fee: "$180.00",
      color: "#0f766e",
    },
  ]
  return (
    <PhonePage>
      <h1 className="text-ink-950 text-xl font-bold">Find Programs &amp; Tryouts</h1>
      <p className="text-ink-500 mt-1 text-sm">
        Browse tryouts, house leagues, camps, and tournaments to find the right fit for your
        player.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {["All", "Tryouts", "House Leagues", "Camps", "Tournaments"].map((p, i) => (
          <span
            key={p}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              i === 1 ? "bg-play-600 text-white" : "bg-white text-ink-600 border-ink-200 border"
            )}
          >
            {p}
          </span>
        ))}
      </div>
      <div className="mt-3">
        <TxtInput placeholder="Search by name, club, or location..." />
      </div>
      <div className="mt-4 space-y-3">
        <Advance block>
          <Card size="sm" className="overflow-hidden p-0 text-left">
            <div className="h-[3px]" style={{ backgroundColor: CLUB.color }} />
            <div className="p-4">
              <div className="flex items-center justify-between">
                <Badge tone="play">Tryout</Badge>
                <span className="text-ink-400 text-xs">12/40 signed up</span>
              </div>
              <p className="text-ink-900 mt-2 text-sm font-bold">{TRYOUT.title}</p>
              <p className="text-ink-500 text-xs">{CLUB.name}</p>
              <p className="text-ink-500 mt-1.5 text-xs">{TRYOUT.dateShort}</p>
              <p className="text-ink-500 text-xs">Haber Recreation Centre, Burlington</p>
              <p className="text-ink-500 text-xs">U16 • Boys</p>
              <p className="text-ink-900 mt-2 text-sm font-bold">{fmt(TRYOUT.fee)}</p>
            </div>
          </Card>
        </Advance>
        {others.map((o) => (
          <Card key={o.title} size="sm" className="overflow-hidden p-0">
            <div className="h-[3px]" style={{ backgroundColor: o.color }} />
            <div className="p-4">
              <div className="flex items-center justify-between">
                <Badge tone="neutral">{o.type}</Badge>
                <span className="text-ink-400 text-xs">{o.spots}</span>
              </div>
              <p className="text-ink-900 mt-2 text-sm font-bold">{o.title}</p>
              <p className="text-ink-500 text-xs">{o.club}</p>
              <p className="text-ink-500 mt-1.5 text-xs">{o.meta}</p>
              <p className={cn("mt-2 text-sm font-bold", o.fee === "FREE" ? "text-court-600" : "text-ink-900")}>
                {o.fee}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </PhonePage>
  )
}

/* Step 13 — Tryout details (phone) */
export function SceneTryoutDetails() {
  return (
    <PhonePage noHeader className="p-0 px-0 pt-0">
      <div className="px-4 py-3 text-white" style={{ backgroundColor: CLUB.color }}>
        <p className="text-xs opacity-90">&larr; Back to Marketplace</p>
        <p className="mt-1 text-sm font-bold">{CLUB.name}</p>
      </div>
      <div className="space-y-3 px-4 py-4">
        <Card size="sm">
          <Badge tone="court" dot>
            Open
          </Badge>
          <h1 className="text-ink-950 mt-2 text-lg font-bold">{TRYOUT.title}</h1>
          <p className="text-ink-600 mt-1 text-sm">
            Full-court scrimmages and skills stations. Bring indoor shoes, a water bottle, and a
            reversible if you have one.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              ["Date & Time", `${TRYOUT.dateLong}\n6:30 PM (90 min)`],
              ["Location", "Haber Recreation Centre, Burlington"],
              ["Age Group & Gender", "U16 • Boys"],
              ["Spots", "12 signed up (28 spots left)"],
            ].map(([k, v]) => (
              <div key={k} className="bg-ink-50 rounded-xl p-3">
                <p className="text-ink-400 text-[10px] font-bold uppercase tracking-[0.12em]">{k}</p>
                <p className="text-ink-900 mt-1 whitespace-pre-line text-xs font-semibold">{v}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card size="sm" className="text-center">
          <p className="text-ink-950 text-2xl font-bold">{fmt(TRYOUT.fee)}</p>
          <p className="text-ink-400 text-xs">per player</p>
          <div className="mt-3">
            <Advance block>
              <Button block>Sign Up Now</Button>
            </Advance>
          </div>
        </Card>
        <Card size="sm">
          <p className="text-play-700 text-sm font-semibold">View {CLUB.name} Profile &rarr;</p>
        </Card>
      </div>
    </PhonePage>
  )
}

/* Step 14 — Registration (phone) */
export function SceneTryoutSignup() {
  return (
    <PhonePage noHeader className="p-0 px-0 pt-0">
      <div className="px-4 py-3 text-white" style={{ backgroundColor: CLUB.color }}>
        <p className="text-xs opacity-90">&larr; {CLUB.name}</p>
        <p className="mt-1 text-sm font-bold">{TRYOUT.title}</p>
      </div>
      <div className="space-y-3 px-4 py-4">
        <Card size="sm">
          <p className="text-ink-950 mb-3 text-base font-bold">Sign up</p>
          <div className="space-y-3.5">
            <Field label="Select Player" required>
              <SelectBox value={KID.name} placeholder="Choose a player..." />
            </Field>
            <Field label="Notes (optional)">
              <AreaBox placeholder="Any additional info for the club..." rows={2} />
            </Field>
            <div className="bg-amber-50 text-amber-800 rounded-xl p-3 text-xs">
              This tryout requires a {fmt(TRYOUT.fee)} fee. Payment processing will be available
              soon. Your signup will be marked as pending until payment is completed.
            </div>
            <CheckRow checked label="Email me about future programs from this club" />
            <Advance block>
              <Button block>Sign Up ({fmt(TRYOUT.fee)})</Button>
            </Advance>
          </div>
        </Card>
      </div>
    </PhonePage>
  )
}

export function SceneSignupRegistered() {
  return (
    <PhonePage>
      <SuccessPanel title="Signup registered!" actions={<Button variant="subtle">View in Dashboard &rarr;</Button>}>
        <p>
          <strong>{KID.name}</strong> has been registered. Payment of {fmt(TRYOUT.fee)} will be
          required when payment processing is available.
        </p>
      </SuccessPanel>
      <div className="mt-4 text-center">
        <Advance>
          <Button variant="secondary">Go to My Payments</Button>
        </Advance>
      </div>
    </PhonePage>
  )
}

/* Step 14b — Paying the tryout fee from My Payments (phone) */
export function ScenePayTryoutFee() {
  return (
    <PhonePage>
      <Badge tone="play">Payments</Badge>
      <h1 className="text-ink-950 mt-2 text-xl font-bold">My Payments</h1>
      <p className="text-ink-500 mt-1 text-sm">1 open item, {fmt(TRYOUT.fee)} outstanding.</p>
      <Card size="sm" className="mt-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {["All", "Open", "Paid"].map((p, i) => (
            <span
              key={p}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold",
                i === 1 ? "bg-ink-900 text-white" : "bg-white text-ink-600 border-ink-200 border"
              )}
            >
              {p}
            </span>
          ))}
        </div>
        <div className="border-ink-100 rounded-xl border p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-ink-900 text-sm font-bold">
                {TRYOUT.title} · {KID.name}
              </p>
              <p className="text-ink-500 mt-0.5 text-xs">
                To <span className="text-play-700 font-semibold">{CLUB.name}</span>
              </p>
            </div>
            <Badge tone="gold">Owed</Badge>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="bg-ink-50 text-ink-500 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                Tryout fee
              </span>
              <span className="text-ink-900 text-sm font-bold">{fmt(TRYOUT.fee)}</span>
            </div>
            <Advance>
              <Button size="sm">Pay online</Button>
            </Advance>
          </div>
        </div>
      </Card>
    </PhonePage>
  )
}

/* Stripe payment modal (phone) */
export function SceneStripeTryout() {
  return (
    <PhonePage className="bg-ink-900/40">
      <div className="mt-16">
        <Card>
          <p className="text-ink-950 text-lg font-bold">Pay {fmt(TRYOUT.fee)}</p>
          <div className="mt-4 space-y-3">
            <Field label="Card number">
              <TxtInput value="4242 4242 4242 4242" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Expiry">
                <TxtInput value="04 / 28" />
              </Field>
              <Field label="CVC">
                <TxtInput value="•••" />
              </Field>
            </div>
            <p className="text-ink-400 text-xs">Payments are processed securely by Stripe.</p>
          </div>
          <div className="mt-5 flex gap-3">
            <Button variant="subtle">Cancel</Button>
            <Advance block className="flex-1" confirm="✓ Payment received">
              <Button block>Pay {fmt(TRYOUT.fee)}</Button>
            </Advance>
          </div>
        </Card>
      </div>
    </PhonePage>
  )
}

/* Step 15 — Attendance: tryout check-in (desktop) */
export function SceneCheckIn() {
  return (
    <OperatorPage
      narrow
      back="Back to Signups"
      title={`${TRYOUT.title} · Check-in`}
      subtitle={`${TRYOUT.dateShort} • ${TRYOUT.location} • ${TEAM.name}`}
    >
      <Card size="sm" className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-ink-950 text-3xl font-bold tabular-nums">
              {TRYOUT.checkedIn} / {TRYOUT.signups}
            </p>
            <p className="text-ink-500 text-sm">checked in</p>
          </div>
        </div>
        <div className="bg-ink-100 mt-3 h-2 overflow-hidden rounded-full">
          <div
            className="bg-court-500 h-full rounded-full"
            style={{ width: `${(TRYOUT.checkedIn / TRYOUT.signups) * 100}%` }}
          />
        </div>
      </Card>
      <div className="mb-3">
        <TxtInput placeholder="Search player or parent…" />
      </div>
      <div className="space-y-2">
        {SIGNUPS.map((s, i) =>
          s.in ? (
            <div key={s.player} className="border-ink-100 flex items-center justify-between rounded-xl border bg-white px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="bg-court-500 flex h-6 w-6 items-center justify-center rounded-full text-white">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3.5 w-3.5">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <div>
                  <p className="text-ink-900 text-sm font-bold">{s.player}</p>
                  <p className="text-ink-500 text-xs">
                    {s.age} • male • {s.parent}
                  </p>
                </div>
              </div>
              <span className="text-court-600 text-xs font-semibold">{`6:${(11 + i).toString().padStart(2, "0")} PM`}</span>
            </div>
          ) : (
            <Advance key={s.player} block>
              <div className="border-ink-100 flex items-center justify-between rounded-xl border bg-white px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="border-ink-300 h-6 w-6 rounded-full border" />
                  <div>
                    <p className="text-ink-900 text-sm font-bold">{s.player}</p>
                    <p className="text-ink-500 text-xs">
                      {s.age} • male • {s.parent}
                    </p>
                  </div>
                </div>
                <span className="text-ink-400 text-xs font-semibold">Tap to check in</span>
              </div>
            </Advance>
          )
        )}
        <p className="text-ink-400 pt-1 text-center text-xs">+ 13 more signed up</p>
      </div>
    </OperatorPage>
  )
}

/* Step 16 — Club sees signup status (desktop) */
export function SceneSignupsTable() {
  return (
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
          <Advance>
            <Button>Send Offers ({TRYOUT.eligible})</Button>
          </Advance>
          <Button variant="subtle">
            Check-in ({TRYOUT.checkedIn + 1}/{TRYOUT.signups})
          </Button>
        </div>
      </div>
      <Card className="overflow-hidden p-0">
        <PanelHeader variant="band" title="Signups" action={<span className="text-ink-600 text-sm">21 signups • 18 checked in</span>} />
        <table className="w-full">
          <thead className="border-ink-100 border-b">
            <tr>
              <Th>Player</Th>
              <Th>Parent</Th>
              <Th>Age / Gender</Th>
              <Th>Status</Th>
              <Th>Signed Up</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody className="divide-ink-50 divide-y">
            {SIGNUPS.map((s, i) => (
              <tr key={s.player}>
                <Td>
                  <span className="font-bold">{s.player}</span>{" "}
                  {(s.in || i === 5) && (
                    <span className="bg-court-50 text-court-700 ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                      ✓ in
                    </span>
                  )}
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
                <Td>
                  <Button size="sm" variant="subtle">
                    Make Offer
                  </Button>
                </Td>
              </tr>
            ))}
            <tr>
              <td colSpan={6} className="text-ink-400 px-3 py-3 text-center text-xs">
                + 13 more signups
              </td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  )
}
