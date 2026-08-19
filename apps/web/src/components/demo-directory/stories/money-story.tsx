"use client"

import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import type { DemoBeat, DemoScript } from "../types"
import { AppIcon } from "./your-week-story"

/**
 * "The money picture", rebuilt 2026-08-16 to the gold standard and CONVERTED
 * 2026-08-19 to the realism standard (mock-ui.tsx R1–R8) on the owner's ruling:
 * every screen to the real component's anatomy, every flow to its real end
 * state, and the balloons cut to the ones that say something the screen cannot.
 *
 * THE DESK STAYS DESKTOP (`OWNER` audit section D): a money table is an
 * operator working surface. The family's phone joins for the two chapters that
 * happen on it, the reminder and the receipt.
 *
 * TRUTH TO THE PRODUCT, SCREEN BY SCREEN (R1: classes copied, files cited):
 *   · the money desk is `app/(platform)/clubs/[id]/payments/page.tsx`: the four
 *     `rounded-3xl` `font-condensed` tiles in their real tones (collected
 *     court-700, outstanding hoop-600, overdue red-600, waived ink-600), the
 *     red-200 aging banner with the buckets that have money in them, the
 *     `TYPE_LABEL` by-type pills, and `PanelHeader` "Owed to Toronto Lords".
 *     Every money string is `formatCurrency(n, "CAD")`, which is
 *     `Intl.NumberFormat("en", …)` and therefore prints CA$ (see PUNCH below);
 *   · the table under it is `components/payments/obligations-table.tsx`: the
 *     five real filter chips (ink-900 when active), the six real columns, the
 *     `bg-ink-100` reference-type chip before every description, the
 *     `OBLIGATION_STATUS_STYLE` badge, the red-100 `Overdue {n}d` badge, and
 *     Record payment / Waive on EVERY open row, because that is what the real
 *     merchant view renders for an admin;
 *   · the row expansion is the same file's `<td colSpan={6}>` block: the
 *     ink-50/40 strip and one `text-xs` line per payment, "{date} · {method} ·
 *     recorded by {name}" with the amount in court-700 on the right. The
 *     product does NOT list future installments there, so the 08-16 cut's
 *     dashed "not in" rows are gone;
 *   · recording is that file's `RecordPaymentModal`: the ink-900/40 scrim, the
 *     max-w-md card, "Record a payment", the remaining-balance line, the three
 *     real fields (amount prefilled to the balance, method defaulting to Cash,
 *     the note with its own placeholder) and the court-600 button. It runs to
 *     the real end state: `recordOfflinePayment` closes the obligation, the row
 *     turns Paid, its chase buttons disappear and the payer gets a receipt;
 *   · the price list is `clubs/[id]/offer-templates/page.tsx` with
 *     `template-card.tsx` inside it, on the real club tab strip
 *     (`clubs/[id]/club-tabs.tsx`, brand pill when active). The 08-16 cut drew
 *     a five-row price panel that exists on no screen in the product; R1 leaves
 *     no room for it, exactly as the roster story's invented "Programs" screen
 *     had to go;
 *   · the reminder chapter has no invented schedule panel either. It is the
 *     family's real `app/(platform)/notifications/page.tsx`: the Inbox chip,
 *     "Notifications (1 unread)", and one card per notice carrying read state
 *     the way that page carries it (R2: unread = play-200 border, play-50/30
 *     tint and a play-500 dot; read = ink-100). The four overdue notices ARE
 *     the cadence, so the cadence needs no diagram;
 *   · the email is the one `lib/payments/scheduled.ts` sends, in an OS Mail
 *     view (R8): OS chrome around the route's own two paragraphs, verbatim;
 *   · the receipt lands as an iOS-style push (R8) with the APPROVED app icon
 *     imported from your-week-story, carrying `recordOfflinePayment`'s own
 *     title and message.
 *
 * THE FAMILY IS REAL AND SO IS EVERY ROW (`DB`, re-read 2026-08-18 against the
 * local seed, tenant `4a57ba49`, read only):
 *   · 30 obligations at $895 on this club, 22 PAID and 8 PARTIALLY_PAID, every
 *     open one $447.50 paid and due 2026-04-01;
 *   · the eight open payers, in the order `merchantObligations` returns them
 *     (createdAt desc): Kevin Campbell, Jordan Wilson, Jordan Reyes, Jamie
 *     Diallo, Jamie Clarke, Chris Campbell, Elena Rodriguez, Elena Lewis;
 *   · obligation `de81e0eb`, Jordan Reyes, "Summer 2026 season fee — Toronto
 *     Lords Grade 10 Girls" (the row stores an em-dash; house copy law renders
 *     the middot), $895, PARTIALLY_PAID, two SUCCEEDED offline payments:
 *     14 Mar 2026 CASH $223.75 and 13 Apr 2026 ETRANSFER $223.75, both recorded
 *     by Mark Harris, `summer-owner-lords@sportshub.demo`, the ClubOwner of
 *     this club and the persona filming this demo;
 *   · the three offer templates, with their real fees, installments, practice
 *     count, game range, description and included items: Elite All-In $1,495,
 *     Returning Player $795, New Player $895. Jordan Reyes's $895 obligation is
 *     the New Player price, which is why chapter 2 leads into chapter 3;
 *   · `summarize(merchantObligations({ tenantId }))` over that book:
 *     collected 23270, outstanding 3580, overdue 3580, waived 0, overdueCount
 *     8, aging.d60plus 3580, byType [["Offer", 23270]]. It checks: 22 × 895 +
 *     8 × 447.50 = 23,270.
 *
 * FOUR THINGS DECLARED RATHER THAN STAGED:
 *   1. THERE IS NO "MISSED" PAYMENT STATUS. The enum is PENDING, PROCESSING,
 *      SUCCEEDED, FAILED, REFUNDED, DISPUTED, and lateness rides on the row as
 *      "Overdue 137d".
 *   2. THERE IS NO OVERDUE FILTER. The real chips are All, Open, Paid, Waived,
 *      Cancelled; the demo filters to Open.
 *   3. NOTHING IN THIS DATABASE IS WAIVED, so the Waived tile honestly reads
 *      zero and the demo points at the button rather than pressing it. Pressing
 *      it opens a browser `confirm()`, and R7 does not allow starting a flow
 *      the demo will not finish.
 *   4. HER SCHEDULE HAS ALREADY RUN OUT. `OVERDUE_MAX_DAYS` is 90 and her fee
 *      is 137 days late, so `sendOverdueReminders` stopped selecting the row at
 *      the end of June. That is not a gap in the demo, it is the reason the
 *      club owner is on this screen recording cash.
 *
 * TWO PRODUCT PUNCHES THE CONVERSION FOUND (shown as the code behaves, not
 * quietly prettied up):
 *   · `formatCurrency` (`lib/countries.ts`) formats with locale "en", so every
 *     money string in the club UI reads "CA$23,270.00", while `formatMoney`
 *     (`lib/email.ts`) uses "en-CA" and the same amount in an email reads
 *     "$23,270.00". Worth unifying on en-CA.
 *   · the overdue nag quotes the OBLIGATION'S FULL AMOUNT rather than the
 *     balance outstanding (`scheduled.ts` line 213 passes `Number(o.amount)`),
 *     so a family that has paid half is told "$895.00 was due N days ago".
 *     The demo prints what the code sends.
 *
 * INVENTED-CONTENT LEDGER (everything not read out of the database):
 *   · the four overdue notices. The reminder cron has never run against this
 *     seed, so no Notification rows exist for them. Their titles, wording,
 *     amounts and dates are what `sendOverdueReminders` writes for THIS
 *     obligation: first notice the day after the 1 April due date, then every
 *     `OVERDUE_NAG_DAYS` (4), the last one 90 days late on 30 June;
 *   · the receipt notice and push, likewise: `recordOfflinePayment`'s own title
 *     and message for the payment the demo records;
 *   · the note typed into the modal, "paid at the door", which is the real
 *     placeholder that field carries.
 *
 * COMPOSITION TRIMS, DECLARED:
 *   · the club layout's title block (SmartBack, club name, subdomain) is not
 *     drawn; the tab strip is, because the story presses it. The scene's
 *     context strip names the screen instead;
 *   · a later seed pass layered a second book onto this club (obligations at
 *     $3,000 and $2,700, and two more offer templates carrying no detail). The
 *     demo films the summer 2026 book, which is the set the numbers sheet
 *     documents and the set every other demo in this directory follows;
 *   · the region is 1160 by 600 logical, which is a short browser window, so
 *     the page is filmed in its TWO SCROLL POSITIONS the way the roster story
 *     films its long forms: the top (tiles, banner, pills, the head of the
 *     table) and the table itself. Below the table the real page also carries
 *     "Fees Toronto Lords owes" and the payment settings card, both off the
 *     bottom of this window;
 *   · the templates page's create-a-template form sits between the heading and
 *     the grid on the real page and is off the bottom of the same window;
 *   · the phone renders these pages at handset scale, as every converted story
 *     does, and the modal is `absolute` rather than `fixed` so it stays inside
 *     the composed region.
 */

