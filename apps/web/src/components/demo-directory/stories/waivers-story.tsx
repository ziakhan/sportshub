"use client"

import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import { Btn, Chip, StatusChip } from "../scene-kit"
import { TypeText } from "../motion"
import type { DemoBeat, DemoScript } from "../types"

/**
 * "Waivers, start to finish" (league shelf, audit section B: KEEP).
 *
 * Rebuilt 2026-08-16 to the gold standard set by `season-story.tsx` and
 * `schedule-change-story.tsx`, to the same three laws:
 *
 *   1. PRESENTATION (audit D2). The league board is a focused working REGION
 *      composed at 1160 logical and rendered at scale 1.0: no browser chrome,
 *      no site header, one slim context strip. The parent's signing page is a
 *      LIFE SIZE handset, 390 logical at 1.0, because that is where a waiver
 *      is really signed. Nothing here is authored under 14px, and
 *      `scripts/demo/readability-audit.mjs` is the gate.
 *   2. PACING. Stop, explain, act. Every dwell is computed from the balloon's
 *      own word count, and a beat that carries a balloon silences the caption
 *      bar so the viewer is never read to twice.
 *   3. EVERY NUMBER DERIVED. The league, the season, the waiver, the 22
 *      approved teams, the 220 roster spots, the 27 signatures, the 13 live
 *      links and the 180 the re-send would actually mail are all read out of
 *      the local database, and every one of them is written down with its
 *      source in `docs/roadmap/waivers-numbers.md`.
 *
 * THE WORLD IS REAL, NOT STAGED. `DB`: NPH Summer League, season Summer 2026
 * (`fbbe767c-00e9-4130-9258-4f02c6854efa`), holds exactly one required
 * parent-facing waiver, `WaiverDocument ea472023-b4cb-450a-ab15-b26552bc3b25`,
 * "Concussion Code of Conduct (Rowan's Law)", CONCUSSION_CODE, province ON,
 * `annualRenewal: true`, `required: true`, version 1, created from the
 * product's own template `concussion-code-on` in `lib/waivers/templates.ts`.
 * Against it sit 22 APPROVED team submissions, 220 rostered players, 40 minted
 * sign requests and 27 signatures. The board in this demo is that board.
 *
 * THE FAMILY IS REAL. `DB` `summer-parent-lords@sportshub.demo`, Jordan Reyes,
 * two children in this league. He signed for Darius (#37, Toronto Lords Grade
 * 9) on 2026-07-18. The link for Danielle (#20, Toronto Lords Grade 10 Girls)
 * was emailed on 2026-07-17, expires 2026-10-05, and `consumedAt` is still
 * NULL. So the one signature this demo performs is the one signature this
 * world is actually waiting for, and the cell that turns green is her cell.
 *
 * TRUTH TO THE PRODUCT, SCREEN BY SCREEN.
 *   · the waiver library, `manage/leagues/[id]/waivers` with
 *     `components/waivers/waivers-manager.tsx`: "Waivers & agreements",
 *     "Documents parents sign before their child participates", the type / v1 /
 *     Required / Renews yearly badges, the "27 signatures" count, Edit and
 *     Deactivate, and the versions footnote verbatim;
 *   · the compliance board, `manage/leagues/[id]/seasons/[seasonId]/waivers`
 *     with `components/waivers/waiver-status-view.tsx`: the "N signed" and
 *     "N outstanding" badges, "Only missing", "Re-send all outstanding", the
 *     collapsed team rows with "{signed}/{total} signed" and their own
 *     "Re-send", the expanded table's Player column with the parent email
 *     under it, one column per required waiver, and the cell that reads
 *     "✓ {signerName}" in court green or "Pending" in amber;
 *   · the email, `sendWaiverSignEmail` in `lib/email.ts`: the subject
 *     "Action needed: sign {title} for {player}", the "Review and sign"
 *     button, and the sentence about the link being personal and expiring in
 *     30 days;
 *   · the signing page, `(public)/waivers/sign/[token]`: the org eyebrow, the
 *     title, "For {player} · renews yearly", the document text, "Your full
 *     name" with its "First and last name" placeholder, the "Parent or
 *     guardian" and "Player (18 or older)" chips, "Signature" with "Draw with
 *     your finger or mouse", the acknowledgment sentence naming the child,
 *     "Sign and submit", the storage line, and "Signed and recorded";
 *   · the reminders, `lib/waivers/reminders.ts` behind
 *     `GET /api/cron/waiver-reminders`: 7 days out and 24 hours out, the two
 *     real titles, and the `WaiverReminder` row that IS the send-once lock.
 *
 * FOUR THINGS THE PRODUCT CANNOT HONESTLY SHOW, AND THEY ARE NOT STAGED. All
 * four are punch items in `waivers-numbers.md` section F:
 *
 *   1. NO REMINDER SURFACE. `sendWaiverReminders` runs on a cron and nothing
 *      in the product ever shows a league what it sent or is about to send. So
 *      the reminder beat is drawn as an explicit NARRATION card, in navy, with
 *      no console chrome on it, exactly as the schedule-change demo draws its
 *      fan-out. It can never be mistaken for a screen.
 *   2. NO EXPIRY ANYWHERE ON SCREEN. `WaiverSignature.validUntil` is written
 *      (signedAt plus 365 days) and every "is this satisfied" query filters on
 *      it, but no surface tells a parent or a league when a signature lapses.
 *      The demo therefore says renewal in words and on the two badges the
 *      product really draws, and shows no renewal date.
 *   3. NO TEAM IS COMPLETE. Not one of the 22 approved teams has all ten
 *      signatures, so the product's "All signed" badge never appears in this
 *      world and it does not appear here either.
 *   4. THE SEASON ALREADY STARTED (2026-04-04), so the cron's two windows are
 *      in the past and there are no `WaiverReminder` rows for this waiver. The
 *      cadence card states the rule and its code path, not a send that
 *      happened.
 *
 * MOTION. Nothing pans, zooms or scrolls. The signature draws itself the way a
 * finger leaves it, the cell that changed flashes green in place, and the
 * phone changes what it is showing the same way the desktop does, with a
 * keyed fade rather than a camera move.
 */

