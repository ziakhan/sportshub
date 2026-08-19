"use client"

import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import { CourtBackdropLayer } from "@/components/ui/court-backdrop"
import type { DemoBeat, DemoScript } from "../types"
import { AppIcon } from "./your-week-story"

/**
 * "Claim your club and make it yours", rebuilt 2026-08-16 to the gold standard
 * and completed 2026-08-19 to the REALISM standard (mock-ui.tsx R1-R8).
 *
 * The 08-16 cut got the facts right and drew them on invented furniture: a
 * three-across card grid the directory does not have, a "what the code is
 * protecting" panel the product never raises, a court-tinted reservation card,
 * an audit-log panel nobody ships, and a branding screen with a made-up layout
 * grid. It also stopped before the flow's real ending: it jumped from "Take
 * ownership" straight to owning, skipping the completion page, the account and
 * the redemption that actually bind the club to a person. Every screen below is
 * now the real component's markup, and the flow runs to its real end state.
 *
 * ── WHAT SURVIVED FROM THE GOLD-STANDARD PASS (all of the truth work) ───────
 *
 * THE CLUB IS REAL AND SO IS ITS LISTING. `DB` `Tenant fb71b08a`, "Alpha Elite
 * Sports Group", UNCLAIMED, published 2026-08-15, `dataSources`
 * "contact-enrichment,geocode,ontario-circuit-list,website-scrape". Its city
 * reads "Toronto ON" with the province stuck on the end, so the page's own
 * location chip reads "Toronto ON, ON, CA"; its phone is ten unbroken digits
 * and its website has no scheme. That is what an imported listing really looks
 * like and exactly why the flow has a corrections step.
 *
 * THE FLOW IS CLAIM-V2, VERBATIM. `lib/claims/claim-v2.ts` documents itself:
 *
 *   anonymous claim → code to the club's contact ON FILE (census data)
 *   → verify → completion token + ~14-day reservation
 *   → register/sign in with the token → claim binds to the User
 *   → club CLAIMED (ClubOwner role), claim-time corrections applied.
 *
 * Every constant on screen is that module's: `CODE_TTL_MINUTES` 30,
 * `CODE_ATTEMPT_CAP` 5, `RESERVATION_DAYS` 14. Every masked hint is
 * `maskEmail`/`maskPhone` from `lib/sms.ts`, run for real against this club's
 * own row rather than typed by hand.
 *
 * ONE IDENTITY LAW, AND WHY THIS DOES NOT BREAK IT. Claiming is PRE-IDENTITY:
 * the wizard is anonymous, and proof of control is that the code lands at the
 * contact already on file, never at an address the claimer types. Ownership
 * binds at the END, to whichever signed-in `User` redeems the token, and the
 * product says so in its own words: "the club binds to your account, not the
 * inbox that got the code". Written up in `docs/roadmap/claim-numbers.md` §0.
 *
 * TWO THINGS THE DEMO DOES NOT PRETEND ABOUT (numbers sheet §F):
 *   1. THE TEXT CHANNEL IS NOT AVAILABLE ON THIS MACHINE. `smsEnabled()`
 *      requires three Twilio variables and none is set, so `getClaimOptions`
 *      returns the email option and the proof option and nothing else. The
 *      wizard draws the two it really returns.
 *   2. A CLAIMED CLUB IS STILL NEUTRAL UNTIL SOMEBODY PICKS A COLOUR.
 *      `hasChosenBrand()` (lib/club-page/brand.ts) refuses every UNCLAIMED
 *      listing outright, whatever hex sits on its record, so the branding
 *      chapter is not decoration: it is the step that turns the colour on.
 *
 * ── TRUTH TO THE PRODUCT, SCREEN BY SCREEN (R1: classes copied, files cited) ─
 *
 *   · the directory is `app/(public)/club/page.tsx` inside the `(public)`
 *     layout's `bg-[#fafafa]` ground: `components/ui/page-band.tsx` (daylight
 *     CourtBackdropLayer, the sienna eyebrow, the 40px display title, the lead
 *     line), `club-search.tsx`'s rounded-2xl input with its magnifier and its
 *     play-600 Search button, then the THREE labelled chip rows the page really
 *     draws (Province with its per-province counts, Greater Toronto, More
 *     Ontario) and the "Featured clubs" grid with its gold ring. Counts, cities
 *     and club names are read off the running directory, not composed;
 *   · the search dropdown is `club-search.tsx`'s portal panel: shadow-panel
 *     rounded-2xl, one row per club, `Crest` at h-10 w-10 rounded-2xl and the
 *     "city, province" line under the name. `/api/clubs/public?q=Alpha Elite`
 *     returns exactly ONE club, so the demo's dropdown holds exactly one row;
 *   · the public page is `app/(public)/club/[slug]/page.tsx`: SmartBack, the
 *     daylight hero band, the 20/28 crest carrying the club's initial, the 46px
 *     display name, the location pill with its pin, the description line, the
 *     Contact / "Claim this club" row (bg-ink-950, the exact button an imported
 *     listing shows), the four-cell quick-stats strip on its #e7dbc4 hairline,
 *     the 4px baseline, `club-subnav.tsx`, and the About block from
 *     `club-blocks.tsx` on the theme's ground;
 *   · the wizard is `app/(public)/claim/[tenantId]/claim-wizard.tsx` in its
 *     `options` step: the rounded-[28px] shadow-soft card, the uppercase
 *     eyebrow, the condensed 3xl name, the sentence, the two channel buttons
 *     (selected = border-play-500 bg-play-50) with the proof hint, the
 *     corrections toggle and the real five-input `sm:grid-cols-2` grid in the
 *     product's own order, and the full-width Button;
 *   · the code step is the same card's `code` step: the sent-to sentence with
 *     the masked address in <strong>, the font-mono 2xl input on tracking
 *     [0.5em], and Verify. The 08-16 cut's "what the code is protecting" panel
 *     is DELETED: the product raises no such panel, and R1 outranks a nice box;
 *   · the verified step is the same card's `verified` step: the success Badge,
 *     the reservation sentence with "your account" in italics, the play-600
 *     "Take ownership" link and the ink-400 line about the emailed copy;
 *   · the completion page is `app/(public)/claim/complete/page.tsx` +
 *     `complete-claim.tsx`, on its real daylight CourtBackdrop, centred: the
 *     "Take ownership" eyebrow, the verified-and-reserved sentence and the two
 *     stacked buttons, then the same card's DONE state (success Badge, the
 *     condensed name, "You're the owner…", "Go to your club dashboard");
 *   · the account is `app/(auth)/sign-up/[[...sign-up]]`: the rounded-[30px]
 *     card on the auth court, the hoop eyebrow pill, "Create your account", the
 *     Google button, the "or" rule and the real field grid. Public signups are
 *     CLOSED right now (`PUBLIC_SIGNUPS=false`) and a claim completion token in
 *     the callbackUrl is one of exactly two things that opens the form, which
 *     is why this screen exists here at all;
 *   · the branding screen is `app/(platform)/clubs/[id]/customize/page.tsx`'s
 *     header plus `club-page-editor.tsx`'s "Brand" Section (banner and logo
 *     upload fields, Tagline, Description, and the Primary / Secondary / Accent
 *     colour pickers) over its sticky save bar;
 *   · the code email is `claim-v2.ts` lines 213 to 226, rendered inside OS Mail
 *     chrome with the route's own HTML: the Arial max-width 600 body, the
 *     32px letter-spaced code on its #f5f5f5 chip, and the expiry sentence,
 *     word for word. The mail app is chrome and invents no product UI (R8), and
 *     its sender mark is the approved app icon rather than a redrawn logo.
 *
 * ── DELIBERATE DEPARTURES, ALL DECLARED ─────────────────────────────────────
 *   · THE HERO HEADING IS DRAWN IN ITS OWN `text-ink-950`. On the live page the
 *     club theme module (`club-theme.module.css`) re-points every ink utility
 *     at `--club-ink`, which puts near-white type on the daylight band. That is
 *     a contrast defect in the product, not a look a demo should teach, so the
 *     header keeps the ink its own markup asks for. Everything below the band
 *     is drawn on the theme's real ground.
 *   · COMPOSITION, not invention. The pane is 1160x600 and these pages are
 *     taller, so they sit in it exactly as they would in a 600px browser
 *     window: the directory shows the band and the featured pair with the club
 *     grid starting at the fold, and the club page shows the hero and the top
 *     of the body. The claim card is CENTRED rather than pinned to the top the
 *     way the real page pins it, so a three-step card is not floating over
 *     200px of empty ground. The customize page opens ON the Brand card, with
 *     its spacing tightened enough to keep the sticky save bar in frame: the
 *     Club Page Studio sits above it and is scrolled past, because the two
 *     controls that reach the public hero (the club's own colour and its
 *     tagline) are both on Brand.
 *   · THE SAVE MESSAGE READS "Saved · your public page is updated." The product
 *     string carries an em-dash, which the house copy law forbids on any user
 *     facing surface, so the demo prints the middot.
 *
 * ── INVENTED-CONTENT LEDGER (everything not read from the running product) ──
 *   · the person who claims the club: "Dana Okafor", dana.okafor@gmail.com. A
 *     personal address on purpose, because the point of the screen is that the
 *     account is a person's and any email works;
 *   · the six-digit code 418305 (crypto.randomInt per claim) and the tagline
 *     "Developing players since 2009", which is the product's own placeholder
 *     text on that field;
 *   · the colour the club picks, #7c3aed;
 *   · the mail app shows the recipient as the MASKED address. A real inbox
 *     would show it in full; a public demo of a real club's page should not.
 */