/* ── Cast, read out of the seeded world ──────────────────────────────────── */

/** `DB` Tenant 4a57ba49, "Toronto Lords", Toronto, CAD. */
const CLUB = "Toronto Lords"
const CTX_PAY = `${CLUB} · Payments`
const CTX_TPL = `${CLUB} · Offer templates`
/** `DB` User 1d3618ed, summer-owner-lords@sportshub.demo, ClubOwner here. */
const OWNER = "Mark Harris"

/** `PRODUCT` `summarize()` over this club's summer book. */
const COLLECTED = 23270
const OUTSTANDING = 3580
const OVERDUE = 3580
const WAIVED = 0
const OVERDUE_COUNT = 8
const AGING_60PLUS = 3580
/** `PRODUCT` `TYPE_LABEL.Offer` is "Season fee"; every row here is an Offer. */
const BY_TYPE: [string, number][] = [["Season fee", 23270]]

/** `DB` every obligation in this book: $895, half paid, due 2026-04-01. */
const FEE = 895
const PAID = 447.5
const REMAINING = 447.5
/** `ARITH` due 2026-04-01, read 2026-08-16. */
const LATE_DAYS = 137

const FAMILY = "Jordan Reyes"
const FAMILY_TEAM = `${CLUB} Grade 10 Girls`
/** `DB` the obligation's own description; the row stores an em-dash. */
const FAMILY_DESC = `Summer 2026 season fee · ${FAMILY_TEAM}`

interface Row {
  payer: string
  team: string
  paid: boolean
}
const mkRow = (payer: string, team: string, paid: boolean): Row => ({ payer, team, paid })

