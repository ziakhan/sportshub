"use client"

import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import { TypeText } from "../motion"
import type { DemoBeat, DemoScript } from "../types"

/**
 * "Waivers, start to finish" (league shelf), rebuilt to the REALISM STANDARD
 * (mock-ui.tsx R1–R8) on 2026-08-19, over the gold-standard truth pass of
 * 2026-08-16.
 *
 * WHAT SURVIVED, UNTOUCHED. The 08-16 pass anchored this story to real waiver
 * data and wrote every number down in `docs/roadmap/waivers-numbers.md`. None
 * of that is disturbed: the league, the season, the document, the 22 approved
 * teams, the 220 rostered players, the 27 signatures, the 12 live links and
 * the 180 the re-send would really mail are the same rows, and the one
 * signature this demo performs is still the one signature this world is
 * actually waiting for. What changed is FIDELITY: every screen below is now
 * the real component's markup, and every flow runs to its real end state.
 *
 * WHAT THE 08-16 CUT STILL GOT WRONG, AND IS FIXED HERE:
 *   · the two league screens were drawn as bare regions with no page around
 *     them. Both are real pages with a SmartBack, an h1 and a lead sentence,
 *     and the lead sentences are the two that explain the whole feature;
 *   · the library invented a panel called "The text every family signs". The
 *     product never shows a body there. The document's text is now shown where
 *     the product really shows it, in the create panel's own preview, which
 *     also means the story can film the document being MADE;
 *   · the board drew 22 teams as a two column grid under an invented
 *     "3 of 22 teams" chip, and stacked the parent email beside the player
 *     name. The real board is one vertical column and the email sits UNDER the
 *     name. It is one column here now, all 22 of them, and the pane scrolls to
 *     the team the story opens, the way a browser does;
 *   · "Only missing" was pressed and claimed to filter the board. Not one of
 *     the 22 teams is complete in this world, so the real filter removes
 *     nothing. The beat is gone rather than dressed up;
 *   · everything was authored to the scene kit's 14px floor. R1 outranks that
 *     floor: these screens are the product's own `text-sm` / `text-xs`.
 *
 * THE WORLD IS REAL, NOT STAGED. `DB`: NPH Summer League, season Summer 2026
 * (`fbbe767c-00e9-4130-9258-4f02c6854efa`), holds exactly one required
 * parent-facing waiver, `WaiverDocument ea472023-b4cb-450a-ab15-b26552bc3b25`,
 * "Concussion Code of Conduct (Rowan's Law)", CONCUSSION_CODE, province ON,
 * `annualRenewal: true`, `required: true`, version 1, created by
 * `scripts/seed-summer-world.ts` from the product's own template
 * `concussion-code-on` in `lib/waivers/templates.ts`. Against it sit 22
 * APPROVED team submissions, 220 rostered players, 40 minted sign requests and
 * 27 signatures.
 *
 * THE FAMILY IS REAL. `DB` `summer-parent-lords@sportshub.demo`, Jordan Reyes,
 * two children in this league. He signed for Darius (#37, Toronto Lords Grade
 * 9) on 2026-07-18. The link for Danielle (#20, Toronto Lords Grade 10 Girls)
 * was emailed on 2026-07-17, expires 2026-10-05, and `consumedAt` is still
 * NULL. So the cell that turns green is her cell.
 *
 * WHAT THIS STORY IS, NEXT TO `your-week`. The your-week demo films the FAMILY
 * side of one waiver from inside the app: a push arrives, the signing page
 * opens, "Signed and recorded". This one is the LEAGUE arc around it, and it
 * deliberately reaches the family a different way, because the product really
 * has two: the emailed link the roster send mints. So the phone here opens in
 * MAIL and the page opens in a BROWSER, which is what a tokenized public link
 * does, and the two demos never draw the same surface twice.
 *
 * TRUTH TO THE PRODUCT, SCREEN BY SCREEN (R1: classes copied, files cited):
 *   · the library page is `app/(platform)/manage/leagues/[id]/waivers/page.tsx`
 *     (SmartBack, `text-xl font-bold text-ink-900 md:text-2xl` "Waivers", and
 *     the lead about roster auto-send, verbatim) wrapped around
 *     `components/waivers/waivers-manager.tsx`: the heading pair, the primary
 *     "Add waiver", the dashed EMPTY STATE that names the two Ontario
 *     starters, the `CreatePanel` (template buttons in play tones, the
 *     template's own description, the `max-h-56` preview with its
 *     `text-xs leading-relaxed` pre, and the `Add "{title}"` button), the
 *     document row with its type / v1 / Required / Renews yearly Badges and
 *     its signature count, Edit and Deactivate, and the versions footnote;
 *   · the board page is
 *     `manage/leagues/[id]/seasons/[seasonId]/waivers/page.tsx` around
 *     `components/waivers/waiver-status-view.tsx`: the "N signed" court Badge
 *     and "N outstanding" warning Badge, the "Only missing" pill, the subtle
 *     "Re-send all outstanding", the `bg-play-50 text-play-800` notice, then
 *     one card per approved team with its caret, its name, its
 *     "{signed}/{total} signed" warning Badge and its own "Re-send", and the
 *     expansion's table: Player column with the parent email under the name,
 *     one column per required waiver, and the cell that reads "✓ {signerName}"
 *     in `text-court-700` or "Pending" in `text-amber-600`;
 *   · the email is `sendWaiverSignEmail` in `lib/email.ts` lines 292 to 339,
 *     rendered with its OWN inline styles (the #4f46e5 eyebrow, the 21px
 *     title, the 14px/1.6 body, the #4f46e5 pill, the #a1a1aa fine print),
 *     inside an iOS Mail message view. The Mail chrome is chrome (R8);
 *   · the signing page is `app/(public)/waivers/sign/[token]/page.tsx` +
 *     `sign-form.tsx`: the daylight court wash, the `rounded-[28px]` card, the
 *     org eyebrow, the title, "For {player} · renews yearly", the `bg-ink-50`
 *     document box, "Your full name" with its "First and last name"
 *     placeholder, the ChipGroup's "Parent or guardian" / "Player (18 or
 *     older)", "Signature" with "Draw with your finger or mouse", the
 *     acknowledgment naming the child, "Sign and submit", the storage line,
 *     and the real success render: court check tile, "Signed and recorded",
 *     the on-file sentence;
 *   · the reminders are `lib/waivers/reminders.ts` behind
 *     `GET /api/cron/waiver-reminders`: 7 days out and 24 hours out, both
 *     notification titles and the message template verbatim, and the
 *     `WaiverReminder` row that IS the send-once lock.
 *
 * FRAMING, and why anything scrolls (R4). The scene region is 600 logical
 * tall and both league pages are taller than that in a real browser too. So
 * they are filmed in the scroll positions a person really puts them in: the
 * library scrolls once to reach the preview and the Add button, the board
 * scrolls once to reach the team the story opens and back up to read the
 * season total, and the signing page scrolls the way a thumb scrolls it. No
 * screen is squeezed to fit and no phone is cropped in half.
 *
 * THREE THINGS THE PRODUCT CANNOT HONESTLY SHOW, AND THEY ARE NOT STAGED.
 * All three are punch items in `waivers-numbers.md` section F:
 *
 *   1. NO REMINDER SURFACE. `sendWaiverReminders` runs on a cron and nothing
 *      in the product ever shows a league what it sent or is about to send. So
 *      the reminder beat is an explicit NARRATION card, navy, with no console
 *      chrome on it, and its context strip says out loud that no screen shows
 *      this. It quotes the notification the cron really sends rather than
 *      inventing a dashboard for it.
 *   2. NO EXPIRY ANYWHERE ON SCREEN. `WaiverSignature.validUntil` is written
 *      (signedAt plus 365 days) and every "is this satisfied" query filters on
 *      it, but no surface tells a parent or a league when a signature lapses.
 *      The demo says renewal in words and on the badge the product really
 *      draws, and shows no renewal date.
 *   3. NO TEAM IS COMPLETE. Not one of the 22 approved teams has all ten
 *      signatures, so the product's court "All signed" badge never appears in
 *      this world and it does not appear here either.
 *
 * INVENTED-CONTENT LEDGER (everything not read from the seeded world):
 *   · THE LIBRARY OPENS EMPTY. The document exists in the database today, so
 *     the create flow is filmed at the moment the seed really created it, from
 *     the same template, and the row it makes carries 0 signatures because
 *     that is what a new document has. By the time the story reaches the
 *     season board the same document has the 27 the database holds. That gap
 *     is a cut between two moments in one season, and it is the only one;
 *   · the iOS Mail chrome (the nav row, the sender row, "9:41 AM") and the
 *     browser bar over the signing page are OS chrome, not product UI;
 *   · the four teams' signature counts, the roster and the signer names are
 *     `DB`; the four guardian names on the pending rows are the seed's pool
 *     names, like every other roster in these demos.
 *
 * ONE COPY DEFECT CARRIED, NOT INTRODUCED. `waivers-manager.tsx` line 119
 * writes its empty state with an em-dash, which the owner's copy rule bans
 * everywhere user facing. R1 says quote the screen, so it is quoted here
 * exactly; the fix belongs in the product component, not in a mock of it.
 */

