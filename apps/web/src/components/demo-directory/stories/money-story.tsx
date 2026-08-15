"use client"

import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import { PlayerMug } from "@/components/ui/player-mug"
import { TypeText } from "../motion"
import {
  MockButton,
  MockDialog,
  MockEmailPreview,
  MockEndCard,
  MockPill,
  MockTile,
  MockTopBar,
} from "../mock-ui"
import type { DemoScript } from "../types"

/**
 * Chapter 8: "The money picture" (owner-signed script, 2026-08-15).
 *
 * THE ARGUMENT. Club money is run out of a spreadsheet and a group chat, and
 * the worst job in amateur sport is the volunteer treasurer standing in a gym
 * doorway telling a parent they are two hundred dollars behind. This chapter
 * is about removing that conversation, not about a nicer table.
 *
 * THE PAINFUL DETAIL (owner's law, named for this chapter): NOBODY MAKES THE
 * AWKWARD CALL. The reminders are not a button somebody has to be brave enough
 * to press. They are scheduled: three days before the charge, the day after it
 * is missed, then every four days, and they stop the moment the money is
 * recorded, whether it arrived by card or by e-transfer at the door. The demo
 * shows the schedule and shows the email, because "we send reminders" means
 * nothing until you can read the one that goes out with your club's name on it.
 *
 * TRUTH TO THE PRODUCT. Every surface mirrors one that ships today:
 *   · the screen — app/(platform)/clubs/[id]/payments/page.tsx: the four tiles
 *     Collected, Outstanding, Overdue, Waived, the red overdue banner reading
 *     "N payments overdue" with its "1–30 days", "31–60 days" and "60+ days"
 *     aging, the by-type pill row, and the "Owed to {club}" panel;
 *   · the table — components/payments/obligations-table.tsx: the filter chips
 *     All, Open, Owed, Partially paid, Paid, Waived, Cancelled, the From /
 *     For / Amount / Paid / Status columns, the status pill wording from
 *     components/payments/types.ts, the red "Overdue Nd" badge, the expanded
 *     payment history written "{date} · {method} · recorded by {name}", and
 *     the Record payment and Waive actions;
 *   · the modal — the same file's "Record a payment": "{description} —
 *     {remaining} remaining", "Amount received", "Method" with Cash,
 *     e-Transfer, Cheque and Other, and "Note (optional)" carrying the
 *     product's own placeholder, "e.g. paid at the door";
 *   · the plan — lib/payments/installments.ts computeDefaultPlan: a 25%
 *     deposit and three equal installments on the first of the next three
 *     months, labelled "Deposit" then "Installment N" the way
 *     app/(platform)/payments/page.tsx labels them for the family;
 *   · the reminder — lib/payments/scheduled.ts: reminderLeadDays defaulting to
 *     3, OVERDUE_NAG_DAYS of 4, OVERDUE_MAX_DAYS of 90, the notification
 *     titles "Payment coming up" and "Payment overdue", and both email bodies
 *     word for word.
 *
 * TWO SCRIPT CORRECTIONS THE PRODUCT FORCED (2026-08-15):
 *   1. The brief said "filter to overdue". There is no Overdue filter, and
 *      adding one to a demo would be selling a control that does not exist.
 *      Overdue is not a state, it is a date passing: the filter is "Open" and
 *      lateness rides on the row as "Overdue 12d". So the demo presses Open,
 *      and the banner above the table is what counts the late ones.
 *   2. The brief said "send the reminder". There is no send button anywhere in
 *      the payments UI, and that is the feature rather than a gap: the club
 *      never sends it, the schedule does. The beat became the schedule and the
 *      email itself, which is a better beat and a true one.
 *
 * MOTION. One fixed browser window. The table filters in place, one row opens
 * underneath itself, two rows go green where they stand, and the four tiles at
 * the top move last, because the tiles are the answer and the answer comes
 * after the work.
 */

/* ── Cast ────────────────────────────────────────────────────────────────── */