/** `DB` the head of the unfiltered list, createdAt desc, statuses as stored. */
const ALL_ROWS: Row[] = [
  mkRow("Jamie Liu", "Grade 10 Girls", true),
  mkRow("David Green", "Grade 10 Girls", true),
  mkRow("Kevin Campbell", "Grade 10 Girls", false),
  mkRow("Wendy Santos", "Grade 10 Girls", true),
]

/** `DB` all eight open rows, in the order the query returns them. */
const OPEN_ROWS: Row[] = [
  mkRow("Kevin Campbell", "Grade 10 Girls", false),
  mkRow("Jordan Wilson", "Grade 10 Girls", false),
  mkRow(FAMILY, "Grade 10 Girls", false),
  mkRow("Jamie Diallo", "Grade 10", false),
  mkRow("Jamie Clarke", "Grade 10", false),
  mkRow("Chris Campbell", "Grade 9", false),
  mkRow("Elena Rodriguez", "Grade 9", false),
  mkRow("Elena Lewis", "Grade 9", false),
]

/** `PRODUCT` the five real filter chips. There is no Overdue chip. */
const FILTERS: { key: string; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "PAID", label: "Paid" },
  { key: "WAIVED", label: "Waived" },
  { key: "CANCELLED", label: "Cancelled" },
]

/** `DB` her two real payments, and `ARITH` $895 / 4 = $223.75. */
const PER = 223.75
const HISTORY = [
  { when: "Mar 14, 2026", method: "Cash", amount: PER },
  { when: "Apr 13, 2026", method: "e-Transfer", amount: PER },
]
/** `PRODUCT` the note field's own placeholder. */
const NOTE = "paid at the door"
/** The day this demo is read: 137 days past 1 April 2026. */
const TODAY = "Aug 16, 2026"

/** `DB` the three summer offer templates on this club, every field as stored. */
const TEMPLATES = [
  {
    id: "tpl-elite",
    name: "Elite All-In",
    fee: 1495,
    installments: 4,
    practices: 24,
    games: "13-15 games",
    items: ["Uniform", "Tracksuit", "Shoes", "Basketball", "Bag", "Full kit", "Summer skills block"],
  },
  {
    id: "tpl-returning",
    name: "Returning Player",
    fee: 795,
    installments: 4,
    practices: 24,
    games: "13-15 games",
    items: ["Basketball", "Keeps last season's kit"],
  },
  {
    id: "tpl-new",
    name: "New Player",
    fee: 895,
    installments: 4,
    practices: 24,
    games: "13-15 games",
    items: ["Uniform", "Basketball", "Reversible practice jersey"],
  },
]
/** `DB` the shared `programDescription`, minus its seed marker. */
const TEMPLATE_BLURB =
  "Toronto Lords summer program: two practices a week plus weekend games in the NPH Summer League."

/** `PRODUCT` `clubs/[id]/layout.tsx` lines 123 to 139, the admin club tabs. */
const TABS = [
  "Overview",
  "Teams",
  "Tryouts",
  "Offers",
  "Templates",
  "House League",
  "Camps",
  "Tournaments",
  "Payments",
  "Accounting",
  "Polls",
  "Staff",
  "Customize page",
  "Messages",
  "Settings",
]

/**
 * `PRODUCT` `lib/payments/scheduled.ts`: title line 244, message line 236
 * (em-dash to middot), and the amount is the obligation's own, not the balance.
 * The cadence is `OVERDUE_NAG_DAYS = 4` from the day after the due date, and
 * `OVERDUE_MAX_DAYS = 90` is where the run stops selecting the row.
 */
const LATE_TITLE = "Payment overdue"
const lateMsg = (days: number) =>
  `${FAMILY_DESC} · ${moneyE(FEE)} was due ${days} day${days === 1 ? "" : "s"} ago.`
const NAGS = [
  { id: "nag-90", days: 90, when: "Jun 30, 9:30 AM" },
  { id: "nag-9", days: 9, when: "Apr 10, 9:30 AM" },
  { id: "nag-5", days: 5, when: "Apr 6, 9:30 AM" },
  { id: "nag-1", days: 1, when: "Apr 2, 9:30 AM" },
]
/** `PRODUCT` `scheduled.ts` lines 262 to 264, subject and body verbatim. */
const LATE_SUBJECT = `${LATE_TITLE} · ${moneyE(FEE)}`
const LATE_BODY_2 =
  "Please settle it (or update your card if a charge failed): My payments. Already paid the club directly? They'll record it and this reminder stops."

/** `PRODUCT` `lib/payments/obligations.ts` lines 301 to 306, verbatim. */
const RECEIPT_TITLE = "Payment received"
const RECEIPT_MSG = `${FAMILY_DESC} · ${moneyE(REMAINING)} received (cash). Thank you!`

/**
 * `PRODUCT` `lib/countries.ts` `formatCurrency`: `Intl.NumberFormat("en", {
 * style: "currency", currency: "CAD" })`, which prints CA$. Every money string
 * on the club's screens goes through it.
 */