/* ── The listing, read out of the running directory ──────────────────────── */

const CLUB = "Alpha Elite Sports Group"
/** `DB` tenant.city, with the province stuck on the end by the import. */
const CITY_RAW = "Toronto ON"
const CITY_FIXED = "Toronto"
/** `PRODUCT` club/[slug]/page.tsx: `[city, state, country].join(", ")`. */
const SUBTITLE_RAW = "Toronto ON, ON, CA"
const SUBTITLE_FIXED = "Toronto, ON, CA"
/** `DB` tenant.description, which is all the import had to say. */
const DESCRIPTION = "Leagues: NJC; NPH-SL"
const WEBSITE_FIXED = "https://alphaelitesportsgroup.com"
const PHONE_FIXED = "647-618-9295"

/** `PRODUCT` `maskEmail` in `lib/sms.ts`, run against this row's contact. */
const MASKED_EMAIL = "co•••@alphaelitesportsgroup.com"

/** `PRODUCT` `lib/claims/claim-v2.ts` lines 21 to 23. */
const CODE_TTL = 30
const ATTEMPT_CAP = 5
const RESERVATION_DAYS = 14
const CODE = "418305"

/** The person doing the claiming. Invented; see the ledger. */
const CLAIMER = "Dana Okafor"
const CLAIMER_EMAIL = "dana.okafor@gmail.com"

/** `PRODUCT` `lib/club-page/brand.ts`: neutral until a human stands behind it. */
const NEUTRAL_BRAND = "#0f1b33"
const CHOSEN_HEX = "#7c3aed"
const TAGLINE = "Developing players since 2009"
const SAVED = "Saved · your public page is updated."

/** `PRODUCT` `lib/club-page/theme.ts` THEMES[0] "home-court", the ground every
 *  club page resolves to until somebody opens the studio. */
const CLUB_BG = "#0b1729"
const CLUB_PANEL = "#12203a"
const CLUB_INK = "#eef3fb"
const CLUB_MUTED = "#a9bad4"
const CLUB_BORDER = "rgba(255,255,255,0.10)"

/** `DB` the province chip row, counts and all, off the running directory. */
const PROVINCES: Array<[string, number]> = [
  ["Ontario", 378],
  ["British Columbia", 202],
  ["Alberta", 182],
  ["Quebec", 163],
  ["Saskatchewan", 97],
  ["Manitoba", 79],
  ["Nova Scotia", 56],
  ["New Brunswick", 42],
  ["Newfoundland and Labrador", 28],
  ["Northwest Territories", 12],
  ["Prince Edward Island", 10],
]
const GTA = [
  "Toronto",
  "Brampton",
  "Vaughan",
  "Mississauga",
  "Scarborough",
  "Oakville",
  "Burlington",
  "Markham",
  "North York",
  "Etobicoke",
]
const MORE_ON = [
  "London",
  "Hamilton",
  "Ottawa",
  "Windsor",
  "Brantford",
  "Peterborough",
  "Waterloo",
  "Niagara Falls",
]

/** `DB` the two featured slots and the first row of "Top clubs". */
const FEATURED = [
  { name: "Burlington Basketball", meta: "Burlington, ON · 7 teams · 4 tryouts" },
  { name: "Toronto Lords", meta: "Toronto, ON · 6 teams · 5 tryouts" },
]
const TOP = [
  { name: "Royal Crown School", meta: "Scarborough, ON · 4 teams · 3 tryouts" },
  { name: "West United Prep", meta: "Mississauga, ON · 8 teams · 3 tryouts" },
  { name: "Kings Court Academy", meta: "Hamilton, ON · 6 teams · 3 tryouts" },
]