const CLUB = "Riverside Ravens"

interface Row {
  id: string
  family: string
  type: string
  description: string
  amount: string
  paid: string
  status: "Owed" | "Partially paid" | "Paid" | "Waived"
  overdueDays?: number
  open: boolean
}

const ROWS: Row[] = [
  {
    id: "malik",
    family: "Sana Malik",
    type: "Season fee",
    description: "Amara Bello · U11 Girls Rep",
    amount: "$340.00",
    paid: "$170.00",
    status: "Partially paid",
    overdueDays: 12,
    open: true,
  },
  {
    id: "thompson",
    family: "Grace Thompson",
    type: "Season fee",
    description: "Noah Thompson · U13 Boys Rep",
    amount: "$340.00",
    paid: "$255.00",
    status: "Partially paid",
    overdueDays: 5,
    open: true,
  },
  {
    id: "sundaram",
    family: "Meera Sundaram",
    type: "Camp",
    description: "March Break Camp · week 1",
    amount: "$210.00",
    paid: "—",
    status: "Owed",
    open: true,
  },
  {
    id: "ruiz",
    family: "Tomas Ruiz",
    type: "Season fee",
    description: "Mateo Ruiz · U13 Boys Rep",
    amount: "$340.00",
    paid: "$85.00",
    status: "Partially paid",
    open: true,
  },
  {
    id: "nair",
    family: "Priya Nair",
    type: "Season fee",
    description: "Priya Nair · U11 Girls Rep",
    amount: "$340.00",
    paid: "$340.00",
    status: "Paid",
    open: false,
  },
  {
    id: "whitfield",
    family: "Ben Whitfield",
    type: "Team fee",
    description: "U13 Boys Rep · gym share",
    amount: "$120.00",
    paid: "—",
    status: "Waived",
    open: false,
  },
]