/* ── Cast, all read out of the seeded world ──────────────────────────────── */

const LEAGUE = "NPH Summer League"
const SEASON = "Summer 2026"
const DOC = "Concussion Code of Conduct (Rowan's Law)"

const CTX_LIBRARY = `${LEAGUE} · League workspace · Waivers`
const CTX_BOARD = `${LEAGUE} · ${SEASON} · Signing status`
/** The narration card is not a screen, and its strip says so (punch 1). */
const CTX_CRON = `${LEAGUE} · ${SEASON} · Runs on its own, and no screen shows it`

/** `DB` The family. Two children in this league, one waiver still open. */
const PARENT = "Jordan Reyes"
const PARENT_EMAIL = "summer-parent-lords@sportshub.demo"
const PLAYER = "Danielle Reyes"
const PLAYER_TEAM = "Toronto Lords Grade 10 Girls"

/** `DB` The board, before this demo signs anything. 22 approved teams. */
const CELLS = 220
const SIGNED_BEFORE = 27
const SIGNED_AFTER = 28
/** `PRODUCT` `waiver-status/route.ts`: outstanding is cells minus signed. */
const OUT_BEFORE = CELLS - SIGNED_BEFORE
const OUT_AFTER = CELLS - SIGNED_AFTER
/** `DB`/`ARITH` What "Re-send all outstanding" would really mail. */
const RESEND_SENT = 180
const LIVE_LINKS_AFTER = 12

/* ── The product's own words ─────────────────────────────────────────────── */

/** `PRODUCT` `manage/leagues/[id]/waivers/page.tsx` lines 49 to 53. */
const LIBRARY_LEAD =
  "Required waivers are emailed automatically to every parent on a team's roster the moment that team is approved for a season. Track who has signed from each season's Signing status page."

/** `PRODUCT` `waivers-manager.tsx` lines 117 to 120, the empty state. */
const LIBRARY_EMPTY =
  "No waivers yet. Start from a template: the risk acknowledgment and the Rowan's Law concussion code cover most Ontario programs."

/** `PRODUCT` `waivers-manager.tsx` lines 179 to 183, the versions footnote. */
const LIBRARY_FOOT =
  "Templates are starting points, not legal advice. Have a lawyer review your final text. Editing a waiver's text creates a new version and everyone signs the new text; existing signatures keep the exact text they signed."

/** `PRODUCT` `seasons/[seasonId]/waivers/page.tsx` lines 54 to 58. */
const BOARD_LEAD =
  "Who has signed the league's required waivers, team by team. Waiver emails go out automatically when a team is approved; re-send covers new roster additions and lost emails."

/** `PRODUCT` The re-send notice, `waiver-status-view.tsx` lines 86 to 88. */
const RESEND_NOTICE = `Sent ${RESEND_SENT} emails.`

/** `PRODUCT` The acknowledgment, `sign-form.tsx` lines 134 to 137. */
const ACK = `I have read and understood this document, and I confirm that I am authorized to sign it for ${PLAYER}.`

/** `PRODUCT` The storage line under the submit button, `sign-form.tsx` 153. */
const STORED =
  "Your signature, name, the exact document text, and the date and time are stored securely as your signed record."

/**
 * `PRODUCT` `WaiverDocument.body`, the whole thing, exactly as
 * `WAIVER_TEMPLATES` builds it for this league. The create panel caps it at
 * `max-h-56` and the signing page scrolls it, so both screens show the part
 * that fits and neither pretends otherwise.
 */
const DOC_BODY = `CONCUSSION CODE OF CONDUCT

Organization: ${LEAGUE}

Under Rowan's Law (Concussion Safety), 2018, all athletes under 26, and the parents or guardians of athletes under 18, must review Ontario's Concussion Awareness Resources and confirm this Code of Conduct every year.

I confirm that I have reviewed the Ontario Concussion Awareness Resource for my child's age group (available at ontario.ca/concussions) and I commit to the following:

1. I will help create a culture where concussions are taken seriously. Fair play and respect for all participants come first.

2. I understand the signs and symptoms of concussion, and I will encourage my child to report any symptoms to a coach, official, trainer, parent or guardian right away, whether the injury happened during this sport or anywhere else.

3. I understand that if my child is suspected of having sustained a concussion, they will be removed from play immediately and will not return to practice or competition until permitted under the organization's Removal-from-Sport and Return-to-Sport protocols.

4. I understand that returning to sport after a concussion is a gradual process that must follow the Return-to-Sport protocol, and that medical clearance may be required.

5. I will respect the decisions of coaches, officials and trainers regarding removal from play, and I will not pressure my child, their coaches, or ${LEAGUE} for an early return.

6. I understand that repeated concussions, and returning to play before recovery is complete, can significantly worsen outcomes.`

/**
 * `PRODUCT` The other two template bodies, also verbatim. They are here
 * because the create panel previews WHATEVER template is selected, and the
 * 2026-08-19 frame review caught the first cut previewing the concussion text
 * under the risk agreement's own heading. A preview that does not match its
 * selection is a lie on screen, so every button in this panel now carries the
 * text `WAIVER_TEMPLATES` really builds for it.
 */
