"use client"

import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import { Btn, Chip, StatusChip } from "../scene-kit"
import type { DemoBeat, DemoScript } from "../types"

/**
 * "Build a team, fill the roster" (roster story), rebuilt 2026-08-16 to the
 * gold standard set by `season-story.tsx`, `schedule-change-story.tsx`,
 * `waivers-story.tsx`, `game-day-story.tsx`, `team-drops-out-story.tsx` and
 * `the-referees-story.tsx`.
 *
 * THE THREE LAWS THIS CUT OBEYS:
 *
 *   1. PRESENTATION (audit D2). No browser chrome, no site header. Every
 *      surface is a focused working REGION composed at a logical size and
 *      rendered at scale 1.0, so 14px authored text reaches the viewer at
 *      14px. `scripts/demo/readability-audit.mjs` is the machine gate.
 *   2. PACING. Stop, explain, act, ONE VOICE. Every dwell is computed from
 *      the balloon's own word count; a beat carrying a balloon silences the
 *      caption bar.
 *   3. EVERY NUMBER DERIVED. The club, the team, the tryout, its fee, its
 *      venue, its five signups, the family, the player, his sizes, his jersey
 *      preferences, the pending offer and the roster that fills are read out
 *      of the local seeded database, and every one is written down with its
 *      source in `docs/roadmap/roster-story-numbers.md`.
 *
 * TWO HANDSETS, NO DESKTOP (audit D, the phone-first chart). The owner ruled
 * team creation, tryout posting and offer SEND onto the phone with fabrication
 * allowed, and the parent's half is not a fabrication at all: `/tryouts/[id]`
 * and `/offers` are responsive pages a guardian reaches from the app's own
 * mobile bottom bar (`components/nav/bottom-tabs.tsx`: Home, Chat, Calendar,
 * My Kids, Social). So the stage is the LEFT handset (the club) and the RIGHT
 * one (Jordan Reyes), and every club screen composed at 390 is declared as a
 * phone composition in section H of the numbers sheet.
 *
 * THE SPINE IS A REAL PENDING OFFER. `DB` offer bb219828 is live in this
 * database right now: PENDING, to Darius Reyes, on `Toronto Lords Grade 10
 * (Fall/Winter 2026-27)`, a team with zero players on it, carrying the seeded
 * message and a ten day expiry. The club is genuinely mid-build of a fall
 * roster in this world, which is exactly the story.
 *
 * TRUTH TO THE PRODUCT, SCREEN BY SCREEN:
 *   · team creation is `clubs/[id]/teams/create/page.tsx`, including the rule
 *     that nobody types a team name: age group plus a picked suffix, and the
 *     product writes the name from the club's SHORT name;
 *   · the tryout is `clubs/[id]/tryouts/create/page.tsx`, down to the draft
 *     note and the two buttons;
 *   · the family's registration is `components/registration/program-signup-form.tsx`,
 *     down to "Who's playing?", the eligibility chips and the offline payment
 *     sentence this club really renders;
 *   · the packages are `components/offers/offer-composer.tsx`, including the
 *     real `Auto: 25% + 3 monthly` control and its balance check line;
 *   · the send is `bulk-offer-button.tsx` and `POST /api/offers/bulk`;
 *   · the accept is `app/(platform)/offers/offer-response-form.tsx`, field for
 *     field and label for label;
 *   · the roster is `clubs/[id]/teams/[teamId]/roster/page.tsx`.
 *
 * THREE THINGS THE PRODUCT CANNOT HONESTLY SHOW, AND THEY ARE DECLARED
 * (numbers sheet section F, not hidden here):
 *   1. NO SEEDED CLUB CAN TAKE ONLINE MONEY. There is exactly one
 *      `PaymentConfig` row in this database, on a different tenant, with
 *      `stripeAccountStatus: "pending"`, and the platform default online mode
 *      is NONE. The payment step of the accept form is gated on `online`, so
 *      today every seeded club would render the OFFLINE sentence instead. The
 *      demo films the online branch because that is the code path a club takes
 *      the day it finishes Connect onboarding, and says so.
 *   2. THERE ARE ZERO `OfferOption` AND ZERO `OfferInstallmentTerm` ROWS in
 *      this database. The 227 accepted offers are single-package legacy rows.
 *      The plan on screen is therefore computed by the product's own arithmetic
 *      rather than read off a row.
 *   3. `computeDefaultPlan` IN `lib/payments/installments.ts` HAS NO
 *      PRODUCTION CALLER. The shipping path is `autofillPlan` in
 *      `offer-composer.tsx`, which is the identical arithmetic reimplemented
 *      client side. Both were run for this cut and agree to the cent.
 */

/* ── Cast, all read out of the seeded world ──────────────────────────────── */

/** `DB` Tenant dcd497e7, name "Toronto Lords", shortName "Lords", Toronto. */
const CLUB = "Toronto Lords"
const SHORT = "Lords"

/**
 * `DB` Team d430fbd8 is real and empty: "Toronto Lords Grade 10 (Fall/Winter
 * 2026-27)", MALE, zero players. `PRODUCT` the create screen composes a name
 * from the club's SHORT name and cannot emit parentheses, so the name the
 * shipping picker writes for that same team is this one.
 */
const TEAM = `${SHORT} Grade 10 Fall/Winter 2026-27`
const SUFFIX = "Fall/Winter 2026-27"
const AGE = "Grade 10"

/** `DB` the club already fields "Toronto Lords Grade 10", which is why a
 *  suffix is required at all. `PRODUCT` the helper sentence, verbatim. */
const SUFFIX_HINT = "Only needed when you field more than one team in the same age group."

/** `DB` Tryout 1689307c on this club. The row stores an em-dash in its title;
 *  the house copy rule renders the middot. */
const TRYOUT = `${CLUB} Fall Tryouts · Grade 9 & 10`
const TRYOUT_DAY = "Thu, Aug 20"
const TRYOUT_TIME = "6:30 – 8:30 PM"
/** `DB` Venue c805d634. */
const VENUE = "The Playground"
const VENUE_CITY = "Burlington"
/** `DB` Tryout.fee, and the owner's tryout tier. */
const TRYOUT_FEE = 25
/** `DB` Tryout.maxParticipants. */
const CAP = 30

/** `DB` five `TryoutSignup` rows on that tryout, every one PENDING. */
const SIGNUPS = [
  { player: "Darius Reyes", parent: "Jordan Reyes" },
  { player: "Ibrahim White", parent: "Carlos Diallo" },
  { player: "Isaiah Clarke", parent: "Robin Osei" },
  { player: "Daniel Grant", parent: "Nadia Kim" },
  { player: "Isaiah Boateng", parent: "Mark Young" },
]