/* ── Cast, all read out of the seeded world ──────────────────────────────── */

const LEAGUE = "NPH Summer League"
const SEASON = "Summer 2026"
const DOC = "Concussion Code of Conduct (Rowan's Law)"

const CTX_LIBRARY = `${LEAGUE} · League workspace · Waivers`
const CTX_BOARD = `${LEAGUE} · ${SEASON} · Signing status`
const CTX_LEDGER = `${LEAGUE} · ${SEASON} · What the cron does next`

/** `DB` The family. Two children in this league, one waiver still open. */
const PARENT = "Jordan Reyes"
const PARENT_EMAIL = "summer-parent-lords@sportshub.demo"
const PLAYER = "Danielle Reyes"
const PLAYER_TEAM = "Toronto Lords Grade 10 Girls"

/** `DB` The board, before this demo signs anything. */
const TEAMS_TOTAL = 22
const CELLS = 220
const SIGNED_BEFORE = 27
const SIGNED_AFTER = 28
/** `PRODUCT` `waiver-status/route.ts`: outstanding is cells minus signed. */
const OUT_BEFORE = CELLS - SIGNED_BEFORE
const OUT_AFTER = CELLS - SIGNED_AFTER
/** `DB`/`ARITH` What "Re-send all outstanding" would really mail. */
const RESEND_SENT = 180
const LIVE_LINKS_AFTER = 12

/**
 * The document text, verbatim from `WaiverDocument.body`. The signing page
 * renders the whole thing in a scrolling `<pre>`; the handset shows the part
 * that fits and says so, which is what a phone does.
 */
const DOC_BODY = `CONCUSSION CODE OF CONDUCT

Organization: ${LEAGUE}

Under Rowan's Law (Concussion Safety), 2018, all athletes under 26, and the parents or guardians of athletes under 18, must review Ontario's Concussion Awareness Resources and confirm this Code of Conduct every year.

I confirm that I have reviewed the Ontario Concussion Awareness Resource for my child's age group (available at ontario.ca/concussions) and I commit to the following:

1. I will help create a culture where concussions are taken seriously. Fair play and respect for all participants come first.`

/**
 * ALL TWENTY TWO approved teams, in the order the endpoint returns them
 * (`waiver-status/route.ts` orders submissions by `createdAt` asc), each with
 * its REAL signed count read out of the database on 2026-08-16: 27 signatures
 * across 220 rostered players, and the four teams carrying all of them.
 *
 * The 2026-08-16 cut drew THREE of these rows under a "3 of 22" chip, with
 * about 290px of empty panel under them, while the beat said the board counts
 * the whole season. A compliance board that claims 22 teams draws 22 teams, so
 * it is a two column grid now. Opening a team narrows it back to one column
 * around that team, because the expansion names all ten of its players.
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
/** The window the board narrows to while a team is open. */
const OPEN_WINDOW = 3

/**
 * The whole Toronto Lords Grade 10 Girls roster, in the order the endpoint
 * hands it over, with the signer the product would print in the cell. Ten of
 * ten, because the point of the beat is that the four who have not signed are
 * named rather than counted.
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

/** `PRODUCT` The board's own lead sentence, from the season waivers page. */
const BOARD_LEAD =
  "Who has signed the league's required waivers, team by team. Waiver emails go out automatically when a team is approved; re-send covers new roster additions and lost emails."

/** `PRODUCT` The library's footnote, from `waivers-manager.tsx`. */
const LIBRARY_FOOT =
  "Templates are starting points, not legal advice. Have a lawyer review your final text. Editing a waiver's text creates a new version and everyone signs the new text; existing signatures keep the exact text they signed."

/** `PRODUCT` The email, from `sendWaiverSignEmail` in `lib/email.ts`. */
const EMAIL = {
  subject: `Action needed: sign ${DOC} for ${PLAYER}`,
  greeting: `Hi ${PARENT.split(" ")[0]},`,
  context: `${PLAYER_TEAM} · ${SEASON}`,
  body: `before ${PLAYER} can participate with ${LEAGUE}, a parent or guardian needs to review and sign this document. It takes about a minute.`,
  cta: "Review and sign",
  foot: `This link is personal to ${PLAYER} and expires in 30 days. If someone else in your family already signed, the page will tell you and nothing more is needed.`,
}

/** `PRODUCT` The re-send notice, from `waiver-status-view.tsx` line 88. */
const RESEND_NOTICE = `Sent ${RESEND_SENT} emails.`

