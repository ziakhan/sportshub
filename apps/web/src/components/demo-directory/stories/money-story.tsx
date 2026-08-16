"use client"

import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import { Btn, Chip, Panel, StatusChip } from "../scene-kit"
import type { DemoBeat, DemoScript } from "../types"

/**
 * "The money picture", rebuilt 2026-08-16 to the gold standard set by
 * `season-story.tsx`, `waivers-story.tsx`, `roster-story.tsx` and the rest of
 * the 08-16 set, to the same three laws:
 *
 *   1. PRESENTATION (audit D2). A focused working REGION composed at 1160
 *      logical and rendered at scale 1.0, no browser chrome, no site header.
 *      When the family's phone joins, the region is composed NARROWER (900)
 *      rather than scaled down. `scripts/demo/readability-audit.mjs` gates it.
 *   2. PACING. Stop, explain, act, one voice.
 *   3. EVERY NUMBER DERIVED. The four tiles, the aging split, the overdue
 *      count, the family, her plan, her two real payments and the price list
 *      were all read out of the local seeded database, most of them by running
 *      the product's own `merchantObligations` and `summarize` over it. Every
 *      one is written down in `docs/roadmap/money-picture-numbers.md`.
 *
 * THE SCREEN IS THE REAL ONE. `/clubs/[id]/payments`
 * (`app/(platform)/clubs/[id]/payments/page.tsx`) reading
 * `lib/payments/queries.ts`, which is the SAME module the mobile money surface
 * reads, so the parity law holds. The tiles, the overdue banner, the by-type
 * pills, the table columns, the filter chips, the status badges, the row's
 * overdue counter, the expanded payment history, the record-payment modal and
 * the waive confirmation are all that page's own copy.
 *
 * THE DESK STAYS DESKTOP (audit D, owner exception): a money table is an
 * operator working surface. The family's phone is a real phone surface, so the
 * reminder chapter puts the notification and the email where they actually
 * land.
 *
 * SAME FAMILY AS THE REST OF THE DIRECTORY. `DB` Jordan Reyes, guardian of
 * Darius (#37) and Danielle (#20), is one of the eight families this club is
 * genuinely owed money by: obligation `e2f5e46b`, $895, $447.50 paid, 137 days
 * late. Her two payments on it are real rows: cash in March, e-transfer in
 * April. The demo did not have to invent a debtor.
 *
 * FOUR THINGS THE PRODUCT CANNOT HONESTLY SHOW, DECLARED IN SECTION F OF THE
 * NUMBERS SHEET RATHER THAN STAGED AS FEATURES:
 *   1. THE REMINDER CRON IS NOT RUNNING ON THE BOX TODAY (runbook #36). The
 *      cadence in this demo is what the code schedules, and the demo says so
 *      on the card instead of implying mail is going out tonight.
 *   2. THERE IS NO "MISSED" PAYMENT STATUS. The enum is PENDING, PROCESSING,
 *      SUCCEEDED, FAILED, REFUNDED, DISPUTED. The previous cut of this demo
 *      invented a "Missed, card expired" chip; it is gone.
 *   3. THERE IS NO OVERDUE FILTER. The real chips are All, Open, Paid, Waived,
 *      Cancelled, and lateness rides on the row as "Overdue 137d".
 *   4. NOTHING IN THIS DATABASE IS WAIVED. Zero `WAIVED` obligations exist, so
 *      the Waived tile starts at zero and the demo says what the button does
 *      rather than pretending the club has already used it.
 */

/* ── Cast, read out of the seeded world ──────────────────────────────────── */

/** `DB` Tenant dcd497e7, "Toronto Lords", Toronto, CAD. */
const CLUB = "Toronto Lords"
const CTX = `${CLUB} · Payments`

/**
 * The four tiles. `PRODUCT` produced by `summarize(merchantObligations({
 * tenantId }))` in `lib/payments/queries.ts`, which is exactly what the page
 * calls; run against this club on 2026-08-16 and copied here.
 */
