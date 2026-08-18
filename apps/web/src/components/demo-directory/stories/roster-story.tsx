"use client"

import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import { PlayerMug } from "@/components/ui/player-mug"
import type { DemoBeat, DemoScript } from "../types"
import { AppIcon } from "./your-week-story"

/**
 * "From tryouts to a full team" (roster story), rebuilt 2026-08-16 to the gold
 * standard and completed 2026-08-19 to the REALISM standard (mock-ui.tsx
 * R1–R8) on the owner's ruling: every screen to real anatomy, every flow to its
 * real end state, and the balloons cut to the ones that say something the
 * screen cannot.
 *
 * TWO HANDSETS, NO DESKTOP. The LEFT one is the club (Toronto Lords), the
 * RIGHT one is Jordan Reyes. Every club screen is a PHONE COMPOSITION of a
 * screen the product ships wide today, which the owner authorized in the
 * 2026-08-16 phone-first chart; the parent's screens are responsive pages a
 * guardian already reaches from the app's own bottom bar.
 *
 * THE SPINE IS A REAL PENDING OFFER. `DB` offer bb219828 is live in this
 * database: PENDING, to Darius Reyes, on `Toronto Lords Grade 10 (Fall/Winter
 * 2026-27)`, a team with zero players on it, carrying the seeded message and a
 * ten day expiry. The club is genuinely mid-build of a fall roster here.
 *
 * TRUTH TO THE PRODUCT, SCREEN BY SCREEN (R1: classes copied, files cited):
 *   · the club's team list is `clubs/[id]/teams/page.tsx`: the brand-bar
 *     condensed h2 with its count, the Create Team button, the TeamsFilter row
 *     (`teams-filter.tsx`), and team CARDS carrying the league chip and the
 *     four-tile stat grid (Players / Record / Tryouts / Offers) in
 *     `font-condensed`, not the list rows the 08-16 cut invented;
 *   · team creation is `clubs/[id]/teams/create/page.tsx`, including the real
 *     suffix control: chips of `TEAM_NAME_SUFFIXES` plus "Custom…", which is
 *     the only way a season-shaped suffix gets typed, and the dashed
 *     `Team name (written for you)` preview. It ends on the page's own
 *     success card (court-100 check circle, "Team Created!", View Teams);
 *   · the tryout is `clubs/[id]/tryouts/create/page.tsx`: SmartBack, condensed
 *     h2, `PanelHeader` sections (Tryout details / Schedule / Fee & capacity),
 *     the age-group and gender Badges the team fills in, the ink-50 draft
 *     note, and the real three-button footer. It ends on the page's created
 *     card;
 *   · the signups screen is `clubs/[id]/tryouts/[tryoutId]/signups/page.tsx`
 *     in its OWN phone shape (the `sm:hidden` card list, responsive-design
 *     Shape 1): player, guardian under it, `Badge tone={toneForStatus(status)}`
 *     which is gold "pending" in lower case, and the row chevron. The panel is
 *     the rounded-[28px] card with the band `PanelHeader`;
 *   · the offers are `signups/bulk-offer-button.tsx` with
 *     `components/offers/offer-composer.tsx` inside it: the black/50 modal, the
 *     scrollable recipient box, the "N of N eligible selected" line, the
 *     Option 1 card with Fee / Installments / Practices and the five item
 *     checkboxes, the "Payment plan (deposit + installments)" checkbox that
 *     autofills through `autofillPlan`, the `#1 amount + due date` rows, the
 *     live `PlanSum` check line, the Expires-in ChipGroup and "Send to 5
 *     players". It ends on the modal's own result state, "5 offers sent";
 *   · the roster is `clubs/[id]/teams/[teamId]/roster/page.tsx`: the condensed
 *     "{team} - Roster" h2, the collapsed `roster-manager.tsx` bar with its
 *     brand tick, and the real table (ink-50 uppercase head, `PlayerMug` per
 *     row, the size cells, `Badge tone="court"` Finalized);
 *   · the parent's browse is `app/(public)/events/events-browser.tsx`: the
 *     filter pills and the program card with its stage-gradient cover, crest
 *     watermark, type pill, the by-type lead line ("Tryout in 3 days · Aug
 *     20"), the club crest row and the hoop-600 condensed fee;
 *   · the listing is `app/(platform)/tryouts/[id]/page.tsx` with
 *     `components/registration/program-signup-form.tsx` under it: the brand
 *     band, the Open badge, the condensed h1, the InfoTiles, "Who's playing?",
 *     the KidRow with its `Outside age group` chip, and the fee on the button.
 *     It ends on the form's own green Registered panel;
 *   · her offer is `app/(platform)/offers/page.tsx`: the Offers eyebrow chip,
 *     condensed "My offers", the gold-bar "Pending (1)" heading, the
 *     play-200 card with the condensed fee, the play-50 "What's included"
 *     panel, the ink-50 italic message and the Accept / Decline pair;
 *   · accepting is `offers/offer-response-form.tsx`: the court-50 panel, the
 *     three size listboxes, the three jersey inputs, the Payment panel with
 *     its two `ChoiceCardGroup` plans, the saved card, "Due now" and
 *     "Pay $900.00 & Accept". It ends where the real page ends: the offer
 *     moves into "Past Offers" as an ACCEPTED court-tinted row carrying the
 *     sizes and jersey preferences it collected;
 *   · the push is the notification `lib/offers/create-offer.ts` really sends
 *     ("New Team Offer", `{club} has sent an offer for {player} to join
 *     {team}.`, link /offers), delivered as an iOS-style banner (R8) with the
 *     APPROVED app icon imported from your-week-story.
 *
 * TWO PRODUCT CORRECTIONS, DECLARED RATHER THAN HIDDEN (the demo says what the
 * product should say, and the gap is written down in
 * `docs/roadmap/product-corrections-from-demo-feedback.md`):
 *   1. `tryouts/create` renders "has been created as a draft" even when the
 *      club pressed "Create & publish". The demo shows the published sentence.
 *   2. House copy law: the product's offline-payment sentences carry em-dashes.
 *      The demo renders the middot, as every other story does.
 *
 * THREE THINGS THE PRODUCT CANNOT HONESTLY SHOW, ALSO DECLARED (numbers sheet
 * section F): no seeded club can take online money yet, so the accept form's
 * online branch is the code path a club takes the day Connect onboarding
 * finishes; there are zero `OfferOption` and zero `OfferInstallmentTerm` rows,
 * so the plan on screen is the product's own arithmetic; and
 * `computeDefaultPlan` has no production caller, `autofillPlan` is the
 * shipping path. Both were run for this cut and agree to the cent.
 *
 * INVENTED-CONTENT LEDGER (everything not read out of the database):
 *   · the summer cards' Record / Tryouts / Offers tiles are shaped to the
 *     seeded world's scale rather than counted row by row; the Players tile
 *     (10) is real;
 *   · the head coach on the create form is a seed-pool name;
 *   · the other program on Jordan's events page is a Burlington Force tryout,
 *     shaped like the seed's other clubs' listings;
 *   · the rep fee is raised from the seeded $1,250 to the owner's $3,000 to
 *     $5,000 rep band, and the package's 48 practice sessions with it. Nothing
 *     was written to the database;
 *   · the saved card on the accept form ("Visa •••• 4242") is Stripe's own
 *     test card, standing in for a real one.
 *
 * COMPOSITION TRIMS (what a 390 by ~400 handset could not hold, screen by
 * screen): the create-team form drops Practice Days, Gender, Season and
 * Description and shows five suffix chips of the nine; the tryout form drops
 * Description, the age-policy select and the marketplace checkbox; the roster
 * table drops the Position, Height/Weight and Actions columns (and the Waivers
 * column, which the real page only renders when the CLUB owns a required
 * waiver, and this club does not: the Rowan's Law waiver belongs to the
 * league).
 *
 * THREE LONG FORMS ARE FILMED IN THEIR TWO SCROLL POSITIONS rather than
 * squeezed: create-team (naming, then staffing with the buttons), create-tryout
 * (details and schedule, then schedule and money with the buttons), and the
 * compose modal, the same device the accept form has always used. A phone
 * scrolls these; pretending they fit would be the lie.
 *
 * WHAT THE 08-16 CUT HAD AND THIS ONE DOES NOT: a club "Programs" screen
 * showing the rep team, the house league and the tryout side by side. There is
 * no such page in the product, so it was the one invented screen in the story,
 * and R1 leaves no room for it. The house league keeps its own place in the
 * money-picture demo.
 */

/* ── Cast, all read out of the seeded world ──────────────────────────────── */

/** `DB` Tenant dcd497e7, name "Toronto Lords", shortName "Lords", Toronto. */
const CLUB = "Toronto Lords"
const SHORT = "Lords"

/**
 * `DB` Team d430fbd8 is real and empty: "Toronto Lords Grade 10 (Fall/Winter
 * 2026-27)", MALE, zero players. `PRODUCT` `composeTeamName` builds a name from
 * the club's SHORT name and cannot emit parentheses, so the name the shipping
 * picker writes for that same team is this one.
 */
const TEAM = `${SHORT} Grade 10 Fall/Winter 2026-27`
const SUFFIX = "Fall/Winter 2026-27"
const AGE = "Grade 10"

/** `PRODUCT` `teams/create/page.tsx` line 448, the helper sentence verbatim. */
const SUFFIX_HINT = "Only needed when you field more than one team in the same age group."
/** `PRODUCT` `lib/teams/naming.ts` TEAM_NAME_SUFFIXES, the first five chips. */
const SUFFIX_CHIPS = ["None", "Blue", "White", "Black", "Red"]
/** `SEED` a name from the ADULT_NAMES / LAST_NAMES pools. */
const COACH = "Marcus Bell"

/** `DB` Tryout 1689307c on this club. The row stores an em-dash in its title;
 *  the house copy rule renders the middot. */