/* ── Pacing ──────────────────────────────────────────────────────────────── */

function paced(b: Omit<DemoBeat, "hold"> & { hold?: number }): DemoBeat {
  if (b.hold) return b as DemoBeat
  /* Human pace (owner 2026-08-19), copied from your-week: people click, then
     click again. Long reads only where a balloon earns one. */
  const arrive = b.cursor ? 620 : 180
  const settle = 400
  const read = b.callout ? b.callout.trim().split(/\s+/).length * 140 + 700 : 1200
  return { ...b, hold: Math.round(arrive + read + (b.callout ? settle : 0)) }
}

/* ── The script ──────────────────────────────────────────────────────────── */

export const claimStory: DemoScript = {
  presentation: "scene",
  desktopUrl: "/club",
  context: "SportsHub · Club directory",
  initialStage: "desktop",
  chapters: [
    { id: "find", title: "Find your club" },
    { id: "prove", title: "Prove it" },
    { id: "reserved", title: "Reserved for you" },
    { id: "brand", title: "Make it yours" },
  ],

  beats: [
    /* ── 1. Find your club ────────────────────────────────────────────── */
    paced({
      id: "open",
      chapter: "find",
      caption: "The directory already holds a listing for most Canadian clubs.",
      emphasize: "provinces",
      callout:
        "Every one of these was built from public league listings, and nobody at the club put it there.",
    }),
    paced({
      id: "search",
      chapter: "find",
      caption: "The first step is finding yours.",
      cursor: "search",
      type: { key: "q", text: "Alpha Elite" },
    }),
    paced({
      id: "result",
      chapter: "find",
      caption: "One club, in Toronto.",
      emphasize: "result",
    }),
    paced({
      id: "open-page",
      chapter: "find",
      caption: "Opening it shows what an imported listing looks like.",
      cursor: "result",
      press: true,
    }),
    paced({
      id: "page",
      chapter: "find",
      caption: "A real page, about a real club, with nothing on it the club chose.",
      set: { view: "page" },
      context: `${CLUB} · public page`,
      emphasize: "location",
      callout: "The province is stuck on the end of the city, exactly as the import left it.",
    }),
    paced({
      id: "claim-btn",
      chapter: "find",
      caption: "That button.",
      cursor: "claim-btn",
      press: true,
      callout: "No account yet. The claim starts before anybody signs up for anything.",
    }),

    /* ── 2. Prove it ──────────────────────────────────────────────────── */
    paced({
      id: "channels",
      chapter: "prove",
      caption: "The claim starts with a code.",
      set: { view: "wizard" },
      context: `${CLUB} · claim`,
      emphasize: "channels",
      callout: "It goes to the contact already on file, so the destination is not a choice.",
    }),
    paced({
      id: "masked",
      chapter: "prove",
      caption: "Enough of the address to recognise, and not enough to write down.",
      emphasize: "channel-email",
    }),
    paced({
      id: "corrections",
      chapter: "prove",
      caption: "Beside it, the corrections.",
      cursor: "corrections-toggle",
      press: true,
    }),
    paced({
      id: "corrections-open",
      chapter: "prove",
      caption: "This listing is wrong in three places.",
      set: { corrections: true },
      emphasize: "corrections-fields",
    }),
    paced({
      id: "fix",
      chapter: "prove",
      caption: "The city, the phone and the website, put right by the person who knows.",
      set: { fixed: true },
      emphasize: "corrections-fields",
      callout: "Nothing is written yet. Corrections apply the moment the claim completes.",
    }),
    paced({
      id: "send",
      chapter: "prove",
      caption: "Send the code.",
      cursor: "send-code",
      press: true,
    }),
    paced({
      id: "code-step",
      chapter: "prove",
      caption: "Six digits, on a clock.",
      set: { view: "code" },
      emphasize: "code-note",
    }),
    paced({
      id: "mail",
      chapter: "prove",
      caption: "It lands in the club's own inbox.",
      set: { mail: true },
      context: "Mail · the club's contact on file",
      emphasize: "mail-code",
      hold: 4600,
      callout:
        "The address came off the club's own record, so a stranger cannot point this at an inbox they control.",
    }),
    paced({
      id: "type-code",
      chapter: "prove",
      caption: "Back on the page, the code.",
      set: { mail: false },
      context: `${CLUB} · claim`,
      cursor: "code-field",
      type: { key: "code", text: CODE },
    }),
    paced({
      id: "verify",
      chapter: "prove",
      caption: "Verify.",
      cursor: "verify-btn",
      press: true,
      callout: `Thirty minutes and ${ATTEMPT_CAP} attempts. After that the claim expires and starts again.`,
    }),

    /* ── 3. Reserved for you ──────────────────────────────────────────── */
    paced({
      id: "verified",
      chapter: "reserved",
      caption: "Verified is not the same as owned.",
      set: { view: "verified" },
      emphasize: "reserved-line",
      callout: `Reserved for ${RESERVATION_DAYS} days, and nobody else can start a claim on it while it is.`,
    }),
    paced({
      id: "identity",
      chapter: "reserved",
      caption: "The club binds to an account, and the account is a person.",
      emphasize: "identity-phrase",
      callout: "The inbox that received the code is not the thing that ends up owning the club.",
    }),
    paced({
      id: "take",
      chapter: "reserved",
      caption: "Take ownership.",
      cursor: "take-btn",
      press: true,
    }),
    paced({
      id: "complete",
      chapter: "reserved",
      caption: "The link opens the completion page, and it asks for one thing.",
      set: { view: "complete" },
      context: "Take ownership of your club",
      emphasize: "complete-card",
    }),
    paced({
      id: "create",
      chapter: "reserved",
      caption: "Create an account.",
      cursor: "create-acct",
      press: true,
    }),
    paced({
      id: "signup",
      chapter: "reserved",
      caption: "The first time the flow has asked for an account at all.",
      set: { view: "signup" },
      context: "Create your account",
      emphasize: "signup-card",
      callout:
        "Any email works, including a personal one, because the account belongs to the person and not to the club.",
    }),
    paced({
      id: "submit",
      chapter: "reserved",
      caption: "Her name, her email, her password.",
      set: { filled: true },
      cursor: "signup-submit",
      press: true,
    }),
    paced({
      id: "owned",
      chapter: "reserved",
      caption: "And the token redeems itself the second she is signed in.",
      set: { view: "owned" },
      context: "Take ownership of your club",
      emphasize: "owned-card",
      callout:
        "One transaction: the listing goes active, the corrections apply, she becomes the owner, and the audit log gets a name against it.",
    }),

    /* ── 4. Make it yours ─────────────────────────────────────────────── */
    paced({
      id: "customize",
      chapter: "brand",
      caption: "The page is now a page the club runs.",
      set: { view: "customize" },
      context: `${CLUB} · customize`,
      emphasize: "brand-card",
      callout: "Everything that reaches the top of the public page is on one card.",
    }),
    paced({
      id: "words",
      chapter: "brand",
      caption: "Their own words first.",
      cursor: "tagline-field",
      type: { key: "tagline", text: TAGLINE },
    }),
    paced({
      id: "colour",
      chapter: "brand",
      caption: "Then a colour.",
      cursor: "colour-field",
      press: true,
    }),
    paced({
      id: "colour-set",
      chapter: "brand",
      caption: "One hex, and the whole page follows it.",
      set: { colour: true },
      emphasize: "colour-field",
      callout:
        "An unclaimed listing is never painted, whatever colour sits on its record, so this is the first colour a person chose.",
    }),
    paced({
      id: "save",
      chapter: "brand",
      caption: "Save.",
      cursor: "save-btn",
      press: true,
    }),
    paced({
      id: "saved",
      chapter: "brand",
      caption: "It reaches the public page as soon as it is saved.",
      set: { saved: true },
      emphasize: "save-msg",
    }),
    paced({
      id: "public",
      chapter: "brand",
      caption: "The same page, an afternoon later.",
      set: { view: "page", claimed: true },
      context: `${CLUB} · public page`,
      emphasize: "hero",
      callout: "The claim button is gone, because there is nothing left to claim.",
    }),
    paced({
      id: "end",
      chapter: "brand",
      caption:
        "A listing the club did not make, claimed with a code sent to the contact on file, corrected on the way in, bound to a person rather than an inbox, and turned into the club's own page the same afternoon.",
      hold: 4400,
      set: { endCard: true },
    }),
  ],

  /* ── Render ────────────────────────────────────────────────────────── */

  render: ({ get, typingKey }) => {
    const view = get<string>("view", "directory")
    const q = get<string>("q", "")
    return {
      desktop: (
        <div className="relative flex h-full flex-col">
          <div key={view} className="demo-fade-in flex min-h-0 flex-1 flex-col">
            {view === "directory" && <Directory q={q} typing={typingKey === "q"} />}
            {view === "page" && <PublicPage claimed={get("claimed", false)} />}
            {(view === "wizard" || view === "code" || view === "verified") && (
              <ClaimPage
                step={view}
                corrections={get("corrections", false)}
                fixed={get("fixed", false)}
                code={get<string>("code", "")}
                typing={typingKey === "code"}
              />
            )}
            {(view === "complete" || view === "owned") && <CompletePage done={view === "owned"} />}
            {view === "signup" && <SignUpScreen filled={get("filled", false)} />}
            {view === "customize" && (
              <Customize
                colour={get("colour", false)}
                tagline={get<string>("tagline", "")}
                typing={typingKey === "tagline"}
                saved={get("saved", false)}
              />
            )}
          </div>
          {get("mail", false) && <MailApp />}
          {get("endCard", false) && <EndCard />}
        </div>
      ),
    }
  },
}