/** `DB` User 2a6333d5, summer-parent-lords@sportshub.demo. */
const PARENT = "Jordan Reyes"
/** `DB` Player a18c732d, born 2011-12-20, and `DB` TryoutSignup.playerAge. */
const PLAYER = "Darius Reyes"
const PLAYER_AGE = 15
/** `DB` Player 729b0d07, the sister, on Toronto Lords Grade 10 Girls. */
const SISTER = "Danielle Reyes"

/**
 * The rep season fee. `OWNER` the 2026-08-16 ruling puts a rep season in the
 * $3,000 to $5,000 band; `DB` the live pending offer carries a seeded $1,250
 * and the club's three saved templates are its SUMMER prices ($795, $895,
 * $1,495). Nothing was written to the database: the demo raises the number to
 * the ruled band on screen and says so in the numbers sheet.
 */
const FEE = 3600
/** `PRODUCT` `autofillPlan(3600)` and `computeDefaultPlan(3600)` both return
 *  a $900 deposit and three $900 installments. Both were run for this cut. */
const DEPOSIT = 900
const PER = 900
const TERMS = [
  { label: "Installment 1", amount: PER, due: "Sep 1" },
  { label: "Installment 2", amount: PER, due: "Oct 1" },
  { label: "Installment 3", amount: PER, due: "Nov 1" },
]

/** `DB` Offer bb219828's own message. The row stores an em-dash. */
const OFFER_MESSAGE =
  "Darius had a strong summer · we'd love to have him back for the fall/winter season."
/** `DB` the same row says ten days, and `PRODUCT` 10 is one of the real
 *  expiry chips (3, 5, 7, 10, 14). */
const EXPIRES_DAYS = 10

/**
 * `DB` Darius's accepted summer offer 6a179f47 recorded exactly these. The
 * fall accept collects them again, and the demo reuses his real answers
 * rather than inventing a growth spurt.
 */
const UNIFORM = "YL"
const TRACKSUIT = "AM"
const SHOE = "9"
const PREFS = [37, 1, 7]

/**
 * The roster that fills. `DB` the ten players on Toronto Lords Grade 9 with
 * their real jersey numbers: this is the group that moves up to Grade 10 for
 * the fall, and five of them are the tryout signups above.
 */
const ROSTER = [
  { name: "Daniel Grant", num: 4 },
  { name: "Ethan Lee", num: 15 },
  { name: "Cameron Baptiste", num: 17 },
  { name: "Isaiah Clarke", num: 18 },
  { name: "Zion Nguyen", num: 21 },
  { name: "Ibrahim White", num: 28 },
  { name: "Isaiah Boateng", num: 29 },
  { name: "Darius Reyes", num: 37 },
  { name: "Cole Campbell", num: 34 },
  { name: "Owen Lee", num: 38 },
]
const ROSTER_SHOWN = 5

/**
 * `DB` HouseLeague 7d5b9a63 on this club: "Lords Saturday House League",
 * eight Saturdays, $220, The Playground, 10:00 to 12:00, U8 to U12, jersey
 * and medal included. The audit's "~$500 house" tier is NOT what this world
 * holds, and the demo shows the number the database has.
 */
const HOUSE_FEE = 220

/** `PRODUCT` `program-signup-form.tsx` line 464, the offline branch this club
 *  really renders, with `methodsText(["CASH","ETRANSFER"])`. */
const OFFLINE_LINE =
  "This organizer accepts cash, e-Transfer · pay them directly after registering. Offline payments are arranged directly with the organizer, the platform can't refund them."

const money = (n: number) => `$${n.toLocaleString("en-CA")}`

/* ── Pacing ──────────────────────────────────────────────────────────────── */

function paced(b: Omit<DemoBeat, "hold"> & { hold?: number }): DemoBeat {
  if (b.hold) return b as DemoBeat
  const arrive = b.cursor ? 620 : 220
  const settle = 500
  const read = b.callout ? b.callout.trim().split(/\s+/).length * 180 + 900 : 2400
  return { ...b, hold: Math.round(arrive + read + (b.callout ? settle : 0)) }
}

/* ── The script ──────────────────────────────────────────────────────────── */