const RISK_BODY = `ACKNOWLEDGMENT OF RISK AND INDEMNITY AGREEMENT

Organization: ${LEAGUE}

1. ACKNOWLEDGMENT OF RISK
I understand that participation in basketball activities, including practices, games, tryouts, tournaments and related events, involves inherent risks. These risks include, but are not limited to: collisions with other participants, falls, contact with equipment or playing surfaces, muscle and joint injuries, fractures, concussion and other head injuries, and, in rare circumstances, serious or permanent injury. I acknowledge that these risks cannot be fully eliminated even when the activity is run with reasonable care.

2. VOLUNTARY PARTICIPATION
I confirm that my child's participation is voluntary and that I have had the opportunity to ask questions about the activities and how they are supervised.

3. FITNESS TO PARTICIPATE
I confirm that, to the best of my knowledge, my child has no medical condition that would make participation unsafe, and I agree to inform ${LEAGUE} of any relevant medical conditions or changes.

4. ASSUMPTION OF RISK
I freely accept and assume the inherent risks described above as a condition of my child's participation.`

const MEDIA_BODY = `PHOTO AND MEDIA CONSENT

Organization: ${LEAGUE}

I understand that photographs and video may be taken at games, practices and events organized by ${LEAGUE}.

I consent to images and recordings that include my child being used by ${LEAGUE} for its website, team and league pages, social media accounts, and reasonable promotional material, without compensation.

I understand that:

1. My child's full name will not be published alongside their image without separate consent.
2. I may withdraw this consent at any time by written notice to ${LEAGUE}, which applies to future use.
3. ${LEAGUE} cannot control photography by spectators or other attendees at public events.`

/**
 * `PRODUCT` The template library, `lib/waivers/templates.ts`. Titles,
 * descriptions and bodies verbatim, in the file's own order, so the panel
 * opens on `templates[0]` exactly as the real one does; the fourth button is
 * the manager's own "Custom document".
 */
const TEMPLATES = [
  {
    id: "tpl-risk",
    title: "Acknowledgment of Risk and Indemnity Agreement",
    description:
      "The core participation agreement: informed acknowledgment of the risks of basketball plus a parent indemnity. Structured for Ontario, where courts are not expected to enforce liability releases signed on behalf of minors.",
    body: RISK_BODY,
  },
  {
    id: "tpl-concussion",
    title: DOC,
    description:
      "Mandatory in Ontario under Rowan's Law (Concussion Safety), 2018: athletes and, for athletes under 18, their parent or guardian must review concussion awareness resources and acknowledge the code of conduct every year, within 12 months before registration.",
    body: DOC_BODY,
  },
  {
    id: "tpl-media",
    title: "Photo and Media Consent",
    description:
      "Optional consent for photos and video taken at games and events to be used on the organization's website, social media and promotional material.",
    body: MEDIA_BODY,
  },
]

/** `PRODUCT` The email, `sendWaiverSignEmail` in `lib/email.ts`. */
const EMAIL = {
  subject: `Action needed: sign ${DOC} for ${PLAYER}`,
  greeting: `Hi ${PARENT.split(" ")[0]},`,
  context: `${PLAYER_TEAM} · ${SEASON}`,
  cta: "Review and sign",
}

/**
 * ALL TWENTY TWO approved teams, in the order the endpoint returns them
 * (`waiver-status/route.ts` orders submissions by `createdAt` asc), each with
 * its REAL signed count read out of the database on 2026-08-16: 27 signatures
 * across 220 rostered players, and the four teams carrying all of them.
 */
const BOARD_TEAMS: { team: string; signed: number; id?: string }[] = [
  { team: "Toronto Lords Grade 9", signed: 7 },
  { team: "Burlington Force Grade 9", signed: 7 },
  { team: "North Toronto Huskies Grade 9", signed: 0 },
  { team: "Mississauga Monarchs Grade 9", signed: 0 },
  { team: "Oakville Panthers Grade 9", signed: 0 },
  { team: "West United Prep Grade 9", signed: 0 },
  { team: "CKATT Basketball Grade 9", signed: 0 },
  { team: "Kings Court Basketball Grade 9", signed: 0 },
  { team: "Toronto Lords Grade 10", signed: 0 },
  { team: "Burlington Force Grade 10", signed: 0 },
  { team: "North Toronto Huskies Grade 10", signed: 0 },
  { team: "Mississauga Monarchs Grade 10", signed: 0 },
  { team: "Oakville Panthers Grade 10", signed: 0 },
  { team: "West United Prep Grade 10", signed: 0 },
  { team: "CKATT Basketball Grade 10", signed: 0 },
  { team: "Kings Court Basketball Grade 10", signed: 0 },
  { team: PLAYER_TEAM, signed: 6, id: "team-lords" },
  { team: "Burlington Force Grade 10 Girls", signed: 7 },
  { team: "North Toronto Huskies Grade 10 Girls", signed: 0 },
  { team: "Mississauga Monarchs Grade 10 Girls", signed: 0 },
  { team: "Oakville Panthers Grade 10 Girls", signed: 0 },
  { team: "West United Prep Grade 10 Girls", signed: 0 },
]

/**
 * The whole Toronto Lords Grade 10 Girls roster, in the order the endpoint
 * hands it over, with the signer the product prints in the cell. Ten of ten,
 * because the point is that the four who have not signed are named rather
 * than counted.
 */
const ROSTER: { player: string; email: string; signer?: string; id?: string }[] = [
  { player: "Emma Pierre", email: "parent-summer-lords-159@sportshub.demo", signer: "Dana Sharma" },
  { player: PLAYER, email: PARENT_EMAIL, id: "row-danielle" },
  { player: "Brianna Garcia", email: "parent-summer-lords-160@sportshub.demo", signer: "Jordan Wilson" },
  { player: "Keisha Boateng", email: "parent-summer-lords-161@sportshub.demo", signer: "Alex Adams" },
  { player: "Amara Okafor", email: "parent-summer-lords-162@sportshub.demo", signer: "Raj Rodriguez" },
  { player: "Aaliyah Adams", email: "parent-summer-lords-163@sportshub.demo", signer: "Nadia Allen" },
  { player: "Faith Osei", email: "parent-summer-lords-164@sportshub.demo", signer: "Wendy Santos" },
  { player: "Priya Silva", email: "parent-summer-lords-165@sportshub.demo" },
  { player: "Danielle Wong", email: "parent-summer-lords-166@sportshub.demo" },
  { player: "Priya Diallo", email: "parent-summer-lords-167@sportshub.demo" },
]

/**
 * THE CADENCE, from `lib/waivers/reminders.ts`, behind
 * `GET /api/cron/waiver-reminders` running daily. Both notification titles and
 * the message template are verbatim (lines 160 to 166); the send-once rule is
 * the `WaiverReminder` unique key on player, waiver, season and window.
 */
const CADENCE = [
  {
    n: "7 days out",
    label: "Waiver still unsigned",
    note: `Bell, push and a fresh signing link to the guardian of every player still outstanding: "${LEAGUE} starts soon: ${PLAYER} can't play until you sign “${DOC}”. Tap to sign, it takes a minute."`,
  },
  {
    n: "24 hours out",
    label: "Sign before the first game",
    note: "The same three channels, the last call, and it writes the 7 day ledger row at the same time so an out of order run can never double send.",
  },
  {
    n: "Once each",
    label: "The ledger row is the lock",
    note: "One row per player, waiver, season and window, unique in the database, so a missed cron day or a late start date never mails anybody twice. The reminders stop the moment the signature lands.",
  },
]

/* ── Scroll stops: the positions a person really puts these pages in ─────── */

const LIB_TOP = 0
/** Down to the template's own description, its preview and the Add button. */
const LIB_PREVIEW = 208