/** `PRODUCT` The acknowledgment, from `sign-form.tsx` lines 134 to 137. */
const ACK = `I have read and understood this document, and I confirm that I am authorized to sign it for ${PLAYER}.`

/** `PRODUCT` The storage line under the submit button. */
const STORED =
  "Your signature, name, the exact document text, and the date and time are stored securely as your signed record."

/**
 * THE CADENCE, from `lib/waivers/reminders.ts`, behind
 * `GET /api/cron/waiver-reminders` running daily. Titles and the message
 * template are verbatim; the send-once rule is the `WaiverReminder` unique key.
 */
const CADENCE = [
  {
    n: "7 days",
    label: "Waiver still unsigned",
    note: `Bell, push and a fresh signing link, to the guardian of every player still outstanding. "${LEAGUE} starts soon: ${PLAYER} can't play until you sign."`,
  },
  {
    n: "24 hours",
    label: "Sign before the first game",
    note: "The same three channels, the last call, and it also writes the 7 day ledger row so an out of order run can never double send.",
  },
  {
    n: "Once each",
    label: "A row in the ledger is the lock",
    note: "The reminder row is unique on player, waiver, season and window, so a missed day or a late start date never mails anybody twice.",
  },
  {
    n: "0",
    label: "lists built by hand",
    note: "The window picks the season, and the season's own rosters pick the guardians. The reminders stop the moment the signature lands.",
  },
]

/* ── Pacing ──────────────────────────────────────────────────────────────── */

/**
 * Stop, explain, act (owner ruling 2026-08-16: "slow is the point"). The hand
 * takes CURSOR_ARRIVE_MS to reach its target and the balloon lands with it, so
 * a beat holds for the travel, plus long enough to READ the balloon at about
 * 180ms a word with a 900ms buffer for the eye to find it, plus a settle so
 * the next thing does not fire on the last syllable.
 */