const TRYOUT = `${CLUB} Fall Tryouts · Grade 9 & 10`
const TRYOUT_DAY = "Thu, Aug 20"
const TRYOUT_TIME = "6:30 PM"
const TRYOUT_MINUTES = 120
/** `DB` Venue c805d634. */
const VENUE = "The Playground"
const VENUE_CITY = "Burlington"
const VENUE_ADDRESS = "952 Century Dr, Burlington"
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
const PLAYER_ID = "a18c732d"
const PLAYER_BORN = 2011
/** `DB` Player 729b0d07, the sister, on Toronto Lords Grade 10 Girls. */
const SISTER = "Danielle Reyes"
const SISTER_BORN = 2010

/**
 * The rep season fee. `OWNER` the 2026-08-16 ruling puts a rep season in the
 * $3,000 to $5,000 band; `DB` the live pending offer carries a seeded $1,250.
 * Nothing was written to the database: the demo raises the number on screen.
 */
const FEE = 3600
/** `PRODUCT` `autofillPlan(3600)` and `computeDefaultPlan(3600)` both return a
 *  $900 deposit and three $900 installments. Both were run for this cut. */
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
/** `DB` the same row says ten days, and `PRODUCT` 10 is one of the real expiry
 *  chips (3, 5, 7, 10, 14). */
const EXPIRES_DAYS = 10

/**
 * `DB` Darius's accepted summer offer 6a179f47 recorded exactly these. The fall
 * accept collects them again, and the demo reuses his real answers rather than
 * inventing a growth spurt.
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
  { name: "Daniel Grant", num: 4, id: "p-grant", uniform: "AM", tracksuit: "AM", shoe: "10" },
  { name: "Ethan Lee", num: 15, id: "p-lee", uniform: "YL", tracksuit: "YL", shoe: "8.5" },
  { name: "Cameron Baptiste", num: 17, id: "p-bap", uniform: "AM", tracksuit: "AS", shoe: "10.5" },
  { name: "Isaiah Clarke", num: 18, id: "p-clarke", uniform: "AS", tracksuit: "AM", shoe: "9.5" },
  { name: "Zion Nguyen", num: 21, id: "p-ngu", uniform: "YL", tracksuit: "AM", shoe: "9" },
  { name: PLAYER, num: PREFS[0], id: PLAYER_ID, uniform: UNIFORM, tracksuit: TRACKSUIT, shoe: SHOE },
]

/** `PRODUCT` `program-signup-form.tsx` line 464, the offline branch this club
 *  really renders, with `methodsText(["CASH","ETRANSFER"])`. Middots for the
 *  product's em-dashes (house copy law). */
const OFFLINE_LINE =
  "This organizer accepts cash or e-transfer · pay them directly after registering. Offline payments are arranged directly with the organizer, the platform can't refund them."

/** `PRODUCT` `lib/offers/create-offer.ts` lines 264 to 267, verbatim. */
const PUSH_TITLE = "New Team Offer"
const PUSH_MESSAGE = `${CLUB} has sent an offer for ${PLAYER} to join ${TEAM}.`

const money = (n: number) => `$${n.toLocaleString("en-CA")}`
const money2 = (n: number) => `$${n.toFixed(2)}`

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
    /* Engine law learned in the 08-19 drive: a beat's `set` is applied the
       moment the beat starts, so a beat must never remove its OWN cursor
       target. Every press that replaces the screen presses on one beat and
       lands on the next, which is also how a press reads to a person. */
    paced({
      id: "open",
      chapter: "team",
      caption: "Three teams at this club, all of them summer. Nothing exists for the fall yet.",
      emphasize: "club-teams",
    }),
    paced({
      id: "new",
      chapter: "team",
      caption: "Create team.",
      cursor: "new-team",
      press: true,
    }),
    paced({
      id: "age",
      chapter: "team",
      caption: "The age group first.",
      cursor: "age-field",
      press: true,
      set: { view: "create", age: true },
      callout: "Grade 10, because this summer's Grade 9 group moves up together.",
    }),
    paced({
      id: "custom",
      chapter: "team",
      caption:
        "The club already fields a Grade 10, so this one needs a suffix, and no preset says a season.",
      cursor: "suffix-custom",
      press: true,
      set: { custom: true },
    }),
    paced({
      id: "suffix",
      chapter: "team",
      caption: "This is the only part of the name anybody types.",
      cursor: "suffix-field",
      type: { key: "suffixTyped", text: SUFFIX },
      set: { suffix: true },
    }),
    paced({
      id: "name",
      chapter: "team",
      caption: "The rest is written underneath as she goes.",
      emphasize: "name-preview",
      callout: "The product writes the name, so one team is never spelled two ways.",
    }),
    paced({
      id: "staff",
      chapter: "team",
      caption: "The head coach goes on with the team.",
      cursor: "staff-field",
      press: true,
      set: { staff: true },
    }),
    paced({
      id: "create",
      chapter: "team",
      caption: "And create it.",
      cursor: "create-btn",
      press: true,
    }),
    paced({
      id: "created",
      chapter: "team",
      caption: "Created, with the coach already on it.",
      set: { view: "created" },
    }),

    /* ── 2. Post the tryout ───────────────────────────────────────────── */
    paced({
      id: "tryout-open",
      chapter: "tryout",
      caption: "Now the tryout, hung off that team so its signups land on it.",
      set: { view: "tryout" },
      emphasize: "tryout-form",
    }),
    paced({
      id: "tryout-where",
      chapter: "tryout",
      caption: "The gym comes out of the club's venues, address and all.",
      cursor: "venue-field",
      press: true,
      set: { venue: true },
    }),
    paced({
      id: "tryout-when",
      chapter: "tryout",
      caption: "Thursday evening, two hours on the floor.",
      cursor: "when-field",
      press: true,
      set: { when: true },
    }),
    paced({
      id: "tryout-fee",
      chapter: "tryout",
      caption: `${money(TRYOUT_FEE)} to walk in, and ${CAP} places.`,
      cursor: "fee-field",
      type: { key: "feeTyped", text: `${TRYOUT_FEE}` },
      set: { fee: true },
      callout: "The cap sits on the tryout, so signups stop at thirty without anybody watching.",
    }),
    paced({
      id: "tryout-publish",
      chapter: "tryout",
      caption: "Created and published in the same sitting.",
      cursor: "publish-btn",
      press: true,
      callout: "Published means families outside the club can find it too.",
    }),
    paced({
      id: "published",
      chapter: "tryout",
      caption: "One press does both.",
      stage: "split",
      set: { view: "tryout-live" },
    }),

    /* ── 3. A family signs up ─────────────────────────────────────────── */
    paced({
      id: "listed",
      chapter: "family",
      caption:
        "A minute later it is on the public programs page, at the top because it is the soonest.",
      set: { listed: true },
      emphasize: "p-tryout-card",
    }),
    paced({
      id: "open-listing",
      chapter: "family",
      caption: `${PARENT} has two children at this club. She opens it.`,
      cursor: "p-tryout-card",
      press: true,
    }),
    paced({
      id: "who",
      chapter: "family",
      caption: "The form asks who is playing, and both her children are already on the account.",
      set: { phone: "tryout" },
      emphasize: "who-list",
    }),
    paced({
      id: "eligible",
      chapter: "family",
      caption:
        "She picks Darius. Danielle is flagged outside the age group before anybody presses anything.",
      cursor: "kid-darius",
      press: true,
      set: { picked: true },
    }),
    paced({
      id: "register",
      chapter: "family",
      caption: "She registers him, with the fee written on the button.",
      cursor: "register-btn",
      press: true,
    }),
    paced({
      id: "offline",
      chapter: "family",
      caption: "This club takes the fee in person.",
      set: { phone: "registered" },
      emphasize: "offline-line",
      callout: "Card payments are off for this club, so the product says how to pay instead.",
    }),

    /* ── 4. The offer, accepted ───────────────────────────────────────── */
    paced({
      id: "signups",
      chapter: "offer",
      caption:
        "Tryout night is over. Five players signed up, each one carrying the guardian who signed them up.",
      set: { view: "signups" },
      emphasize: "signup-list",
    }),
    paced({
      id: "bulk",
      chapter: "offer",
      caption: "One composition, five separate offers, each one answered on its own.",
      cursor: "bulk-btn",
      press: true,
      set: { view: "compose" },
    }),
    paced({
      id: "package",
      chapter: "offer",
      caption: `The season fee, ${money(FEE)}, and the kit the fee covers.`,
      cursor: "fee-input",
      type: { key: "repFeeTyped", text: "3600" },
      set: { repFee: true },
    }),
    paced({
      id: "plan",
      chapter: "offer",
      caption:
        "One tick writes the deposit and three dated installments, and checks they add up to the fee.",
      cursor: "plan-toggle",
      press: true,
      set: { plan: true },
    }),
    paced({
      id: "expiry",
      chapter: "offer",
      caption: `${EXPIRES_DAYS} days to answer.`,
      cursor: "expiry-10",
      press: true,
      set: { expiry: true },
    }),
    paced({
      id: "send",
      chapter: "offer",
      caption: "Sent.",
      cursor: "send-btn",
      press: true,
      callout: "An offer nobody answers expires by itself, and the place comes back to the club.",
    }),
    paced({
      id: "sent",
      chapter: "offer",
      caption: "Five offers, five separate answers to wait for.",
      set: { view: "sent" },
    }),
    paced({
      id: "push",
      chapter: "offer",
      caption: "Hers arrives the way a phone delivers things.",
      set: { banner: true },
      hold: 2800,
    }),
    paced({
      id: "arrive",
      chapter: "offer",
      caption: "She taps it.",
      cursor: "w-open",
      press: true,
    }),
    paced({
      id: "offer-page",
      chapter: "offer",
      caption: "Her offers page: the fee, what it includes, and the coach's note.",
      set: { phone: "offer", banner: false },
      emphasize: "offer-card",
    }),
    paced({
      id: "accept-open",
      chapter: "offer",
      caption: "Accepting opens the form under the card.",
      cursor: "accept-open",
      press: true,
    }),
    paced({
      id: "sizes",
      chapter: "offer",
      caption: "Uniform, tracksuit, shoes. The club's kit order comes off these three fields.",
      cursor: "size-uniform",
      press: true,
      set: { phone: "offer-sizes", sizes: true },
    }),
    paced({
      id: "jersey",
      chapter: "offer",
      caption: "Three jersey numbers, in order.",
      cursor: "pref-1",
      press: true,
      set: { prefs: true },
      callout: "Three choices let the club settle a clash without asking her again.",
    }),
    paced({
      id: "plan-view",
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
      callout: "One press pays the deposit, books the three charges and puts him on the roster.",
    }),
    paced({
      id: "accepted",
      chapter: "offer",
      caption: "Her copy keeps every answer she gave.",
      set: { phone: "accepted" },
      emphasize: "past-card",
      hold: 2600,
    }),

    /* ── 5. The roster fills ──────────────────────────────────────────── */
    paced({
      id: "roster",
      chapter: "roster",
      caption: "The roster, filled. Every line arrived from a family accepting their own offer.",
      stage: "desktop",
      set: { view: "roster" },
      emphasize: "roster-list",
    }),
    paced({
      id: "roster-sizes",
      chapter: "roster",
      caption: "The sizes are already on it.",
      emphasize: "row-darius",
      callout: "Nobody typed these here. They came off each accept form.",
    }),
    paced({
      id: "roster-status",
      chapter: "roster",
      caption: "One chip is what a manager chases all season.",
      emphasize: "row-status",
      callout: "Finalized means his number is settled, not that the fee is paid.",
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
          custom={get("custom", false)}
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
          expiry={get("expiry", false)}
        />
        {get("endCard", false) && <EndCard />}
      </div>
    )

    const phone = (
      <ParentPhone
        view={get<string>("phone", "events")}
        listed={get("listed", false)}
        picked={get("picked", false)}
        sizes={get("sizes", false)}
        prefs={get("prefs", false)}
        banner={get("banner", false)}
      />
    )

    return {
      desktop: club,
      phone,
      frameLabels: { left: `${CLUB} · club`, right: `${PARENT} · parent` },
    }
  },
}