const BOARD_TOP = 0
/** Down to Toronto Lords Grade 10 Girls, the seventeenth of the 22 cards. */
const BOARD_LORDS = 1592

const SIGN_TOP = 0
/** Thumb one: the name, the relationship chips and the signature pad. */
const SIGN_FORM = 400
/** Thumb two: the signature, the acknowledgment and the button. */
const SIGN_SUBMIT = 640
/** The success render is short: the card sits with the receipt mid screen. */
const SIGN_DONE = 250

/* ── Pacing ──────────────────────────────────────────────────────────────── */

function paced(b: Omit<DemoBeat, "hold"> & { hold?: number }): DemoBeat {
  if (b.hold) return b as DemoBeat
  /* Human pace (owner 2026-08-19): people click, then click again. Long reads
     only where a balloon earns one. Copied from your-week-story.tsx. */
  const arrive = b.cursor ? 620 : 180
  const settle = 400
  const read = b.callout ? b.callout.trim().split(/\s+/).length * 140 + 700 : 1200
  return { ...b, hold: Math.round(arrive + read + (b.callout ? settle : 0)) }
}

/* ── The script ──────────────────────────────────────────────────────────── */

export const waiversStory: DemoScript = {
  presentation: "scene",
  desktopUrl: "/manage/leagues/nph-summer/waivers",
  context: CTX_LIBRARY,
  initialStage: "desktop",
  chapters: [
    { id: "doc", title: "One document" },
    { id: "sign", title: "A minute on a phone" },
    { id: "board", title: "The board answers" },
  ],

  /* ENGINE LAW, obeyed everywhere below: a beat's `set` applies at its START,
     so a press whose own patch moves or removes its target deletes the thing
     the cursor is flying at. Every press is its own beat; the landing is the
     next one, and nothing scrolls on a beat that also presses. */
  beats: [
    /* ── 1. One document ──────────────────────────────────────────────── */
    paced({
      id: "empty",
      chapter: "doc",
      caption: "A league starts with nothing to sign, and the page names the two that matter.",
      emphasize: "empty-state",
    }),
    paced({
      id: "add",
      chapter: "doc",
      caption: "Adding one.",
      cursor: "add-waiver",
      press: true,
    }),
    paced({
      id: "templates",
      chapter: "doc",
      caption: "Three Ontario starters, and a blank document for anything else.",
      set: { creating: true },
      emphasize: "templates",
    }),
    paced({
      id: "pick",
      chapter: "doc",
      caption: "The concussion code.",
      cursor: "tpl-concussion",
      press: true,
    }),
    /* No balloon here: the panel's own description states the Rowan's Law
       mandate in the product's words, and R6 forbids narrating the visible. */
    paced({
      id: "preview",
      chapter: "doc",
      caption: "The whole text, and the province's reason for it, before anybody agrees to anything.",
      set: { template: "tpl-concussion", scroll: LIB_PREVIEW },
      emphasize: "tpl-preview",
    }),
    paced({
      id: "create",
      chapter: "doc",
      caption: "Added.",
      cursor: "tpl-add",
      press: true,
    }),
    paced({
      id: "created",
      chapter: "doc",
      caption: "Required, version one, and it renews every year.",
      set: { created: true, creating: false, scroll: LIB_TOP },
      emphasize: "badge-renews",
      callout: "Last season's signature is not an answer to this season.",
    }),
    paced({
      id: "attach",
      chapter: "doc",
      caption: "Nothing else is set up. Approval is the send.",
      emphasize: "page-lead",
      callout: "There is no recipient picker in this product: an approved roster already is the list.",
    }),

    /* ── The season's own board ───────────────────────────────────────── */
    paced({
      id: "board-open",
      chapter: "doc",
      caption: `Later in the season, the same document reads ${SIGNED_BEFORE} in and ${OUT_BEFORE} still out.`,
      context: CTX_BOARD,
      set: { screen: "board", scroll: BOARD_TOP },
      emphasize: "totals",
      callout: `Twenty two approved teams and ${CELLS} rostered players, counted off the rosters rather than off emails sent.`,
    }),
    paced({
      id: "stack",
      chapter: "doc",
      caption: "Every approved team, with its own count and its own re-send.",
      set: { scroll: BOARD_LORDS },
    }),
    paced({
      id: "expand",
      chapter: "doc",
      caption: "One of them opens.",
      cursor: "team-lords",
      press: true,
    }),
    paced({
      id: "expanded",
      chapter: "doc",
      caption: "The families behind the number, and the guardian each link was sent to.",
      set: { expanded: true },
      emphasize: "roster-table",
    }),
    paced({
      id: "pending",
      chapter: "doc",
      caption: "One of the four still pending has a guardian who has already signed once.",
      emphasize: "row-danielle",
      callout: `${PARENT} signed for his son in July. His daughter's link is still unopened.`,
    }),

    /* ── 2. A minute on a phone ───────────────────────────────────────── */
    paced({
      id: "email",
      chapter: "sign",
      caption: "This is what the league sent him, in the app he reads mail in.",
      stage: "split",
      set: { phone: "mail" },
      /* No balloon: the email's own fine print says the link is personal to
         one child and expires, which is the only invisible thing here. */
      emphasize: "mail-body",
    }),
    paced({
      id: "open",
      chapter: "sign",
      caption: "One tap.",
      cursor: "mail-cta",
      press: true,
      callout: "No account and no password: the emailed link is the whole of the authorization.",
    }),
    paced({
      id: "read",
      chapter: "sign",
      caption: "The link opens the stored document, named for his daughter.",
      set: { phone: "sign", scrollY: SIGN_TOP },
      emphasize: "sign-doc",
    }),
    paced({
      id: "form",
      chapter: "sign",
      caption: "Under the document, three things and a button.",
      set: { scrollY: SIGN_FORM },
    }),
    paced({
      id: "name",
      chapter: "sign",
      caption: "His name, typed by him.",
      cursor: "name-field",
      type: { key: "name", text: PARENT },
      hold: 3200,
    }),
    paced({
      id: "relation",
      chapter: "sign",
      caption: "Then who is signing.",
      cursor: "rel-parent",
      press: true,
    }),
    paced({
      id: "relation-land",
      chapter: "sign",
      caption: "Parent or guardian.",
      set: { relation: "parent" },
    }),
    paced({
      id: "pad",
      chapter: "sign",
      caption: "And a signature.",
      cursor: "sign-pad",
      press: true,
    }),
    paced({
      id: "drawn",
      chapter: "sign",
      caption: "Drawn with a finger, the way he would sign a form at the gym door.",
      set: { drawn: true },
      hold: 2600,
    }),
    paced({
      id: "ack",
      chapter: "sign",
      caption: "The confirmation names his daughter rather than agreeing to nothing in particular.",
      set: { scrollY: SIGN_SUBMIT },
      emphasize: "ack-check",
    }),
    paced({
      id: "ack-press",
      chapter: "sign",
      caption: "Checked.",
      cursor: "ack-check",
      press: true,
    }),
    paced({
      id: "submit",
      chapter: "sign",
      caption: "Sign and submit.",
      set: { acked: true },
      cursor: "submit",
      press: true,
    }),
    paced({
      id: "recorded",
      chapter: "sign",
      caption: "Recorded, and the whole thing took about a minute.",
      set: { done: true, scrollY: SIGN_DONE },
      emphasize: "done-card",
      callout:
        "The record keeps the exact text he was shown, so editing the document later cannot change what he agreed to.",
    }),

    /* ── 3. The board answers ─────────────────────────────────────────── */
    paced({
      id: "cell",
      chapter: "board",
      caption: "Her cell on the league's board turns green while you watch, with his name in it.",
      stage: "desktop",
      context: CTX_BOARD,
      set: { signed: true, scroll: BOARD_LORDS },
      emphasize: "row-danielle",
      callout: "The board is reading the same signature record from the other end.",
    }),
    paced({
      id: "badge",
      chapter: "board",
      caption: "The team badge moves with it: seven of ten, and the three still open keep their names.",
      emphasize: "badge-lords",
      holdMs: 0,
    }),
    paced({
      id: "totals",
      chapter: "board",
      caption: `${SIGNED_AFTER} signed, ${OUT_AFTER} outstanding, across every approved team.`,
      set: { scroll: BOARD_TOP },
      emphasize: "totals",
    }),
    paced({
      id: "resend",
      chapter: "board",
      caption: "One button covers new roster additions and lost emails.",
      cursor: "resend-all",
      press: true,
    }),
    paced({
      id: "sent",
      chapter: "board",
      caption: `${RESEND_SENT} emails, and the ${LIVE_LINKS_AFTER} families who already have a live link were left alone.`,
      set: { notice: RESEND_NOTICE },
      emphasize: "notice",
      callout: "A family whose link is still live is skipped, so no inbox gets the same ask twice.",
    }),
    paced({
      id: "cadence",
      chapter: "board",
      caption: "The rest of the chase is nobody's job.",
      context: CTX_CRON,
      set: { ledger: true, shown: 0 },
      emphasize: "ledger",
      callout: "Two windows, once each, and a row in the database that guarantees the once.",
    }),
    paced({ id: "cad-1", chapter: "board", caption: "Seven days before the season starts.", set: { shown: 1 }, hold: 3000 }),
    paced({ id: "cad-2", chapter: "board", caption: "Then twenty four hours before.", set: { shown: 2 }, hold: 2600 }),
    paced({ id: "cad-3", chapter: "board", caption: "Once each, guaranteed, and no list built by a person.", set: { shown: 3 }, hold: 2800 }),
    paced({
      id: "end",
      chapter: "board",
      caption:
        "One document made from a template, sent by the roster rather than by a person, signed on a phone in a minute, and a board that keeps its own score.",
      hold: 4800,
      set: { endCard: true },
    }),
  ],

  /* ── Render ────────────────────────────────────────────────────────── */

  render: ({ get, typingKey }) => {
    const screen = get<string>("screen", "library")
    const ledger = get("ledger", false)
    const phone = get<string>("phone", "mail")

    const desktop = (
      /* `globals.css` body: white, lit by two faint corner radials. */
      <div
        className="relative flex h-full flex-col bg-white"
        style={{
          backgroundImage:
            "radial-gradient(circle at top left, rgba(99, 102, 241, 0.05), transparent 22%), radial-gradient(circle at top right, rgba(242, 78, 30, 0.04), transparent 18%)",
        }}
      >
        <div key={ledger ? "ledger" : screen} className="demo-fade-in flex min-h-0 flex-1 flex-col">
          {ledger ? (
            <CadenceNarration shown={get("shown", 0)} />
          ) : screen === "library" ? (
            <WaiverLibraryPage
              creating={get("creating", false)}
              created={get("created", false)}
              template={get<string>("template", "tpl-risk")}
              scroll={get("scroll", 0)}
            />
          ) : (
            <SigningStatusPage
              expanded={get("expanded", false)}
              signed={get("signed", false)}
              notice={get<string>("notice", "")}
              scroll={get("scroll", 0)}
            />
          )}
        </div>

        {get("endCard", false) && <EndCard />}
      </div>
    )

    const phoneNode = (
      <div key={phone} className="demo-fade-in h-full">
        {phone === "mail" ? (
          <PhoneMail />
        ) : (
          <PhoneSignPage
            scrollY={get("scrollY", 0)}
            name={
              <TypeText
                text={get<string>("name", "")}
                typing={typingKey === "name"}
                placeholder="First and last name"
              />
            }
            relation={get<string>("relation", "")}
            drawn={get("drawn", false)}
            acked={get("acked", false)}
            done={get("done", false)}
          />
        )}
      </div>
    )

    return { desktop, phone: phoneNode }
  },
}