function paced(b: Omit<DemoBeat, "hold"> & { hold?: number }): DemoBeat {
  if (b.hold) return b as DemoBeat
  const arrive = b.cursor ? 620 : 220
  const settle = 500
  const read = b.callout ? b.callout.trim().split(/\s+/).length * 180 + 900 : 2400
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

  beats: [
    /* ── 1. One document ──────────────────────────────────────────────── */
    paced({
      id: "library",
      chapter: "doc",
      caption: "The league's waiver is a document the league owns.",
      emphasize: "doc-row",
      callout: "One stored text and one version, so everybody signs the same words.",
    }),
    paced({
      id: "renews",
      chapter: "doc",
      caption: "Ontario's concussion code has to be confirmed again every year.",
      emphasize: "badge-renews",
      callout:
        "Rowan's Law renews yearly, so last season's signature is not an answer to this season.",
    }),
    paced({
      id: "footnote",
      chapter: "doc",
      caption: "Change the text and the old signatures keep the old text.",
      emphasize: "library-foot",
      holdMs: 0,
      callout: "Editing makes a new version. Nobody is recorded agreeing to words they never read.",
    }),
    paced({
      id: "board-open",
      chapter: "doc",
      caption: `The season counts the same document in signatures: ${SIGNED_BEFORE} in, ${OUT_BEFORE} still out.`,
      context: CTX_BOARD,
      set: { screen: "board" },
      emphasize: "totals",
      callout: `Twenty two approved teams and ${CELLS} rostered players, counted from the rosters.`,
    }),
    paced({
      id: "no-picker",
      chapter: "doc",
      caption: "There is no recipient list to build.",
      emphasize: "board-lead",
      callout: "Approving a team emails every guardian on its roster. That is the whole send.",
    }),
    paced({
      id: "expand",
      chapter: "doc",
      caption: "Every team opens to the families behind the number.",
      cursor: "team-lords",
      press: true,
      set: { expanded: true },
      callout: "The four who have not signed are named on the row, with their guardian.",
    }),
    paced({
      id: "pending",
      chapter: "doc",
      caption: "One of them has a guardian who has already signed for his other child.",
      emphasize: "row-danielle",
      callout: "Jordan Reyes signed for his son in July. Her link is still unopened.",
    }),

    /* ── 2. A minute on a phone ───────────────────────────────────────── */
    paced({
      id: "email",
      chapter: "sign",
      caption: "This is the email the league sent him.",
      stage: "split",
      set: { phone: "email" },
      emphasize: "mail-card",
      callout: "One email per child, naming the child, with the link that belongs to her alone.",
    }),
    paced({
      id: "open",
      chapter: "sign",
      caption: "One tap.",
      /* PRESS, THEN RESULT (2026-08-16). State lands at the TOP of a beat, so
         opening the link here would delete the button the hand is still
         travelling to, and a phone keyhole would pan to nothing. The tap is
         this beat; the page it opens is the next one. */
      cursor: "mail-cta",
      press: true,
      callout: "The link is the key. There is no account to make first.",
    }),
    paced({
      id: "read",
      chapter: "sign",
      caption: "The link opens the stored document.",
      emphasize: "doc-body",
      set: { phone: "doc" },
      /* The renewal is carried on this beat rather than its own: the header
         line "For Danielle Reyes · renews yearly" sits directly above the ring,
         so the viewer reads both without buying a second beat for it. */
      callout: "For Danielle Reyes by name, and it renews next year.",
    }),
    paced({
      id: "form",
      chapter: "sign",
      caption: "Under the document, three things and a button.",
      set: { phone: "form" },
      emphasize: "form-top",
      callout: "His name, who he is to the player, and a signature.",
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
      set: { relation: "parent" },
      callout: "A player over eighteen signs for themselves, so the form asks who is signing.",
    }),
    paced({
      id: "pad",
      chapter: "sign",
      caption: "The signature is drawn with a finger.",
      cursor: "sign-pad",
      press: true,
      set: { drawn: true },
      hold: 3400,
    }),
    paced({
      id: "ack",
      chapter: "sign",
      caption: "The acknowledgment names his daughter.",
      cursor: "ack-check",
      press: true,
      set: { acked: true },
      callout: "It names the child, and it names the authority to sign for her.",
    }),
    paced({
      id: "submit",
      chapter: "sign",
      caption: "Sign and submit.",
      cursor: "submit",
      press: true,
      hold: 2400,
    }),
    paced({
      id: "recorded",
      chapter: "sign",
      caption: "Recorded.",
      set: { phone: "done" },
      emphasize: "done-card",
      callout: "The signature, the name, the exact text and the timestamp, kept as one record.",
    }),

    /* ── 3. The board answers ─────────────────────────────────────────── */
    paced({
      id: "cell",
      chapter: "board",
      caption: "Her cell on the league's board turns green while you watch, with his name in it.",
      stage: "desktop",
      context: CTX_BOARD,
      set: { signed: true },
      emphasize: "row-danielle",
      callout: "The board is reading the same signature record from the other end.",
    }),
    paced({
      id: "badge",
      chapter: "board",
      caption: "The team badge moves with it.",
      emphasize: "badge-lords",
      holdMs: 0,
      callout: "Seven of ten, and the three still open keep their names on the row.",
    }),
    paced({
      id: "totals",
      chapter: "board",
      caption: `${SIGNED_AFTER} signed, ${OUT_AFTER} outstanding, across every approved team.`,
      emphasize: "totals",
      holdMs: 0,
      callout: "One count for the whole season, recomputed on every read.",
    }),
    paced({
      id: "missing",
      chapter: "board",
      caption: "Only missing filters the board to the teams with a gap.",
      cursor: "only-missing",
      press: true,
      set: { onlyMissing: true },
      callout: "That filtered list is the chase list, and it is the whole of it.",
    }),
    paced({
      id: "resend",
      chapter: "board",
      caption: "One button covers roster additions and lost emails.",
      cursor: "resend-all",
      press: true,
      set: { notice: RESEND_NOTICE, onlyMissing: false },
      callout: "The first send already happened, the day each team was approved.",
    }),
    paced({
      id: "skipped",
      chapter: "board",
      caption: `${RESEND_SENT} emails, and the ${LIVE_LINKS_AFTER} families with a live link were left alone.`,
      emphasize: "notice",
      holdMs: 0,
      callout: "A family whose link is still live is skipped, so no inbox gets it twice.",
    }),
    paced({
      id: "cadence",
      chapter: "board",
      caption: "The reminders run on a clock.",
      context: undefined,
      set: { ledger: true, shown: 0 },
      emphasize: "ledger",
      callout: "Two windows, once each, and a ledger row that guarantees the once.",
    }),
    paced({ id: "cad-1", chapter: "board", caption: "Seven days before the season starts.", set: { shown: 1 }, hold: 2700 }),
    paced({ id: "cad-2", chapter: "board", caption: "Then twenty four hours before.", set: { shown: 2 }, hold: 2400 }),
    paced({ id: "cad-3", chapter: "board", caption: "Once each, guaranteed, by a ledger row.", set: { shown: 3 }, hold: 2400 }),
    paced({ id: "cad-4", chapter: "board", caption: "And no list is built by a human being.", set: { shown: 4 }, hold: 2700 }),
    paced({
      id: "end",
      chapter: "board",
      caption:
        "One document, sent by the roster rather than by a person, signed in a minute, and a board that keeps its own score.",
      hold: 4800,
      set: { endCard: true },
    }),
  ],

  /* ── Render ────────────────────────────────────────────────────────── */

  render: ({ get, typingKey }) => {
    const screen = get<string>("screen", "library")
    const ledger = get("ledger", false)
    const phone = get<string>("phone", "email")

    const desktop = (
      <div className="relative flex h-full flex-col">
        <div
          key={ledger ? "ledger" : screen}
          className="demo-fade-in flex min-h-0 flex-1 flex-col"
        >
          {ledger ? (
            <CadenceLedger shown={get("shown", 0)} />
          ) : screen === "library" ? (
            <WaiverLibrary />
          ) : (
            <SigningBoard
              expanded={get("expanded", false)}
              signed={get("signed", false)}
              onlyMissing={get("onlyMissing", false)}
              notice={get<string>("notice", "")}
            />
          )}
        </div>

        {get("endCard", false) && <EndCard />}
      </div>
    )

    const phoneNode = (
      <div key={phone} className="demo-fade-in h-full">
        {phone === "email" ? (
          <PhoneMail />
        ) : phone === "done" ? (
          <PhoneDone />
        ) : (
          <PhoneSign
            view={phone === "form" ? "form" : "doc"}
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
          />
        )}
      </div>
    )

    return { desktop, phone: phoneNode }
  },
}