function money(n: number) {
  return `CA$${n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
/** `PRODUCT` `lib/email.ts` `formatMoney`: "en-CA", so mail and bell print $. */
function moneyE(n: number) {
  return `$${n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/* ── Pacing ──────────────────────────────────────────────────────────────── */

function paced(b: Omit<DemoBeat, "hold"> & { hold?: number }): DemoBeat {
  if (b.hold) return b as DemoBeat
  /* Human pace (owner 2026-08-19): people click, then click again. Long reads
     only where a balloon earns one. */
  const arrive = b.cursor ? 620 : 180
  const settle = 400
  const read = b.callout ? b.callout.trim().split(/\s+/).length * 140 + 700 : 1200
  return { ...b, hold: Math.round(arrive + read + (b.callout ? settle : 0)) }
}

/* ── The script ──────────────────────────────────────────────────────────── */

export const moneyStory: DemoScript = {
  presentation: "scene",
  desktopUrl: "/clubs/toronto-lords/payments",
  context: CTX_PAY,
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
      callout: "All four are computed from the obligations, so no one keeps a second copy in a spreadsheet.",
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
      caption: "Overdue is aged, and every dollar of this one is past sixty days.",
      emphasize: "overdue-band",
    }),
    paced({
      id: "bytype",
      chapter: "stands",
      caption: "Then broken down by what the money was for.",
      emphasize: "bytype",
    }),

    /* ── 2. What the club charges ─────────────────────────────────────── */
    /* Engine law (roster conversion, 2026-08-19): `set` applies at beat START,
       so a press that replaces the screen presses on one beat and lands on the
       next, which is also how a press reads to a person. */
    paced({
      id: "tab",
      chapter: "charges",
      caption: "Behind those numbers is what the club charges.",
      cursor: "tab-templates",
      press: true,
    }),
    paced({
      id: "templates",
      chapter: "charges",
      caption: "Three packages, priced apart.",
      context: CTX_TPL,
      set: { view: "templates" },
      emphasize: "template-grid",
      callout: "Every offer sent on one of these raises its own obligation at that price. That is where the money on the last screen came from.",
    }),
    paced({
      id: "new-player",
      chapter: "charges",
      caption: "A new player is eight hundred and ninety five, in four parts, uniform included.",
      emphasize: "tpl-new",
    }),

    /* ── 3. One family, one plan ──────────────────────────────────────── */
    paced({
      id: "back",
      chapter: "plan",
      caption: "Back to the money.",
      context: CTX_PAY,
      cursor: "tab-payments",
      press: true,
    }),
    paced({
      id: "filter",
      chapter: "plan",
      caption: "Filtered to what is still open.",
      set: { view: "payments" },
      cursor: "filter-open",
      press: true,
    }),
    paced({
      id: "eight",
      chapter: "plan",
      caption: "Eight families, all on the same date, all half paid.",
      set: { filter: "OPEN", scrolled: true },
      emphasize: "table",
    }),
    paced({
      id: "row",
      chapter: "plan",
      caption: "One of the eight is a family this directory already follows.",
      cursor: "row-family",
      press: true,
    }),
    paced({
      id: "expand",
      chapter: "plan",
      caption: "Cash in March, an e-transfer in April, and then nothing.",
      set: { expanded: true },
      emphasize: "history",
      callout: "Offline money is most of the money a club takes, and it lands on the same ledger a card would.",
    }),

    /* ── 4. The reminder ──────────────────────────────────────────────── */
    paced({
      id: "remind",
      chapter: "remind",
      caption: "This is what her phone got while it was owed.",
      stage: "split",
      set: { phone: "notifs" },
      emphasize: "notif-list",
      callout: "The day after a fee is missed, then every four days, written by a job nobody has to remember.",
    }),
    paced({
      id: "stops",
      chapter: "remind",
      caption: "And then it stops.",
      emphasize: "nag-90",
      callout: "The schedule gives up at ninety days. Hers ran out in June, which is why the row is still open.",
    }),
    paced({
      id: "email",
      chapter: "remind",
      caption: "The same words reached her inbox.",
      set: { phone: "mail" },
      emphasize: "mail-body",
    }),

    /* ── 5. Cash at the door ──────────────────────────────────────────── */
    paced({
      id: "door",
      chapter: "door",
      caption: "She hands over the rest in cash at the gym.",
      cursor: "record-btn",
      press: true,
    }),
    paced({
      id: "modal",
      chapter: "door",
      caption: "The amount is the balance, and Cash is how it arrived.",
      set: { modal: true },
      emphasize: "modal-amount",
    }),
    paced({
      id: "note",
      chapter: "door",
      caption: "And a note in the club's own words.",
      cursor: "modal-note",
      type: { key: "noteTyped", text: NOTE },
      callout: "The note is what makes this payment findable in November.",
    }),
    paced({
      id: "save",
      chapter: "door",
      caption: "Record payment.",
      cursor: "modal-save",
      press: true,
    }),
    paced({
      id: "recorded",
      chapter: "door",
      caption: "Paid in full, with the cash on the same ledger as the rest.",
      set: { modal: false, recorded: true, focus: true },
      emphasize: "history",
      callout: "The obligation closes itself, and the buttons that chase it are gone with it.",
    }),
    paced({
      id: "receipt",
      chapter: "door",
      caption: "The family is told, without anybody writing a message.",
      set: { phone: "notifs", banner: true },
      hold: 2800,
    }),
    paced({
      id: "receipt-land",
      chapter: "door",
      caption: "A receipt on her phone and in her inbox, from one press on a table.",
      set: { banner: false, receipt: true },
      emphasize: "notif-receipt",
    }),
    paced({
      id: "waive",
      chapter: "door",
      caption: "The other button on every open row is Waive.",
      stage: "desktop",
      set: { focus: false },
      cursor: "waive-btn",
      callout: "It keeps what was paid, writes off what is left and tells the family the fee is closed.",
    }),
    paced({
      id: "tiles-move",
      chapter: "door",
      caption: "And the four numbers at the top move last.",
      set: { scrolled: false },
      emphasize: "tiles",
    }),
    paced({
      id: "end",
      chapter: "door",
      caption:
        "One screen for every dollar owed, a plan with the real payments on it, a reminder that ran on its own clock, and cash recorded at the door.",
      hold: 4400,
      set: { endCard: true },
    }),
  ],

  /* ── Render ────────────────────────────────────────────────────────── */

  render: ({ get, typingKey }) => {
    const view = get<string>("view", "payments")

    const desktop = (
      <div className="relative flex h-full flex-col">
        <ClubDesk
          view={view}
          filter={get<string>("filter", "ALL")}
          scrolled={get("scrolled", false)}
          focus={get("focus", false)}
          expanded={get("expanded", false)}
          recorded={get("recorded", false)}
          modal={get("modal", false)}
          noteTyped={get<string>("noteTyped", "")}
          typingNote={typingKey === "noteTyped"}
        />
        {get("endCard", false) && <EndCard />}
      </div>
    )

    const phone = (
      <FamilyPhone
        view={get<string>("phone", "notifs")}
        receipt={get("receipt", false)}
        banner={get("banner", false)}
      />
    )

    return { desktop, phone }
  },
}