export const rosterStory: DemoScript = {
  presentation: "scene",
  scenePhones: true,
  desktopUrl: "/clubs/toronto-lords/teams",
  initialStage: "desktop",
  chapters: [
    { id: "team", title: "Build the team" },
    { id: "tryout", title: "Post the tryout" },
    { id: "family", title: "A family signs up" },
    { id: "offer", title: "The offer, accepted" },
    { id: "roster", title: "The roster fills" },
  ],

  beats: [
    /* ── 1. Build the team ────────────────────────────────────────────── */
    paced({
      id: "open",
      chapter: "team",
      caption: "The club's team list. The fall shelf is empty.",
      emphasize: "club-teams",
      callout: "Teams sit under the season they play in, so the summer ones stay put.",
    }),
    paced({
      id: "new",
      chapter: "team",
      caption: "Create team.",
      cursor: "new-team",
      press: true,
      set: { view: "create" },
    }),
    paced({
      id: "age",
      chapter: "team",
      caption: "Pick the age group.",
      cursor: "age-field",
      press: true,
      set: { age: true },
      callout: "Grade 10, because this summer's Grade 9 group moves up together.",
    }),
    paced({
      id: "suffix",
      chapter: "team",
      caption: "The club already fields a Grade 10, so this one takes a suffix.",
      cursor: "suffix-field",
      type: { key: "suffixTyped", text: SUFFIX },
      set: { suffix: true },
      callout: "The suffix is the only part of the name anybody types.",
    }),
    paced({
      id: "name",
      chapter: "team",
      caption: "The name is written from the club's short name.",
      emphasize: "name-preview",
      callout: "The product writes it, so one team is never spelled two ways.",
    }),
    paced({
      id: "staff",
      chapter: "team",
      caption: "A coach goes on with the team.",
      cursor: "staff-field",
      press: true,
      set: { staff: true },
      callout: "Or an email invite, and the role lands when it is accepted.",
    }),
    paced({
      id: "create",
      chapter: "team",
      caption: "The team is created.",
      cursor: "create-btn",
      press: true,
      toast: `Team created · ${TEAM}`,
      set: { view: "created" },
      callout: "Now there is something for a tryout to hang off.",
    }),

    /* ── 2. Post the tryout ───────────────────────────────────────────── */
    paced({
      id: "tryout-open",
      chapter: "tryout",
      caption: "A tryout for that team.",
      set: { view: "tryout" },
      emphasize: "tryout-form",
      callout: "The tryout is attached to the team, so its signups land there.",
    }),
    paced({
      id: "tryout-where",
      chapter: "tryout",
      caption: "The gym comes from the club's venues.",
      cursor: "venue-field",
      press: true,
      set: { venue: true },
      callout: "The address travels with the venue, so nobody retypes it.",
    }),
    paced({
      id: "tryout-when",
      chapter: "tryout",
      caption: "Thursday evening, two hours on the floor.",
      cursor: "when-field",
      press: true,
      set: { when: true },
      callout: "The end time comes from the duration rather than a second picker.",
    }),
    paced({
      id: "tryout-fee",
      chapter: "tryout",
      caption: `${money(TRYOUT_FEE)} to walk in, and ${CAP} places.`,
      cursor: "fee-field",
      type: { key: "feeTyped", text: `${TRYOUT_FEE}` },
      set: { fee: true },
      callout: "The cap is on the tryout, so signups stop at thirty without anybody watching.",
    }),
    paced({
      id: "tryout-publish",
      chapter: "tryout",
      caption: "Created and published in the same sitting.",
      cursor: "publish-btn",
      press: true,
      toast: "Tryout created and published",
      set: { view: "tryout-live" },
      callout: "Published means families outside the club can find it too.",
    }),

    /* ── 3. A family signs up ─────────────────────────────────────────── */
    paced({
      id: "phone-in",
      chapter: "family",
      caption: `${PARENT} opens the listing on her phone. She has two children at this club.`,
      stage: "split",
      set: { phone: "tryout" },
      emphasize: "p-tryout",
      callout: "Nothing was sent to her. The tryout is published, so she found it.",
    }),
    paced({
      id: "who",
      chapter: "family",
      caption: "The form asks who is playing.",
      emphasize: "who-list",
      callout: "Her children are already on the account, so she picks instead of typing.",
    }),
    paced({
      id: "eligible",
      chapter: "family",
      caption: "She picks Darius.",
      cursor: "kid-darius",
      press: true,
      set: { picked: true },
      callout: `${SISTER.split(" ")[0]} is flagged outside the age group rather than quietly accepted.`,
    }),
    paced({
      id: "register",
      chapter: "family",
      caption: "She registers him, with the fee written on the button.",
      cursor: "register-btn",
      press: true,
      set: { registered: true, phone: "registered" },
    }),
    paced({
      id: "offline",
      chapter: "family",
      caption: "This club takes the fee in person.",
      emphasize: "offline-line",
      callout: "Card payments are off for this club, so the product says how to pay instead.",
    }),

    /* ── 4. The offer, accepted ───────────────────────────────────────── */
    paced({
      id: "signups",
      chapter: "offer",
      caption: "Tryout night is over. Five players signed up.",
      stage: "desktop",
      set: { view: "signups", phone: "idle" },
      emphasize: "signup-list",
      callout: "Each signup carries the guardian who made it, which is who the offer goes to.",
    }),
    paced({
      id: "bulk",
      chapter: "offer",
      caption: "The offers are composed together.",
      cursor: "bulk-btn",
      press: true,
      set: { view: "compose" },
      callout: "One composition, five separate offers, each one answered on its own.",
    }),
    paced({
      id: "package",
      chapter: "offer",
      caption: `The season fee, ${money(FEE)}, and the kit that comes with it.`,
      cursor: "fee-input",
      type: { key: "repFeeTyped", text: "3600" },
      set: { repFee: true },
      callout: "The kit rides on the offer, so the family can see what the fee covers.",
    }),
    paced({
      id: "auto",
      chapter: "offer",
      caption: "One control writes the payment plan.",
      cursor: "auto-plan",
      press: true,
      set: { plan: true },
      callout: "The dates are the first of the next three months, worked out from the fee.",
    }),
    paced({
      id: "send",
      chapter: "offer",
      caption: `Sent, with ${EXPIRES_DAYS} days to answer.`,
      cursor: "send-btn",
      press: true,
      toast: `5 offers sent · expire in ${EXPIRES_DAYS} days`,
      set: { view: "sent" },
      callout: "When an offer expires the place comes back to the club by itself.",
    }),
    paced({
      id: "arrive",
      chapter: "offer",
      caption: `It lands on ${PARENT}'s phone as one screen.`,
      stage: "split",
      set: { phone: "offer" },
      emphasize: "offer-card",
      callout: "Offers have their own page in the app rather than living in a message thread.",
    }),
    paced({
      id: "sizes",
      chapter: "offer",
      caption: "Accepting collects the sizes.",
      cursor: "size-uniform",
      press: true,
      set: { sizes: true },
      callout: "The club's kit order comes from these three fields.",
    }),
    paced({
      id: "jersey",
      chapter: "offer",
      caption: "Three jersey numbers, in order.",
      cursor: "pref-1",
      press: true,
      set: { prefs: true },
      callout: "Three choices let the club settle a clash without asking again.",
    }),
    paced({
      id: "plan",
      chapter: "offer",
      caption: "The plan is on her screen before she agrees to it.",
      set: { phone: "offer-plan" },
      emphasize: "plan-card",
      callout: "The three later charges are booked now and run on their own dates.",
    }),
    paced({
      id: "accept",
      chapter: "offer",
      caption: "Accepted.",
      cursor: "accept-btn",
      press: true,
      set: { accepted: true, phone: "accepted" },
      callout: "One press pays the deposit, books the three charges and adds him to the roster.",
    }),

    /* ── 5. The roster fills ──────────────────────────────────────────── */
    paced({
      id: "roster",
      chapter: "roster",
      caption:
        "The roster, filled. Every line arrived from a family accepting their own offer.",
      stage: "desktop",
      set: { view: "roster", phone: "idle" },
      emphasize: "roster-list",
    }),
    paced({
      id: "roster-sizes",
      chapter: "roster",
      caption: "The sizes are already on it.",
      emphasize: "row-darius",
      callout: "Nobody typed them here. They came off each accept form.",
    }),
    paced({
      id: "roster-status",
      chapter: "roster",
      caption: "Two chips a manager chases all season.",
      emphasize: "row-status",
      callout: "Finalized means the jersey number is settled, not that the fee is paid.",
    }),
    paced({
      id: "house",
      chapter: "roster",
      caption: "The same club runs a house league at the other end of the age range.",
      set: { view: "programs" },
      emphasize: "house-card",
      callout: "Rep and house sit on the same books, so the club counts its money once.",
    }),
    paced({
      id: "end",
      chapter: "roster",
      caption:
        "A team created, a tryout posted and filled, five offers composed once, and a roster that arrived with the sizes on it.",
      hold: 4400,
      set: { endCard: true },
    }),
  ],

  /* ── Render ────────────────────────────────────────────────────────── */

  render: ({ get, typingKey }) => {
    const view = get<string>("view", "teams")

    const club = (
      <div className="relative flex h-full flex-col">
        <ClubPhone
          view={view}
          age={get("age", false)}
          suffix={get("suffix", false)}
          suffixTyped={get<string>("suffixTyped", "")}
          typingSuffix={typingKey === "suffixTyped"}
          staff={get("staff", false)}
          venue={get("venue", false)}
          when={get("when", false)}
          fee={get("fee", false)}
          feeTyped={get<string>("feeTyped", "")}
          typingFee={typingKey === "feeTyped"}
          repFee={get("repFee", false)}
          repFeeTyped={get<string>("repFeeTyped", "")}
          typingRepFee={typingKey === "repFeeTyped"}
          plan={get("plan", false)}
          accepted={get("accepted", false)}
        />
        {get("endCard", false) && <EndCard />}
      </div>
    )

    const phone = (
      <ParentPhone
        view={get<string>("phone", "idle")}
        picked={get("picked", false)}
        sizes={get("sizes", false)}
        prefs={get("prefs", false)}
        accepted={get("accepted", false)}
      />
    )

    return {
      desktop: club,
      phone,
      frameLabels: { left: `${CLUB} · club`, right: `${PARENT} · parent` },
    }
  },
}