/* ── Desktop: the league's waiver library ────────────────────────────────── */

/**
 * `manage/leagues/[id]/waivers`, drawn from `waivers-manager.tsx`: the heading
 * pair, the "Add waiver" button, one document row carrying the type label, the
 * version, Required, Renews yearly and its signature count, the two row
 * actions, and the versions footnote in full.
 */
function WaiverLibrary() {
  return (
    <div className="bg-ink-50/70 flex min-h-0 flex-1 flex-col px-6 py-4">
      <div className="mb-3 flex items-center gap-3">
        <span>
          <h2 className="font-display text-ink-900 text-[20px] font-extrabold">
            Waivers &amp; agreements
          </h2>
          <p className="text-ink-500 mt-0.5 text-[15px] font-medium">
            Documents parents sign before their child participates
          </p>
        </span>
        <span className="ml-auto">
          <Btn tone="primary">Add waiver</Btn>
        </span>
      </div>

      <div
        data-demo-target="doc-row"
        className="border-ink-200 rounded-2xl border bg-white px-5 py-3.5 shadow-[0_2px_10px_-8px_rgba(15,23,42,0.4)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-ink-900 text-[17px] font-bold">{DOC}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Chip tone="neutral">Concussion code</Chip>
              <Chip tone="neutral">v1</Chip>
              <Chip tone="play" strong>
                Required
              </Chip>
              <span data-demo-target="badge-renews">
                <Chip tone="gold" strong>
                  Renews yearly
                </Chip>
              </span>
              <span className="text-ink-500 text-[14px] font-semibold">
                {SIGNED_BEFORE} signatures
              </span>
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-2">
            <Btn tone="quiet" size="sm">
              Edit
            </Btn>
            <Btn tone="quiet" size="sm">
              Deactivate
            </Btn>
          </span>
        </div>
      </div>

      {/* The opening of the stored text, so the operator screen shows what the
          league is actually holding. The library page reveals the body through
          Edit; this is the same string, `WaiverDocument.body`. */}
      <div className="border-ink-200 mt-3 min-h-0 flex-1 overflow-hidden rounded-2xl border bg-white px-5 py-3">
        <p className="text-ink-500 text-[14px] font-bold uppercase tracking-[0.08em]">
          The text every family signs
        </p>
        <pre className="text-ink-700 mt-2 whitespace-pre-wrap font-sans text-[15px] leading-[1.6]">
          {DOC_BODY}
        </pre>
      </div>

      <p
        data-demo-target="library-foot"
        className="text-ink-500 mt-3 shrink-0 text-[14px] font-medium leading-snug"
      >
        {LIBRARY_FOOT}
      </p>
    </div>
  )
}

/* ── Desktop: the compliance board ───────────────────────────────────────── */

/**
 * `manage/leagues/[id]/seasons/[seasonId]/waivers`, drawn from
 * `waiver-status-view.tsx`. All 22 approved teams as a two column grid, and a
 * three row window around the open team when a roster is expanded. The count
 * chip carries the product's own "N of M" shape either way.
 */
function SigningBoard({
  expanded,
  signed,
  onlyMissing,
  notice,
}: {
  expanded: boolean
  signed: boolean
  onlyMissing: boolean
  notice: string
}) {
  const total = signed ? SIGNED_AFTER : SIGNED_BEFORE
  const outstanding = signed ? OUT_AFTER : OUT_BEFORE
  const openIndex = BOARD_TEAMS.findIndex((t) => t.id === "team-lords")
  const rows = expanded
    ? BOARD_TEAMS.slice(openIndex - 1, openIndex - 1 + OPEN_WINDOW)
    : onlyMissing
      ? BOARD_TEAMS.filter((t) => t.signed < 10)
      : BOARD_TEAMS

  return (
    <div className="bg-ink-50/70 flex min-h-0 flex-1 flex-col px-6 py-3">
      <p
        data-demo-target="board-lead"
        className="text-ink-600 mb-1.5 shrink-0 text-[15px] font-medium leading-tight"
      >
        {BOARD_LEAD}
      </p>

      <div data-demo-target="totals" className="mb-2 flex shrink-0 items-center gap-2">
        <Chip tone="court" strong>
          <span className="tabular-nums">{total}</span> signed
        </Chip>
        <Chip tone="gold" strong>
          <span className="tabular-nums">{outstanding}</span> outstanding
        </Chip>
        <span
          data-demo-target="only-missing"
          className={cn(
            "rounded-full border px-3 py-0.5 text-[14px] font-semibold transition-colors duration-200 motion-reduce:transition-none",
            onlyMissing
              ? "border-gold-400 bg-gold-100 text-gold-600"
              : "border-ink-200 text-ink-600 bg-white"
          )}
        >
          Only missing
        </span>
        {notice && (
          <span
            data-demo-target="notice"
            className="bg-play-50 text-play-800 live-pop rounded-xl px-3 py-1 text-[14px] font-semibold"
          >
            {notice}
          </span>
        )}
        {/* The slice, stated on screen rather than hidden: three consecutive
            rows of the twenty two the endpoint returns. Same honesty device the
            schedule-change demo uses for its "3 of 11" games chip. */}
        <Chip tone="neutral" strong>
          {rows.length} of {TEAMS_TOTAL} teams
        </Chip>
        <span className="ml-auto">
          <Btn id="resend-all" tone="quiet" size="sm">
            Re-send all outstanding
          </Btn>
        </span>
      </div>

      {/* No panel chrome: the real page (`waiver-status-view.tsx`) is a plain
          vertical stack of team cards under the badges row, with no section
          header over it. */}
      <div
        className={cn(
          "min-h-0 flex-1",
          expanded ? "space-y-1.5" : "grid grid-cols-2 content-start gap-x-3 gap-y-0.5"
        )}
      >
        {rows.map((t) => {
          const isTarget = t.id === "team-lords"
          const teamSigned = isTarget && signed ? t.signed + 1 : t.signed
          return (
            <BoardTeam
              key={t.team}
              id={t.id}
              team={t.team}
              signed={teamSigned}
              badgeId={isTarget ? "badge-lords" : undefined}
              open={isTarget && expanded}
              signedNow={isTarget && signed}
            />
          )
        })}
      </div>
    </div>
  )
}