/* ── The club workspace ──────────────────────────────────────────────────── */

function ClubDesk({
  view,
  filter,
  scrolled,
  focus,
  expanded,
  recorded,
  modal,
  noteTyped,
  typingNote,
}: {
  view: string
  filter: string
  scrolled: boolean
  /** Scrolled one more notch, to the family's own row (after acting on it). */
  focus: boolean
  expanded: boolean
  recorded: boolean
  modal: boolean
  noteTyped: string
  typingNote: boolean
}) {
  return (
    <div className="bg-ink-50 relative flex h-full flex-col">
      {/* `clubs/[id]/layout.tsx` lines 151 to 172: the white band the tab strip
          sits on. The title block above it is off the top of this window. */}
      {!scrolled && (
        <div className="border-ink-200 shrink-0 border-b bg-white px-6 pt-4">
          <ClubTabsStrip active={view === "templates" ? "Templates" : "Payments"} />
        </div>
      )}

      <div key={view} className="demo-fade-in min-h-0 flex-1 overflow-hidden">
        {view === "templates" ? (
          <TemplatesScreen />
        ) : (
          <PaymentsScreen
            filter={filter}
            scrolled={scrolled}
            focus={focus}
            expanded={expanded}
            recorded={recorded}
          />
        )}
      </div>

      {modal && <RecordModal noteTyped={noteTyped} typingNote={typingNote} />}
    </div>
  )
}

/** `clubs/[id]/club-tabs.tsx`, verbatim: brand pill when active, edge clip. */
function ClubTabsStrip({ active }: { active: string }) {
  return (
    <div className="relative">
      <nav className="-mx-1 flex gap-1.5 overflow-hidden px-1 pb-3">
        {TABS.map((tab) => {
          const on = tab === active
          return (
            <span
              key={tab}
              data-demo-target={
                tab === "Templates" ? "tab-templates" : tab === "Payments" ? "tab-payments" : undefined
              }
              style={on ? { backgroundColor: "var(--brand)", borderColor: "var(--brand)" } : undefined}
              className={cn(
                "whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold transition",
                on ? "text-white" : "border-ink-200 text-ink-600"
              )}
            >
              {tab}
            </span>
          )
        })}
      </nav>
    </div>
  )
}

/* ── The money desk ──────────────────────────────────────────────────────── */

/** `clubs/[id]/payments/page.tsx`, in the two scroll positions the window has. */
function PaymentsScreen({
  filter,
  scrolled,
  focus,
  expanded,
  recorded,
}: {
  filter: string
  scrolled: boolean
  focus: boolean
  expanded: boolean
  recorded: boolean
}) {
  const collected = recorded ? COLLECTED + REMAINING : COLLECTED
  const outstanding = recorded ? OUTSTANDING - REMAINING : OUTSTANDING
  const overdue = recorded ? OVERDUE - REMAINING : OVERDUE
  const overdueCount = recorded ? OVERDUE_COUNT - 1 : OVERDUE_COUNT
  const aging = recorded ? AGING_60PLUS - REMAINING : AGING_60PLUS
  /* One more notch down the same list: after acting on the family's row a club
     is looking at that row, not at the head of the table. */
  const list = filter === "OPEN" ? OPEN_ROWS : ALL_ROWS
  const rows = focus ? list.slice(2) : list

  return (
    <div className="h-full overflow-hidden px-6 pt-4">
      <div className="space-y-8 p-6 pt-4">
        {!scrolled && (
          <>
            <div data-demo-target="tiles" className="grid grid-cols-4 gap-4">
              <Tile label="Collected" value={money(collected)} tone="text-court-700" flash={recorded} />
              <Tile label="Outstanding" value={money(outstanding)} tone="text-hoop-600" flash={recorded} />
              <Tile label="Overdue" value={money(overdue)} tone="text-red-600" flash={recorded} />
              <Tile id="tile-waived" label="Waived" value={money(WAIVED)} tone="text-ink-600" />
            </div>

            {/* page.tsx lines 82 to 100: only the buckets with money in them. */}
            <div
              data-demo-target="overdue-band"
              className="flex flex-wrap items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"
            >
              <span className="font-semibold">{overdueCount} payments overdue</span>
              <span>· 60+ days: {money(aging)}</span>
            </div>

            <div data-demo-target="bytype" className="text-ink-600 flex flex-wrap gap-2 text-xs">
              {BY_TYPE.map(([type, amount]) => (
                <span
                  key={type}
                  className="bg-ink-50 ring-ink-200 rounded-full px-3 py-1 font-medium ring-1 ring-inset"
                >
                  {type}: {money(recorded ? amount + REMAINING : amount)}
                </span>
              ))}
            </div>
          </>
        )}

        <section>
          <PanelHeader title={`Owed to ${CLUB}`} />
          <ObligationsTable
            rows={rows}
            filter={filter}
            expanded={expanded}
            recorded={recorded}
          />
        </section>
      </div>
    </div>
  )
}