/* ── The club's phone ────────────────────────────────────────────────────── */

/**
 * Every screen in this handset is a PHONE COMPOSITION of a screen the product
 * ships wide today (`/clubs/[id]/teams`, `/clubs/[id]/teams/create`,
 * `/clubs/[id]/tryouts/create`, the tryout signups page with its bulk offer
 * modal, and `/clubs/[id]/teams/[teamId]/roster`). The owner authorized
 * exactly that in the 2026-08-16 phone-first chart; each one is listed in
 * section H of `roster-story-numbers.md` with the fields it keeps and drops.
 */
function ClubPhone({
  view,
  age,
  suffix,
  suffixTyped,
  typingSuffix,
  staff,
  venue,
  when,
  fee,
  feeTyped,
  typingFee,
  repFee,
  repFeeTyped,
  typingRepFee,
  plan,
  accepted,
}: {
  view: string
  age: boolean
  suffix: boolean
  suffixTyped: string
  typingSuffix: boolean
  staff: boolean
  venue: boolean
  when: boolean
  fee: boolean
  feeTyped: string
  typingFee: boolean
  repFee: boolean
  repFeeTyped: string
  typingRepFee: boolean
  plan: boolean
  accepted: boolean
}) {
  return (
    <div className="flex h-full flex-col bg-[#f6f7f9]">
      <div className="flex items-baseline gap-2 bg-[#0b1628] px-4 pb-2.5 pt-2 text-white">
        <p className="text-[15px] font-bold leading-tight">{CLUB}</p>
        <p className="text-[14px] font-medium text-white/60">Club workspace</p>
      </div>

      <div key={view} className="demo-fade-in min-h-0 flex-1 overflow-hidden px-3 py-2.5">
        {view === "teams" && <TeamsList />}
        {(view === "create" || view === "created") && (
          <CreateTeam
            age={age}
            suffix={suffix}
            suffixTyped={suffixTyped}
            typingSuffix={typingSuffix}
            staff={staff}
            created={view === "created"}
          />
        )}
        {(view === "tryout" || view === "tryout-live") && (
          <CreateTryout
            venue={venue}
            when={when}
            fee={fee}
            feeTyped={feeTyped}
            typingFee={typingFee}
            live={view === "tryout-live"}
          />
        )}
        {view === "signups" && <SignupList />}
        {(view === "compose" || view === "sent") && (
          <Compose
            repFee={repFee}
            repFeeTyped={repFeeTyped}
            typingRepFee={typingRepFee}
            plan={plan}
            sent={view === "sent"}
          />
        )}
        {view === "roster" && <RosterBoard accepted={accepted} />}
        {view === "programs" && <Programs />}
      </div>

      <TabBar tabs={["Home", "Chat", "Calendar", "My Club", "Social"]} active="My Club" />
    </div>
  )
}

/** `/clubs/[id]/teams`. */
function TeamsList() {
  return (
    <div data-demo-target="club-teams" className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-ink-900 text-[17px] font-extrabold">Teams</p>
        <span>
          <Btn id="new-team" size="sm">
            Create team
          </Btn>
        </span>
      </div>
      <p className="text-ink-400 text-[14px] font-bold uppercase tracking-[0.1em]">Summer 2026</p>
      {["Toronto Lords Grade 9", "Toronto Lords Grade 10", "Toronto Lords Grade 10 Girls"].map(
        (t) => (
          <div
            key={t}
            className="border-ink-200 flex items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2"
          >
            <span className="text-ink-900 min-w-0 truncate text-[15px] font-bold">{t}</span>
            <Chip tone="neutral">10 players</Chip>
          </div>
        )
      )}
      <p className="text-ink-400 pt-1 text-[14px] font-bold uppercase tracking-[0.1em]">
        Fall/Winter 2026-27
      </p>
      <div className="border-ink-200 rounded-2xl border border-dashed bg-white px-4 py-5 text-center">
        <p className="text-ink-900 text-[15px] font-bold">No teams yet</p>
        <p className="text-ink-500 mt-1 text-[14px] font-medium leading-snug">
          Create your first team to start managing players and scheduling games.
        </p>
      </div>
    </div>
  )
}

/** `/clubs/[id]/teams/create`. */
function CreateTeam({
  age,
  suffix,
  suffixTyped,
  typingSuffix,
  staff,
  created,
}: {
  age: boolean
  suffix: boolean
  suffixTyped: string
  typingSuffix: boolean
  staff: boolean
  created: boolean
}) {
  const name = age ? [SHORT, AGE, suffix ? suffixTyped : ""].filter(Boolean).join(" ") : ""
  return (
    <div className={created ? "space-y-1" : "space-y-1.5"}>
      <p className="text-ink-900 text-[17px] font-extrabold">Create New Team</p>
      {!created && (
        <p className="text-ink-500 text-[14px] font-medium leading-snug">
          Add a team to your club and assign coaching staff
        </p>
      )}

      <Field label="Age Group">
        <Picker id="age-field" filled={age}>
          {age ? AGE : "Select age group…"}
        </Picker>
      </Field>

      <Field label="Suffix" hint={created ? undefined : SUFFIX_HINT}>
        <span
          data-demo-target="suffix-field"
          className={cn(
            "border-ink-300 block rounded-lg border bg-white px-3 py-1.5 text-[15px] font-semibold",
            suffix ? "text-ink-900" : "text-ink-400"
          )}
        >
          {suffix ? (
            <>
              {suffixTyped}
              {typingSuffix && (
                <span className="bg-play-600 ml-0.5 inline-block h-4 w-[2px] align-middle" />
              )}
            </>
          ) : (
            "Your own suffix, e.g. Elite, North, 2B"
          )}
        </span>
      </Field>

      <div
        data-demo-target="name-preview"
        className={cn(
          "rounded-xl border px-3 transition-colors duration-300 motion-reduce:transition-none",
          created ? "py-1" : "py-2",
          name ? "border-court-200 bg-court-50/70" : "border-ink-200 bg-white"
        )}
      >
        <p className="text-ink-500 text-[14px] font-bold uppercase tracking-[0.06em]">
          Team name (written for you)
        </p>
        <p className={cn("mt-0.5 text-[16px] font-extrabold", name ? "text-ink-900" : "text-ink-400")}>
          {name || "Pick an age group above"}
        </p>
      </div>

      <Field label="Staff Assignment">
        <Picker id="staff-field" filled={staff}>
          {staff ? "Marcus Bell · Head Coach" : "Add existing staff…"}
        </Picker>
      </Field>

      <div className="pt-0.5">
        {created ? (
          <div className="border-court-200 bg-court-50 live-pop rounded-xl border px-3 py-2">
            <p className="text-court-800 text-[15px] font-bold">Team Created!</p>
            <p className="text-court-700 mt-0.5 text-[14px] font-semibold leading-snug">
              {TEAM} ({AGE}) has been created. 1 staff member assigned.
            </p>
          </div>
        ) : (
          <Btn id="create-btn">Create Team</Btn>
        )}
      </div>
    </div>
  )
}