/* ── Shared atoms, copied from the kit the real pages use ────────────────── */

/** `components/ui/badge.tsx` TONES + shell, at handset scale. */
function Badge({
  tone = "neutral",
  dot,
  children,
  small,
}: {
  tone?: "neutral" | "play" | "hoop" | "court" | "gold"
  dot?: boolean
  children: ReactNode
  small?: boolean
}) {
  const tones = {
    neutral: "bg-ink-50 text-ink-600 ring-ink-200",
    play: "bg-play-50 text-play-700 ring-play-100",
    hoop: "bg-hoop-50 text-hoop-600 ring-hoop-100",
    court: "bg-court-50 text-court-700 ring-court-100",
    gold: "bg-gold-50 text-gold-600 ring-gold-100",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold uppercase tracking-[0.12em] ring-1 ring-inset",
        small ? "px-1.5 py-0.5 text-[9.5px]" : "px-2 py-0.5 text-[11px]",
        tones[tone]
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

/** `components/ui/button.tsx`: primary play fill / subtle outline, size sm. */
function Btn({
  children,
  id,
  variant = "primary",
  tone = "play",
  block,
  icon,
}: {
  children: ReactNode
  id?: string
  variant?: "primary" | "subtle"
  tone?: "play" | "court"
  block?: boolean
  icon?: ReactNode
}) {
  return (
    <span
      data-demo-target={id}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-shadow duration-150 data-[demo-press=true]:shadow-inner data-[demo-press=true]:brightness-95",
        block && "w-full",
        variant === "subtle"
          ? "border-ink-200 text-ink-700 border bg-white"
          : tone === "court"
            ? "bg-court-600 text-white shadow-[0_10px_24px_-14px_rgba(22,163,74,0.6)]"
            : "bg-play-600 text-white shadow-[0_10px_24px_-14px_rgba(79,70,229,0.55)]"
      )}
    >
      {icon}
      {children}
    </span>
  )
}

/** `components/ui/smart-back.tsx`: arrow plus the parent's name. */
function Back({ label }: { label: string }) {
  return (
    <span className="text-ink-500 inline-flex items-center gap-1 text-[12px] font-semibold">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
        <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </span>
  )
}

/** `components/ui/panel-header.tsx`: brand tick + condensed uppercase title. */
function PanelHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-1 flex items-center gap-2">
      <span className="h-4 w-1 shrink-0 rounded-full bg-[var(--brand)]" aria-hidden="true" />
      <span className="font-condensed text-ink-950 text-[14px] font-bold uppercase leading-none tracking-wide">
        {title}
      </span>
      {action && <span className="ml-auto shrink-0">{action}</span>}
    </div>
  )
}