export const moneyStory: DemoScript = {
  desktopUrl: "/clubs/riverside-ravens/payments",
  initialStage: "desktop",
  chapters: [
    { id: "stands", title: "Where every dollar stands" },
    { id: "family", title: "One family, one plan" },
    { id: "reminder", title: "The reminder sends itself" },
  ],

  beats: [
    /* ── 1. Where every dollar stands ─────────────────────────────────── */
    {
      id: "open",
      chapter: "stands",
      caption:
        "One screen, every dollar the club is owed. No spreadsheet, no second copy of the truth in somebody's email.",
      hold: 3400,
      set: { screen: "payments" },
    },
    {
      id: "tiles",
      chapter: "stands",
      caption:
        "Collected, outstanding, overdue and waived. Waived is on there because clubs quietly carry families every season and that money should be visible, not lost.",
      hold: 3600,
    },
    {
      id: "banner",
      chapter: "stands",
      caption:
        "Overdue gets its own line, aged the way an accountant ages it: what is one to thirty days late, what is a month, what has been sitting since the summer.",
      hold: 3600,
      cursor: "overdue-banner",
      hover: "overdue-banner",
    },
    {
      id: "bytype",
      chapter: "stands",
      caption:
        "And split by what it was for, so a treasurer can answer the board question before it is asked.",
      hold: 3000,
      cursor: "type-pills",
      hover: "type-pills",
    },
    {
      id: "statuses",
      chapter: "stands",
      caption:
        "Every family sits in one of five states. Owed, partially paid, paid, waived, cancelled. There is no sixth state called probably.",
      hold: 3200,
    },
    {
      id: "filter",
      chapter: "stands",
      caption: "Open is the filter that matters: everything still owing, nothing already settled.",
      hold: 3200,
      cursor: "chip-open",
      press: true,
      set: { filter: "open" },
    },
    {
      id: "late",
      chapter: "stands",
      caption:
        "Late is not a status, it is a date that went past. So it rides on the row with the number of days on it, and two families are carrying one.",
      hold: 3400,
    },

    /* ── 2. One family, one plan ──────────────────────────────────────── */
    {
      id: "open-row",
      chapter: "family",
      caption: "Twelve days is the one worth opening.",
      hold: 2800,
      cursor: "row-malik",
      press: true,
    },
    {
      id: "plan",
      chapter: "family",
      caption:
        "The whole plan, written out: a deposit at signup and three installments on the first of the month. Two are ticked, one missed, one has not come round yet.",
      hold: 3800,
      set: { expanded: true },
    },
    {
      id: "why",
      chapter: "family",
      caption:
        "This is what late usually is. Not a family refusing to pay, a card that expired in October. Nobody decided anything and nobody noticed.",
      hold: 3800,
    },
    {
      id: "history",
      chapter: "family",
      caption:
        "Every payment carries how it arrived and who recorded it, so the cash somebody took at the door in September is on the same line as the card charges.",
      hold: 3400,
    },

    /* ── 3. The reminder sends itself ─────────────────────────────────── */
    {
      id: "mail",
      chapter: "reminder",
      caption:
        "Nobody pressed send. There is no send button on this screen, and that is the point.",
      hold: 3800,
      set: { mail: true },
    },
    {
      id: "cadence",
      chapter: "reminder",
      caption:
        "Three days before the charge it says a payment is coming. The day after it is missed it says it is overdue. Then every four days, and it gives up at ninety rather than nagging a family forever.",
      hold: 3800,
    },
    {
      id: "stops",
      chapter: "reminder",
      caption:
        "It also tells them how to make it stop, including the sentence that saves the club a phone call: already paid us directly, we will record it and this ends.",
      hold: 3600,
    },
    {
      id: "malik-paid",
      chapter: "reminder",
      caption: "She updates the card that evening, the charge goes through, and the row moves itself.",
      hold: 3200,
      set: { mail: false, malikPaid: true },
      toast: "Payment received, $170.00",
    },
    {
      id: "record-press",
      chapter: "reminder",
      caption:
        "The other one paid by e-transfer on Saturday, in a gym, to a coach. That money is real and it has to land here too.",
      hold: 3000,
      cursor: "record-thompson",
      press: true,
    },
    {
      id: "record-modal",
      chapter: "reminder",
      caption: "Cash, e-transfer, cheque or other, with what is left already filled in.",
      hold: 3200,
      set: { modal: true },
    },
    {
      id: "record-note",
      chapter: "reminder",
      caption: "And a note, because in eight months somebody will ask.",
      hold: 3000,
      cursor: "note-field",
      type: { key: "note", text: "paid at the door" },
    },
    {
      id: "record-confirm",
      chapter: "reminder",
      caption: "Recorded against the family, not against a memory.",
      hold: 2800,
      cursor: "record-confirm",
      press: true,
    },
    {
      id: "thompson-paid",
      chapter: "reminder",
      caption: "The reminders for that family stop on the same press.",
      hold: 3200,
      set: { modal: false, thompsonPaid: true },
      toast: "Payment recorded, $85.00",
    },
    {
      id: "tiles-move",
      chapter: "reminder",
      caption:
        "Then the numbers at the top catch up, because they were never a separate report. They are the same rows added up.",
      hold: 3600,
      set: { filter: "all" },
    },
    {
      id: "zero",
      chapter: "reminder",
      caption:
        "Overdue at zero, the banner gone, and not one awkward conversation in a gym doorway.",
      hold: 3600,
    },
    {
      id: "end-card",
      chapter: "reminder",
      caption: "The money picture.",
      hold: 3800,
      set: { endCard: true },
    },
  ],

  render: ({ get, typingKey }) => {
    const filter = get<string>("filter", "all")
    const expanded = get("expanded", false)
    const mail = get("mail", false)
    const modal = get("modal", false)
    const malikPaid = get("malikPaid", false)
    const thompsonPaid = get("thompsonPaid", false)
    const endCard = get("endCard", false)

    const rows = ROWS.map((r) => {
      if (r.id === "malik" && malikPaid) {
        return { ...r, paid: "$340.00", status: "Paid" as const, overdueDays: undefined, open: false }
      }
      if (r.id === "thompson" && thompsonPaid) {
        return { ...r, paid: "$340.00", status: "Paid" as const, overdueDays: undefined, open: false }
      }
      return r
    })
    const shown = filter === "open" ? rows.filter((r) => r.open) : rows

    const overdueCount = rows.filter((r) => r.overdueDays).length
    const overdueTotal = malikPaid && thompsonPaid ? "$0.00" : malikPaid ? "$85.00" : "$255.00"
    const collected = malikPaid && thompsonPaid ? "$18,670.00" : malikPaid ? "$18,585.00" : "$18,415.00"
    const outstanding = malikPaid && thompsonPaid ? "$985.00" : malikPaid ? "$1,070.00" : "$1,240.00"

    const desktop = (
      <div className="relative flex h-full flex-col bg-[#f7f8fa]">
        <MockTopBar
          workspace={CLUB}
          tabs={["Dashboard", "Teams", "Programs", "Payments"]}
          activeTab="Payments"
        />

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-6 py-3">
          <div className="grid shrink-0 grid-cols-4 gap-3">
            <MockTile label="Collected" value={<Money value={collected} tone="text-court-700" />} compact />
            <MockTile label="Outstanding" value={<Money value={outstanding} tone="text-hoop-600" />} compact />
            <MockTile
              label="Overdue"
              value={
                <Money
                  value={overdueTotal}
                  tone={overdueTotal === "$0.00" ? "text-court-700" : "text-red-600"}
                />
              }
              compact
            />
            <MockTile label="Waived" value={<Money value="$120.00" tone="text-ink-600" />} compact />
          </div>

          {overdueCount > 0 ? (
            <div
              data-demo-target="overdue-banner"
              className={cn(
                "flex shrink-0 flex-wrap items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-[12.5px] text-red-700 transition-all duration-300 motion-reduce:transition-none",
                "data-[demo-hover=true]:ring-2 data-[demo-hover=true]:ring-red-200"
              )}
            >
              <span className="font-semibold">
                {overdueCount} payment{overdueCount !== 1 ? "s" : ""} overdue
              </span>
              <span>1–30 days: {overdueTotal}</span>
              <span className="text-red-500/70">· 31–60 days: $0.00</span>
              <span className="text-red-500/70">· 60+ days: $0.00</span>
            </div>
          ) : (
            <div className="border-court-200 bg-court-50 text-court-800 live-pop flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2 text-[12.5px]">
              <span className="bg-court-600 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black text-white">
                ✓
              </span>
              <span className="font-semibold">Nothing overdue</span>
              <span className="text-court-700/80">Every family is on time or on a plan.</span>
            </div>
          )}

          <div
            data-demo-target="type-pills"
            className={cn(
              "text-ink-600 flex shrink-0 flex-wrap gap-2 rounded-xl text-[11.5px] transition-all duration-200 motion-reduce:transition-none",
              "data-[demo-hover=true]:ring-play-100 data-[demo-hover=true]:ring-2"
            )}
          >
            {[
              ["Season fee", "$17,000.00"],
              ["Tryout fee", "$1,240.00"],
              ["Camp", "$1,415.00"],
            ].map(([label, amount]) => (
              <span
                key={label}
                className="bg-ink-50 ring-ink-200 rounded-full px-3 py-1 font-medium ring-1 ring-inset"
              >
                {label}: {amount}
              </span>
            ))}
          </div>

          <section className="border-ink-100 min-h-0 flex-1 overflow-hidden rounded-2xl border bg-white shadow-[0_10px_30px_-26px_rgba(15,23,42,0.55)]">
            <header className="border-ink-100 flex items-center gap-3 border-b px-4 py-2">
              <h2 className="text-ink-900 text-[15px] font-semibold">Owed to {CLUB}</h2>
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                {["All", "Open", "Owed", "Partially paid", "Paid", "Waived", "Cancelled"].map((c) => {
                  const active =
                    (filter === "open" && c === "Open") || (filter === "all" && c === "All")
                  return (
                    <span
                      key={c}
                      data-demo-target={c === "Open" ? "chip-open" : undefined}
                      className={cn(
                        "rounded-full border px-2.5 py-[3px] text-[11px] font-semibold transition-all duration-200 motion-reduce:transition-none",
                        active
                          ? "border-play-600 bg-play-600 text-white shadow-sm"
                          : "border-ink-200 text-ink-600 bg-white",
                        !active && "data-[demo-hover=true]:border-play-300 data-[demo-hover=true]:bg-play-50/60",
                        "data-[demo-press=true]:scale-[0.96]"
                      )}
                    >
                      {c}
                    </span>
                  )
                })}
              </div>
            </header>

            <table className="w-full table-fixed">
              <thead className="bg-ink-50">
                <tr>
                  <Th className="w-[180px]">From</Th>
                  <Th>For</Th>
                  <Th className="w-[92px] text-right">Amount</Th>
                  <Th className="w-[92px] text-right">Paid</Th>
                  <Th className="w-[186px]">Status</Th>
                  <Th className="w-[192px]" />
                </tr>
              </thead>
              <tbody className="divide-ink-50 divide-y">
                {shown.map((r) => (
                  <PaymentRow
                    key={r.id}
                    row={r}
                    expanded={expanded && r.id === "malik" && !malikPaid}
                    justPaid={
                      (r.id === "malik" && malikPaid) || (r.id === "thompson" && thompsonPaid)
                    }
                  />
                ))}
              </tbody>
            </table>
          </section>
        </div>

        {/* The reminder, as the family receives it. Nobody at the club pressed
            anything: this is the cron's own output. */}
        <MockDialog
          open={mail}
          title="Payment overdue"
          subtitle="Sent automatically, 12 days after the missed charge. No club action, no button."
        >
          <MockEmailPreview
            org={CLUB}
            subject="Payment overdue — $170.00"
            body={
              <>
                <p>Season fee 2026-27 — $170.00 was due 12 days ago.</p>
                <p className="mt-2">
                  Please settle it (or update your card if a charge failed):{" "}
                  <span className="text-play-600 font-semibold underline">My payments</span>. Already
                  paid the club directly? They&apos;ll record it and this reminder stops.
                </p>
              </>
            }
          />
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <MockPill tone="neutral">3 days before, Payment coming up</MockPill>
            <MockPill tone="gold">Day after, Payment overdue</MockPill>
            <MockPill tone="gold">Then every 4 days</MockPill>
            <MockPill tone="neutral">Stops at 90 days</MockPill>
          </div>
        </MockDialog>

        {/* Record a payment: the money that arrives in a gym, not on a card. */}
        <MockDialog
          open={modal}
          title="Record a payment"
          subtitle="Season fee 2026-27 — $85.00 remaining"
          footer={
            <>
              <MockButton tone="quiet" size="sm">
                Cancel
              </MockButton>
              <MockButton id="record-confirm" tone="court" size="sm">
                Record payment
              </MockButton>
            </>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount received">
              <span className="text-ink-900 font-semibold tabular-nums">$85.00</span>
            </Field>
            <Field label="Method">
              <span className="text-ink-900 font-semibold">e-Transfer</span>
            </Field>
          </div>
          <div className="mt-3">
            <Field id="note-field" label="Note (optional)">
              <TypeText
                text={get<string>("note", "")}
                typing={typingKey === "note"}
                placeholder="e.g. paid at the door"
              />
            </Field>
          </div>
          <p className="text-ink-400 mt-2 text-[11.5px]">
            Recorded payments show on the family&apos;s own history with your name against them.
          </p>
        </MockDialog>

        {endCard && (
          <MockEndCard
            eyebrow="Chapter 8 of 10"
            title="The money picture"
            line="Every dollar owed on one screen, one family's plan written out in full, and reminders that go out on a schedule instead of on somebody's nerve."
            next="Standings to playoffs"
          />
        )}
      </div>
    )

    return { desktop }
  },
}

/* ── Pieces ──────────────────────────────────────────────────────────────── */

function Money({ value, tone }: { value: string; tone: string }) {
  return (
    <span key={value} className={cn("demo-pulse-green rounded text-[21px]", tone)}>
      {value}
    </span>
  )
}

function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "text-ink-500 px-4 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.1em]",
        className
      )}
    >
      {children}
    </th>
  )
}