/** `/clubs/[id]/tryouts/create`. */
function CreateTryout({
  venue,
  when,
  fee,
  feeTyped,
  typingFee,
  live,
}: {
  venue: boolean
  when: boolean
  fee: boolean
  feeTyped: string
  typingFee: boolean
  live: boolean
}) {
  return (
    <div data-demo-target="tryout-form" className="space-y-1.5">
      <p className="text-ink-900 text-[17px] font-extrabold">Create Tryout</p>

      <Field label="Team">
        <Picker filled>{TEAM}</Picker>
      </Field>
      <Field label="Title">
        <Picker filled>{TRYOUT}</Picker>
      </Field>
      <Field label="Venue">
        <Picker id="venue-field" filled={venue}>
          {venue ? `${VENUE} · ${VENUE_CITY}` : "Search venues…"}
        </Picker>
      </Field>

      <div className="grid grid-cols-[1.5fr_1fr_1fr] gap-1.5">
        <Field label="Date and time">
          <Picker id="when-field" filled={when} small>
            {when ? `${TRYOUT_DAY} · ${TRYOUT_TIME}` : "Pick a date"}
          </Picker>
        </Field>
        <Field label="Fee ($)">
          <span
            data-demo-target="fee-field"
            className={cn(
              "border-ink-300 block rounded-lg border bg-white px-2 py-1.5 text-[15px] font-semibold tabular-nums",
              fee ? "text-ink-900" : "text-ink-400"
            )}
          >
            {fee ? (
              <>
                ${feeTyped}
                {typingFee && (
                  <span className="bg-play-600 ml-0.5 inline-block h-4 w-[2px] align-middle" />
                )}
              </>
            ) : (
              "0.00"
            )}
          </span>
        </Field>
        <Field label="Max">
          <Picker filled small>
            {CAP}
          </Picker>
        </Field>
      </div>

      {live ? (
        <div className="border-court-200 bg-court-50 live-pop rounded-xl border px-3 py-2">
          <p className="text-court-800 text-[15px] font-bold">Published to the marketplace</p>
          <p className="text-court-700 mt-0.5 text-[14px] font-semibold leading-snug">
            {TRYOUT_DAY} · {VENUE} · {money(TRYOUT_FEE)} · {CAP} spots
          </p>
        </div>
      ) : (
        <>
          <p className="text-ink-500 text-[14px] font-medium leading-snug">
            Tryouts are saved as drafts. You can publish them to the marketplace from the tryouts
            list.
          </p>
          <div className="flex gap-2">
            <Btn tone="quiet" size="sm">
              Save draft
            </Btn>
            <Btn id="publish-btn" size="sm">
              Create &amp; publish
            </Btn>
          </div>
        </>
      )}
    </div>
  )
}

/** The tryout's signups page, with the real bulk control on it. */
function SignupList() {
  return (
    <div className="space-y-2">
      <p className="text-ink-900 text-[17px] font-extrabold leading-tight">Tryout signups</p>
      <p className="text-ink-500 text-[14px] font-medium">
        {TRYOUT_DAY} · {VENUE}
      </p>
      <div data-demo-target="signup-list" className="space-y-1.5">
        {SIGNUPS.map((s) => (
          <div
            key={s.player}
            className="border-ink-200 flex items-center justify-between gap-2 rounded-xl border bg-white px-3 py-1.5"
          >
            <span className="min-w-0">
              <span className="text-ink-900 block truncate text-[15px] font-bold">{s.player}</span>
              <span className="text-ink-500 block truncate text-[14px] font-medium">
                {s.parent}
              </span>
            </span>
            <StatusChip tone="gold">PENDING</StatusChip>
          </div>
        ))}
      </div>
      <div className="pt-0.5">
        <Btn id="bulk-btn" size="sm">
          Send Offers ({SIGNUPS.length})
        </Btn>
      </div>
    </div>
  )
}