/* ═══ 1. The directory ═════════════════════════════════════════════════════
 * `app/(public)/club/page.tsx` inside the `(public)` layout ground.
 */

/** `components/ui/crest.tsx`, the neutral light tile every list surface gets. */
function Crest({ name, className }: { name: string; className?: string }) {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean)
  const mono =
    words.length === 0
      ? name.slice(0, 2).toUpperCase()
      : words.length === 1
        ? words[0].slice(0, 2).toUpperCase()
        : (words[0][0] + words[1][0]).toUpperCase()
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-ink-100 text-ink-700 flex shrink-0 items-center justify-center overflow-hidden font-bold leading-none",
        className
      )}
    >
      {mono}
    </span>
  )
}

/** `components/follow-button.tsx` compact: the icon-only star on every card. */
function FollowStar() {
  return (
    <span className="border-ink-200 text-ink-400 grid h-8 w-8 place-items-center rounded-lg border bg-white">
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 18.5 6.1 21.3l1.2-6.6L2.5 9.5l6.6-.9z" />
      </svg>
    </span>
  )
}

/** `club/page.tsx` chipClass. */
function Chip({ label, count, active }: { label: string; count?: number; active?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-semibold",
        active ? "bg-play-600 text-white" : "text-ink-700 ring-ink-200 bg-white ring-1"
      )}
    >
      {label}
      {count != null && (
        <span className={active ? "ml-1.5 text-white/70" : "text-ink-400 ml-1.5"}>{count}</span>
      )}
    </span>
  )
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="text-ink-500 text-[12px] font-bold uppercase tracking-[0.14em]">{label}</span>
      {children}
    </div>
  )
}

/** `club/page.tsx` ClubCard. */
function DirectoryCard({
  name,
  meta,
  featured,
  unclaimed,
}: {
  name: string
  meta: string
  featured?: boolean
  unclaimed?: boolean
}) {
  return (
    <div className="relative">
      <span className="absolute right-3 top-3 z-10">
        <FollowStar />
      </span>
      <span
        className={cn(
          "shadow-soft flex items-center gap-4 rounded-2xl border bg-white p-4 pr-12",
          featured ? "border-gold-400 ring-gold-100 ring-2" : "border-ink-100"
        )}
      >
        <Crest name={name} className="h-11 w-11 rounded-xl text-sm" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-ink-950 truncate font-semibold">{name}</span>
            {featured && (
              <span className="bg-gold-100 text-gold-600 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                Featured
              </span>
            )}
          </span>
          <span className="text-ink-500 block truncate text-xs">{meta}</span>
        </span>
        {unclaimed && (
          <span className="bg-ink-50 text-ink-500 ring-ink-200 shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1">
            Open profile
          </span>
        )}
      </span>
    </div>
  )
}