/** `components/ui/brand-listbox.tsx` trigger, at handset scale. */
function Listbox({
  children,
  id,
  filled,
  compact,
}: {
  children: ReactNode
  id?: string
  filled?: boolean
  compact?: boolean
}) {
  return (
    <span
      data-demo-target={id}
      className={cn(
        "border-ink-200 flex items-center justify-between gap-1 rounded-xl border bg-white shadow-sm",
        compact ? "px-2 py-1 text-[12px]" : "px-2.5 py-1.5 text-[13px]",
        filled ? "text-ink-900" : "text-ink-500"
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-400 h-3 w-3 shrink-0">
        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <span className="text-ink-700 block text-[12px] font-medium">
      {children}
      {required && <span className="text-red-500"> *</span>}
    </span>
  )
}

/** The real text input, at handset scale. */
function Input({
  id,
  value,
  placeholder,
  typing,
  center,
}: {
  id?: string
  value?: string
  placeholder?: string
  typing?: boolean
  center?: boolean
}) {
  return (
    <span
      data-demo-target={id}
      className={cn(
        "border-ink-200 block rounded-xl border bg-white px-2.5 py-1.5 text-[13px]",
        center && "text-center",
        value ? "text-ink-900 font-medium" : "text-ink-400"
      )}
    >
      {value || placeholder}
      {typing && <span className="bg-play-600 ml-0.5 inline-block h-3.5 w-[2px] align-middle" />}
    </span>
  )
}

/** `components/ui/crest.tsx` on a dark surface, and the events card watermark. */
function crestOf(name: string) {
  return name
    .replace(/\b(grade|gr\.?)\s*\d+\w*/gi, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

/* ── The club's handset ──────────────────────────────────────────────────── */

function ClubPhone({
  view,
  age,
  custom,
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
  expiry,
}: {
  view: string
  age: boolean
  custom: boolean
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
  expiry: boolean
}) {
  const composing = view === "compose" || view === "sent"
  return (
    <div className="relative flex h-full flex-col bg-[#f6f7f9]">
      <div className="flex items-baseline gap-2 bg-[#0b1628] px-4 pb-2 pt-1.5 text-white">
        <p className="text-[14px] font-bold leading-tight">{CLUB}</p>
        <p className="text-[12px] font-medium text-white/60">Club workspace</p>
      </div>

      <div key={view} className="demo-fade-in min-h-0 flex-1 overflow-hidden px-3 py-2">
        {view === "teams" && <TeamsList />}
        {(view === "create" || view === "created") && (
          <CreateTeam
            age={age}
            custom={custom}
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
        {(view === "signups" || composing) && <SignupList />}
        {view === "roster" && <RosterBoard />}
      </div>

      {/* `bulk-offer-button.tsx` opens `fixed inset-0` over the whole screen. */}
      {composing && (
        <ComposeSheet
          repFee={repFee}
          repFeeTyped={repFeeTyped}
          typingRepFee={typingRepFee}
          plan={plan}
          expiry={expiry}
          sent={view === "sent"}
        />
      )}

      <TabBar active="My Club" context="club" />
    </div>
  )
}

/** `/clubs/[id]/teams` — heading, filter row, team cards with the stat grid. */
function TeamsList() {
  return (
    <div data-demo-target="club-teams" className="h-full overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-condensed text-ink-950 flex items-center gap-2 text-[19px] font-bold uppercase leading-none tracking-wide">
          <span className="h-5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" aria-hidden="true" />
          Teams (3)
        </h2>
        <Btn
          id="new-team"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          }
        >
          Create Team
        </Btn>
      </div>

      {/* `teams-filter.tsx` */}
      <div className="mt-2 flex gap-2">
        <span className="w-[132px] shrink-0">
          <Listbox compact>All Age Groups</Listbox>
        </span>
        <span className="border-ink-200 text-ink-400 min-w-0 flex-1 rounded-xl border bg-white px-2 py-1 text-[12px]">
          Search teams...
        </span>
        <span className="bg-court-100 text-ink-700 shrink-0 rounded-xl px-2.5 py-1 text-[12px]">
          Search
        </span>
      </div>

      <div className="mt-2 space-y-2">
        <TeamCard name="Toronto Lords Grade 9" meta="Grade 9 • MALE • Summer 2026" coach="Marcus Bell" record="7–2" tryouts={1} offers={12} />
        <TeamCard name="Toronto Lords Grade 10" meta="Grade 10 • MALE • Summer 2026" coach="Andre Wright" record="5–4" tryouts={0} offers={10} />
      </div>
    </div>
  )
}

function TeamCard({
  name,
  meta,
  coach,
  record,
  tryouts,
  offers,
}: {
  name: string
  meta: string
  coach: string
  record: string
  tryouts: number
  offers: number
}) {
  return (
    <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-3">
      <h3 className="text-ink-900 text-[15px] font-bold leading-tight">{name}</h3>
      <p className="text-ink-600 text-[12px]">{meta}</p>
      <p className="text-ink-500 text-[10.5px]">Coach: {coach}</p>
      <div className="mt-1.5">
        <Badge tone="play">NPH Summer League</Badge>
      </div>
      <div className="border-ink-100 mt-2 grid grid-cols-4 gap-1 border-t pt-2 text-center">
        <Stat value="10" label="Players" className="text-[color:var(--brand-ink)]" />
        <Stat value={record} label="Record" className="text-ink-900" />
        <Stat value={String(tryouts)} label="Tryouts" className="text-hoop-600" />
        <Stat value={String(offers)} label="Offers" className="text-play-700" />
      </div>
    </div>
  )
}

function Stat({ value, label, className }: { value: string; label: string; className: string }) {
  return (
    <div>
      <div className={cn("font-condensed text-[17px] font-bold leading-none", className)}>{value}</div>
      <div className="text-ink-500 mt-0.5 text-[10px]">{label}</div>
    </div>
  )
}

/** `/clubs/[id]/teams/create`, through to its own success card. */
function CreateTeam({
  age,
  custom,
  suffix,
  suffixTyped,
  typingSuffix,
  staff,
  created,
}: {
  age: boolean
  custom: boolean
  suffix: boolean
  suffixTyped: string
  typingSuffix: boolean
  staff: boolean
  created: boolean
}) {
  const name = age ? [SHORT, AGE, suffix ? suffixTyped : ""].filter(Boolean).join(" ") : null

  if (created) {
    /* teams/create/page.tsx lines 349 to 402, the real created render. */
    return (
      <div className="flex h-full items-center">
        <div className="border-ink-100 shadow-soft w-full rounded-2xl border bg-white p-5 text-center">
          <div className="bg-court-100 live-pop mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full">
            <svg className="text-court-600 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-ink-900 mb-1.5 text-[17px] font-bold">Team Created!</h2>
          <p className="text-ink-600 text-[13px] leading-snug">
            <span className="font-semibold">{TEAM}</span> ({AGE}) has been created.
          </p>
          <p className="text-ink-500 mt-1 text-[12px]">1 staff member assigned/invited.</p>
          <div className="mt-4 flex gap-2">
            <span className="bg-play-600 flex-1 rounded-xl px-3 py-1.5 text-center text-[13px] font-semibold text-white">
              View Teams
            </span>
            <span className="border-ink-200 text-ink-700 flex-1 rounded-xl border px-3 py-1.5 text-center text-[13px] font-semibold">
              Create Another Team
            </span>
          </div>
        </div>
      </div>
    )
  }

  /* The real form is longer than a handset and a club scrolls it, so the
     screen is filmed in its two scroll positions: the naming half, then the
     staffing half with the buttons under it (the page header and the fields
     already answered have scrolled off, exactly as they would). */
  const scrolled = staff
  return (
    <div className="h-full overflow-hidden">
      {!scrolled && (
        <>
          <Back label="Teams" />
          <h2 className="text-ink-900 text-[16px] font-bold">Create New Team</h2>
          <p className="text-ink-600 text-[11.5px]">
            Add a team to your club and assign coaching staff
          </p>
        </>
      )}

      <div
        className={cn(
          "border-ink-100 shadow-soft space-y-1.5 rounded-2xl border bg-white p-2.5",
          !scrolled && "mt-1.5"
        )}
      >
        {!scrolled && <h3 className="text-ink-900 text-[13.5px] font-semibold">Team Details</h3>}

        {!scrolled && (
          <div>
            <FieldLabel required>Age Group</FieldLabel>
            <span className="mt-0.5 block">
              <Listbox id="age-field" filled={age} compact>
                {age ? AGE : "Select age group"}
              </Listbox>
            </span>
          </div>
        )}

        <div>
          <span className="text-ink-700 block text-[12px] font-medium">Suffix</span>
          {!scrolled && (
            <p className="text-ink-500 mt-0.5 text-[10.5px] leading-snug">{SUFFIX_HINT}</p>
          )}
          <div className="mt-1 flex flex-wrap gap-1">
            {SUFFIX_CHIPS.map((s) => (
              <span
                key={s}
                className="bg-ink-50 text-ink-600 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
              >
                {s}
              </span>
            ))}
            <span
              data-demo-target="suffix-custom"
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors duration-200",
                custom ? "bg-play-600 text-white" : "bg-ink-50 text-ink-600"
              )}
            >
              Custom…
            </span>
          </div>
          {custom && (
            <span className="mt-1 block">
              <Input
                id="suffix-field"
                value={suffix ? suffixTyped : ""}
                placeholder="Your own suffix, e.g. Elite, North, 2B"
                typing={typingSuffix}
              />
            </span>
          )}
        </div>

        <div
          data-demo-target="name-preview"
          className="border-ink-100 bg-ink-50/60 rounded-xl border border-dashed px-2.5 py-1"
        >
          <p className="text-ink-500 text-[10.5px]">Team name (written for you)</p>
          <p className={cn("text-[13px] font-semibold", name ? "text-ink-900" : "text-ink-400")}>
            {name ?? "Pick an age group above"}
          </p>
        </div>
      </div>

      <div className="border-ink-100 shadow-soft mt-1.5 rounded-2xl border bg-white p-2.5">
        <h3 className="text-ink-900 text-[13.5px] font-semibold">Staff Assignment</h3>
        <p className="text-ink-600 text-[11px] leading-snug">
          Assign coaches and team managers. You can also invite people by email.
        </p>
        <div className="mt-1 flex items-end gap-1.5">
          <span className="min-w-0 flex-1">
            <Listbox id="staff-field" filled={staff} compact>
              {staff ? COACH : "Select a staff member"}
            </Listbox>
          </span>
          <span className="w-[86px] shrink-0">
            <Listbox filled compact>
              Head Coach
            </Listbox>
          </span>
          <span className="bg-play-600 shrink-0 rounded-xl px-2.5 py-1 text-[12px] font-medium text-white">
            Add
          </span>
        </div>
        <div className="mt-1.5">
          <span className="text-ink-700 mb-0.5 block text-[11px] font-medium">Invite by Email</span>
          <div className="flex items-end gap-1.5">
            <span className="border-ink-200 text-ink-400 min-w-0 flex-1 rounded-xl border px-2 py-1 text-[12px]">
              staff@example.com
            </span>
            <span className="w-[86px] shrink-0">
              <Listbox filled compact>
                Assistant
              </Listbox>
            </span>
            <span className="border-play-600 text-play-600 shrink-0 rounded-xl border px-2.5 py-1 text-[12px] font-medium">
              Invite
            </span>
          </div>
          <p className="text-ink-500 mt-0.5 text-[10px] leading-snug">
            The invited person will receive a notification and be assigned to this team once they
            accept.
          </p>
        </div>
      </div>

      <div className="mt-1.5 flex gap-2">
        <span className="border-ink-200 text-ink-700 rounded-xl border px-3 py-1 text-[13px] font-semibold">
          Cancel
        </span>
        <span
          data-demo-target="create-btn"
          className="bg-play-600 flex-1 rounded-xl px-3 py-1 text-center text-[13px] font-semibold text-white data-[demo-press=true]:brightness-95"
        >
          Create Team
        </span>
      </div>
    </div>
  )
}

/** `/clubs/[id]/tryouts/create`, through to its own created card. */
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
  if (live) {
    /* tryouts/create/page.tsx lines 165 to 203. The shipping page says "as a
       draft" even on the publish branch; the demo says what the press did. */
    return (
      <div className="flex h-full items-center">
        <div className="border-ink-100 shadow-soft w-full rounded-2xl border bg-white p-5 text-center">
          <div className="bg-court-50 live-pop mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full">
            <svg className="text-court-600 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-condensed text-ink-950 mb-1.5 text-[20px] font-bold uppercase tracking-wide">
            Tryout Created!
          </h2>
          <p className="text-ink-600 text-[13px] leading-snug">
            <span className="font-semibold">{TRYOUT}</span> has been created and published to the
            marketplace.
          </p>
          <p className="text-ink-500 mt-1 text-[12px]">
            {TRYOUT_DAY} · {VENUE} · {money(TRYOUT_FEE)} · {CAP} spots
          </p>
          <div className="mt-4 flex gap-2">
            <span className="bg-play-600 flex-1 rounded-xl px-3 py-1.5 text-center text-[13px] font-semibold text-white">
              View Tryouts
            </span>
            <span className="border-ink-200 text-ink-700 flex-1 rounded-xl border px-3 py-1.5 text-center text-[13px] font-semibold">
              Create Another
            </span>
          </div>
        </div>
      </div>
    )
  }

  /* Filmed in the two scroll positions a club really uses: details and
     schedule, then schedule and money with the three buttons under them. */
  const scrolled = fee
  return (
    <div data-demo-target="tryout-form" className="h-full overflow-hidden">
      {!scrolled && (
        <>
          <Back label="Tryouts" />
          <h2 className="font-condensed text-ink-950 text-[18px] font-bold uppercase leading-none tracking-wide">
            Create Tryout
          </h2>
        </>
      )}

      <div
        className={cn(
          "border-ink-100 shadow-soft rounded-2xl border bg-white p-2.5",
          !scrolled && "mt-1"
        )}
      >
        {!scrolled && <PanelHeader title="Tryout details" />}
        <div className="space-y-1.5">
          {!scrolled && (
            <div>
              <FieldLabel required>Team</FieldLabel>
              <span className="mt-0.5 block">
                <Listbox filled compact>
                  {TEAM} ({AGE} / Boys)
                </Listbox>
              </span>
            </div>
          )}
          {!scrolled && (
            <div className="flex gap-1.5">
              <Badge tone="play">Age group · {AGE}</Badge>
              <Badge tone="play">Boys</Badge>
            </div>
          )}
          <div>
            <FieldLabel required>Title</FieldLabel>
            <span className="mt-0.5 block">
              <Input value={TRYOUT} />
            </span>
          </div>
          <div>
            <FieldLabel required>Venue</FieldLabel>
            <span className="mt-0.5 block">
              <Listbox id="venue-field" filled={venue} compact>
                {venue ? `${VENUE}, ${VENUE_ADDRESS}` : "Search venues…"}
              </Listbox>
            </span>
          </div>
        </div>

        <div className="mt-1.5">
          <PanelHeader title="Schedule" />
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <FieldLabel required>Date</FieldLabel>
              <span className="mt-0.5 block">
                <Listbox id="when-field" filled={when} compact>
                  {when ? TRYOUT_DAY : "Pick a date"}
                </Listbox>
              </span>
            </div>
            <div>
              <FieldLabel>Time</FieldLabel>
              <span className="mt-0.5 block">
                <Listbox filled={when} compact>
                  {when ? `${TRYOUT_TIME} · ${TRYOUT_MINUTES} min` : "6:00 PM · 90 min"}
                </Listbox>
              </span>
            </div>
          </div>
        </div>

        <div className={cn("mt-1.5", !scrolled && "hidden")}>
          <PanelHeader title="Fee & capacity" />
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <FieldLabel required>Fee ($)</FieldLabel>
              <span className="mt-0.5 block">
                <Input id="fee-field" value={fee ? feeTyped : ""} placeholder="0.00" typing={typingFee} />
              </span>
            </div>
            <div>
              <FieldLabel>Max Participants</FieldLabel>
              <span className="mt-0.5 block">
                <Input value={fee ? String(CAP) : ""} placeholder="No limit" />
              </span>
            </div>
          </div>
          <p className="border-ink-200 bg-ink-50 text-ink-500 mt-1 rounded-md border px-2 py-0.5 text-[10px] leading-snug">
            Tryouts are saved as drafts. You can publish them to the marketplace from the tryouts
            list.
          </p>
        </div>
      </div>

      <div className={cn("mt-1.5 flex gap-1.5", !scrolled && "hidden")}>
        <span className="border-ink-200 text-ink-700 rounded-xl border bg-white px-2.5 py-1 text-[12px] font-semibold">
          Cancel
        </span>
        <span className="border-ink-200 text-ink-700 rounded-xl border bg-white px-2.5 py-1 text-[12px] font-semibold">
          Save draft
        </span>
        <span
          data-demo-target="publish-btn"
          className="bg-play-600 flex-1 rounded-xl px-3 py-1 text-center text-[12px] font-semibold text-white data-[demo-press=true]:brightness-95"
        >
          Create &amp; publish
        </span>
      </div>
    </div>
  )
}

/** The tryout's signups page in its own phone shape (`sm:hidden` cards). */
function SignupList() {
  return (
    <div className="h-full overflow-hidden">
      <Back label="Tryouts" />
      <h2 className="font-condensed text-ink-950 mt-0.5 text-[18px] font-bold uppercase leading-tight tracking-wide">
        {TRYOUT} - Signups
      </h2>
      <div className="text-ink-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
        <span>Aug 20, 2026 at 6:30 PM</span>
        <span>{VENUE}</span>
        <Badge tone="play">{TEAM}</Badge>
      </div>

      <div className="mt-1.5 flex gap-1.5">
        <Btn id="bulk-btn">Send Offers ({SIGNUPS.length})</Btn>
        <Btn variant="subtle">Check-in (0/{SIGNUPS.length})</Btn>
      </div>

      <div className="border-ink-100 shadow-soft mt-2 overflow-hidden rounded-[22px] border bg-white">
        <div className="flex items-center justify-between gap-2 bg-[var(--brand-soft)] px-3 py-2">
          <span className="flex items-center gap-2">
            <span className="h-4 w-1 shrink-0 rounded-full bg-[var(--brand)]" aria-hidden="true" />
            <span className="font-condensed text-ink-950 text-[14px] font-bold uppercase leading-none tracking-wide">
              Signups
            </span>
          </span>
          <span className="text-ink-600 text-[11px] font-semibold">
            {SIGNUPS.length} signups
          </span>
        </div>
        <div data-demo-target="signup-list" className="divide-ink-100 divide-y">
          {SIGNUPS.map((s) => (
            <div key={s.player} className="flex items-center justify-between gap-2 px-3 py-1.5">
              <div className="min-w-0">
                <div className="text-ink-900 truncate text-[13px] font-medium">{s.player}</div>
                <div className="text-ink-500 truncate text-[11px]">{s.parent}</div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge tone="gold">pending</Badge>
                <span className="text-ink-400 text-[13px]">›</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * `bulk-offer-button.tsx` with `offer-composer.tsx` inside it.
 *
 * The real modal is `max-h-[90vh] overflow-y-auto` and a club scrolls it, so
 * the handset films its TWO scroll positions: the recipients and the package
 * first, then the plan the tick just wrote with the send row under it.
 */
function ComposeSheet({
  repFee,
  repFeeTyped,
  typingRepFee,
  plan,
  expiry,
  sent,
}: {
  repFee: boolean
  repFeeTyped: string
  typingRepFee: boolean
  plan: boolean
  expiry: boolean
  sent: boolean
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-3">
      <div className="live-pop max-h-full w-full overflow-hidden rounded-2xl bg-white p-3.5 shadow-xl">
        {sent ? (
          <div>
            <h3 className="text-ink-900 text-[16px] font-bold">{SIGNUPS.length} offers sent</h3>
            <p className="text-ink-500 mt-1 text-[12px] leading-snug">
              {TEAM} · {money(FEE)} · expire in {EXPIRES_DAYS} days
            </p>
            <div className="mt-3 space-y-1">
              {SIGNUPS.map((s, i) => (
                <div
                  key={s.player}
                  className="border-ink-100 live-row-in flex items-center justify-between gap-2 rounded-xl border px-2.5 py-1"
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <span className="text-ink-800 truncate text-[12.5px] font-medium">{s.player}</span>
                  <Badge tone="court">sent</Badge>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <span className="bg-play-600 rounded-xl px-3.5 py-1.5 text-[13px] font-semibold text-white">
                Done
              </span>
            </div>
          </div>
        ) : plan ? (
          <div>
            {/* Scrolled to the composer: the option card keeps its header line
                so the viewer knows nothing was swapped out from under them. */}
            <div className="border-ink-200 bg-ink-50/40 space-y-1.5 rounded-xl border p-2.5">
              <div className="flex items-center gap-1.5">
                <span className="bg-play-100 text-play-700 shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold">
                  Option 1
                </span>
                <span className="text-ink-900 truncate text-[12.5px] font-semibold">
                  Fall/Winter Rep
                </span>
                <span className="text-ink-500 ml-auto shrink-0 text-[12px] tabular-nums">
                  {money(FEE)}
                </span>
              </div>
              <div className="border-ink-200 space-y-1.5 border-t pt-1.5">
                <div className="text-ink-600 flex flex-wrap items-center gap-2 text-[11px] font-medium">
                  <span className="flex items-center gap-1">
                    <Tick on />
                    Pay in full
                  </span>
                  <span data-demo-target="plan-toggle" className="flex items-center gap-1">
                    <Tick on />
                    Payment plan (deposit + installments)
                  </span>
                </div>
                <div className="live-pop space-y-1">
                  <div className="text-ink-500 flex items-center gap-1.5 text-[11px]">
                    Deposit (due on accept) $
                    <span className="border-ink-200 text-ink-900 rounded-lg border px-1.5 py-0.5 text-[12px] font-medium tabular-nums">
                      {DEPOSIT}
                    </span>
                    <span className="text-play-600 text-[11px] font-semibold">
                      Auto: 25% + 3 monthly
                    </span>
                  </div>
                  {TERMS.map((t, i) => (
                    <div key={t.label} className="flex items-center gap-1.5">
                      <span className="text-ink-400 w-4 shrink-0 text-[11px]">#{i + 1}</span>
                      <span className="border-ink-200 text-ink-900 rounded-lg border px-1.5 py-0.5 text-[12px] font-medium tabular-nums">
                        {t.amount}
                      </span>
                      <span className="border-ink-200 text-ink-900 min-w-0 flex-1 rounded-lg border px-1.5 py-0.5 text-[12px] font-medium">
                        {t.due}, 2026
                      </span>
                      <span className="text-ink-400 shrink-0 text-[12px]">×</span>
                    </div>
                  ))}
                  <p className="text-play-600 text-[11px] font-semibold">+ Add installment</p>
                  <p className="text-ink-400 text-[10.5px] tabular-nums">
                    Deposit {money2(DEPOSIT)} + installments {money2(PER * 3)} = {money2(FEE)} ✓
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-ink-700 mb-0.5 block text-[11px] font-semibold">
                  Message <span className="text-ink-400 font-normal">(optional)</span>
                </span>
                <span className="border-ink-200 text-ink-800 block truncate rounded-xl border px-2 py-1 text-[11.5px]">
                  {OFFER_MESSAGE}
                </span>
              </div>
            </div>
            <div className="mt-1.5">
              <span className="text-ink-700 mb-0.5 block text-[11px] font-semibold">Expires in</span>
              <div className="flex flex-wrap gap-1">
                {[3, 5, 7, 10, 14].map((d) => (
                  <span
                    key={d}
                    data-demo-target={d === EXPIRES_DAYS ? "expiry-10" : undefined}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors duration-200",
                      expiry && d === EXPIRES_DAYS
                        ? "border-play-500 bg-play-50 text-play-700"
                        : !expiry && d === 7
                          ? "border-play-500 bg-play-50 text-play-700"
                          : "border-ink-200 text-ink-600 bg-white"
                    )}
                  >
                    {d} days
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-2.5 flex justify-end gap-1.5">
              <span className="border-ink-200 text-ink-600 rounded-xl border px-3 py-1.5 text-[12.5px] font-semibold">
                Cancel
              </span>
              <span
                data-demo-target="send-btn"
                className="bg-play-600 rounded-xl px-3 py-1.5 text-[12.5px] font-semibold text-white data-[demo-press=true]:brightness-95"
              >
                Send to {SIGNUPS.length} players
              </span>
            </div>
          </div>
        ) : (
          <div>
            <h3 className="text-ink-900 text-[15px] font-bold leading-tight">
              Send Offers · {TEAM}
            </h3>
            <p className="text-ink-500 mt-0.5 text-[11.5px] leading-snug">
              Compose the packages once; everyone you tick gets the same offer.
            </p>

            <div className="border-ink-100 mt-2 h-[70px] space-y-0.5 overflow-hidden rounded-xl border p-2">
              {SIGNUPS.map((s) => (
                <span
                  key={s.player}
                  className="text-ink-800 flex items-center gap-1.5 text-[12px]"
                >
                  <Tick on />
                  <span className="truncate">{s.player}</span>
                </span>
              ))}
            </div>
            <p className="text-ink-400 mt-1 text-[10.5px]">
              {SIGNUPS.length} of {SIGNUPS.length} eligible selected
            </p>

            <div className="border-ink-200 bg-ink-50/40 mt-1.5 space-y-1.5 rounded-xl border p-2.5">
              <div className="flex items-center gap-1.5">
                <span className="bg-play-100 text-play-700 shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold">
                  Option 1
                </span>
                <span className="border-ink-200 text-ink-900 min-w-0 flex-1 rounded-lg border bg-white px-1.5 py-0.5 text-[12px] font-semibold">
                  Fall/Winter Rep
                </span>
              </div>
              <div className="text-ink-500 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="flex items-center gap-1">
                  Fee $
                  <span data-demo-target="fee-input" className="border-ink-200 rounded-lg border bg-white px-1.5 py-0.5">
                    <span className={cn("text-[12px] font-medium tabular-nums", repFee ? "text-ink-900" : "text-ink-400")}>
                      {repFee ? repFeeTyped : "0"}
                    </span>
                    {typingRepFee && (
                      <span className="bg-play-600 ml-0.5 inline-block h-3 w-[2px] align-middle" />
                    )}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  Installments
                  <span className="border-ink-200 text-ink-900 rounded-lg border bg-white px-1.5 py-0.5 text-[12px] font-medium tabular-nums">
                    4
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  Practices
                  <span className="border-ink-200 text-ink-900 rounded-lg border bg-white px-1.5 py-0.5 text-[12px] font-medium tabular-nums">
                    48
                  </span>
                </span>
              </div>
              <div className="text-ink-600 flex flex-wrap gap-x-2.5 gap-y-1 text-[11px]">
                {[
                  ["Uniform", true],
                  ["Tracksuit", true],
                  ["Shoes", true],
                  ["Basketball", true],
                  ["Bag", false],
                ].map(([label, on]) => (
                  <span key={label as string} className="flex items-center gap-1">
                    <Tick on={on as boolean} />
                    {label}
                  </span>
                ))}
              </div>
              <div className="border-ink-200 text-ink-600 flex flex-wrap items-center gap-2.5 border-t pt-1.5 text-[11px] font-medium">
                <span className="flex items-center gap-1">
                  <Tick on />
                  Pay in full
                </span>
                <span data-demo-target="plan-toggle" className="flex items-center gap-1">
                  <Tick on={false} />
                  Payment plan (deposit + installments)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** The composer's native checkbox, drawn rather than typed. */
function Tick({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid h-3 w-3 shrink-0 place-items-center rounded-[3px] border",
        on ? "border-play-600 bg-play-600 text-white" : "border-ink-300 bg-white"
      )}
    >
      {on && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="h-2 w-2">
          <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  )
}

/** `/clubs/[id]/teams/[teamId]/roster`: the manager bar and the real table. */
function RosterBoard() {
  return (
    <div className="h-full overflow-hidden">
      <Back label="Team Dashboard" />
      <h2 className="font-condensed text-ink-950 mt-0.5 text-[18px] font-bold uppercase leading-none tracking-wide">
        {TEAM} - Roster
      </h2>
      <p className="text-ink-500 mt-1 text-[11px] font-medium">
        {AGE} MALE - Fall/Winter 2026-27
      </p>

      {/* roster-manager.tsx, collapsed. */}
      <div className="border-ink-100 shadow-soft mt-1.5 flex items-center justify-between gap-2 rounded-[22px] border bg-white px-3 py-2">
        <span className="flex items-center gap-2">
          <span className="h-4 w-1 shrink-0 rounded-full bg-[var(--brand)]" aria-hidden="true" />
          <span className="font-condensed text-ink-950 text-[14px] font-bold uppercase leading-none tracking-wide">
            Add players manually
          </span>
        </span>
        <span className="text-ink-400 text-[12px]">▾</span>
      </div>

      <div
        data-demo-target="roster-list"
        className="border-ink-100 shadow-soft mt-1.5 overflow-hidden rounded-[22px] border bg-white"
      >
        <table className="w-full">
          <thead className="bg-ink-50">
            <tr className="text-ink-500 text-[9px] font-semibold uppercase tracking-wider">
              <th className="px-1.5 py-1.5 text-left">#</th>
              <th className="px-1 py-1.5 text-left">Player</th>
              <th className="px-1 py-1.5 text-left">Uni</th>
              <th className="px-1 py-1.5 text-left">Track</th>
              <th className="px-1 py-1.5 text-left">Shoes</th>
              <th className="px-1.5 py-1.5 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-ink-100 divide-y">
            {ROSTER.map((p, i) => {
              const mine = p.name === PLAYER
              return (
                <tr
                  key={p.name}
                  data-demo-target={mine ? "row-darius" : undefined}
                  className="live-row-in"
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <td className="px-1.5 py-1">
                    <PlayerMug
                      name={p.name}
                      accentKey={p.id}
                      jerseyNumber={p.num}
                      sizeClassName="h-7 w-7 rounded-full"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <div className="text-ink-900 max-w-[92px] truncate text-[12px] font-medium">
                      {p.name}
                    </div>
                    <div className="text-ink-500 text-[9.5px]">MALE</div>
                  </td>
                  <td className="text-ink-600 px-1 py-1 text-[11px]">{p.uniform}</td>
                  <td className="text-ink-600 px-1 py-1 text-[11px]">{p.tracksuit}</td>
                  <td className="text-ink-600 px-1 py-1 text-[11px] tabular-nums">{p.shoe}</td>
                  <td data-demo-target={mine ? "row-status" : undefined} className="px-1.5 py-1">
                    <Badge tone="court" small>
                      Finalized
                    </Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── The parent's handset ────────────────────────────────────────────────── */

function ParentPhone({
  view,
  listed,
  picked,
  sizes,
  prefs,
  banner,
}: {
  view: string
  listed: boolean
  picked: boolean
  sizes: boolean
  prefs: boolean
  banner: boolean
}) {
  const offers = view === "offer" || view === "offer-sizes" || view === "offer-plan"
  return (
    <div className="relative flex h-full flex-col bg-[#f6f7f9]">
      <div className="flex items-baseline gap-2 bg-[#0b1628] px-4 pb-2 pt-1.5 text-white">
        <p className="text-[14px] font-bold leading-tight">{PARENT}</p>
        <p className="text-[12px] font-medium text-white/60">Parent · two players</p>
      </div>

      <div key={view} className="demo-fade-in min-h-0 flex-1 overflow-hidden">
        {view === "events" && <EventsBrowse listed={listed} />}
        {(view === "tryout" || view === "registered") && (
          <TryoutListing picked={picked} registered={view === "registered"} />
        )}
        {offers && <OffersPage view={view} sizes={sizes} prefs={prefs} />}
        {view === "accepted" && <PastOffers />}
      </div>

      {banner && <PushBanner />}

      {/* `/events` and `/tryouts/[id]` are neither of the bar's tabs, so the
          real bar highlights nothing there (bottom-tabs.tsx `isActive`). */}
      <TabBar active={offers || view === "accepted" ? "My Kids" : ""} context="parent" />
    </div>
  )
}

/** `/events` — the filter pills and the program cards, at handset scale. */
function EventsBrowse({ listed }: { listed: boolean }) {
  return (
    <div className="h-full overflow-hidden px-3 py-2">
      <p className="text-ink-500 text-[10px] font-black uppercase tracking-[0.18em]">
        Around the hub
      </p>
      <h1 className="font-condensed text-ink-950 text-[19px] font-bold uppercase leading-none tracking-wide">
        Find Programs &amp; Tryouts
      </h1>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {["All", "Tryouts", "House Leagues", "Camps"].map((f) => (
          <span
            key={f}
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
              f === "Tryouts" ? "bg-play-600 text-white" : "bg-ink-100 text-ink-700"
            )}
          >
            {f}
          </span>
        ))}
      </div>
      <div className="mt-2 space-y-2">
        {listed && (
          <EventCard
            id="p-tryout-card"
            fresh
            club={CLUB}
            name={TRYOUT}
            lead="Tryout in 3 days · Aug 20"
            place={`${VENUE}, ${VENUE_CITY}`}
            meta={`${AGE} • MALE`}
            fee={money(TRYOUT_FEE)}
            spots={`${CAP} spots`}
          />
        )}
        <EventCard
          club="Burlington Force"
          name="Burlington Force Fall Tryouts · Grade 11"
          lead="Tryout in 9 days · Aug 26"
          place="Sherwood Community Centre, Burlington"
          meta="Grade 11 • MALE"
          fee="$30"
          spots="24 spots"
        />
      </div>
    </div>
  )
}

function EventCard({
  id,
  fresh,
  club,
  name,
  lead,
  place,
  meta,
  fee,
  spots,
}: {
  id?: string
  fresh?: boolean
  club: string
  name: string
  lead: string
  place: string
  meta: string
  fee: string
  spots: string
}) {
  return (
    <div
      data-demo-target={id}
      className={cn(
        "border-ink-100 shadow-soft overflow-hidden rounded-[22px] border bg-white",
        fresh && "live-row-in"
      )}
    >
      <div
        className="relative h-[62px] overflow-hidden"
        style={{
          background:
            "linear-gradient(125deg, var(--stage-2), var(--stage) 55%, rgba(15,23,42,0.88))",
        }}
      >
        <span className="pointer-events-none absolute -right-4 -top-6 h-20 w-20 rounded-full bg-white/15 blur-2xl" />
        <span className="font-condensed pointer-events-none absolute -bottom-2 right-2 text-[38px] font-black leading-none text-white/15">
          {crestOf(club)}
        </span>
        <span className="absolute left-2.5 top-2 rounded-full bg-black/35 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-white">
          Tryout
        </span>
        <p className="absolute bottom-2 left-2.5 right-14 truncate text-[11.5px] font-bold text-white">
          {lead}
        </p>
      </div>
      <div className="p-2.5">
        <h3 className="text-ink-950 text-[13.5px] font-extrabold leading-snug">{name}</h3>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="bg-ink-100 text-ink-700 grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[9px] font-bold">
            {crestOf(club)}
          </span>
          <span className="text-ink-800 min-w-0 flex-1 truncate text-[11.5px] font-bold">
            {club}
          </span>
        </div>
        <div className="text-ink-500 mt-1 space-y-0.5 text-[10.5px]">
          <div className="truncate">{place}</div>
          <div>{meta}</div>
        </div>
        <div className="border-ink-100 mt-1.5 flex items-end justify-between gap-2 border-t pt-1.5">
          <span>
            <span className="font-condensed text-hoop-600 block text-[19px] font-black leading-none">
              {fee}
            </span>
            <span className="text-ink-400 mt-0.5 block text-[10px] font-semibold">{spots}</span>
          </span>
          <span className="text-play-700 text-[11px] font-extrabold">View →</span>
        </div>
      </div>
    </div>
  )
}

/**
 * `/tryouts/[id]` with `program-signup-form.tsx` under it.
 *
 * The form lives in the page's sidebar card, so registering swaps THAT card
 * for the green success panel and leaves the tryout above it, exactly as the
 * real page does.
 */
function TryoutListing({ picked, registered }: { picked: boolean; registered: boolean }) {
  return (
    <div className="h-full overflow-hidden">
      {/* The club band, in the club's own colour. */}
      <div className="border-b border-black/10 bg-[#1d4ed8] px-3 pb-1 pt-0.5">
        <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/80">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3">
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Events
        </p>
        <h2 className="font-condensed text-[15px] font-bold uppercase tracking-wide text-white">
          {CLUB}
        </h2>
      </div>

      <div className="px-3 py-1.5">
        <div className="border-ink-100 shadow-soft rounded-[22px] border bg-white p-2">
          <Badge tone="court" dot>
            Open
          </Badge>
          <h1 className="text-ink-900 font-condensed mt-0.5 text-[18px] font-bold leading-tight">
            {TRYOUT}
          </h1>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            <InfoTile label="Date &amp; Time" value={`${TRYOUT_DAY}, 2026`} note={`${TRYOUT_TIME} (${TRYOUT_MINUTES} min)`} />
            <InfoTile label="Location" value={VENUE} note={VENUE_CITY} />
          </div>
        </div>

        {registered ? (
          /* program-signup-form.tsx lines 232 to 278, the real success render. */
          <div className="mt-1.5">
            <div className="live-pop rounded-2xl border border-green-200 bg-green-50 p-2.5">
              <h3 className="mb-0.5 text-[14px] font-semibold text-green-800">Registered!</h3>
              <p className="text-court-700 text-[12px] leading-snug">
                <strong>{PLAYER}</strong> is registered for {TRYOUT}.
              </p>
              <p className="text-court-700 mt-1 text-[12px] leading-snug">
                Total <strong>{money2(TRYOUT_FEE)}</strong> · the club accepts cash or e-transfer;
                pay them directly and they&apos;ll mark it received.
              </p>
            </div>
            <p
              data-demo-target="offline-line"
              className="text-ink-500 border-ink-100 mt-1.5 rounded-xl border bg-white px-2.5 py-1.5 text-[11px] leading-snug"
            >
              {OFFLINE_LINE}
            </p>
            <p className="mt-1.5 text-center text-[12px] font-semibold text-[color:var(--brand-ink)]">
              Done
            </p>
          </div>
        ) : (
          <div className="border-ink-100 shadow-soft mt-1.5 rounded-[22px] border bg-white p-2">
            <div className="text-center">
              <div className="font-condensed text-[20px] font-bold leading-none text-[#1d4ed8]">
                {money2(TRYOUT_FEE)}
              </div>
              <p className="text-ink-500 text-[9.5px]">per player</p>
            </div>

            <p className="text-ink-800 mt-1 text-[12px] font-medium">
              Who&apos;s playing? <span className="text-red-500">*</span>
            </p>
            <div data-demo-target="who-list" className="mt-1 space-y-1">
              <KidRow id="kid-darius" name={PLAYER} born={PLAYER_BORN} checked={picked} />
              <KidRow name={SISTER} born={SISTER_BORN} warn="Outside age group" />
            </div>

            <div className="mt-1.5">
              <Btn
                id="register-btn"
                block
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                }
              >
                Register · {money2(TRYOUT_FEE)}
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoTile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="border-ink-100 rounded-xl border bg-white px-2 py-1.5 shadow-[0_16px_50px_-38px_rgba(15,23,42,0.4)]">
      <p className="text-ink-400 text-[9px] font-semibold uppercase tracking-wide">{label}</p>
      <p className="text-ink-900 text-[12px] font-semibold leading-tight">{value}</p>
      <p className="text-ink-600 text-[10px] leading-tight">{note}</p>
    </div>
  )
}

function KidRow({
  id,
  name,
  born,
  checked,
  warn,
}: {
  id?: string
  name: string
  born: number
  checked?: boolean
  warn?: string
}) {
  return (
    <span
      data-demo-target={id}
      className={cn(
        "flex items-start gap-2 rounded-xl border px-2 py-1.5 transition-colors duration-300",
        warn
          ? "border-ink-100 bg-ink-50/60"
          : checked
            ? "border-[color:var(--brand)] bg-[color:var(--brand-wash,#faf7f2)]"
            : "border-ink-200 bg-white"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded border",
          checked ? "border-play-600 bg-play-600 text-white" : "border-ink-300 bg-white"
        )}
      >
        {checked && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="h-2.5 w-2.5">
            <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className={cn("text-[12.5px] font-semibold", warn ? "text-ink-400" : "text-ink-900")}>
            {name}
          </span>
          <span className="text-ink-400 text-[10.5px]">b. {born}</span>
          {warn && (
            <span className="bg-hoop-100 text-hoop-700 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold">
              {warn}
            </span>
          )}
        </span>
        {warn && (
          <span className="text-ink-500 block text-[10px] leading-snug">
            {name.split(" ")[0]} is above this age group · register anyway if the organizer allows.
          </span>
        )}
      </span>
    </span>
  )
}

/** `/offers`: the pending card, and `offer-response-form.tsx` under it. */
function OffersPage({ view, sizes, prefs }: { view: string; sizes: boolean; prefs: boolean }) {
  const open = view !== "offer"
  return (
    <div className="h-full overflow-hidden px-3 py-2">
      {view !== "offer-plan" && (
        <>
          <div className="border-ink-100 shadow-soft rounded-[22px] border bg-white p-2.5">
            <span className="border-play-100 bg-play-50 text-play-600 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em]">
              Offers
            </span>
            <h1 className="font-condensed text-ink-950 mt-1 text-[20px] font-bold uppercase leading-none tracking-wide">
              My offers
            </h1>
          </div>

          <h2 className="font-condensed text-ink-950 mt-2 flex items-center gap-2 text-[15px] font-bold uppercase leading-none tracking-wide">
            <span className="bg-gold-400 h-4 w-1.5 shrink-0 rounded-full" aria-hidden="true" />
            Pending (1)
          </h2>
        </>
      )}

      <div
        data-demo-target="offer-card"
        className="border-play-200 shadow-soft mt-1.5 rounded-2xl border bg-white p-2.5"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-ink-950 text-[14px] font-semibold">{CLUB}</h3>
            <p className="text-ink-600 truncate text-[11.5px]">
              {TEAM} &middot; {AGE}
            </p>
            <p className="text-ink-500 text-[11.5px]">
              For <strong>{PLAYER}</strong>
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-condensed text-ink-950 text-[20px] font-bold leading-none">
              {money(FEE)}
            </div>
            <div className="text-ink-500 text-[10px]">4 installments</div>
          </div>
        </div>

        {view === "offer" && (
          <>
            <div className="border-play-200 bg-play-50 mt-2 rounded-xl border p-2">
              <div className="text-play-700 mb-1 text-[10px] font-medium">What&apos;s included:</div>
              <div className="flex flex-wrap gap-1">
                {["48 practice sessions", "Uniform (Shirt + Shorts)", "Tracksuit", "Shoes", "Basketball"].map(
                  (i) => (
                    <span
                      key={i}
                      className="bg-play-100 text-play-700 rounded-full px-1.5 py-0.5 text-[10px]"
                    >
                      {i}
                    </span>
                  )
                )}
              </div>
            </div>
            <div className="bg-ink-50 text-ink-700 mt-1.5 rounded-xl p-2 text-[11.5px] italic leading-snug">
              &ldquo;{OFFER_MESSAGE}&rdquo;
            </div>
            <div className="text-ink-500 mt-1.5 flex items-center justify-between text-[10px]">
              <span>Received Aug 20, 2026</span>
              <span>Expires Aug 30, 2026</span>
            </div>
            <div className="mt-2 flex gap-2">
              <span
                data-demo-target="accept-open"
                className="bg-court-600 flex-1 rounded-xl px-3 py-1.5 text-center text-[12.5px] font-semibold text-white data-[demo-press=true]:brightness-95"
              >
                Accept Offer
              </span>
              <span className="bg-hoop-50 text-hoop-700 flex-1 rounded-xl px-3 py-1.5 text-center text-[12.5px] font-semibold">
                Decline
              </span>
            </div>
          </>
        )}

        {open && <AcceptForm plan={view === "offer-plan"} sizes={sizes} prefs={prefs} />}
      </div>
    </div>
  )
}

/**
 * `offer-response-form.tsx`, the court-50 panel that opens inside the card.
 *
 * The real form is longer than a handset, so the demo films its two halves the
 * way a guardian scrolls them: the sizes and the numbers, then the payment
 * panel and the button.
 */
function AcceptForm({ plan, sizes, prefs }: { plan: boolean; sizes: boolean; prefs: boolean }) {
  return (
    <div className="border-court-200 bg-court-50 mt-2 rounded-2xl border p-2.5">
      <h4 className="text-ink-900 mb-2 text-[13px] font-semibold">Accept Offer</h4>

      {!plan ? (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-1.5">
            {[
              ["Uniform Size", UNIFORM, "size-uniform"],
              ["Tracksuit Size", TRACKSUIT, undefined],
              ["Shoe Size", SHOE, undefined],
            ].map(([label, value, id]) => (
              <div key={label as string}>
                <span className="text-ink-800 block text-[10.5px] font-medium">
                  {label}
                  <span className="text-red-500"> *</span>
                </span>
                <span className="mt-0.5 block">
                  <Listbox id={id as string | undefined} filled={sizes} compact>
                    {sizes ? (value as string) : "Select..."}
                  </Listbox>
                </span>
              </div>
            ))}
          </div>

          <div>
            <span className="text-ink-800 mb-1 block text-[10.5px] font-medium">
              Jersey Number Preferences <span className="text-red-500">*</span>
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {["1st", "2nd", "3rd"].map((c, i) => (
                <span key={c} className="block">
                  <span className="text-ink-500 mb-0.5 block text-[9.5px]">{c} Choice</span>
                  <Input
                    id={i === 0 ? "pref-1" : undefined}
                    value={prefs ? String(PREFS[i]) : ""}
                    placeholder="#"
                    center
                  />
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div data-demo-target="plan-card" className="border-ink-100 rounded-xl border bg-white p-2">
          <p className="text-ink-800 text-[12px] font-semibold">Payment</p>
          <div className="mt-1.5 space-y-1.5">
            <PlanChoice
              title="Pay in full"
              selected={false}
              body={
                <>
                  <strong className="text-ink-900">{money2(FEE)}</strong> now
                </>
              }
            />
            <PlanChoice
              title="Payment plan"
              selected
              body={
                <>
                  <strong className="text-ink-900">{money2(DEPOSIT)}</strong> deposit now, then{" "}
                  {TERMS.map((t, i) => (
                    <span key={t.label}>
                      {i > 0 ? ", " : ""}
                      {money2(t.amount)} on {t.due}
                    </span>
                  ))}
                  <span className="text-ink-400 mt-0.5 block text-[9.5px]">
                    Auto-charged to your card on file.
                  </span>
                </>
              }
            />
          </div>

          <div className="border-play-500 bg-play-50 mt-1.5 flex items-center gap-2 rounded-xl border px-2 py-1.5">
            <span className="border-play-500 bg-play-500 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border-2">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            </span>
            <span className="text-ink-900 text-[12px] font-bold">Visa •••• 4242</span>
            <span className="rounded-full bg-[#fef3c7] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#78350f]">
              Default
            </span>
          </div>
          <p className="text-ink-500 mt-1.5 text-[10.5px]">
            Due now: <strong>{money2(DEPOSIT)}</strong>
          </p>

          <div className="mt-2 flex gap-2">
            <span
              data-demo-target="accept-btn"
              className="bg-play-600 rounded-xl px-3 py-1.5 text-[12.5px] font-semibold text-white data-[demo-press=true]:brightness-95"
            >
              Pay {money2(DEPOSIT)} &amp; Accept
            </span>
            <span className="border-ink-200 text-ink-700 rounded-xl border bg-white px-3 py-1.5 text-[12.5px] font-medium">
              Cancel
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

/** `components/ui/choice-card.tsx`, at handset scale. */
function PlanChoice({
  title,
  body,
  selected,
}: {
  title: string
  body: ReactNode
  selected: boolean
}) {
  return (
    <span
      className={cn(
        "flex w-full items-start gap-2 rounded-xl border px-2 py-1.5 text-left",
        selected ? "border-play-500 bg-play-50" : "border-ink-200 bg-white"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border-2",
          selected ? "border-play-500 bg-play-500" : "border-ink-300 bg-white"
        )}
      >
        {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-ink-900 block text-[12px] font-bold leading-tight">{title}</span>
        <span className="text-ink-600 mt-0.5 block text-[10.5px] leading-snug">{body}</span>
      </span>
    </span>
  )
}

/** `/offers` after the accept: the offer moves into Past Offers, ACCEPTED. */
function PastOffers() {
  return (
    <div className="h-full overflow-hidden px-3 py-2">
      <div className="border-ink-100 shadow-soft rounded-[22px] border bg-white p-2.5">
        <span className="border-play-100 bg-play-50 text-play-600 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em]">
          Offers
        </span>
        <h1 className="font-condensed text-ink-950 mt-1 text-[20px] font-bold uppercase leading-none tracking-wide">
          My offers
        </h1>
        <p className="text-ink-500 mt-0.5 text-[11px]">Team offers for your players</p>
      </div>

      <h2 className="font-condensed text-ink-950 mt-2 flex items-center gap-2 text-[15px] font-bold uppercase leading-none tracking-wide">
        <span className="bg-ink-300 h-4 w-1.5 shrink-0 rounded-full" aria-hidden="true" />
        Past Offers (1)
      </h2>

      <div
        data-demo-target="past-card"
        className="border-court-200 bg-court-50 live-pop mt-1.5 rounded-xl border p-2.5"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="text-ink-900 block text-[12.5px] font-medium leading-snug">
              {CLUB} - {TEAM}
            </span>
            <span className="text-ink-500 block text-[11.5px]">for {PLAYER}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <Badge tone="court">accepted</Badge>
            <span className="text-ink-400 text-[10px]">Aug 20</span>
          </span>
        </div>
        <div className="text-ink-600 mt-1.5 text-[10.5px] leading-snug">
          Uniform: {UNIFORM} | Tracksuit: {TRACKSUIT} | Shoes: {SHOE} | Jersey prefs: #{PREFS[0]}, #
          {PREFS[1]}, #{PREFS[2]}
        </div>
      </div>

      <div className="border-ink-100 shadow-soft mt-2 rounded-xl border bg-white p-2.5">
        <p className="text-ink-800 text-[11.5px] font-semibold">Next charge</p>
        <p className="text-ink-500 mt-0.5 text-[11px] leading-snug">
          {money2(PER)} on {TERMS[0].due}, 2026 · then {TERMS[1].due} and {TERMS[2].due}.
        </p>
      </div>
    </div>
  )
}

/** An iOS-style push dropping from the top of the handset (R8). */
function PushBanner() {
  return (
    <div className="demo-banner-in absolute left-1.5 right-1.5 top-1.5 z-30">
      <div
        data-demo-target="w-open"
        className="rounded-[18px] border border-black/5 bg-white/95 p-2.5 shadow-[0_10px_30px_rgba(11,22,40,0.28)] backdrop-blur"
      >
        <div className="flex items-start gap-2.5">
          <AppIcon className="h-9 w-9 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-ink-400 text-[10px] font-semibold uppercase tracking-[0.06em]">
                SportsHub One
              </p>
              <p className="text-ink-400 text-[10px]">now</p>
            </div>
            <p className="text-ink-950 text-[13px] font-semibold leading-tight">{PUSH_TITLE}</p>
            <p className="text-ink-600 line-clamp-2 text-[12px] leading-snug">{PUSH_MESSAGE}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── The bottom bar, from `components/nav/bottom-tabs.tsx` ───────────────── */

const TAB_ICONS: Record<string, ReactNode> = {
  Home: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10 12 3l9 7" />
      <path d="M5 10v10h14V10" />
    </svg>
  ),
  Chat: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Calendar: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  "My Club": (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  ),
  "My Kids": (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="7" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3 20a6 6 0 0 1 12 0M14 20a5 5 0 0 1 7-4.6" />
    </svg>
  ),
  Social: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2c0 5.5 2 8.5 10 10M12 22c0-5.5-2-8.5-10-10" />
    </svg>
  ),
}

/** The real bar: icon over label, and the active tab in its energy capsule. */
function TabBar({ active, context }: { active: string; context: "club" | "parent" }) {
  const tabs = ["Home", "Chat", "Calendar", context === "club" ? "My Club" : "My Kids", "Social"]
  return (
    <div className="border-ink-100 flex shrink-0 items-stretch justify-around border-t bg-white/95 px-1 pb-2 pt-1">
      {tabs.map((t) => (
        <span key={t} className="flex min-w-[54px] flex-col items-center justify-center px-0.5 py-1">
          <span
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 rounded-2xl px-2.5 py-0.5 text-[10px] font-bold",
              t === active ? "bg-energy text-energy-on" : "text-ink-600"
            )}
          >
            {TAB_ICONS[t]}
            {t}
          </span>
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
          From tryouts to a full team
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