/** `bulk-offer-button.tsx` with `offer-composer.tsx` inside it. */
function Compose({
  repFee,
  repFeeTyped,
  typingRepFee,
  plan,
  sent,
}: {
  repFee: boolean
  repFeeTyped: string
  typingRepFee: boolean
  plan: boolean
  sent: boolean
}) {
  if (sent) {
    return (
      <div className="space-y-2">
        <div className="border-court-200 bg-court-50 live-pop rounded-2xl border px-3.5 py-3">
          <p className="text-court-800 text-[17px] font-extrabold">
            {SIGNUPS.length} offers sent
          </p>
          <p className="text-court-700 mt-1 text-[14px] font-semibold leading-snug">
            {TEAM} · {money(FEE)} · expire in {EXPIRES_DAYS} days
          </p>
        </div>
        <div className="space-y-1.5">
          {SIGNUPS.map((s) => (
            <div
              key={s.player}
              className="border-ink-200 live-row-in flex items-center justify-between gap-2 rounded-xl border bg-white px-3 py-1.5"
            >
              <span className="text-ink-900 truncate text-[15px] font-bold">{s.player}</span>
              <StatusChip tone="play">SENT</StatusChip>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-1">
      <p className="text-ink-900 text-[17px] font-extrabold leading-tight">Send Offers</p>
      <p className="text-ink-500 text-[14px] font-medium leading-snug">
        Compose the packages once; everyone you tick gets the same offer.
      </p>

      <div className="border-ink-200 rounded-xl border bg-white px-3 py-1">
        <div className="flex items-end gap-2">
          <Field label="Fee ($)" className="w-[104px] shrink-0">
            <span
              data-demo-target="fee-input"
              className={cn(
                "border-ink-300 block rounded-lg border bg-white px-2.5 py-1 text-[15px] font-semibold tabular-nums",
                repFee ? "text-ink-900" : "text-ink-400"
              )}
            >
              {repFee ? (
                <>
                  ${repFeeTyped}
                  {typingRepFee && (
                    <span className="bg-play-600 ml-0.5 inline-block h-4 w-[2px] align-middle" />
                  )}
                </>
              ) : (
                "0.00"
              )}
            </span>
          </Field>
          <Field label="Installments" className="min-w-0 flex-1">
            <Picker filled>4 installments</Picker>
          </Field>
        </div>
        <div className="mt-1 flex flex-nowrap gap-0.5">
          {["Uniform", "Tracksuit", "Shoes", "Basketball", "Bag"].map((i) => (
            <span
              key={i}
              className={cn(
                "shrink-0 rounded-full px-1 py-0.5 text-[14px] font-semibold",
                i === "Bag" ? "bg-ink-100 text-ink-500" : "bg-court-50 text-court-700"
              )}
            >
              {i === "Bag" ? i : `✓ ${i}`}
            </span>
          ))}
        </div>
      </div>

      <div className="border-ink-200 rounded-xl border bg-white px-3 py-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-ink-700 text-[14px] font-bold">Payment plan</span>
          <span
            data-demo-target="auto-plan"
            className={cn(
              "shrink-0 rounded-lg border px-2 py-0.5 text-[14px] font-bold",
              plan ? "border-play-500 text-play-700" : "border-ink-300 text-ink-600"
            )}
          >
            Auto: 25% + 3 monthly
          </span>
        </div>
        {plan && (
          <div className="live-pop mt-1 space-y-0.5">
            <PlanRow label="Deposit" amount={DEPOSIT} due="on accept" />
            {TERMS.map((t) => (
              <PlanRow key={t.label} label={t.label} amount={t.amount} due={t.due} />
            ))}
            <p className="text-court-700 pt-0.5 text-[14px] font-bold tabular-nums">
              Deposit {money(DEPOSIT)} + installments {money(PER * 3)} = {money(FEE)} ✓
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <span className="text-ink-500 text-[14px] font-semibold">
          {SIGNUPS.length} of {SIGNUPS.length} eligible selected
        </span>
        <Btn id="send-btn" size="sm">
          Send to {SIGNUPS.length} players
        </Btn>
      </div>
    </div>
  )
}

function PlanRow({ label, amount, due }: { label: string; amount: number; due: string }) {
  return (
    <div className="border-ink-100 flex items-center justify-between gap-2 rounded-lg border bg-white px-2.5 py-0">
      <span className="text-ink-800 text-[14px] font-semibold">{label}</span>
      <span className="text-ink-500 ml-auto text-[14px] font-medium">{due}</span>
      <span className="text-ink-900 text-[14px] font-bold tabular-nums">{money(amount)}</span>
    </div>
  )
}

/** `/clubs/[id]/teams/[teamId]/roster`, composed as cards. */
function RosterBoard({ accepted }: { accepted: boolean }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-ink-900 min-w-0 truncate text-[17px] font-extrabold">Roster</p>
        <Chip tone="court" strong>
          {ROSTER.length} of {ROSTER.length}
        </Chip>
      </div>
      <p className="text-ink-500 text-[14px] font-medium leading-tight">
        {TEAM} · {AGE} Boys
      </p>
      <div data-demo-target="roster-list" className="space-y-1">
        {ROSTER.slice(0, ROSTER_SHOWN).map((p, i) => {
          const mine = p.name === PLAYER
          return (
            <div
              key={p.name}
              data-demo-target={mine ? "row-darius" : undefined}
              className={cn(
                "border-ink-200 live-row-in rounded-xl border bg-white px-3 py-1",
                mine && accepted && "border-court-200 bg-court-50/60"
              )}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="flex items-center gap-2">
                <span className="bg-ink-900 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[14px] font-bold tabular-nums text-white">
                  {p.num}
                </span>
                <span className="text-ink-900 min-w-0 truncate text-[15px] font-bold">{p.name}</span>
                <span
                  data-demo-target={mine ? "row-status" : undefined}
                  className="ml-auto flex shrink-0 items-center gap-1"
                >
                  <StatusChip tone="court">Finalized</StatusChip>
                  <StatusChip tone="court">Signed</StatusChip>
                </span>
              </div>
              <p className="text-ink-500 text-[14px] font-medium leading-tight tabular-nums">
                Uniform {mine ? UNIFORM : "AM"} · Tracksuit {mine ? TRACKSUIT : "AM"} · Shoes{" "}
                {mine ? SHOE : "10"}
              </p>
            </div>
          )
        })}
      </div>
      <p className="text-ink-400 px-1 text-[14px] font-semibold">
        and {ROSTER.length - ROSTER_SHOWN} more, all finalised
      </p>
    </div>
  )
}

/** The club's other product, at the price the database actually holds. */
function Programs() {
  return (
    <div className="space-y-2">
      <p className="text-ink-900 text-[17px] font-extrabold">Programs</p>
      <div className="border-ink-200 rounded-2xl border bg-white px-3.5 py-2.5">
        <p className="text-ink-900 text-[15px] font-bold">{TEAM}</p>
        <p className="text-ink-500 mt-0.5 text-[14px] font-medium">
          Rep season · {money(FEE)} · deposit and three installments
        </p>
      </div>
      <div
        data-demo-target="house-card"
        className="border-court-200 bg-court-50/50 rounded-2xl border px-3.5 py-2.5"
      >
        <p className="text-ink-900 text-[15px] font-bold">Lords Saturday House League</p>
        <p className="text-ink-500 mt-0.5 text-[14px] font-medium leading-snug">
          Eight Saturdays · {VENUE} · 10:00 to 12:00 · U8 to U12
        </p>
        <p className="text-court-700 mt-1 text-[15px] font-extrabold tabular-nums">
          {money(HOUSE_FEE)}
          <span className="text-ink-500 ml-1.5 text-[14px] font-semibold">
            reversible jersey and a medal included
          </span>
        </p>
      </div>
      {/* The tryout is a priced product on the same books, and it is the one
          this story just posted. `DB` Tryout 1689307c. */}
      <div className="border-ink-200 rounded-2xl border bg-white px-3.5 py-2.5">
        <p className="text-ink-900 text-[15px] font-bold leading-snug">{TRYOUT}</p>
        <p className="text-ink-500 mt-0.5 text-[14px] font-medium leading-snug">
          {TRYOUT_DAY} · {VENUE} · {money(TRYOUT_FEE)} · {CAP} spots
        </p>
        <p className="text-ink-500 mt-1 text-[14px] font-semibold">
          {SIGNUPS.length} registered
        </p>
      </div>
    </div>
  )
}

/* ── The parent's phone ──────────────────────────────────────────────────── */

/**
 * Not a fabrication. `/tryouts/[id]` and `/offers` are responsive pages a
 * guardian reaches from the app's own mobile bottom bar, which is why the tab
 * strip below is the real parent bar: Home, Chat, Calendar, My Kids, Social
 * (`components/nav/bottom-tabs.tsx`, the `hasKids` context slot).
 */
function ParentPhone({
  view,
  picked,
  sizes,
  prefs,
  accepted,
}: {
  view: string
  picked: boolean
  sizes: boolean
  prefs: boolean
  accepted: boolean
}) {
  return (
    <div className="flex h-full flex-col bg-[#f6f7f9]">
      <div className="flex items-baseline gap-2 bg-[#0b1628] px-4 pb-2.5 pt-2 text-white">
        <p className="text-[15px] font-bold leading-tight">{PARENT}</p>
        <p className="text-[14px] font-medium text-white/60">Parent · two players</p>
      </div>

      <div key={view} className="demo-fade-in min-h-0 flex-1 overflow-hidden px-3 py-2.5">
        {(view === "tryout" || view === "registered") && (
          <TryoutSignup picked={picked} registered={view === "registered"} />
        )}
        {(view === "offer" || view === "offer-plan" || view === "accepted") && (
          <OfferAccept
            sizes={sizes}
            prefs={prefs}
            accepted={accepted}
            lower={view === "offer-plan"}
          />
        )}
      </div>

      <TabBar tabs={["Home", "Chat", "Calendar", "My Kids", "Social"]} active="Home" />
    </div>
  )
}

/** `/tryouts/[id]` with `program-signup-form.tsx` under it. */
function TryoutSignup({ picked, registered }: { picked: boolean; registered: boolean }) {
  if (registered) {
    return (
      <div className="space-y-2">
        <div className="border-court-200 bg-court-50 live-pop rounded-2xl border px-3.5 py-3">
          <p className="text-court-800 text-[17px] font-extrabold">Registered!</p>
          <p className="text-court-700 mt-1 text-[14px] font-semibold leading-snug">
            {PLAYER} is registered for {TRYOUT}.
          </p>
          <p className="text-court-700 mt-1 text-[15px] font-extrabold tabular-nums">
            {money(TRYOUT_FEE)} due
          </p>
        </div>
        <p
          data-demo-target="offline-line"
          className="border-ink-200 text-ink-600 rounded-xl border bg-white px-3 py-2 text-[14px] font-medium leading-snug"
        >
          {OFFLINE_LINE}
        </p>
      </div>
    )
  }
  return (
    <div data-demo-target="p-tryout" className="space-y-2">
      <p className="text-ink-900 text-[17px] font-extrabold leading-tight">{TRYOUT}</p>
      <div className="border-ink-200 flex items-center justify-between gap-2 rounded-xl border bg-white px-3 py-1.5">
        <span className="min-w-0">
          <span className="text-ink-900 block text-[15px] font-bold">
            {TRYOUT_DAY} · {TRYOUT_TIME}
          </span>
          <span className="text-ink-500 block truncate text-[14px] font-medium">
            {VENUE} · {VENUE_CITY}
          </span>
        </span>
        <span className="text-ink-900 shrink-0 text-[17px] font-extrabold tabular-nums">
          {money(TRYOUT_FEE)}
        </span>
      </div>

      <p className="text-ink-900 text-[15px] font-bold">Who&apos;s playing?</p>
      <div data-demo-target="who-list" className="space-y-1.5">
        <div
          data-demo-target="kid-darius"
          className={cn(
            "flex items-center gap-2 rounded-xl border px-3 py-1.5 transition-colors duration-300 motion-reduce:transition-none",
            picked ? "border-court-300 bg-court-50" : "border-ink-200 bg-white"
          )}
        >
          <span
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[14px] font-black",
              picked ? "border-court-600 bg-court-600 text-white" : "border-ink-300 text-transparent"
            )}
            aria-hidden="true"
          >
            ✓
          </span>
          <span className="min-w-0">
            <span className="text-ink-900 block text-[15px] font-bold">{PLAYER}</span>
            <span className="text-ink-500 block text-[14px] font-medium">
              b. 2011 · {PLAYER_AGE}
            </span>
          </span>
        </div>
        <div className="border-ink-200 flex items-center gap-2 rounded-xl border bg-white px-3 py-1.5">
          <span
            className="border-ink-300 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border"
            aria-hidden="true"
          />
          <span className="min-w-0">
            <span className="text-ink-900 block text-[15px] font-bold">{SISTER}</span>
            <span className="text-gold-600 block text-[14px] font-semibold">
              Outside age group
            </span>
          </span>
        </div>
      </div>

      <div className="pt-0.5">
        <Btn id="register-btn">Register · {money(TRYOUT_FEE)}.00</Btn>
      </div>
      <p className="text-ink-500 text-[14px] font-medium leading-snug">{OFFLINE_LINE}</p>
    </div>
  )
}

/**
 * `/offers` with `offer-response-form.tsx` under it.
 *
 * The real form is longer than a handset, so a guardian scrolls it. The scene
 * cannot scroll, so the form is composed as its two halves: the offer with the
 * sizes and numbers on it, then the plan and the accept button under them, with
 * a one-line summary of what she already answered. Declared in section H of the
 * numbers sheet.
 */
function OfferAccept({
  sizes,
  prefs,
  accepted,
  lower,
}: {
  sizes: boolean
  prefs: boolean
  accepted: boolean
  lower?: boolean
}) {
  if (accepted) {
    return (
      <div className="space-y-2">
        <div className="border-court-200 bg-court-50 live-pop rounded-2xl border px-3.5 py-3">
          <p className="text-court-800 text-[17px] font-extrabold">On the roster</p>
          <p className="text-court-700 mt-1 text-[14px] font-semibold leading-snug">
            {PLAYER} · {TEAM} · number {PREFS[0]}
          </p>
        </div>
        <div className="border-ink-200 rounded-2xl border bg-white px-3.5 py-2.5">
          <p className="text-ink-500 text-[14px] font-bold uppercase tracking-[0.06em]">
            Payment plan
          </p>
          <div className="mt-1 space-y-1">
            <div className="border-court-100 bg-court-50/60 flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1">
              <span className="text-ink-800 text-[14px] font-semibold">Deposit</span>
              <span className="text-ink-500 ml-auto text-[14px] font-medium">Paid at signup</span>
              <span className="text-ink-900 text-[14px] font-bold tabular-nums">
                {money(DEPOSIT)}
              </span>
            </div>
            {TERMS.map((t) => (
              <div
                key={t.label}
                className="border-ink-100 flex items-center justify-between gap-2 rounded-lg border bg-white px-2.5 py-1"
              >
                <span className="text-ink-800 text-[14px] font-semibold">{t.label}</span>
                <span className="text-ink-500 ml-auto text-[14px] font-medium">
                  {t.due}, 2026
                </span>
                <span className="text-ink-900 text-[14px] font-bold tabular-nums">
                  {money(t.amount)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-ink-500 mt-1.5 text-[14px] font-medium leading-snug">
            Scheduled payments charge automatically to your default card. Update it any time under
            Manage cards.
          </p>
        </div>
      </div>
    )
  }
  if (lower) {
    return (
      <div className="space-y-2">
        <p className="text-ink-900 text-[17px] font-extrabold">Accept Offer</p>
        <div className="border-ink-200 rounded-xl border bg-white px-3 py-1.5">
          <p className="text-ink-900 text-[15px] font-bold leading-snug">
            {TEAM} <span className="text-court-700">{money(FEE)}</span>
          </p>
          <p className="text-ink-500 mt-0.5 text-[14px] font-medium tabular-nums">
            Uniform {UNIFORM} · Tracksuit {TRACKSUIT} · Shoes {SHOE} · #{PREFS[0]}, #{PREFS[1]}, #
            {PREFS[2]}
          </p>
        </div>

        <div
          data-demo-target="plan-card"
          className="border-play-500 rounded-xl border bg-white px-3 py-2"
        >
          <p className="text-ink-900 text-[15px] font-bold">Payment plan</p>
          <div className="mt-1.5 space-y-1">
            <div className="border-play-200 bg-play-50/60 flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1">
              <span className="text-ink-800 text-[14px] font-semibold">Deposit</span>
              <span className="text-ink-500 ml-auto text-[14px] font-medium">due now</span>
              <span className="text-ink-900 text-[14px] font-bold tabular-nums">
                {money(DEPOSIT)}
              </span>
            </div>
            {TERMS.map((t) => (
              <div
                key={t.label}
                className="border-ink-100 flex items-center justify-between gap-2 rounded-lg border bg-white px-2.5 py-1"
              >
                <span className="text-ink-800 text-[14px] font-semibold">{t.label}</span>
                <span className="text-ink-500 ml-auto text-[14px] font-medium">{t.due}, 2026</span>
                <span className="text-ink-900 text-[14px] font-bold tabular-nums">
                  {money(t.amount)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-ink-400 mt-1.5 text-[14px] font-medium leading-snug">
            Auto-charged to your card on file.
          </p>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-ink-700 text-[14px] font-bold tabular-nums">
            Due now: {money(DEPOSIT)}
          </span>
          <Btn id="accept-btn" tone="court" size="sm">
            Pay {money(DEPOSIT)}.00 &amp; Accept
          </Btn>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-ink-900 text-[17px] font-extrabold">Accept Offer</p>
      <div data-demo-target="offer-card" className="border-ink-200 rounded-xl border bg-white px-3 py-2">
        <p className="text-ink-900 text-[15px] font-bold leading-snug">
          {TEAM} <span className="text-court-700">{money(FEE)}</span>
        </p>
        <p className="text-ink-500 mt-0.5 text-[14px] font-medium leading-snug">
          Includes Uniform, Tracksuit, Shoes, Basketball
        </p>
        <p className="text-ink-600 mt-1 text-[14px] font-medium leading-snug">
          &ldquo;{OFFER_MESSAGE}&rdquo;
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <Field label="Uniform">
          <Picker id="size-uniform" filled={sizes} small>
            {sizes ? UNIFORM : "Select…"}
          </Picker>
        </Field>
        <Field label="Tracksuit">
          <Picker filled={sizes} small>
            {sizes ? TRACKSUIT : "Select…"}
          </Picker>
        </Field>
        <Field label="Shoe Size">
          <Picker filled={sizes} small>
            {sizes ? SHOE : "Select…"}
          </Picker>
        </Field>
      </div>

      <div>
        <span className="text-ink-600 mb-1 block text-[14px] font-semibold">
          Jersey Number Preferences
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {["1st Choice", "2nd Choice", "3rd Choice"].map((c, i) => (
            <span key={c} className="block">
              <span
                data-demo-target={i === 0 ? "pref-1" : undefined}
                className={cn(
                  "border-ink-300 block rounded-lg border bg-white px-2 py-1.5 text-center text-[15px] font-bold tabular-nums",
                  prefs ? "text-ink-900" : "text-ink-400"
                )}
              >
                {prefs ? `#${PREFS[i]}` : "#"}
              </span>
              <span className="text-ink-400 mt-0.5 block text-center text-[14px] font-semibold">
                {c}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* The form keeps going below the fold, which is what the guardian sees
          before she scrolls. The plan gets its own composition on the next
          beat, where the whole of it is on screen. */}
      <div className="border-play-500 rounded-xl border bg-white px-3 py-2">
        <p className="text-ink-900 text-[15px] font-bold">Payment plan</p>
        <p className="text-ink-600 mt-0.5 text-[14px] font-medium leading-snug">
          {money(DEPOSIT)} deposit now, then {money(PER)} on {TERMS[0].due}, {money(PER)} on{" "}
          {TERMS[1].due}, {money(PER)} on {TERMS[2].due}
        </p>
      </div>
    </div>
  )
}

/* ── Shared bits ─────────────────────────────────────────────────────────── */

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <span className={cn("block", className)}>
      <span className="text-ink-600 mb-1 block text-[14px] font-semibold">{label}</span>
      {children}
      {hint && <span className="text-ink-400 mt-0.5 block text-[14px] font-medium leading-snug">{hint}</span>}
    </span>
  )
}

function Picker({
  children,
  id,
  filled,
  small,
}: {
  children: ReactNode
  id?: string
  filled?: boolean
  small?: boolean
}) {
  return (
    <span
      data-demo-target={id}
      className={cn(
        "border-ink-300 flex items-center justify-between gap-1 rounded-lg border bg-white text-[15px] font-semibold",
        small ? "px-2 py-1.5" : "px-3 py-1.5",
        filled ? "text-ink-900" : "text-ink-400"
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
      <span className="text-ink-400 shrink-0 text-[14px]">▾</span>
    </span>
  )
}

function TabBar({ tabs, active }: { tabs: string[]; active: string }) {
  return (
    <div className="border-ink-200 flex shrink-0 items-center justify-around border-t bg-white px-1.5 pb-4 pt-2">
      {tabs.map((t) => (
        <span
          key={t}
          className={cn("text-[14px] font-bold", t === active ? "text-play-700" : "text-ink-400")}
        >
          {t}
        </span>
      ))}
    </div>
  )
}

/* ── End card ────────────────────────────────────────────────────────────── */

function EndCard() {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0b1628] px-8 text-white">
      <div className="live-pop max-w-[340px] text-center">
        <p className="text-gold-400 text-[15px] font-bold uppercase tracking-[0.18em]">
          A club story
        </p>
        <h3 className="font-display mt-2 text-[26px] font-extrabold leading-tight">
          Build a team, fill the roster
        </h3>
        <p className="mt-3 text-[15px] leading-relaxed text-white/75">
          A team created with a name the product wrote, a tryout posted and filled, five offers
          composed once, and one accept that collected the sizes, the jersey numbers and a{" "}
          {money(DEPOSIT)} deposit with three dated installments behind it.
        </p>
        <p className="mt-4 text-[14px] font-semibold text-white/50">Next: the money picture</p>
      </div>
    </div>
  )
}