const COLLECTED = 23270
const OUTSTANDING = 3580
const OVERDUE = 3580
const WAIVED = 0
/** `PRODUCT` `summarize().overdueCount` and `.aging`. */
const OVERDUE_COUNT = 8
const AGING_60PLUS = 3580
/** `PRODUCT` `summarize().byType`, and `TYPE_LABEL.Offer` is "Season fee". */
const BY_TYPE: [string, number][] = [["Season fee", 23270]]

/** `DB` 30 obligations on this club, 22 PAID and 8 PARTIALLY_PAID. */
const TOTAL_ROWS = 30
const OPEN_ROWS = 8

/** `PRODUCT` the real filter chips. There is no Overdue chip. */
const FILTERS = ["All", "Open", "Paid", "Waived", "Cancelled"]

/**
 * The eight open rows. `DB` every one is $895 with $447.50 paid, due
 * 2026-04-01, and 137 days late as of 2026-08-16. Guardian names are real.
 */
const FEE = 895
const PAID = 447.5
const REMAINING = 447.5
const LATE_DAYS = 137
const OPEN = [
  { payer: "Jordan Reyes", team: "Toronto Lords Grade 10 Girls" },
  { payer: "Elena Lewis", team: "Toronto Lords Grade 9" },
  { payer: "Chris Campbell", team: "Toronto Lords Grade 9" },
  { payer: "Jamie Clarke", team: "Toronto Lords Grade 10" },
  { payer: "Jordan Wilson", team: "Toronto Lords Grade 10 Girls" },
  { payer: "Kevin Campbell", team: "Toronto Lords Grade 10 Girls" },
]
const OPEN_SHOWN = 5

/** `DB` the family this directory already follows. */
const FAMILY = "Jordan Reyes"
const FAMILY_TEAM = "Toronto Lords Grade 10 Girls"
/** `DB` the description on the obligation itself; the row stores an em-dash. */
const FAMILY_DESC = `Summer 2026 season fee · ${FAMILY_TEAM}`

/**
 * Her plan, and it is not a mock: `DB` two `Payment` rows on obligation
 * e2f5e46b, both SUCCEEDED, both offline, and `ARITH` $895 / 4 = $223.75,
 * which is what `computeDefaultPlan(895)` returns for a deposit and three.
 */
const PER = 223.75
const HISTORY = [
  { when: "Mar 14", method: "Cash", amount: PER, label: "Summer 2026 deposit" },
  { when: "Apr 13", method: "e-Transfer", amount: PER, label: "Summer 2026 installment 1/3" },
]
const REMAINING_TERMS = [
  { label: "Summer 2026 installment 2/3", amount: PER },
  { label: "Summer 2026 installment 3/3", amount: PER },
]

/**
 * The club's price list. Every line `DB` except the rep season, which is the
 * `OWNER` band the roster story sends its offer at.
 */
const TIERS = [
  { what: "Tryout", price: "$25", detail: "Fall tryouts, per player, one evening", tag: "DB" },
  { what: "House league", price: "$220", detail: "Eight Saturdays, U8 to U12, jersey and medal", tag: "DB" },
  { what: "Skills camp", price: "$275 a week", detail: "or $950 for the full camp", tag: "DB" },
  { what: "Summer program", price: "$795 to $1,495", detail: "Returning, New Player, Elite All-In", tag: "DB" },
  { what: "Rep season", price: "$3,600", detail: "Deposit and three monthly installments", tag: "OWNER" },
]

/** `PRODUCT` the record-payment modal, `obligations-table.tsx` lines 334 to 374. */
const NOTE = "paid at the door"

/**
 * The cadence, exactly as `lib/payments/scheduled.ts` schedules it.
 * `PaymentConfig.reminderLeadDays` defaults to 3, `OVERDUE_NAG_DAYS` is 4 and
 * `OVERDUE_MAX_DAYS` is 90.
 */
const LEAD_DAYS = 3
const NAG_DAYS = 4
const MAX_DAYS = 90

/** `PRODUCT` `scheduled.ts` lines 113 to 114, and 136 to 138. */
const DUE_TITLE = "Payment coming up"
const DUE_MSG = `${FAMILY_DESC}: $223.75 due Sep 1.`
const DUE_SUBJECT = "Payment reminder: $223.75 due Sep 1"
const DUE_BODY =
  "It will be charged automatically to your card on file. See your schedule: My payments."