/* ═══════════════════════════════════════════════════════════════════════════
 * SHARED PRIMITIVES, copied from the product's own kit
 * ═══════════════════════════════════════════════════════════════════════════ */

/** `components/ui/badge.tsx`, tones and shape verbatim. */
const BADGE_TONES = {
  neutral: "bg-ink-50 text-ink-600 ring-ink-200",
  play: "bg-play-50 text-play-700 ring-play-100",
  court: "bg-court-50 text-court-700 ring-court-100",
  warning: "bg-amber-50 text-amber-700 ring-amber-100",
} as const

function Badge({
  children,
  tone = "neutral",
  id,
}: {
  children: ReactNode
  tone?: keyof typeof BADGE_TONES
  id?: string
}) {
  return (
    <span
      data-demo-target={id}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] ring-1 ring-inset",
        BADGE_TONES[tone]
      )}
    >
      {children}
    </span>
  )
}

/**
 * `components/ui/button.tsx` at the two shapes these screens use: the default
 * `primary` + `brand` fill (the league's brand colour, `--brand`), and
 * `subtle`. Sizes are the file's own SIZES map.
 */
function Btn({
  children,
  id,
  variant = "primary",
  block,
  className,
}: {
  children: ReactNode
  id?: string
  variant?: "primary" | "subtle"
  block?: boolean
  className?: string
}) {
  return (
    <span
      data-demo-target={id}
      className={cn(
        "inline-flex cursor-default items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 motion-reduce:transition-none",
        variant === "subtle"
          ? "border-ink-200 text-ink-700 border bg-white data-[demo-hover=true]:border-ink-300 data-[demo-hover=true]:bg-ink-50"
          : "text-white shadow-[0_10px_24px_-12px_rgba(15,23,42,0.5)] data-[demo-hover=true]:brightness-95",
        "data-[demo-press=true]:scale-[0.97]",
        block && "w-full",
        className
      )}
      style={variant === "primary" ? { backgroundColor: "var(--brand, #4f46e5)" } : undefined}
    >
      {children}
    </span>
  )
}

/** `components/ui/smart-back.tsx` on a cold entry: the chevron and the parent. */
function SmartBack({ label }: { label: string }) {
  return (
    <span className="text-ink-600 -ml-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl py-2 pl-1 pr-3 text-sm font-semibold">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5">
        <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </span>
  )
}

/**
 * A real page is taller than the 600 the scene gives it, so the region scrolls
 * exactly as a browser would. Nothing is hidden or squeezed; the column moves.
 */