/** `payments/page.tsx` lines 149 to 174, the money KPI tile. */
function Tile({
  label,
  value,
  tone,
  id,
  flash,
}: {
  label: string
  value: string
  tone: string
  id?: string
  flash?: boolean
}) {
  return (
    <div
      data-demo-target={id}
      className="border-ink-100 rounded-3xl border bg-white p-5 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]"
    >
      <p className="text-ink-500 text-xs font-semibold uppercase tracking-[0.12em]">{label}</p>
      <p
        className={cn("font-condensed mt-2 text-4xl font-bold leading-none", tone, flash && "live-pop")}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
    </div>
  )
}

/** `components/ui/panel-header.tsx`, inline variant. */
function PanelHeader({ title }: { title: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <span className="flex items-center gap-2.5">
        <span className="h-5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" aria-hidden="true" />
        <span className="font-condensed text-ink-950 text-lg font-bold uppercase leading-none tracking-wide">
          {title}
        </span>
      </span>
    </div>
  )
}

/** `components/payments/obligations-table.tsx`, merchant view, admin rights. */
function ObligationsTable({
  rows,
  filter,
  expanded,
  recorded,
}: {
  rows: Row[]
  filter: string
  expanded: boolean
  recorded: boolean
}) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <span
            key={f.key}
            data-demo-target={f.key === "OPEN" ? "filter-open" : undefined}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              filter === f.key ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-600"
            )}
          >
            {f.label}
          </span>
        ))}
      </div>

      <div
        data-demo-target="table"
        className="border-ink-200 overflow-x-auto rounded-lg border bg-white"
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-ink-100 text-ink-500 border-b text-left text-xs uppercase tracking-wide">
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3">For</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Paid</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const mine = r.payer === FAMILY
              const done = r.paid || (mine && recorded)
              return (
                <TableRows key={`${r.payer}-${r.team}`}>
                  <tr
                    data-demo-target={mine ? "row-family" : undefined}
                    className="border-ink-50 border-b transition-colors duration-300 last:border-0 motion-reduce:transition-none"
                  >
                    <td className="text-ink-900 px-4 py-3 font-medium">{r.payer}</td>
                    <td className="text-ink-600 px-4 py-3">
                      <span className="bg-ink-100 text-ink-600 mr-2 rounded px-1.5 py-0.5 text-xs">
                        Season fee
                      </span>
                      Summer 2026 season fee · {CLUB} {r.team}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{money(FEE)}</td>
                    <td className="text-ink-600 px-4 py-3 text-right">
                      {money(done ? FEE : PAID)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          done ? "bg-court-50 text-court-700" : "bg-play-50 text-play-700"
                        )}
                      >
                        {done ? "Paid" : "Partially paid"}
                      </span>
                      {!done && (
                        <span className="ml-1.5 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                          Overdue {LATE_DAYS}d
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {!done && (
                          <>
                            <span
                              data-demo-target={mine ? "record-btn" : undefined}
                              className="bg-court-600 rounded-md px-2.5 py-1 text-xs font-medium text-white data-[demo-press=true]:brightness-95"
                            >
                              Record payment
                            </span>
                            <span
                              data-demo-target={mine ? undefined : r.payer === OPEN_ROWS[0].payer ? "waive-btn" : undefined}
                              className="border-ink-200 text-ink-600 rounded-md border px-2.5 py-1 text-xs font-medium"
                            >
                              Waive
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>

                  {mine && expanded && (
                    <tr className="border-ink-50 bg-ink-50/40 border-b last:border-0">
                      <td colSpan={6} className="px-6 py-3">
                        <ul data-demo-target="history" className="space-y-1.5">
                          {HISTORY.map((h) => (
                            <li key={h.when} className="flex items-center justify-between text-xs">
                              <span className="text-ink-600">
                                {h.when} · {h.method} · recorded by {OWNER}
                              </span>
                              <span className="flex items-center gap-3">
                                <span className="text-court-700 font-medium">{money(h.amount)}</span>
                                <span className="border-ink-200 text-ink-600 rounded border px-2 py-0.5">
                                  Refund
                                </span>
                              </span>
                            </li>
                          ))}
                          {recorded && (
                            <li className="live-pop flex items-center justify-between text-xs">
                              <span className="text-ink-600">
                                {TODAY} · Cash · recorded by {OWNER} · &ldquo;{NOTE}&rdquo;
                              </span>
                              <span className="flex items-center gap-3">
                                <span className="text-court-700 font-medium">{money(REMAINING)}</span>
                                <span className="border-ink-200 text-ink-600 rounded border px-2 py-0.5">
                                  Refund
                                </span>
                              </span>
                            </li>
                          )}
                        </ul>
                      </td>
                    </tr>
                  )}
                </TableRows>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** `obligations-table.tsx` `FragmentRow`: two <tr> under one key. */
function TableRows({ children }: { children: ReactNode }) {
  return <>{children}</>
}

/** `obligations-table.tsx` lines 298 to 394, through to its real result. */
function RecordModal({ noteTyped, typingNote }: { noteTyped: string; typingNote: boolean }) {
  return (
    <div className="bg-ink-900/40 absolute inset-0 z-30 flex items-center justify-center p-4">
      <div className="live-pop w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-ink-900 text-lg font-semibold">Record a payment</h3>
        <p className="text-ink-500 mt-1 text-sm">
          {FAMILY_DESC}: {money(REMAINING)} remaining
        </p>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-ink-700 mb-1 block font-medium">Amount received</span>
            <span
              data-demo-target="modal-amount"
              className="border-ink-200 text-ink-900 block w-full rounded-md border px-3 py-2"
            >
              447.50
            </span>
          </label>
          <label className="block text-sm">
            <span className="text-ink-700 mb-1 block font-medium">Method</span>
            <span className="border-ink-200 text-ink-900 flex w-full items-center justify-between rounded-md border px-3 py-2">
              Cash
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-ink-400 h-3.5 w-3.5"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </label>
          <label className="block text-sm">
            <span className="text-ink-700 mb-1 block font-medium">Note (optional)</span>
            <span
              data-demo-target="modal-note"
              className={cn(
                "border-ink-200 block w-full rounded-md border px-3 py-2",
                noteTyped ? "text-ink-900" : "text-ink-400"
              )}
            >
              {noteTyped || "e.g. paid at the door"}
              {typingNote && (
                <span className="bg-play-600 ml-0.5 inline-block h-4 w-[2px] align-middle" />
              )}
            </span>
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <span className="border-ink-200 text-ink-600 rounded-md border px-4 py-2 text-sm">
            Cancel
          </span>
          <span
            data-demo-target="modal-save"
            className="bg-court-600 rounded-md px-4 py-2 text-sm font-medium text-white data-[demo-press=true]:brightness-95"
          >
            Record payment
          </span>
        </div>
      </div>
    </div>
  )
}

/* ── The price list ──────────────────────────────────────────────────────── */

/** `clubs/[id]/offer-templates/page.tsx` + `template-card.tsx`. */
function TemplatesScreen() {
  return (
    <div className="h-full overflow-hidden px-6 pt-4">
      <div className="p-6 pt-4">
        <div className="mb-6">
          <h2 className="font-condensed text-ink-950 text-2xl font-bold uppercase tracking-wide">
            Offer Templates
          </h2>
          <p className="text-ink-500 mt-1 text-sm">
            Create reusable templates for sending offers to players. All teams in the club share
            these templates.
          </p>
        </div>
        <div data-demo-target="template-grid" className="grid grid-cols-3 gap-4">
          {TEMPLATES.map((t) => (
            <TemplateCard key={t.id} t={t} />
          ))}
        </div>
      </div>
    </div>
  )
}

function TemplateCard({ t }: { t: (typeof TEMPLATES)[number] }) {
  return (
    <div
      data-demo-target={t.id}
      className="border-ink-100 shadow-soft h-full rounded-2xl border bg-white p-5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="font-condensed text-ink-950 text-lg font-bold uppercase leading-tight tracking-wide">
            {t.name}
          </h4>
          <span className="bg-play-50 text-play-700 mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold">
            {t.games}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="border-ink-200 text-ink-700 rounded-lg border bg-white px-2.5 py-1 text-xs font-semibold">
            Edit
          </span>
          <span className="border-ink-200 text-ink-400 rounded-lg border bg-white px-2.5 py-1 text-xs font-semibold">
            Archive
          </span>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-500">Season Fee</span>
          <span className="font-condensed text-ink-950 text-base font-bold">{money(t.fee)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-ink-500">Payment</span>
          <span className="text-ink-700 font-medium">{t.installments} installments</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-ink-500">Practice Sessions</span>
          <span className="text-ink-700 font-medium">{t.practices}</span>
        </div>
        <p className="text-ink-500 text-xs">{TEMPLATE_BLURB}</p>
      </div>

      <div className="border-ink-100 mt-3 border-t pt-3">
        <div className="text-ink-500 mb-1.5 text-xs font-medium">Includes</div>
        <div className="flex flex-wrap gap-1.5">
          {t.items.map((item) => (
            <span
              key={item}
              className="bg-court-50 text-court-700 ring-court-100 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] ring-1 ring-inset"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── The family's handset ────────────────────────────────────────────────── */

function FamilyPhone({
  view,
  receipt,
  banner,
}: {
  view: string
  receipt: boolean
  banner: boolean
}) {
  return (
    <div className="relative flex h-full flex-col bg-[#f6f7f9]">
      <div className="flex items-baseline gap-2 bg-[#0b1628] px-4 pb-2.5 pt-2 text-white">
        <p className="text-[15px] font-bold leading-tight">{FAMILY}</p>
        <p className="text-[14px] font-medium text-white/60">Parent · two players</p>
      </div>

      <div key={view} className="demo-fade-in min-h-0 flex-1 overflow-hidden">
        {view === "mail" ? <MailView /> : <Notifications receipt={receipt} />}
      </div>

      {banner && <PushBanner />}

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

/** `app/(platform)/notifications/page.tsx` at handset scale. */
function Notifications({ receipt }: { receipt: boolean }) {
  return (
    <div className="h-full space-y-2.5 overflow-hidden px-3 py-2.5">
      <p className="text-ink-500 text-[12px] font-semibold">← Account</p>
      <div className="border-ink-100 shadow-soft rounded-[20px] border bg-white p-3">
        <div className="border-play-100 bg-play-50 text-play-600 mb-1.5 inline-flex rounded-full border px-2.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.18em]">
          Inbox
        </div>
        <div className="flex items-center justify-between">
          <p className="font-display text-ink-950 text-[20px] font-bold">
            Notifications
            {receipt && <span className="text-ink-500 ml-1.5 text-[11px] font-normal">(1 unread)</span>}
          </p>
          {receipt && <span className="text-play-600 text-[11px] font-semibold">Mark all as read</span>}
        </div>
      </div>

      <div data-demo-target="notif-list" className="space-y-2">
        {receipt && (
          <NotificationCard
            id="notif-receipt"
            unread
            title={RECEIPT_TITLE}
            message={RECEIPT_MSG}
            when={`${TODAY.slice(0, 6)}, 2:40 PM`}
          />
        )}
        {NAGS.map((n) => (
          <NotificationCard
            key={n.id}
            id={n.id}
            title={LATE_TITLE}
            message={lateMsg(n.days)}
            when={n.when}
          />
        ))}
      </div>
    </div>
  )
}

function NotificationCard({
  id,
  title,
  message,
  when,
  unread,
}: {
  id?: string
  title: string
  message: string
  when: string
  unread?: boolean
}) {
  return (
    <div
      data-demo-target={id}
      className={cn(
        "shadow-soft rounded-2xl border bg-white p-2.5 transition",
        unread ? "border-play-200 bg-play-50/30 live-pop" : "border-ink-100"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className={cn("text-[13px] font-semibold", unread ? "text-ink-900" : "text-ink-700")}>
              {title}
            </p>
            {unread && <span className="bg-play-500 h-2 w-2 rounded-full" />}
          </div>
          <p className="text-ink-600 mt-0.5 text-[12px] leading-snug">{message}</p>
          <p className="text-ink-400 mt-0.5 text-[10px]">{when}</p>
        </div>
        <span className="text-ink-300 ml-2 text-[12px] leading-none">✕</span>
      </div>
    </div>
  )
}

/** The OS mail app, carrying the route's own HTML (R8: chrome, not product UI). */
function MailView() {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-ink-100 flex shrink-0 items-center gap-2 border-b px-3 py-2">
        <span className="text-[#2f7cf6] text-[13px] font-semibold">‹ Inbox</span>
        <span className="text-ink-400 ml-auto text-[11px]">{TODAY.slice(0, 6)}</span>
      </div>
      <div className="border-ink-100 flex shrink-0 items-start gap-2.5 border-b px-3 py-2.5">
        <AppIcon className="h-9 w-9 shrink-0 rounded-[10px]" />
        <div className="min-w-0">
          <p className="text-ink-950 text-[13px] font-bold">SportsHub One</p>
          <p className="text-ink-500 text-[11px]">no-reply@sportshubone.com</p>
          <p className="text-ink-500 text-[11px]">to {FAMILY}</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-3 py-2.5">
        <p className="text-ink-950 text-[14px] font-bold leading-snug">{LATE_SUBJECT}</p>
        <div
          data-demo-target="mail-body"
          className="mt-2 space-y-2 font-[Arial,sans-serif] text-[12.5px] leading-relaxed text-black"
        >
          <p>{lateMsg(LATE_DAYS)}</p>
          <p>
            Please settle it (or update your card if a charge failed):{" "}
            <span className="text-[#2f7cf6] underline">My payments</span>. Already paid the club
            directly? They&apos;ll record it and this reminder stops.
          </p>
        </div>
      </div>
    </div>
  )
}

/** An iOS-style push dropping from the top of the handset (R8). */
function PushBanner() {
  return (
    <div className="demo-banner-in absolute left-1.5 right-1.5 top-1.5 z-30">
      <div className="rounded-[18px] border border-black/5 bg-white/95 p-2.5 shadow-[0_10px_30px_rgba(11,22,40,0.28)] backdrop-blur">
        <div className="flex items-start gap-2.5">
          <AppIcon className="h-9 w-9 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-ink-400 text-[10px] font-semibold uppercase tracking-[0.06em]">
                SportsHub One
              </p>
              <p className="text-ink-400 text-[10px]">now</p>
            </div>
            <p className="text-ink-950 text-[13px] font-semibold leading-tight">{RECEIPT_TITLE}</p>
            <p className="text-ink-600 line-clamp-2 text-[12px] leading-snug">{RECEIPT_MSG}</p>
          </div>
        </div>
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
          Twenty three thousand collected and three and a half thousand outstanding, worked out from
          the obligations rather than a spreadsheet. One family&apos;s row opened underneath itself
          with the cash and the e-transfer that really paid half of it, the reminders her phone got
          on the schedule the code keeps, and the rest taken at the gym, recorded with a note, and
          receipted to her before anybody could write a message.
        </p>
        <p className="mt-5 text-[15px] font-semibold text-white/50">Next: everyone in the loop</p>
      </div>
    </div>
  )
}