/** `PRODUCT` `scheduled.ts` lines 236 and 241 to 246; the row writes an em-dash. */
const LATE_TITLE = "Payment overdue"
const LATE_MSG = `${FAMILY_DESC} · $447.50 was due ${LATE_DAYS} days ago.`

const money = (n: number) =>
  `$${n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const round = (n: number) => `$${n.toLocaleString("en-CA")}`

/* ── Pacing ──────────────────────────────────────────────────────────────── */

function paced(b: Omit<DemoBeat, "hold"> & { hold?: number }): DemoBeat {
  if (b.hold) return b as DemoBeat
  const arrive = b.cursor ? 620 : 220
  const settle = 500
  const read = b.callout ? b.callout.trim().split(/\s+/).length * 180 + 900 : 2400
  return { ...b, hold: Math.round(arrive + read + (b.callout ? settle : 0)) }
}

/* ── The script ──────────────────────────────────────────────────────────── */

export const moneyStory: DemoScript = {
  presentation: "scene",
  desktopUrl: "/clubs/toronto-lords/payments",
  context: CTX,
  initialStage: "desktop",
  chapters: [
    { id: "stands", title: "Every dollar owed" },
    { id: "charges", title: "What it charges" },
    { id: "plan", title: "One family's plan" },
    { id: "remind", title: "The reminder" },
    { id: "door", title: "Cash at the door" },
  ],

  beats: [
    /* ── 1. Where every dollar stands ─────────────────────────────────── */
    paced({
      id: "open",
      chapter: "stands",
      caption: "Every dollar this club is owed, on one screen.",
      emphasize: "tiles",
      callout: "All four numbers are computed from the obligations, not typed in anywhere.",
    }),
    paced({
      id: "waived-tile",
      chapter: "stands",
      caption: "Waived money gets a number of its own.",
      emphasize: "tile-waived",
      callout: "A fee a club writes off is recorded rather than deleted, so the books still balance.",
    }),
    paced({
      id: "overdue",
      chapter: "stands",
      caption: "Overdue is aged in buckets.",
      emphasize: "overdue-band",
      callout: "Eight payments, and every dollar of it is past sixty days.",
    }),
    paced({
      id: "bytype",
      chapter: "stands",
      caption: "Broken down by what the money is for.",
      emphasize: "bytype",
      callout: "Season fees only, because season fees are all this club has raised so far.",
    }),
    paced({
      id: "filter",
      chapter: "stands",
      caption: "Filter to what is still open.",
      cursor: "filter-open",
      press: true,
      set: { filter: "Open" },
      callout: "Thirty rows becomes eight. Lateness sits on the row rather than in a filter.",
    }),

    /* ── 2. What the club charges ─────────────────────────────────────── */
    paced({
      id: "tiers",
      chapter: "charges",
      caption: "Behind those numbers is the club's price list.",
      set: { view: "tiers" },
      emphasize: "tier-list",
      callout: "Five products, and each one raises its own obligation when somebody signs up.",
    }),
    paced({
      id: "small",
      chapter: "charges",
      caption: "A twenty five dollar tryout is on the same books as everything else.",
      emphasize: "tier-0",
      callout: "The obligation is raised whatever the amount, so small fees stay counted.",
    }),
    paced({
      id: "big",
      chapter: "charges",
      caption: "The rep season is the one that carries a plan.",
      emphasize: "tier-4",
      callout: "A deposit and three dated installments, agreed at the moment the offer is accepted.",
    }),

    /* ── 3. One family, one plan ──────────────────────────────────────── */
    paced({
      id: "row",
      chapter: "plan",
      caption: `One of the eight. ${FAMILY} paid half and stopped.`,
      set: { view: "table", filter: "Open" },
      cursor: "row-family",
      press: true,
      callout: "The row carries how much is left and how many days late it is.",
    }),
    paced({
      id: "expand",
      chapter: "plan",
      caption: "Open it and the plan is underneath.",
      set: { expanded: true },
      emphasize: "history",
      callout: "Four parts of two hundred and twenty three seventy five. Two are in.",
    }),
    paced({
      id: "offline",
      chapter: "plan",
      caption: "Cash in March, an e-transfer in April.",
      emphasize: "history",
      callout: "Neither payment went through a card, and both are on the same ledger.",
    }),
    paced({
      id: "left",
      chapter: "plan",
      caption: "Two are not.",
      emphasize: "remaining",
      callout: "Four hundred and forty seven fifty, a hundred and thirty seven days past its date.",
    }),

    /* ── 4. The reminder sends itself ─────────────────────────────────── */
    paced({
      id: "cadence",
      chapter: "remind",
      caption: "The reminders run on a schedule nobody has to remember.",
      stage: "split",
      set: { view: "cadence", phone: "due" },
      emphasize: "cadence-card",
      callout: "Three days before it is due, the day after it is missed, then every four days.",
    }),
    paced({
      id: "stops",
      chapter: "remind",
      caption: "And it stops.",
      emphasize: "cadence-stop",
      callout: "At ninety days the schedule ends and the club takes the conversation over.",
    }),
    paced({
      id: "phone",
      chapter: "remind",
      caption: "This is what lands on the family's phone.",
      emphasize: "p-due",
      callout: "The notification and the email say the same thing, because one function writes both.",
    }),
    paced({
      id: "late",
      chapter: "remind",
      caption: "And this is what lands once it is late.",
      set: { phone: "late" },
      emphasize: "p-late",
      callout: "It names the fee, the child's team, the amount and the date it was due.",
    }),
    /* ── 5. Cash at the door ──────────────────────────────────────────── */
    paced({
      id: "door",
      chapter: "door",
      caption: "She hands over the rest at the gym on Saturday.",
      stage: "desktop",
      set: { view: "table", expanded: true },
      cursor: "record-btn",
      press: true,
      callout: "Money taken in person is recorded against the same obligation.",
    }),
    paced({
      id: "modal",
      chapter: "door",
      caption: "Amount, method, and a note in the club's own words.",
      set: { modal: true },
      emphasize: "modal-note",
      callout: `Cash, four forty seven fifty, and "${NOTE}". The note is what makes it findable in November.`,
    }),
    paced({
      id: "recorded",
      chapter: "door",
      caption: "Recorded.",
      cursor: "modal-save",
      press: true,
      toast: `Payment recorded · ${money(REMAINING)} · Cash`,
      set: { modal: false, recorded: true },
      callout: "The obligation closes itself, and the family is told without anybody sending a message.",
    }),
    paced({
      id: "tiles-move",
      chapter: "door",
      caption: "And the four numbers at the top move last.",
      emphasize: "tiles",
      callout: "Collected up, outstanding down, overdue down, all from one row closing.",
    }),
    paced({
      id: "waive",
      chapter: "door",
      caption: "The other button on that row is Waive.",
      cursor: "waive-btn",
      emphasize: "waive-btn",
      callout: "It keeps what was paid, writes off what is left and tells the family it is closed.",
    }),
    paced({
      id: "end",
      chapter: "door",
      caption:
        "One screen for every dollar owed, a plan with the real payments on it, cash recorded at the door, and reminders that run on their own clock.",
      hold: 4400,
      set: { endCard: true },
    }),
  ],

  /* ── Render ────────────────────────────────────────────────────────── */

  render: ({ get }) => {
    const view = get<string>("view", "table")
    const recorded = get("recorded", false)

    const desktop = (
      <div className="relative flex h-full flex-col">
        <div key={view} className="demo-fade-in flex min-h-0 flex-1 flex-col">
          {view === "tiers" ? (
            <Tiers />
          ) : view === "cadence" ? (
            <Cadence />
          ) : (
            <MoneyDesk
              filter={get<string>("filter", "All")}
              expanded={get("expanded", false)}
              recorded={recorded}
              modal={get("modal", false)}
            />
          )}
        </div>
        {get("endCard", false) && <EndCard />}
      </div>
    )

    const phone = <FamilyPhone view={get<string>("phone", "due")} />

    return { desktop, phone }
  },
}

/* ── The club's money desk ───────────────────────────────────────────────── */

function MoneyDesk({
  filter,
  expanded,
  recorded,
  modal,
}: {
  filter: string
  expanded: boolean
  recorded: boolean
  modal: boolean
}) {
  const collected = recorded ? COLLECTED + REMAINING : COLLECTED
  const outstanding = recorded ? OUTSTANDING - REMAINING : OUTSTANDING
  const overdue = recorded ? OVERDUE - REMAINING : OVERDUE
  const overdueCount = recorded ? OVERDUE_COUNT - 1 : OVERDUE_COUNT
  /* Expanded, the family row stands alone: the plan under it needs the
     height, and no beat after the expand targets another row. */
  const shown = expanded ? 3 : OPEN_SHOWN

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="bg-ink-50/70 min-h-0 flex-1 px-6 py-3">
        <div data-demo-target="tiles" className="grid grid-cols-4 gap-3">
          <MoneyTile label="Collected" value={round(collected)} tone="court" flash={recorded} />
          <MoneyTile label="Outstanding" value={round(outstanding)} tone="hoop" flash={recorded} />
          <MoneyTile label="Overdue" value={round(overdue)} tone="red" flash={recorded} />
          <MoneyTile label="Waived" value={round(WAIVED)} tone="ink" id="tile-waived" />
        </div>

        <div
          data-demo-target="overdue-band"
          className="mt-2 flex flex-wrap items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-1.5 text-[15px] text-red-700"
        >
          <span className="font-bold">{overdueCount} payments overdue</span>
          <span className="font-semibold tabular-nums">
            60+ days: {round(recorded ? AGING_60PLUS - REMAINING : AGING_60PLUS)}
          </span>
        </div>

        <div data-demo-target="bytype" className="text-ink-600 mt-1.5 flex flex-wrap gap-2">
          {BY_TYPE.map(([type, amount]) => (
            <span
              key={type}
              className="bg-ink-50 ring-ink-200 rounded-full px-3 py-1 text-[14px] font-semibold ring-1 ring-inset"
            >
              {type}: {round(amount)}
            </span>
          ))}
        </div>

        <div className="mt-2.5">
          <Panel
            title={`Owed to ${CLUB}`}
            meta={`${filter === "Open" ? OPEN_ROWS : TOTAL_ROWS} of ${TOTAL_ROWS}`}
            action={
              <span className="flex gap-1.5">
                {FILTERS.map((f) => (
                  <span
                    key={f}
                    data-demo-target={f === "Open" ? "filter-open" : undefined}
                    className={cn(
                      "rounded-full px-3 py-0.5 text-[14px] font-semibold",
                      f === filter ? "bg-play-100 text-play-800" : "text-ink-500 bg-ink-50"
                    )}
                  >
                    {f}
                  </span>
                ))}
              </span>
            }
          >
            <div className="px-4 py-2">
              <div className="text-ink-500 grid grid-cols-[1.1fr_1.6fr_0.7fr_0.7fr_1fr_0.9fr] gap-2 px-2 pb-1 text-[14px] font-bold uppercase tracking-[0.06em]">
                <span>From</span>
                <span>For</span>
                <span className="text-right">Amount</span>
                <span className="text-right">Paid</span>
                <span>Status</span>
                <span />
              </div>
              <div className="space-y-1">
                {OPEN.slice(0, shown).map((r) => {
                  const mine = r.payer === FAMILY
                  const done = mine && recorded
                  return (
                    <div key={r.payer}>
                      <div
                        data-demo-target={mine ? "row-family" : undefined}
                        className={cn(
                          "border-ink-100 grid grid-cols-[1.1fr_1.6fr_0.7fr_0.7fr_1fr_0.9fr] items-center gap-2 rounded-xl border bg-white px-2 py-0.5 transition-colors duration-300 motion-reduce:transition-none",
                          done && "border-court-200 bg-court-50/60",
                          mine && !done && "border-gold-400 bg-gold-50/40"
                        )}
                      >
                        <span className="text-ink-900 truncate text-[15px] font-bold">{r.payer}</span>
                        <span className="text-ink-600 truncate text-[14px] font-medium">
                          Summer 2026 season fee · {r.team}
                        </span>
                        <span className="text-ink-900 text-right text-[15px] font-semibold tabular-nums">
                          {round(FEE)}
                        </span>
                        <span className="text-ink-600 text-right text-[15px] font-semibold tabular-nums">
                          {done ? round(FEE) : money(PAID)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <StatusChip tone={done ? "court" : "gold"}>
                            {done ? "Paid" : "Partially paid"}
                          </StatusChip>
                          {!done && (
                            <span className="text-[14px] font-bold text-red-600 tabular-nums">
                              Overdue {LATE_DAYS}d
                            </span>
                          )}
                        </span>
                        <span className="flex justify-end gap-1.5">
                          {mine && !done && (
                            <>
                              <Btn id="record-btn" tone="quiet" size="sm">
                                Record payment
                              </Btn>
                              <Btn id="waive-btn" tone="ghost" size="sm">
                                Waive
                              </Btn>
                            </>
                          )}
                        </span>
                      </div>

                      {mine && expanded && (
                        <div className="border-ink-100 mt-1 rounded-xl border bg-white px-3 py-1.5">
                          <div data-demo-target="history" className="space-y-1">
                            {HISTORY.map((h) => (
                              <div
                                key={h.label}
                                className="border-ink-100 flex items-center gap-2 rounded-lg border bg-white px-2.5 py-0.5"
                              >
                                <span className="text-ink-500 w-[64px] shrink-0 text-[14px] font-semibold">
                                  {h.when}
                                </span>
                                <span className="text-ink-800 text-[14px] font-bold">{h.method}</span>
                                <span className="text-ink-500 truncate text-[14px] font-medium">
                                  {h.label}
                                </span>
                                <span className="text-ink-900 ml-auto shrink-0 text-[14px] font-bold tabular-nums">
                                  {money(h.amount)}
                                </span>
                              </div>
                            ))}
                            {recorded && (
                              <div className="border-court-200 bg-court-50 live-pop flex items-center gap-2 rounded-lg border px-2.5 py-0.5">
                                <span className="text-court-700 w-[64px] shrink-0 text-[14px] font-semibold">
                                  Today
                                </span>
                                <span className="text-court-800 text-[14px] font-bold">Cash</span>
                                <span className="text-court-700 truncate text-[14px] font-medium">
                                  recorded by the club · &ldquo;{NOTE}&rdquo;
                                </span>
                                <span className="text-court-800 ml-auto shrink-0 text-[14px] font-bold tabular-nums">
                                  {money(REMAINING)}
                                </span>
                              </div>
                            )}
                          </div>
                          {!recorded && (
                            <div data-demo-target="remaining" className="mt-1.5 space-y-1">
                              {REMAINING_TERMS.map((t) => (
                                <div
                                  key={t.label}
                                  className="border-gold-400 bg-gold-50/50 flex items-center gap-2 rounded-lg border border-dashed px-2.5 py-0.5"
                                >
                                  <span className="text-ink-500 w-[64px] shrink-0 text-[14px] font-semibold">
                                    not in
                                  </span>
                                  <span className="text-ink-700 truncate text-[14px] font-medium">
                                    {t.label}
                                  </span>
                                  <span className="text-ink-900 ml-auto shrink-0 text-[14px] font-bold tabular-nums">
                                    {money(t.amount)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="text-ink-400 mt-1.5 px-2 text-[14px] font-semibold">
                and {OPEN_ROWS - shown} more open, every one of them half paid
              </p>
            </div>
          </Panel>
        </div>
      </div>

      {modal && <RecordModal />}
    </div>
  )
}

function MoneyTile({
  label,
  value,
  tone,
  id,
  flash,
}: {
  label: string
  value: string
  tone: "court" | "hoop" | "red" | "ink"
  id?: string
  flash?: boolean
}) {
  const color =
    tone === "court"
      ? "text-court-700"
      : tone === "hoop"
        ? "text-hoop-600"
        : tone === "red"
          ? "text-red-600"
          : "text-ink-600"
  return (
    <div
      data-demo-target={id}
      className="border-ink-200 rounded-2xl border bg-white px-4 py-2 shadow-[0_2px_10px_-8px_rgba(15,23,42,0.4)]"
    >
      <p className="text-ink-500 text-[14px] font-bold uppercase tracking-[0.08em]">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-[28px] font-extrabold leading-none tabular-nums",
          color,
          flash && "live-pop"
        )}
      >
        {value}
      </p>
    </div>
  )
}

/** `obligations-table.tsx` lines 334 to 374, verbatim. */
function RecordModal() {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0b1628]/45 px-8">
      <div className="live-pop w-full max-w-[520px] rounded-2xl bg-white p-5 shadow-[0_40px_90px_-40px_rgba(15,23,42,0.7)]">
        <h4 className="font-display text-ink-900 text-[20px] font-extrabold">Record a payment</h4>
        <p className="text-ink-500 mt-1 text-[15px] font-medium">
          {FAMILY_DESC}: {money(REMAINING)} remaining
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <ModalField label="Amount received">
            <span className="text-ink-900 tabular-nums">{money(REMAINING)}</span>
          </ModalField>
          <ModalField label="Method">
            <span className="text-ink-900">Cash</span>
          </ModalField>
        </div>
        <div className="mt-3">
          <ModalField label="Note (optional)" id="modal-note">
            <span className="text-ink-900">{NOTE}</span>
          </ModalField>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Btn tone="quiet" size="sm">
            Cancel
          </Btn>
          <Btn id="modal-save" tone="court" size="sm">
            Record payment
          </Btn>
        </div>
      </div>
    </div>
  )
}

function ModalField({
  label,
  children,
  id,
}: {
  label: string
  children: ReactNode
  id?: string
}) {
  return (
    <span data-demo-target={id} className="block">
      <span className="text-ink-600 mb-1 block text-[14px] font-semibold">{label}</span>
      <span className="border-ink-300 block rounded-lg border bg-white px-3 py-1.5 text-[15px] font-semibold">
        {children}
      </span>
    </span>
  )
}

/* ── The price list ──────────────────────────────────────────────────────── */

function Tiers() {
  return (
    <div className="bg-ink-50/70 min-h-0 flex-1 px-6 py-4">
      <Panel title={`What ${CLUB} charges`} meta="every one of these raises its own obligation">
        <div data-demo-target="tier-list" className="space-y-3 px-5 py-4">
          {TIERS.map((t, i) => (
            <div
              key={t.what}
              data-demo-target={`tier-${i}`}
              className={cn(
                "flex items-center gap-4 rounded-xl border bg-white px-4 py-5",
                i === 4 ? "border-play-300" : "border-ink-100"
              )}
            >
              <span className="text-ink-900 w-[190px] shrink-0 text-[17px] font-bold">{t.what}</span>
              <span className="text-court-700 w-[170px] shrink-0 text-[20px] font-extrabold tabular-nums">
                {t.price}
              </span>
              <span className="text-ink-600 min-w-0 flex-1 text-[15px] font-medium">{t.detail}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

/* ── The cadence ─────────────────────────────────────────────────────────── */

function Cadence() {
  const steps = [
    {
      when: `${LEAD_DAYS} days before it is due`,
      what: DUE_TITLE,
      how: "notification and email, once",
    },
    {
      when: "the day after it is missed",
      what: LATE_TITLE,
      how: "notification and email, once",
    },
    {
      when: `then every ${NAG_DAYS} days`,
      what: `${LATE_TITLE}, again`,
      how: "guaranteed by a ledger row, never twice in a window",
    },
    {
      when: `after ${MAX_DAYS} days`,
      what: "nothing",
      how: "the schedule stops and the club takes over",
    },
    {
      when: "the moment it is paid or waived",
      what: "nothing",
      how: "a closed obligation drops out of the run on its next pass",
    },
  ]
  return (
    <div className="bg-ink-50/70 min-h-0 flex-1 px-6 py-4">
      <Panel title="What goes out, and when">
        <div data-demo-target="cadence-card" className="space-y-2 px-5 py-3">
          {steps.map((s, i) => (
            <div
              key={s.when}
              data-demo-target={i === 3 ? "cadence-stop" : undefined}
              className={cn(
                "flex items-center gap-4 rounded-xl border bg-white px-4 py-4",
                i >= 3 ? "border-ink-200 border-dashed" : "border-play-200"
              )}
            >
              <span className="text-play-700 w-[230px] shrink-0 text-[16px] font-bold">
                {s.when}
              </span>
              <span className="text-ink-900 w-[220px] shrink-0 text-[16px] font-bold">{s.what}</span>
              <span className="text-ink-600 min-w-0 flex-1 text-[15px] font-medium">{s.how}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

/* ── The family's phone ──────────────────────────────────────────────────── */

function FamilyPhone({ view }: { view: string }) {
  const late = view === "late"
  return (
    <div className="flex h-full flex-col bg-[#f6f7f9]">
      <div className="flex items-baseline gap-2 bg-[#0b1628] px-4 pb-2.5 pt-2 text-white">
        <p className="text-[15px] font-bold leading-tight">{FAMILY}</p>
        <p className="text-[14px] font-medium text-white/60">Parent · two players</p>
      </div>

      <div key={view} className="demo-fade-in min-h-0 flex-1 overflow-hidden px-3 py-2.5">
        <p className="text-ink-900 text-[17px] font-extrabold">Notifications</p>

        <div
          data-demo-target={late ? "p-late" : "p-due"}
          className={cn(
            "live-pop mt-2 rounded-2xl border bg-white px-3 py-2.5",
            late ? "border-red-300" : "border-ink-200"
          )}
        >
          <p className={cn("text-[15px] font-bold", late ? "text-red-700" : "text-ink-900")}>
            {late ? LATE_TITLE : DUE_TITLE}
          </p>
          <p className="text-ink-600 mt-1 text-[14px] font-medium leading-snug">
            {late ? LATE_MSG : DUE_MSG}
          </p>
        </div>

        <p className="text-ink-400 mt-3 text-[14px] font-bold uppercase tracking-[0.1em]">
          The same reminder, by email
        </p>
        <div className="border-ink-200 mt-1.5 rounded-2xl border bg-white px-3 py-2.5">
          <p className="text-ink-900 text-[15px] font-bold leading-snug">
            {late ? `${LATE_TITLE} · ${money(REMAINING)}` : DUE_SUBJECT}
          </p>
          <p className="text-ink-600 mt-1 text-[14px] font-medium leading-snug">
            {late ? LATE_MSG : DUE_BODY}
          </p>
          <p className="text-play-700 mt-1.5 text-[14px] font-bold">My payments</p>
        </div>

      </div>

      <div className="border-ink-200 flex shrink-0 items-center justify-around border-t bg-white px-1.5 pb-4 pt-2">
        {["Home", "Chat", "Calendar", "My Kids", "Social"].map((t) => (
          <span
            key={t}
            className={cn("text-[14px] font-bold", t === "Home" ? "text-play-700" : "text-ink-400")}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ── End card ────────────────────────────────────────────────────────────── */

function EndCard() {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0b1628] px-12 text-white">
      <div className="live-pop max-w-[760px] text-center">
        <p className="text-gold-400 text-[15px] font-bold uppercase tracking-[0.18em]">
          A club chapter
        </p>
        <h3 className="font-display mt-2 text-[34px] font-extrabold leading-tight">
          The money picture
        </h3>
        <p className="mt-3 text-[17px] leading-relaxed text-white/75">
          Twenty three thousand collected, three and a half thousand outstanding and every dollar of
          it more than sixty days old, on one screen nobody had to build in a spreadsheet. One
          family&apos;s plan opened underneath itself with the cash and the e-transfer that really
          paid it, the rest taken at the door and recorded with a note, and a reminder schedule that
          runs without a club owner remembering it.
        </p>
        <p className="mt-5 text-[15px] font-semibold text-white/50">
          Next: everyone in the loop
        </p>
      </div>
    </div>
  )
}