function Directory({ q, typing }: { q: string; typing: boolean }) {
  /* `club-search.tsx` debounces 300ms and then drops its portal panel, so the
     dropdown belongs to the beat AFTER the typing one, without a state flag. */
  const dropdown = q.length >= 2 && !typing
  return (
    <div className="min-h-0 flex-1 overflow-hidden bg-[#fafafa]">
      {/* PageBand, align=center, daylight band. */}
      <div className="relative isolate overflow-hidden border-b border-[#e7dbc4]">
        <CourtBackdropLayer variant="daylight" intensity="band" />
        <div className="container relative z-10 mx-auto px-6 py-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#b45309]">
              Clubs
            </p>
            <h1 className="font-display text-ink-950 text-[40px] font-black leading-[1.04] tracking-[-0.02em]">
              Find a Basketball Club
            </h1>
            <p className="text-ink-600 mt-3 text-base leading-7">
              Clubs near you. Search by name or city, or browse below.
            </p>
          </div>

          <div className="mt-5 text-center">
            <div className="relative mx-auto max-w-xl">
              <span
                data-demo-target="search"
                className={cn(
                  "border-ink-200 block w-full rounded-2xl border bg-white px-4 py-4 pl-12 pr-24 text-left text-[15px] shadow-sm",
                  q ? "text-ink-950" : "text-ink-400"
                )}
              >
                {q || "Start typing a club name..."}
                {typing && (
                  <span className="bg-play-600 ml-0.5 inline-block h-4 w-[2px] align-middle" />
                )}
              </span>
              <svg
                className="text-ink-400 absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <span className="bg-play-600 absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-4 py-2 text-sm font-semibold text-white">
                Search
              </span>

              {dropdown && (
                <div className="shadow-panel border-ink-100 live-pop absolute inset-x-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl border bg-white text-left">
                  <span
                    data-demo-target="result"
                    className="flex w-full items-center gap-3 px-4 py-3"
                  >
                    <Crest name={CLUB} className="h-10 w-10 rounded-2xl text-xs shadow-sm" />
                    <span>
                      <span className="text-ink-950 block font-semibold">{CLUB}</span>
                      <span className="text-ink-500 block text-xs">{CITY_RAW}, ON</span>
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div data-demo-target="provinces">
              <ChipRow label="Province">
                <Chip label="All Canada" active />
                {PROVINCES.map(([name, count]) => (
                  <Chip key={name} label={name} count={count} />
                ))}
              </ChipRow>
            </div>
            <ChipRow label="Greater Toronto">
              {GTA.map((c) => (
                <Chip key={c} label={c} />
              ))}
            </ChipRow>
            <ChipRow label="More Ontario">
              {MORE_ON.map((c) => (
                <Chip key={c} label={c} />
              ))}
            </ChipRow>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pt-2">
        <div className="mt-6">
          <h2 className="text-gold-600 mb-4 text-xs font-bold uppercase tracking-[0.16em]">
            Featured clubs
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {FEATURED.map((c) => (
              <DirectoryCard key={c.name} name={c.name} meta={c.meta} featured />
            ))}
          </div>
        </div>
        <div className="mt-6">
          <h2 className="text-ink-400 mb-4 text-xs font-bold uppercase tracking-[0.16em]">
            Top clubs
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {TOP.map((c) => (
              <DirectoryCard key={c.name} name={c.name} meta={c.meta} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══ 2. The public club page ══════════════════════════════════════════════
 * `app/(public)/club/[slug]/page.tsx`, on the theme's real ground.
 */

function PublicPage({ claimed }: { claimed: boolean }) {
  const brand = claimed ? CHOSEN_HEX : NEUTRAL_BRAND
  const crestFill = claimed ? CHOSEN_HEX : null
  return (
    <div className="min-h-0 flex-1 overflow-hidden" style={{ background: CLUB_BG }}>
      <header data-demo-target="hero" className="relative isolate overflow-hidden">
        <CourtBackdropLayer variant="daylight" intensity="band" />
        <div className="container relative z-10 mx-auto px-4 pb-7 pt-5">
          {/* SmartBack, cold entry: the hierarchical fallback. */}
          <span className="text-ink-600 -ml-1 mb-2 inline-flex items-center gap-1.5 rounded-xl py-2 pl-1 pr-3 text-sm font-semibold">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Home
          </span>

          <div className="flex flex-wrap items-end gap-5">
            <span
              aria-hidden="true"
              className={cn(
                "flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-4xl font-black shadow-lg",
                crestFill ? "text-white" : "bg-ink-100 text-ink-700"
              )}
              style={crestFill ? { backgroundColor: crestFill } : undefined}
            >
              A
            </span>
            <div className="min-w-[17rem] flex-1">
              {/* DEPARTURE (declared in the header): the live theme module
                  repaints this ink near-white on the daylight band. */}
              <h1 className="font-display text-ink-950 text-[46px] font-black leading-[1.02] tracking-[-0.02em]">
                {CLUB}
              </h1>
              {claimed && (
                <p className="text-ink-600 live-pop mt-1.5 max-w-2xl text-lg font-medium">
                  {TAGLINE}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <span
                  data-demo-target="location"
                  className="border-ink-200 text-ink-700 inline-flex items-center gap-1.5 rounded-full border bg-white/90 px-3 py-1 text-xs font-semibold shadow-sm"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  >
                    <path d="M12 21s7-5.686 7-11a7 7 0 10-14 0c0 5.314 7 11 7 11z" strokeLinejoin="round" />
                    <circle cx="12" cy="10" r="2.5" />
                  </svg>
                  {claimed ? SUBTITLE_FIXED : SUBTITLE_RAW}
                </span>
              </div>
            </div>
          </div>

          <p className="text-ink-600 mt-3 max-w-2xl text-sm leading-relaxed">{DESCRIPTION}</p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="border-ink-200 text-ink-800 rounded-xl border bg-white px-5 py-2.5 text-sm font-semibold shadow-sm">
              Contact
            </span>
            {claimed ? (
              <span className="border-ink-200 text-ink-800 inline-flex items-center gap-1.5 rounded-xl border bg-white px-5 py-2.5 text-sm font-semibold shadow-sm">
                ☆ Follow
              </span>
            ) : (
              <span
                data-demo-target="claim-btn"
                className="bg-ink-950 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
              >
                Claim this club
              </span>
            )}
          </div>

          {/* Quick-stats strip. `bg-white/85` resolves to the theme panel. */}
          <div className="mt-6 grid grid-cols-4 gap-px overflow-hidden rounded-2xl border border-[#e7dbc4] bg-[#e7dbc4]">
            {[
              ["0", "Teams"],
              ["0", "Open programs"],
              ["TBD", "Next game"],
              ["0", "Staff"],
            ].map(([value, label]) => (
              <div key={label} className="px-4 py-3" style={{ background: CLUB_PANEL }}>
                <div className="font-display text-3xl font-black leading-none" style={{ color: CLUB_INK }}>
                  {value}
                </div>
                <div
                  className="mt-1 text-[11px] font-semibold uppercase tracking-wide"
                  style={{ color: CLUB_MUTED }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 z-10 h-1"
          style={{ background: brand }}
        />
      </header>

      {/* ClubSubNav, then the top of the body on the theme's ground. */}
      <nav
        className="border-b"
        style={{ background: CLUB_PANEL, borderColor: CLUB_BORDER }}
      >
        <div className="container mx-auto flex gap-1 px-4 py-2">
          {["About", "Teams", "Programs", "Schedule", "Contact"].map((s, i) => (
            <span
              key={s}
              className="font-condensed relative rounded-lg px-3.5 py-2 text-[15px] font-semibold uppercase tracking-wide"
              style={{ color: i === 0 ? brand : CLUB_MUTED }}
            >
              {s}
              {i === 0 && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-3 -bottom-px h-0.5 rounded-full"
                  style={{ background: brand }}
                />
              )}
            </span>
          ))}
        </div>
      </nav>

      <div className="container mx-auto px-4 pt-6">
        <div
          className="rounded-2xl border p-6"
          style={{ background: CLUB_PANEL, borderColor: CLUB_BORDER }}
        >
          <h2 className="mb-4 flex items-center gap-3">
            <span
              aria-hidden="true"
              className="h-7 w-1.5 shrink-0 rounded-full"
              style={{ background: brand }}
            />
            <span
              className="font-condensed text-[26px] font-bold uppercase leading-none tracking-wide"
              style={{ color: CLUB_INK }}
            >
              About
            </span>
          </h2>
          <p className="text-[15px] leading-relaxed" style={{ color: CLUB_MUTED }}>
            {DESCRIPTION}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ═══ 3. The claim wizard ══════════════════════════════════════════════════
 * `app/(public)/claim/[tenantId]/claim-wizard.tsx`, all three of its steps.
 */

/** `components/ui/badge.tsx`, tone="success", verbatim. */
function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="bg-court-50 text-court-700 ring-court-100 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] ring-1 ring-inset">
      {children}
    </span>
  )
}

function CorrectionInput({ placeholder, value }: { placeholder: string; value?: string }) {
  return (
    <span
      className={cn(
        "border-ink-200 block rounded-lg border px-3 py-2 text-sm",
        value ? "text-ink-950" : "text-ink-400"
      )}
    >
      {value || placeholder}
    </span>
  )
}

function ClaimPage({
  step,
  corrections,
  fixed,
  code,
  typing,
}: {
  step: string
  corrections: boolean
  fixed: boolean
  code: string
  typing: boolean
}) {
  /* Composition: the real page pins this card to the top of a full-height
     viewport. The 600 pane centres it instead, so a three-step card does not
     sit over 200px of empty ground, and the corrections step (the tallest of
     the three) still clears the frame. */
  return (
    <div className="flex min-h-0 flex-1 items-center overflow-hidden bg-[#fafafa]">
      <div className="mx-auto w-full max-w-xl px-4">
        <div className="border-ink-100 shadow-soft rounded-[28px] border bg-white p-8">
          <p className="text-ink-400 text-xs font-semibold uppercase tracking-wide">
            Claim your club
          </p>
          <h1 className="font-condensed text-ink-950 mt-1 text-3xl font-bold uppercase leading-none">
            {CLUB}
          </h1>
          <p className="text-ink-500 mt-1 text-sm">{CITY_RAW}</p>

          {step === "wizard" && (
            <div className="mt-6 space-y-4">
              <p className="text-ink-600 text-sm">
                To prove you run this club, we send a code to the contact info already on file. No
                account needed yet.
              </p>
              <div data-demo-target="channels" className="space-y-2">
                <span
                  data-demo-target="channel-email"
                  className="border-play-500 bg-play-50 block w-full rounded-xl border p-3 text-left"
                >
                  <span className="text-ink-900 block text-sm font-semibold">
                    Email a code to {MASKED_EMAIL}
                  </span>
                </span>
                <span className="border-ink-100 block w-full rounded-xl border p-3 text-left">
                  <span className="text-ink-900 block text-sm font-semibold">
                    I can&apos;t access those, submit proof instead
                  </span>
                  <span className="text-ink-500 mt-0.5 block text-xs">
                    Describe your proof (website admin, registration papers, social account) and an
                    admin will review it.
                  </span>
                </span>
              </div>

              <div>
                <span
                  data-demo-target="corrections-toggle"
                  className="text-play-700 block text-sm font-medium"
                >
                  {corrections ? "Hide corrections" : "Our info looks wrong? Propose corrections"}
                </span>
                {corrections && (
                  <div
                    data-demo-target="corrections-fields"
                    className="live-pop mt-2 grid grid-cols-2 gap-2"
                  >
                    <CorrectionInput placeholder="Club name" />
                    <CorrectionInput placeholder="City" value={fixed ? CITY_FIXED : undefined} />
                    <CorrectionInput
                      placeholder="Website"
                      value={fixed ? WEBSITE_FIXED : undefined}
                    />
                    <CorrectionInput placeholder="Contact email" />
                    <CorrectionInput placeholder="Phone" value={fixed ? PHONE_FIXED : undefined} />
                    <p className="text-ink-400 col-span-full text-xs">
                      Corrections apply when the claim completes.
                    </p>
                  </div>
                )}
              </div>

              <span
                data-demo-target="send-code"
                className="bg-play-600 block w-full rounded-xl px-4 py-2.5 text-center text-sm font-semibold text-white"
              >
                Send the code
              </span>
            </div>
          )}

          {step === "code" && (
            <div className="mt-6 space-y-4">
              <p data-demo-target="code-note" className="text-ink-600 text-sm">
                We sent a 6-digit code to <strong>{MASKED_EMAIL}</strong>. It expires in {CODE_TTL}{" "}
                minutes.
              </p>
              <span
                data-demo-target="code-field"
                className={cn(
                  "border-ink-200 block w-full rounded-xl border px-4 py-3 text-center font-mono text-2xl tracking-[0.5em]",
                  code ? "text-ink-950" : "text-ink-300"
                )}
              >
                {code || "••••••"}
                {typing && (
                  <span className="bg-play-600 ml-0.5 inline-block h-6 w-[2px] align-middle" />
                )}
              </span>
              <span
                data-demo-target="verify-btn"
                className={cn(
                  "bg-play-600 block w-full rounded-xl px-4 py-2.5 text-center text-sm font-semibold text-white",
                  code.length !== 6 && "opacity-50"
                )}
              >
                Verify
              </span>
            </div>
          )}

          {step === "verified" && (
            <div className="mt-6 space-y-4 text-center">
              <Badge>Verified</Badge>
              <p data-demo-target="reserved-line" className="text-ink-600 text-sm">
                {CLUB} is reserved for you for {RESERVATION_DAYS} days. Create an account (any email
                works) or sign in: the club binds to{" "}
                <em data-demo-target="identity-phrase">your account</em>, not the inbox that got the
                code.
              </p>
              <span
                data-demo-target="take-btn"
                className="bg-play-600 block w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
              >
                Take ownership
              </span>
              <p className="text-ink-400 text-xs">
                We also emailed this link to the verified contact.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══ 4. The completion page ═══════════════════════════════════════════════
 * `app/(public)/claim/complete/page.tsx` + `complete-claim.tsx`.
 */

function CompletePage({ done }: { done: boolean }) {
  return (
    <div className="relative isolate flex min-h-0 flex-1 items-center overflow-hidden">
      <CourtBackdropLayer variant="daylight" intensity="immersive" />
      <div className="container relative z-10 mx-auto max-w-xl px-4 py-10">
        <div
          data-demo-target={done ? "owned-card" : "complete-card"}
          className="border-ink-100 shadow-soft rounded-[28px] border bg-white p-8 text-center"
        >
          <p className="text-ink-400 text-xs font-semibold uppercase tracking-wide">
            Take ownership
          </p>
          {done ? (
            <div className="live-pop mt-4 space-y-3">
              <Badge>Club claimed</Badge>
              <h1 className="font-condensed text-ink-950 text-2xl font-bold uppercase">{CLUB}</h1>
              <p className="text-ink-600 text-sm">
                You&apos;re the owner. Everything about the club is now yours to edit.
              </p>
              <span className="bg-play-600 block w-full rounded-xl px-4 py-3 text-sm font-semibold text-white">
                Go to your club dashboard
              </span>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <p className="text-ink-600 text-sm">
                Your club is verified and reserved. Sign in or create an account with any email and
                the club binds to your account.
              </p>
              <span
                data-demo-target="create-acct"
                className="bg-play-600 block w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
              >
                Create an account
              </span>
              <span className="border-ink-200 text-ink-700 block w-full rounded-xl border px-4 py-3 text-sm font-semibold">
                I already have an account
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══ 5. The account ═══════════════════════════════════════════════════════
 * `app/(auth)/sign-up/[[...sign-up]]`, the form a claim token unlocks.
 */

function AuthField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <span className="text-ink-700 block text-sm font-medium">{label}</span>
      <span
        className={cn(
          "border-ink-200 mt-1 block w-full rounded-2xl border bg-white px-4 py-2.5 text-[15.5px]",
          value ? "text-ink-950" : "text-ink-400"
        )}
      >
        {value || " "}
      </span>
    </div>
  )
}

function SignUpScreen({ filled }: { filled: boolean }) {
  return (
    <div className="relative isolate flex min-h-0 flex-1 items-center overflow-hidden">
      <CourtBackdropLayer variant="navy" intensity="immersive" />
      <div className="container relative z-10 mx-auto max-w-[460px] px-4">
        <div
          data-demo-target="signup-card"
          className="border-ink-100 shadow-panel w-full rounded-[30px] border bg-white/95 p-6 backdrop-blur-xl"
        >
          <div className="mb-3 text-center">
            <span className="border-hoop-100 bg-hoop-50 text-hoop-600 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
              Join Sportshub
            </span>
          </div>
          <h1 className="text-ink-950 mb-1.5 text-center text-[2rem] font-bold leading-tight">
            Create your account
          </h1>
          <p className="text-ink-500 mb-4 text-center text-sm">
            One account for every team, club, and league in the family.
          </p>
          <span className="border-ink-200 text-ink-800 flex w-full items-center justify-center gap-2 rounded-2xl border bg-white px-4 py-2.5 text-sm font-semibold">
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.6z" />
              <path fill="#34A853" d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3A12 12 0 0 0 12 24z" />
              <path fill="#FBBC05" d="M5.6 14.7a7.2 7.2 0 0 1 0-4.6v-3H1.8a12 12 0 0 0 0 10.6z" />
              <path fill="#EA4335" d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3A11.6 11.6 0 0 0 12 0 12 12 0 0 0 1.8 6.1l3.8 3a7.1 7.1 0 0 1 6.4-4.3z" />
            </svg>
            Sign up with Google
          </span>
          <div className="my-3 flex items-center gap-3">
            <div className="bg-ink-100 h-px flex-1" />
            <span className="text-ink-400 text-xs font-medium uppercase tracking-wider">or</span>
            <div className="bg-ink-100 h-px flex-1" />
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <AuthField label="First Name" value={filled ? "Dana" : undefined} />
              <AuthField label="Last Name" value={filled ? "Okafor" : undefined} />
            </div>
            <AuthField label="Email" value={filled ? CLAIMER_EMAIL : undefined} />
            <AuthField label="Password" value={filled ? "••••••••••" : undefined} />
            <span
              data-demo-target="signup-submit"
              className="bg-play-600 block w-full rounded-full px-6 py-3 text-center text-sm font-bold text-white"
            >
              Create account
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══ 6. Branding ══════════════════════════════════════════════════════════
 * `clubs/[id]/customize/page.tsx` header + `club-page-editor.tsx` Brand.
 */

const EDITOR_INPUT =
  "border-ink-200 text-ink-900 mt-1 block w-full rounded-xl border px-3 py-1.5 text-sm"
const EDITOR_LABEL = "text-ink-700 text-sm font-medium"

function UploadField({ label, hint, swatch }: { label: string; hint?: string; swatch?: string }) {
  return (
    <div>
      <span className={EDITOR_LABEL}>{label}</span>
      <span className="border-ink-200 mt-1 flex items-center gap-3 rounded-xl border border-dashed bg-white px-3 py-1.5">
        <span
          aria-hidden="true"
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-black",
            swatch ? "text-white" : "bg-ink-100 text-ink-500"
          )}
          style={swatch ? { background: swatch } : undefined}
        >
          A
        </span>
        <span className="text-ink-500 text-sm">{hint}</span>
      </span>
    </div>
  )
}

function ColorPicker({
  label,
  hex,
  id,
}: {
  label: string
  hex: string
  id?: string
}) {
  return (
    <div>
      <span className={EDITOR_LABEL}>{label} color</span>
      <span data-demo-target={id} className="mt-1 flex items-center gap-2">
        <span
          aria-hidden="true"
          className="border-ink-200 h-8 w-12 shrink-0 rounded border"
          style={{ background: hex }}
        />
        <span className="border-ink-200 text-ink-900 w-24 rounded-lg border px-2 py-1 text-xs">
          {hex}
        </span>
      </span>
    </div>
  )
}

function Customize({
  colour,
  tagline,
  typing,
  saved,
}: {
  colour: boolean
  tagline: string
  typing: boolean
  saved: boolean
}) {
  return (
    <div className="min-h-0 flex-1 overflow-hidden bg-[#fafafa]">
      <div className="mx-auto flex h-full max-w-5xl flex-col px-6 py-3">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-ink-950 text-lg font-bold">Customize your public page</h2>
            <p className="text-ink-500 text-sm">
              Brand it, add your info, and arrange the sections. Changes go live when you save.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <span className="bg-navy-900 rounded-xl px-4 py-2 text-sm font-bold text-white">
              Edit the page itself
            </span>
            <span className="border-ink-200 text-ink-700 rounded-xl border px-4 py-2 text-sm font-semibold">
              View public page ↗
            </span>
          </div>
        </div>

        <div
          data-demo-target="brand-card"
          className="border-ink-100 shadow-soft mt-3 rounded-3xl border bg-white p-5"
        >
          <h3 className="text-ink-950 font-bold">Brand</h3>
          <p className="text-ink-500 mb-3 mt-0.5 text-sm">
            Your banner, logo, colors, and the words at the top of the page.
          </p>
          <div className="grid grid-cols-2 gap-x-5 gap-y-2">
            <UploadField
              label="Banner image"
              hint="Wide hero image. No image = a gradient in your primary color."
            />
            <UploadField
              label="Logo"
              hint="Square, up to 512px"
              swatch={colour ? CHOSEN_HEX : undefined}
            />
            <div className="col-span-2">
              <span className={EDITOR_LABEL}>Tagline</span>
              <span
                data-demo-target="tagline-field"
                className={cn(EDITOR_INPUT, tagline ? "text-ink-900" : "text-ink-400")}
              >
                {tagline || "e.g. Developing players since 2009"}
                {typing && (
                  <span className="bg-play-600 ml-0.5 inline-block h-4 w-[2px] align-middle" />
                )}
              </span>
            </div>
            <div className="col-span-2">
              <span className={EDITOR_LABEL}>Description</span>
              <span className={cn(EDITOR_INPUT, "text-ink-400 block h-[34px]")}>
                A paragraph about your club, who you are, your philosophy, what families can expect.
              </span>
            </div>
            <div className="col-span-2 flex flex-wrap gap-5">
              <ColorPicker
                label="Primary"
                id="colour-field"
                hex={colour ? CHOSEN_HEX : "#1e40af"}
              />
              <ColorPicker label="Secondary" hex="#34a853" />
              <ColorPicker label="Accent" hex="#fbbc04" />
            </div>
          </div>
        </div>

        <div className="border-ink-100 shadow-panel mb-1 mt-auto flex shrink-0 items-center justify-between gap-4 rounded-2xl border bg-white px-5 py-2.5">
          <span data-demo-target="save-msg" className="text-sm">
            {saved && <span className="text-court-700 live-pop font-semibold">{SAVED}</span>}
          </span>
          <span
            data-demo-target="save-btn"
            className="bg-hoop-500 rounded-xl px-6 py-2.5 text-sm font-semibold text-white"
          >
            Save changes
          </span>
        </div>
      </div>
    </div>
  )
}

/* ═══ OS chrome (R8) ═══════════════════════════════════════════════════════
 * The mail app reading the message `claim-v2.ts` really sends. Chrome only:
 * the message body below is the route's own HTML.
 */

function MailApp() {
  return (
    <div className="demo-fade-in absolute inset-0 z-30 flex flex-col bg-[#f6f6f8]">
      <div className="flex shrink-0 items-center gap-3 border-b border-black/10 bg-[#ececed] px-5 py-2.5">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </span>
        <span className="text-[13px] font-semibold text-[#3c3c43]">Inbox</span>
        <span className="ml-auto text-[13px] text-[#8a8a8e]">Today 4:12 PM</span>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-8 py-5">
        <div className="mx-auto max-w-[760px]">
          <p className="text-[22px] font-semibold text-[#1c1c1e]">
            Verification code for claiming {CLUB}
          </p>
          <div className="mt-3 flex items-center gap-3 border-b border-black/10 pb-3">
            <AppIcon className="h-10 w-10 shrink-0 rounded-lg" />
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-[#1c1c1e]">
                SportsHub One{" "}
                <span className="font-normal text-[#8a8a8e]">&lt;no-reply@sportshubone.com&gt;</span>
              </p>
              <p className="text-[13px] text-[#8a8a8e]">To: {MASKED_EMAIL}</p>
            </div>
          </div>

          {/* claim-v2.ts lines 213 to 226, verbatim, in its own Arial. */}
          <div
            className="mt-4 rounded-xl bg-white px-8 py-6 shadow-sm"
            style={{ fontFamily: "Arial, sans-serif" }}
          >
            <div className="mx-auto max-w-[600px]">
              <h2 className="text-[22px] font-bold text-[#111]">Club ownership verification</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-[#333]">
                Someone is claiming <strong>{CLUB}</strong> on SportsHub using this contact address.
              </p>
              <p className="mt-3 text-[15px] leading-relaxed text-[#333]">
                If that&apos;s you (or someone at your club), enter this code to continue:
              </p>
              <div className="my-6 text-center">
                <span
                  data-demo-target="mail-code"
                  className="inline-block rounded-lg bg-[#f5f5f5] px-6 py-3 text-[32px] font-bold tracking-[4px] text-[#111]"
                >
                  {CODE}
                </span>
              </div>
              <p className="text-[15px] leading-relaxed text-[#333]">
                The code expires in {CODE_TTL} minutes. If you did not expect this, ignore this
                email. Nothing happens without the code.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── End card ────────────────────────────────────────────────────────────── */

function EndCard(): ReactNode {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0b1628] px-12 text-white">
      <div className="live-pop max-w-[760px] text-center">
        <p className="text-gold-400 text-[15px] font-bold uppercase tracking-[0.18em]">
          A club chapter
        </p>
        <h3 className="font-display mt-2 text-[34px] font-extrabold leading-tight">
          Claim your club and make it yours
        </h3>
        <p className="mt-3 text-[17px] leading-relaxed text-white/75">
          One of more than a thousand listings nobody has claimed, found by name, claimed with a
          six-digit code that only ever goes to the contact already on file, corrected on the way in,
          reserved for fourteen days, bound to a person rather than an inbox, and turned into the
          club&apos;s own page the same afternoon.
        </p>
        <p className="mt-5 text-[15px] font-semibold text-white/50">Next: build a team</p>
      </div>
    </div>
  )
}