const STATUS_TONE: Record<Row["status"], string> = {
  Owed: "bg-hoop-50 text-hoop-700",
  "Partially paid": "bg-play-50 text-play-700",
  Paid: "bg-court-50 text-court-700",
  Waived: "bg-ink-100 text-ink-600",
}

function PaymentRow({
  row,
  expanded,
  justPaid,
}: {
  row: Row
  expanded: boolean
  justPaid: boolean
}) {
  return (
    <>
      <tr
        data-demo-target={`row-${row.id}`}
        className={cn(
          "bg-white transition-all duration-300 motion-reduce:transition-none",
          "data-[demo-hover=true]:bg-play-50/40",
          "data-[demo-press=true]:bg-play-50/70",
          justPaid && "bg-court-50/60"
        )}
      >
        <td className="px-4 py-1">
          <span className="flex items-center gap-2">
            <PlayerMug
              name={row.family}
              accentKey={row.family}
              sizeClassName="h-[22px] w-[22px] rounded-full"
            />
            <span className="text-ink-900 truncate text-[12.5px] font-semibold">{row.family}</span>
          </span>
        </td>
        <td className="px-4 py-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="bg-ink-50 text-ink-600 ring-ink-200 shrink-0 rounded-full px-2 py-[1px] text-[10px] font-semibold ring-1 ring-inset">
              {row.type}
            </span>
            <span className="text-ink-500 truncate text-[11.5px]">{row.description}</span>
          </span>
        </td>
        <td className="text-ink-900 px-4 py-1 text-right text-[12px] font-semibold tabular-nums">
          {row.amount}
        </td>
        <td className="text-ink-600 px-4 py-1 text-right text-[12px] tabular-nums">
          <span key={row.paid} className={cn(justPaid && "demo-pulse-green rounded")}>
            {row.paid}
          </span>
        </td>
        <td className="px-4 py-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span
              key={row.status}
              className={cn(
                "rounded-full px-2 py-[2px] text-[11px] font-semibold",
                STATUS_TONE[row.status],
                justPaid && "demo-pulse-green"
              )}
            >
              {row.status}
            </span>
            {row.overdueDays ? (
              <span className="rounded-full bg-red-50 px-2 py-[2px] text-[10.5px] font-bold text-red-700 ring-1 ring-inset ring-red-200">
                Overdue {row.overdueDays}d
              </span>
            ) : null}
          </span>
        </td>
        <td className="px-4 py-1">
          {row.status !== "Paid" && row.status !== "Waived" && (
            <span className="flex items-center justify-end gap-2">
              <span
                data-demo-target={row.id === "thompson" ? "record-thompson" : undefined}
                className={cn(
                  "border-ink-200 text-ink-700 select-none rounded-lg border bg-white px-2 py-[3px] text-[11px] font-semibold transition-all duration-200 motion-reduce:transition-none",
                  "data-[demo-hover=true]:border-play-400 data-[demo-hover=true]:shadow-sm",
                  "data-[demo-press=true]:scale-[0.96]"
                )}
              >
                Record payment
              </span>
              <span className="text-ink-400 text-[11px] font-semibold">Waive</span>
            </span>
          )}
        </td>
      </tr>

      {expanded && (
        <tr className="bg-ink-50/60">
          <td colSpan={6} className="px-4 py-1.5">
            <div className="live-pop grid grid-cols-[minmax(0,1fr)_312px] gap-4">
              <div>
                <p className="text-ink-500 text-[10px] font-bold uppercase tracking-[0.12em]">
                  Payment plan
                </p>
                <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                  <Installment label="Deposit" when="Sep 1, 2026" amount="$85.00" state="paid" />
                  <Installment label="Installment 1" when="Oct 1, 2026" amount="$85.00" state="paid" />
                  <Installment
                    label="Installment 2"
                    when="Nov 1, 2026"
                    amount="$85.00"
                    state="missed"
                  />
                  <Installment
                    label="Installment 3"
                    when="Dec 1, 2026"
                    amount="$85.00"
                    state="upcoming"
                  />
                </div>
                <p className="text-ink-400 mt-1 text-[10.5px]">
                  Scheduled payments charge automatically to the default card on file.
                </p>
              </div>
              <div>
                <p className="text-ink-500 text-[10px] font-bold uppercase tracking-[0.12em]">
                  Payment history
                </p>
                <div className="mt-1 space-y-1">
                  <HistoryLine
                    amount="$85.00"
                    meta="Sep 1, 2026 · Cash · recorded by Dana Michaels"
                  />
                  <HistoryLine amount="$85.00" meta="Oct 1, 2026 · Card (online)" />
                  <HistoryLine amount="$85.00" meta="Nov 1, 2026 · Card (online) · failed" failed />
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function Installment({
  label,
  when,
  amount,
  state,
}: {
  label: string
  when: string
  amount: string
  state: "paid" | "missed" | "upcoming"
}) {
  const tone = {
    paid: "border-court-200 bg-court-50",
    missed: "border-red-200 bg-red-50",
    upcoming: "border-ink-200 bg-white",
  }[state]
  const mark = { paid: "✓", missed: "!", upcoming: "·" }[state]
  const markTone = {
    paid: "bg-court-600 text-white",
    missed: "bg-red-600 text-white",
    upcoming: "bg-ink-200 text-ink-500",
  }[state]
  const word = { paid: "Paid", missed: "Missed, card expired", upcoming: "Upcoming" }[state]
  return (
    <div className={cn("flex items-center gap-2 rounded-xl border px-2 py-[3px]", tone)}>
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-black",
          markTone
        )}
      >
        {mark}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-ink-900 block text-[11px] font-semibold leading-tight">{label}</span>
        <span className="text-ink-500 block text-[9.5px] leading-tight">
          {when} · {word}
        </span>
      </span>
      <span className="text-ink-900 shrink-0 text-[11.5px] font-bold tabular-nums">{amount}</span>
    </div>
  )
}

function HistoryLine({
  amount,
  meta,
  failed,
}: {
  amount: string
  meta: string
  failed?: boolean
}) {
  return (
    <div className="border-ink-100 flex items-baseline gap-2 rounded-lg border bg-white px-2 py-[2px]">
      <span
        className={cn(
          "shrink-0 text-[11.5px] font-bold tabular-nums",
          failed ? "text-red-600 line-through" : "text-ink-900"
        )}
      >
        {amount}
      </span>
      <span className="text-ink-500 min-w-0 truncate text-[10px]">{meta}</span>
    </div>
  )
}

function Field({
  id,
  label,
  children,
}: {
  id?: string
  label: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="text-ink-600 mb-1 block text-[11px] font-semibold uppercase tracking-[0.1em]">
        {label}
      </span>
      <span
        data-demo-target={id}
        className={cn(
          "border-ink-200 flex min-h-[36px] w-full items-center rounded-xl border bg-white px-3 py-2 text-[13px] transition-all duration-200 motion-reduce:transition-none",
          "data-[demo-hover=true]:border-play-300 data-[demo-hover=true]:ring-play-100 data-[demo-hover=true]:ring-2"
        )}
      >
        {children}
      </span>
    </label>
  )
}