/**
 * One collapsed team row and its expansion. The real row is a disclosure
 * button carrying the caret, the team name and the signed badge, with its own
 * "Re-send" on the right; the expansion is a table whose first column is the
 * player and whose remaining columns are one per required waiver.
 */
function BoardTeam({
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
    <div
      className={cn(
        "rounded-xl border bg-white transition-colors duration-300 motion-reduce:transition-none",
        open ? "border-ink-300" : "border-ink-100"
      )}
    >
      <div
        data-demo-target={id}
        className="flex w-full items-center gap-2.5 px-3.5 py-1"
      >
        <span className="text-ink-400 shrink-0 text-[14px]">{open ? "▾" : "▸"}</span>
        <span className="text-ink-900 text-[15px] font-bold">{team}</span>
        <span data-demo-target={badgeId} className="shrink-0">
          {/* PUNCH 3, honoured: no team in this world is complete, so the
              product's "All signed" badge never appears here either. */}
          <StatusChip tone="gold">{signed}/10 signed</StatusChip>
        </span>
        <span className="ml-auto shrink-0">
          <Btn tone="quiet" size="sm">
            Re-send
          </Btn>
        </span>
      </div>

      {/* All TEN players, not a slice: the beat's claim is that the ones who
          have not signed are NAMED rather than counted, so hiding four of them
          would be the demo undercutting its own point. The rows are therefore
          tight, and the parent email sits beside the name rather than under it
          (the product stacks them), which is the one composition liberty this
          screen takes. */}
      {open && (
        <div className="border-ink-100 border-t px-3.5 pb-1.5 pt-1">
          <div className="text-ink-500 flex items-center gap-3 pb-0.5 text-[14px] font-bold uppercase leading-tight tracking-[0.06em]">
            <span className="min-w-0 flex-1">Player</span>
            <span className="w-[300px] shrink-0">{DOC}</span>
          </div>
          <div>
            {ROSTER.map((r) => {
              const isTarget = r.id === "row-danielle"
              const cellSigner = isTarget && signedNow ? PARENT : r.signer
              return (
                <div
                  key={r.player}
                  data-demo-target={r.id}
                  className="border-ink-50 flex items-center gap-3 border-t py-px leading-tight"
                >
                  <span className="flex min-w-0 flex-1 items-baseline gap-2">
                    <span className="text-ink-900 shrink-0 text-[15px] font-semibold leading-tight">
                      {r.player}
                    </span>
                    <span className="text-ink-400 truncate text-[14px] font-medium leading-tight">
                      {r.email}
                    </span>
                  </span>
                  <span className="w-[300px] shrink-0">
                    {cellSigner ? (
                      <span
                        className={cn(
                          "text-court-700 text-[15px] font-semibold leading-tight",
                          isTarget && signedNow && "demo-pulse-green"
                        )}
                      >
                        ✓ {cellSigner}
                      </span>
                    ) : (
                      <span className="text-[15px] font-semibold leading-tight text-amber-600">
                        Pending
                      </span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Desktop: the reminder cadence ───────────────────────────────────────── */

/**
 * NARRATION, NOT A SCREEN.
 *
 * `sendWaiverReminders` runs from `GET /api/cron/waiver-reminders` and nothing
 * in the product ever shows a league what it sent or is about to send. So this
 * card is drawn in navy with no console chrome anywhere near it, which is the
 * honest way to put a server-side truth on camera. It is punch item 1 in the
 * numbers sheet, and the fix is a real reminder log on the season.
 */
function CadenceLedger({ shown }: { shown: number }) {
  return (
    <div
      data-demo-target="ledger"
      className="flex min-h-0 flex-1 flex-col justify-center bg-[#0b1628] px-10 py-7 text-white"
    >
      <p className="text-gold-400 text-[15px] font-bold uppercase tracking-[0.16em]">
        What happens next, without anybody chasing
      </p>
      <p className="font-display mt-1.5 text-[38px] font-extrabold leading-none tabular-nums">
        {OUT_AFTER} still outstanding
      </p>
      <p className="mt-1.5 text-[16px] font-semibold text-white/70">
        {DOC} · every approved roster in {SEASON}
      </p>

      <div className="mt-5 space-y-2">
        {CADENCE.map((r, i) => (
          <div
            key={r.label}
            className={cn(
              "flex items-baseline gap-4 rounded-2xl border px-4 py-2.5 transition-opacity duration-500 motion-reduce:transition-none",
              i < shown ? "border-white/15 bg-white/[0.07] opacity-100" : "border-white/5 opacity-20"
            )}
          >
            <span className="text-gold-400 w-[104px] shrink-0 text-[19px] font-extrabold leading-tight">
              {r.n}
            </span>
            <span className="min-w-0">
              <span className="block text-[17px] font-bold">{r.label}</span>
              <span className="mt-0.5 block text-[15px] font-medium leading-snug text-white/60">
                {r.note}
              </span>
            </span>
          </div>
        ))}
      </div>

    </div>
  )
}

/* ── Phone: the email ────────────────────────────────────────────────────── */

/**
 * Her inbox, not our product. The subject, the greeting, the sentence, the
 * button label and the expiry line are all verbatim from `sendWaiverSignEmail`
 * in `lib/email.ts`.
 */
function PhoneMail() {
  return (
    <div className="flex h-full flex-col bg-[#f2f3f6]">
      <div className="border-ink-200 shrink-0 border-b bg-white px-4 pb-2 pt-2.5">
        <p className="text-ink-900 text-[17px] font-bold">Inbox</p>
        <p className="text-ink-500 text-[14px] font-medium">{PARENT_EMAIL}</p>
      </div>
      <div className="min-h-0 flex-1 px-3 py-3">
        <div
          data-demo-target="mail-card"
          className="border-ink-200 rounded-2xl border bg-white px-4 py-3.5 shadow-[0_10px_30px_-22px_rgba(15,23,42,0.6)]"
        >
          <p className="text-play-700 text-[14px] font-bold uppercase tracking-[0.14em]">
            {LEAGUE}
          </p>
          <p className="text-ink-950 mt-1.5 text-[17px] font-bold leading-snug">{DOC}</p>
          <p className="text-ink-500 mt-1 text-[14px] font-medium">{EMAIL.context}</p>
          <p className="text-ink-700 mt-3 text-[15px] font-medium leading-relaxed">
            {EMAIL.greeting} {EMAIL.body}
          </p>
          <span
            data-demo-target="mail-cta"
            className="bg-play-600 mt-4 block rounded-xl px-4 py-2.5 text-center text-[15px] font-bold text-white transition-all duration-200 motion-reduce:transition-none data-[demo-hover=true]:brightness-110 data-[demo-press=true]:scale-[0.98]"
          >
            {EMAIL.cta}
          </span>
          <p className="text-ink-400 mt-3.5 text-[14px] font-medium leading-snug">{EMAIL.foot}</p>
        </div>
      </div>
    </div>
  )
}

/* ── Phone: the signing page ─────────────────────────────────────────────── */

/**
 * `(public)/waivers/sign/[token]`, at life size.
 *
 * The real page is ONE scrolling page: the header block, the document in a
 * `max-h-[45vh]` scroll box, then the form. A 390 by 576 handset cannot hold
 * all of that at 14px and up, so the demo shows the page in the two positions
 * a thumb actually puts it in, and swaps between them with a fade rather than
 * a camera move. Every label, placeholder, chip and sentence is verbatim.
 */
function PhoneSign({
  view,
  name,
  relation,
  drawn,
  acked,
}: {
  view: "doc" | "form"
  name: ReactNode
  relation: string
  drawn: boolean
  acked: boolean
}) {
  return (
    <div className="flex h-full flex-col bg-white">
      {/* The real page is one long scroll with no sticky header, so a thumb
          that has reached the form has scrolled the title block away. The form
          view therefore keeps one compact line of context rather than pretending
          the header is pinned. */}
      {view === "doc" ? (
        <div className="border-ink-100 shrink-0 border-b px-4 pb-2.5 pt-1.5">
          <p className="text-play-600 text-[14px] font-bold uppercase tracking-[0.14em]">{LEAGUE}</p>
          <h2 className="text-ink-950 mt-1 text-[19px] font-bold leading-tight">{DOC}</h2>
          <p data-demo-target="phone-sub" className="text-ink-500 mt-1 text-[15px] font-medium">
            For <span className="text-ink-700 font-bold">{PLAYER}</span> · renews yearly
          </p>
        </div>
      ) : (
        <div className="border-ink-100 shrink-0 border-b px-4 pb-1.5 pt-1">
          <p className="text-ink-500 text-[14px] font-semibold leading-tight">
            Concussion Code of Conduct · for{" "}
            <span className="text-ink-700 font-bold">{PLAYER}</span> · renews yearly
          </p>
        </div>
      )}

      {view === "doc" ? (
        <div className="bg-ink-50 min-h-0 flex-1 px-4 py-3">
          <pre
            data-demo-target="doc-body"
            className="text-ink-700 h-full overflow-hidden whitespace-pre-wrap font-sans text-[14px] leading-[1.55]"
          >
            {DOC_BODY}
          </pre>
        </div>
      ) : (
        <div className="min-h-0 flex-1 px-4 py-2.5">
          <div data-demo-target="form-top">
            <p className="text-ink-700 text-[15px] font-bold">Your full name</p>
            <span
              data-demo-target="name-field"
              className="border-ink-200 mt-1.5 flex min-h-[40px] w-full items-center rounded-xl border bg-white px-3.5 text-[15px] transition-all duration-200 motion-reduce:transition-none data-[demo-hover=true]:border-play-400 data-[demo-hover=true]:ring-play-100 data-[demo-hover=true]:ring-2"
            >
              {name}
            </span>
          </div>

          <div className="mt-3">
            <p className="text-ink-700 text-[15px] font-bold">Relationship to player</p>
            <div className="mt-1.5 flex gap-2">
              <RelChip id="rel-parent" label="Parent or guardian" on={relation === "parent"} />
              <RelChip label="Player (18 or older)" on={relation === "player"} />
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between">
              <p className="text-ink-700 text-[15px] font-bold">Signature</p>
              <p className="text-ink-400 text-[14px] font-medium">Draw with your finger or mouse</p>
            </div>
            <span
              data-demo-target="sign-pad"
              className={cn(
                "border-ink-200 mt-1.5 block h-[80px] w-full overflow-hidden rounded-xl border bg-white transition-all duration-200 motion-reduce:transition-none",
                "data-[demo-hover=true]:border-play-400 data-[demo-press=true]:brightness-95"
              )}
            >
              {drawn ? (
                <svg viewBox="0 0 320 90" className="h-full w-full" aria-hidden="true">
                  <path
                    d="M22 66 C40 26, 58 24, 66 48 C72 66, 84 66, 92 44 C100 22, 116 26, 120 52 C124 74, 140 70, 152 44 C160 26, 176 30, 178 54 C180 72, 196 70, 208 50 C218 34, 236 36, 244 56 C250 70, 262 68, 276 48"
                    fill="none"
                    stroke="#0b1628"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="demo-sign-in"
                  />
                </svg>
              ) : (
                <span className="text-ink-400 flex h-full items-center justify-center text-[14px] font-semibold">
                  Sign here
                </span>
              )}
            </span>
          </div>

          <span
            data-demo-target="ack-check"
            className={cn(
              "mt-2 flex items-start gap-2.5 rounded-xl border px-3 py-2 transition-all duration-200 motion-reduce:transition-none",
              acked ? "border-play-300 bg-play-50/60" : "border-ink-200 bg-white",
              /* Same rule as the relationship chips: no press scale over 14px copy. */
              "data-[demo-hover=true]:border-play-400 data-[demo-press=true]:brightness-95"
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border-2",
                acked ? "border-play-600 bg-play-600" : "border-ink-300 bg-white"
              )}
            >
              {acked && (
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" className="h-2.5 w-2.5">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            <span className="text-ink-700 text-[14px] font-medium leading-snug">{ACK}</span>
          </span>

          <span
            data-demo-target="submit"
            className={cn(
              "bg-play-600 mt-2.5 block rounded-xl px-4 py-2.5 text-center text-[15px] font-bold text-white transition-all duration-200 motion-reduce:transition-none",
              !(acked && drawn) && "opacity-40",
              "data-[demo-hover=true]:brightness-110 data-[demo-press=true]:scale-[0.98]"
            )}
          >
            Sign and submit
          </span>
          <p className="text-ink-400 mt-1.5 text-center text-[14px] font-medium leading-snug">
            {STORED}
          </p>
        </div>
      )}
    </div>
  )
}

function RelChip({ id, label, on }: { id?: string; label: string; on: boolean }) {
  return (
    <span
      data-demo-target={id}
      className={cn(
        /* No press SCALE anywhere a 14px string lives: the readability gate
           measures effective size through every transform, and a 0.97 press on
           a 14px chip reaches the viewer at 13.6px. The press reads as a
           brightness and border change instead. */
        "flex min-w-0 flex-1 items-center justify-center rounded-xl border px-2 py-1.5 text-center text-[14px] font-bold transition-all duration-200 motion-reduce:transition-none",
        on ? "border-play-600 bg-play-600 text-white" : "border-ink-200 text-ink-600 bg-white",
        "data-[demo-hover=true]:border-play-400 data-[demo-press=true]:brightness-95"
      )}
    >
      {label}
    </span>
  )
}

/**
 * The success state, verbatim from `sign-form.tsx` lines 60 to 84. PUNCH 2,
 * honoured: the product never tells the signer when this lapses, so neither
 * does this card.
 */
function PhoneDone() {
  return (
    <div
      data-demo-target="done-card"
      className="flex h-full flex-col items-center justify-center bg-white px-6 text-center"
    >
      <span className="bg-court-50 text-court-600 live-pop grid h-14 w-14 place-items-center rounded-2xl">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-7 w-7">
          <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <h3 className="text-ink-950 mt-3 text-[19px] font-bold">Signed and recorded</h3>
      <p className="text-ink-600 mt-2 text-[15px] font-medium leading-relaxed">
        Thank you. {LEAGUE} now has your signed copy on file for {PLAYER}. You can close this page.
      </p>
      <p className="text-ink-400 mt-4 text-[14px] font-medium leading-snug">{STORED}</p>
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
          One required document that renews every year, emailed by the roster rather than by a
          person, signed on a phone in about a minute, and a board that counts {SIGNED_AFTER} of{" "}
          {CELLS} without anybody building a list.
        </p>
        <p className="mt-5 text-[15px] font-semibold text-white/50">
          Next: game day, both sides at once
        </p>
      </div>
    </div>
  )
}