function Scroll({ offset, children }: { offset: number; children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      <div
        className="transition-transform duration-500 ease-out motion-reduce:transition-none"
        style={{ transform: `translateY(${-offset}px)` }}
      >
        {children}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
 * DESKTOP 1 — /manage/leagues/[id]/waivers
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * `manage/leagues/[id]/waivers/page.tsx` around
 * `components/waivers/waivers-manager.tsx`. The page's own header block is
 * drawn because it carries the sentence that explains the whole feature, and
 * the 08-16 cut left it off.
 */
function WaiverLibraryPage({
  creating,
  created,
  template,
  scroll,
}: {
  creating: boolean
  created: boolean
  template: string
  scroll: number
}) {
  return (
    <Scroll offset={scroll}>
      <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
        <div>
          <SmartBack label={LEAGUE} />
          <h1 className="text-ink-900 mt-1 text-xl font-bold md:text-2xl">Waivers</h1>
          <p data-demo-target="page-lead" className="text-ink-500 mt-1 text-sm">
            {LIBRARY_LEAD}
          </p>
        </div>

        {/* `waivers-manager.tsx` lines 77 to 185. */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-ink-900 text-lg font-bold">Waivers &amp; agreements</h2>
              <p className="text-ink-500 mt-0.5 text-sm">
                Documents parents sign before their child participates
              </p>
            </div>
            <Btn id="add-waiver">{creating ? "Cancel" : "Add waiver"}</Btn>
          </div>

          {creating && <CreatePanel template={template} />}

          {!created && !creating && (
            <div
              data-demo-target="empty-state"
              className="border-ink-300 bg-ink-50/50 text-ink-500 rounded-xl border border-dashed p-8 text-center text-sm"
            >
              {LIBRARY_EMPTY}
            </div>
          )}

          {created && (
            <div className="space-y-3">
              <div
                data-demo-target="doc-row"
                className="border-ink-200 rounded-xl border bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-ink-900 font-semibold">{DOC}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge>Concussion code</Badge>
                      <Badge>v1</Badge>
                      <Badge tone="play">Required</Badge>
                      <Badge tone="warning" id="badge-renews">
                        Renews yearly
                      </Badge>
                      {/* A document made a moment ago has none. The season
                          board later in the story is the same document with
                          the 27 the database holds. */}
                      <span className="text-ink-400 text-xs">0 signatures</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Btn variant="subtle">Edit</Btn>
                    <Btn variant="subtle">Deactivate</Btn>
                  </div>
                </div>
              </div>
            </div>
          )}

          <p className="text-ink-400 text-xs leading-relaxed">{LIBRARY_FOOT}</p>
        </div>
      </div>
    </Scroll>
  )
}

/** `waivers-manager.tsx` CreatePanel, lines 188 to 272. */
function CreatePanel({ template }: { template: string }) {
  const selected = TEMPLATES.find((t) => t.id === template) ?? TEMPLATES[0]
  return (
    <div
      data-demo-target="templates"
      className="border-ink-200 space-y-4 rounded-xl border bg-white p-4 sm:p-5"
    >
      <div className="flex flex-wrap gap-2">
        {TEMPLATES.map((t) => (
          <span
            key={t.id}
            data-demo-target={t.id}
            className={cn(
              "cursor-default rounded-xl border px-3.5 py-2 text-sm font-semibold transition",
              t.id === template
                ? "border-play-600 bg-play-50 text-play-800"
                : "border-ink-200 text-ink-600 data-[demo-hover=true]:border-ink-300"
            )}
          >
            {t.title}
          </span>
        ))}
        <span className="border-ink-200 text-ink-600 cursor-default rounded-xl border px-3.5 py-2 text-sm font-semibold">
          Custom document
        </span>
      </div>

      <p className="text-ink-500 text-sm">{selected.description}</p>

      {/* The panel's own preview box: max-h-56, scrolling, 12px pre. */}
      <div
        data-demo-target="tpl-preview"
        className="border-ink-100 bg-ink-50/50 max-h-56 overflow-hidden rounded-xl border p-4"
      >
        <pre className="text-ink-600 whitespace-pre-wrap font-sans text-xs leading-relaxed">
          {selected.body}
        </pre>
      </div>

      <Btn id="tpl-add">Add &quot;{selected.title}&quot;</Btn>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
 * DESKTOP 2 — /manage/leagues/[id]/seasons/[seasonId]/waivers
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * `seasons/[seasonId]/waivers/page.tsx` around
 * `components/waivers/waiver-status-view.tsx`. All 22 approved teams in one
 * vertical column, the way the real page draws them; the region scrolls to
 * whichever one is being read.
 */
function SigningStatusPage({
  expanded,
  signed,
  notice,
  scroll,
}: {
  expanded: boolean
  signed: boolean
  notice: string
  scroll: number
}) {
  const total = signed ? SIGNED_AFTER : SIGNED_BEFORE
  const outstanding = signed ? OUT_AFTER : OUT_BEFORE

  return (
    <Scroll offset={scroll}>
      <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
        <div>
          <SmartBack label={`${LEAGUE} · ${SEASON}`} />
          <h1 className="text-ink-900 mt-1 text-xl font-bold md:text-2xl">Signing status</h1>
          <p data-demo-target="board-lead" className="text-ink-500 mt-1 text-sm">
            {BOARD_LEAD}
          </p>
        </div>

        {/* `waiver-status-view.tsx` lines 118 to 146. */}
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div data-demo-target="totals" className="flex items-center gap-2">
              <Badge tone="court">
                <span className="tabular-nums">{total}</span> signed
              </Badge>
              <Badge tone="warning">
                <span className="tabular-nums">{outstanding}</span> outstanding
              </Badge>
              {/* Never pressed in this story: no team in this world is
                  complete, so the real filter would remove nothing. */}
              <span className="bg-ink-50 text-ink-500 rounded-full px-2.5 py-1 text-[11px] font-medium">
                Only missing
              </span>
            </div>
            <Btn id="resend-all" variant="subtle">
              Re-send all outstanding
            </Btn>
          </div>

          {notice && (
            <p
              data-demo-target="notice"
              className="bg-play-50 text-play-800 live-pop rounded-xl px-4 py-3 text-sm"
            >
              {notice}
            </p>
          )}

          {BOARD_TEAMS.map((t) => {
            const isTarget = t.id === "team-lords"
            return (
              <TeamCard
                key={t.team}
                id={t.id}
                team={t.team}
                signed={isTarget && signed ? t.signed + 1 : t.signed}
                badgeId={isTarget ? "badge-lords" : undefined}
                open={isTarget && expanded}
                signedNow={isTarget && signed}
              />
            )
          })}
        </div>
      </div>
    </Scroll>
  )
}

/**
 * One team card and its expansion. The row is a disclosure button carrying the
 * caret, the team name and the signed Badge, with its own "Re-send" on the
 * right; the expansion is a table whose first column is the player with the
 * parent email UNDER the name, and whose remaining columns are one per
 * required waiver.
 */
function TeamCard({
  id,
  team,
  signed,
  badgeId,
  open,
  signedNow,
}: {
  id?: string
  team: string
  signed: number
  badgeId?: string
  open: boolean
  signedNow: boolean
}) {
  return (
    <div className="border-ink-200 overflow-hidden rounded-xl border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <span data-demo-target={id} className="flex min-w-0 items-center gap-2 text-left">
          <span className="text-ink-400 text-xs">{open ? "▾" : "▸"}</span>
          <span className="text-ink-900 font-semibold">{team}</span>
          {/* PUNCH 3, honoured: no team in this world is complete, so the
              product's court "All signed" badge never appears here either. */}
          <Badge tone="warning" id={badgeId}>
            {signed}/10 signed
          </Badge>
        </span>
        <Btn variant="subtle">Re-send</Btn>
      </div>

      {open && (
        <div data-demo-target="roster-table" className="border-ink-100 border-t">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ink-400 text-left text-xs uppercase tracking-wide">
                <th className="px-4 py-2 font-semibold">Player</th>
                <th className="px-4 py-2 font-semibold">{DOC}</th>
              </tr>
            </thead>
            <tbody>
              {ROSTER.map((r) => {
                const isTarget = r.id === "row-danielle"
                const cellSigner = isTarget && signedNow ? PARENT : r.signer
                return (
                  <tr key={r.player} data-demo-target={r.id} className="border-ink-50 border-t">
                    <td className="px-4 py-2.5">
                      <p className="text-ink-800 font-medium">{r.player}</p>
                      <p className="text-ink-400 text-xs">{r.email}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      {cellSigner ? (
                        <span
                          className={cn(
                            "text-court-700",
                            isTarget && signedNow && "demo-pulse-green"
                          )}
                        >
                          ✓ {cellSigner}
                        </span>
                      ) : (
                        <span className="text-amber-600">Pending</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
 * DESKTOP 3 — the reminder cadence: NARRATION, NOT A SCREEN
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * `sendWaiverReminders` runs from `GET /api/cron/waiver-reminders` and nothing
 * in the product ever shows a league what it sent or is about to send. So this
 * card is navy, with no console chrome anywhere near it, and its context strip
 * says out loud that no screen shows this. Punch item 1 in the numbers sheet;
 * the fix is a real reminder log on the season.
 */
function CadenceNarration({ shown }: { shown: number }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center bg-[#0b1628] px-12 py-8 text-white">
      <p className="text-gold-400 text-[15px] font-bold uppercase tracking-[0.16em]">
        What happens next, without anybody chasing
      </p>
      {/* The ring and the balloon anchor HERE rather than to the whole card:
          a full-height anchor pushed the balloon up over the context strip,
          which is the line that says no screen shows this (frame review). */}
      <p
        data-demo-target="ledger"
        className="font-display mt-2 text-[38px] font-extrabold leading-none tabular-nums"
      >
        {OUT_AFTER} still outstanding
      </p>
      <p className="mt-2 text-[16px] font-semibold text-white/70">
        {DOC} · every approved roster in {SEASON}
      </p>

      <div className="mt-6 space-y-2.5">
        {CADENCE.map((r, i) => (
          <div
            key={r.label}
            className={cn(
              "flex items-baseline gap-5 rounded-2xl border px-5 py-3 transition-opacity duration-500 motion-reduce:transition-none",
              i < shown ? "border-white/15 bg-white/[0.07] opacity-100" : "border-white/5 opacity-20"
            )}
          >
            <span className="text-gold-400 w-[132px] shrink-0 text-[18px] font-extrabold leading-tight">
              {r.n}
            </span>
            <span className="min-w-0">
              <span className="block text-[17px] font-bold">{r.label}</span>
              <span className="mt-1 block text-[15px] font-medium leading-snug text-white/60">
                {r.note}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
 * PHONE — the OS, then the public page
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * His mail app, not our product (R8). The chrome is iOS Mail's message view;
 * everything inside the white card is `sendWaiverSignEmail` rendered with its
 * OWN inline styles, so what is on screen is the HTML the server really sends.
 */
function PhoneMail() {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-black/10 bg-[#f7f7f8] px-3 py-1.5">
        <span className="text-[15px] font-medium text-[#007aff]">‹ Inbox</span>
        <span className="flex items-center gap-4 text-[#007aff]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
            <path d="M3 8l9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="3" y="5" width="18" height="14" rx="2" />
          </svg>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
            <path d="M9 17l-5-5 5-5M4 12h11a5 5 0 0 1 0 10h-1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>

      <div className="flex shrink-0 items-start gap-2.5 border-b border-black/10 px-4 py-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#0b1628] text-[12px] font-bold text-white">
          NS
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-ink-950 block text-[15px] font-semibold leading-tight">{LEAGUE}</span>
          <span className="text-ink-500 block text-[13px] leading-tight">to {PARENT}</span>
        </span>
        <span className="text-ink-400 shrink-0 text-[13px]">9:41 AM</span>
      </div>

      <p className="text-ink-950 shrink-0 px-4 pt-2 text-[15px] font-bold leading-tight">
        {EMAIL.subject}
      </p>

      {/* The email itself. Inline styles, not Tailwind, because these are the
          bytes `lib/email.ts` puts on the wire. */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <div
          style={{
            fontFamily: "-apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
            maxWidth: 520,
            margin: "0 auto",
            padding: 8,
          }}
        >
          {/* The ring hugs the CARD, not the scroll region: a ring around the
              region crossed the subject line (frame review, 2026-08-19). */}
          <div
            data-demo-target="mail-body"
            style={{
              background: "#ffffff",
              border: "1px solid #e5e5e5",
              borderRadius: 20,
              padding: 16,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 11,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "#4f46e5",
                fontWeight: 700,
              }}
            >
              {LEAGUE}
            </p>
            <h1 style={{ margin: "10px 0 0", fontSize: 21, color: "#18181b", lineHeight: 1.2 }}>
              {DOC}
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#71717a" }}>{EMAIL.context}</p>
            <p style={{ margin: "16px 0 0", fontSize: 14, lineHeight: 1.6, color: "#3f3f46" }}>
              {EMAIL.greeting} before <strong>{PLAYER}</strong> can participate with {LEAGUE}, a
              parent or guardian needs to review and sign this document. It takes about a minute.
            </p>
            <p style={{ margin: "22px 0 0" }}>
              <span
                data-demo-target="mail-cta"
                style={{
                  display: "inline-block",
                  padding: "13px 28px",
                  background: "#4f46e5",
                  color: "#ffffff",
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 15,
                }}
                className="transition-all duration-150 data-[demo-hover=true]:brightness-110 data-[demo-press=true]:scale-[0.97]"
              >
                {EMAIL.cta}
              </span>
            </p>
            <p style={{ margin: "24px 0 0", fontSize: 12, lineHeight: 1.6, color: "#a1a1aa" }}>
              This link is personal to {PLAYER} and expires in 30 days. If someone else in your
              family already signed, the page will tell you and nothing more is needed.
            </p>
          </div>
          <hr style={{ border: "none", borderTop: "1px solid #e5e5e5", margin: "24px 0 12px" }} />
          <p style={{ color: "#999", fontSize: 12, margin: 0 }}>
            Sent by {LEAGUE} via SportsHub (Youth Basketball Hub). You received this because of an
            account, registration, or invitation associated with this address.
          </p>
        </div>
      </div>
    </div>
  )
}

/** Mobile Safari, the way a tokenized public link arrives. OS chrome (R8). */
function BrowserBar() {
  return (
    <div className="flex shrink-0 items-center justify-center gap-1.5 border-b border-black/10 bg-[#f7f7f8] px-4 py-1.5">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-500 h-3 w-3">
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
      <span className="text-ink-600 text-[13px] font-medium">sportshubone.com</span>
    </div>
  )
}

/**
 * `app/(public)/waivers/sign/[token]/page.tsx` + `sign-form.tsx`, at life size
 * and in one piece.
 *
 * The real page is ONE long scroll: a daylight court wash, a `rounded-[28px]`
 * card, the header block, the document in a `max-h-[45vh]` scroll box, then
 * the form. A 390 handset cannot hold all of that at once and neither can a
 * real one, so the page is filmed in the three positions a thumb puts it in
 * rather than redrawn as three different screens. Every label, placeholder,
 * chip and sentence is verbatim.
 */
function PhoneSignPage({
  scrollY,
  name,
  relation,
  drawn,
  acked,
  done,
}: {
  scrollY: number
  name: ReactNode
  relation: string
  drawn: boolean
  acked: boolean
  done: boolean
}) {
  return (
    <div className="flex h-full flex-col bg-white">
      <BrowserBar />
      <div
        className="min-h-0 flex-1 overflow-hidden"
        /* `court-backdrop.tsx` daylight: the base gradient under the wash. */
        style={{ backgroundImage: "linear-gradient(165deg,#fffbf0 0%,#ffffff 55%,#fff7ed 100%)" }}
      >
        <div
          className="transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: `translateY(${-scrollY}px)` }}
        >
          <div className="px-4 py-8">
            <div className="border-ink-100 shadow-panel overflow-hidden rounded-[28px] border bg-white">
              <div className="border-ink-100 border-b p-6">
                <p className="text-play-600 text-[11px] font-bold uppercase tracking-[2px]">
                  {LEAGUE}
                </p>
                <h1 className="text-ink-950 mt-2 text-2xl font-bold leading-tight">{DOC}</h1>
                <p className="text-ink-500 mt-1 text-sm">
                  For <span className="text-ink-700 font-semibold">{PLAYER}</span> · renews yearly
                </p>
              </div>

              <div
                data-demo-target="sign-doc"
                className="border-ink-100 bg-ink-50 h-[200px] overflow-hidden border-b p-6"
              >
                <pre className="text-ink-700 whitespace-pre-wrap font-sans text-[13.5px] leading-relaxed">
                  {DOC_BODY}
                </pre>
              </div>

              {done ? <SignDone /> : (
                <SignForm
                  name={name}
                  relation={relation}
                  drawn={drawn}
                  acked={acked}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** `sign-form.tsx` lines 87 to 158, verbatim. */
function SignForm({
  name,
  relation,
  drawn,
  acked,
}: {
  name: ReactNode
  relation: string
  drawn: boolean
  acked: boolean
}) {
  return (
    <div className="space-y-5 p-6">
      <div className="grid gap-4">
        <div>
          <span className="text-ink-700 block text-sm font-semibold">Your full name</span>
          <span
            data-demo-target="name-field"
            className="border-ink-200 mt-1.5 flex min-h-[42px] w-full items-center rounded-xl border bg-white px-3.5 text-sm transition-all duration-200 motion-reduce:transition-none data-[demo-hover=true]:border-play-500 data-[demo-hover=true]:ring-play-200 data-[demo-hover=true]:ring-2"
          >
            {name}
          </span>
        </div>
        <div>
          <span className="text-ink-700 block text-sm font-semibold">Relationship to player</span>
          {/* `components/ui/chip-group.tsx`: min-h-[44px] pills, play fill. */}
          <div className="mt-1.5 flex flex-wrap gap-2">
            <RelChip id="rel-parent" label="Parent or guardian" on={relation === "parent"} />
            <RelChip label="Player (18 or older)" on={relation === "player"} />
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <span className="text-ink-700 block text-sm font-semibold">Signature</span>
          <span className="text-ink-400 text-xs">Draw with your finger or mouse</span>
        </div>
        <span
          data-demo-target="sign-pad"
          className={cn(
            "border-ink-200 mt-1.5 block h-[150px] overflow-hidden rounded-xl border bg-white transition-all duration-200 motion-reduce:transition-none",
            "data-[demo-hover=true]:border-play-400 data-[demo-press=true]:brightness-95"
          )}
        >
          {drawn && (
            <svg viewBox="0 0 300 150" className="h-full w-full" aria-hidden="true">
              <path
                className="demo-sign-draw"
                d="M26 104 C40 46 56 40 60 66 C64 92 52 104 74 90 C96 76 90 60 112 76 C124 86 140 62 152 76 C170 96 180 58 200 74 C212 84 226 68 244 80 C256 88 266 76 276 62"
                fill="none"
                stroke="#1b2a4a"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          )}
        </span>
      </div>

      <span
        data-demo-target="ack-check"
        className={cn(
          "text-ink-700 flex items-start gap-3 rounded-lg text-sm transition-all duration-200 motion-reduce:transition-none",
          "data-[demo-press=true]:brightness-95"
        )}
      >
        <span
          className={cn(
            "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border",
            acked ? "border-play-600 bg-play-600" : "border-ink-300 bg-white"
          )}
        >
          {acked && (
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" className="h-2.5 w-2.5">
              <path d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
        <span>{ACK}</span>
      </span>

      <span
        data-demo-target="submit"
        className={cn(
          "bg-play-600 block w-full rounded-xl px-6 py-3.5 text-center text-sm font-bold text-white transition-all duration-150 motion-reduce:transition-none",
          !(acked && drawn) && "opacity-40",
          "data-[demo-hover=true]:bg-play-700 data-[demo-press=true]:scale-[0.97]"
        )}
      >
        Sign and submit
      </span>

      <p className="text-ink-400 text-center text-xs leading-relaxed">{STORED}</p>
    </div>
  )
}

function RelChip({ id, label, on }: { id?: string; label: string; on: boolean }) {
  return (
    <span
      data-demo-target={id}
      className={cn(
        "inline-flex min-h-[44px] cursor-default items-center rounded-full border px-4 py-2 text-sm font-semibold transition-colors duration-200 motion-reduce:transition-none",
        on
          ? "border-play-600 bg-play-600 text-white shadow-sm"
          : "border-ink-200 text-ink-700 bg-white data-[demo-hover=true]:border-play-300 data-[demo-hover=true]:bg-play-50/50"
      )}
    >
      {label}
    </span>
  )
}

/** `sign-form.tsx` lines 60 to 84, the real "done" render. */
function SignDone() {
  return (
    <div data-demo-target="done-card" className="p-6 text-center">
      <div className="bg-court-50 text-court-600 live-pop mx-auto grid h-14 w-14 place-items-center rounded-2xl">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="h-7 w-7"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 className="text-ink-950 mt-3 text-lg font-bold">Signed and recorded</h2>
      <p className="text-ink-600 mt-2 text-sm leading-relaxed">
        Thank you. {LEAGUE} now has your signed copy on file for {PLAYER}. You can close this page.
      </p>
    </div>
  )
}

/* ── End card ────────────────────────────────────────────────────────────── */

function EndCard() {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0b1628] px-12 text-white">
      <div className="live-pop max-w-[760px] text-center">
        <p className="text-gold-400 text-[15px] font-bold uppercase tracking-[0.18em]">
          A league chapter
        </p>
        <h3 className="font-display mt-2 text-[34px] font-extrabold leading-tight">
          Waivers, start to finish
        </h3>
        <p className="mt-3 text-[17px] leading-relaxed text-white/75">
          One required document built from the province&apos;s own template, renewing every year,
          emailed by the roster rather than by a person, signed on a phone in about a minute, and a
          board that counts {SIGNED_AFTER} of {CELLS} without anybody building a list.
        </p>
        <p className="mt-5 text-[15px] font-semibold text-white/50">
          Next: game day, both sides at once
        </p>
      </div>
    </div>
  )
}
