"use client"

import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import { Crest } from "@/components/ui/crest"
import { CourtBackdropLayer } from "@/components/ui/court-backdrop"
import { TypeText } from "../motion"
import {
  MockBand,
  MockButton,
  MockCounter,
  MockEndCard,
  MockPill,
  MockTopBar,
  PhonePushBanner,
} from "../mock-ui"
import type { DemoScript } from "../types"

/**
 * Chapter 10: "Waivers, start to finish" (owner-signed script, 2026-08-15).
 *
 * THE ARGUMENT. Waivers are the one piece of paperwork that decides whether a
 * child is allowed on the floor, and almost every league runs them on a PDF, a
 * printer and a coach with a clipboard at the door. The cost is not the signing.
 * It is the chasing: somebody has to know who has not signed, find them, ask
 * again, and be sure before the first whistle.
 *
 * THE PAINFUL DETAIL (owner's law, named for this chapter): NOBODY CHASES
 * ANYBODY. The grid names who is outstanding without anybody building a list,
 * and the reminders go out on their own at seven days and twenty four hours
 * before the season starts. The other one is the renewal: a concussion code
 * under Rowan's Law has to be signed again every year, so last season's
 * signature is not an answer, and the demo says so on camera.
 *
 * TRUTH TO THE PRODUCT. Every surface mirrors one that ships today:
 *   · the documents page — manage/leagues/[id]/waivers with
 *     components/waivers/waivers-manager.tsx: "Waivers & agreements",
 *     "Documents parents sign before their child participates", the template
 *     chips, the preview of the real text, the version, Required and Renews
 *     yearly badges, and the line that templates are a starting point and not
 *     legal advice;
 *   · the document text itself — lib/waivers/templates.ts. The concussion code
 *     really does open on Rowan's Law and really is flagged annualRenewal;
 *   · the send — there is no recipient picker in this product and the demo does
 *     not invent one. Waivers are emailed automatically to every parent on a
 *     roster the moment that team is approved (lib/waivers/auto-send.ts), and
 *     the only button an operator presses is "Re-send all outstanding" on the
 *     season's Signing status page, which answers with "Sent N emails.";
 *   · the signing page — app/(public)/waivers/sign/[token]: the org eyebrow,
 *     the document title, "For {player}", the scrolling document, "Your full
 *     name", the "Parent or guardian" and "Player (18 or older)" chips, the
 *     signature pad with "Draw with your finger or mouse" and "Clear
 *     signature", the acknowledgment sentence written out in full, "Sign and
 *     submit", and the line about exactly what is stored;
 *   · the grid — components/waivers/waiver-status-view.tsx: "Signing status",
 *     the signed and outstanding badges, "Only missing", the team rows with
 *     "{n}/{n} signed" and "All signed", and the per-player cells that read
 *     "✓ {signer}" in court green or "Pending" in amber;
 *   · the reminders — lib/waivers/reminders.ts: the 7 day and 24 hour windows,
 *     "Waiver still unsigned" and "Sign before the first game".
 *
 * TWO NOTES. The real signature pad is the referee scoresheet component reused,
 * so its empty canvas still says "Referee signs here"; this demo draws what a
 * parent should be told instead. And the real grid can print "No parent email
 * on file" in red under a player, which is the one row a reminder cannot reach.
 * This roster does not have one, so the chapter can end where the owner's
 * script ends, fully green.
 *
 * MOTION. Nothing pans, zooms or scrolls. The signature draws itself the way a
 * finger leaves it, the cell that changed flashes green in place, and the two
 * counters travel to their new numbers rather than cutting to them.
 */

/* ── Cast ────────────────────────────────────────────────────────────────── */

const LEAGUE = "Metro West Basketball"
const SEASON = "Fall 2026"
const DOC = "Concussion Code of Conduct (Rowan's Law)"
const DOC_SHORT = "Concussion Code of Conduct"
const RISK_DOC = "Acknowledgment of Risk and Indemnity Agreement"
const PLAYER = "Amara Bello"
const PARENT = "Ngozi Bello"

const TOTAL = 110

const URL_DOCS = "/manage/leagues/metro-west/waivers"
const URL_STATUS = "/manage/leagues/metro-west/seasons/fall-2026/waivers"

/** The opening of the real Rowan's Law template, as the signer reads it. */
const DOC_BODY = `CONCUSSION CODE OF CONDUCT

Organization: ${LEAGUE}

Under Rowan's Law (Concussion Safety), 2018, all athletes under 26, and the parents or guardians of athletes under 18, must review Ontario's Concussion Awareness Resources and confirm this Code of Conduct every year.

1. I will help prevent concussions by wearing the right equipment, playing within the rules, and respecting my opponents.

2. I will speak up if I think I have a concussion, and I will tell a coach, trainer or parent right away.`

/** What fits on a phone. The rest is behind the scroll, as it is in the app. */
const DOC_BODY_PHONE = `CONCUSSION CODE OF CONDUCT

Organization: ${LEAGUE}

Under Rowan's Law (Concussion Safety), 2018, all athletes under 26, and the parents or guardians of athletes under 18, must review Ontario's Concussion Awareness Resources and confirm this Code of Conduct every year.`

/** The teams on the season board, and where each one stands. */
const TEAMS = [
  { club: "Riverside Ravens", team: "U11 Girls Rep", cells: 22 },
  { club: "Lakeshore Lightning", team: "U11 Girls Rep", cells: 22 },
  { club: "Northside Nets", team: "U13 Girls Rep", cells: 22 },
  { club: "Harbourfront Heat", team: "U13 Boys Rep", cells: 22 },
  { club: "Credit Valley Kings", team: "U16 Girls Rep", cells: 22 },
]

/** The expanded roster. Wendy Chan is the same family as story two. */
const ROSTER = [
  { player: PLAYER, parent: PARENT, email: "ngozi.bello@gmail.com" },
  { player: "Ada Njoku", parent: "Ruth Njoku", email: "r.njoku@outlook.com" },
  { player: "Mila Petrov", parent: "Irina Petrov", email: "irina.petrov@gmail.com" },
  { player: "Grace Chan", parent: "Wendy Chan", email: "wendy.chan@rogers.com" },
]

export const waiversStory: DemoScript = {
  desktopUrl: URL_DOCS,
  initialStage: "desktop",
  chapters: [
    { id: "send", title: "Send once" },
    { id: "sign", title: "Sign on the phone" },
    { id: "green", title: "Green across the board" },
  ],

  beats: [
    /* ── 1. Send once ─────────────────────────────────────────────────── */
    {
      id: "docs",
      chapter: "send",
      caption:
        "A league's waivers are documents, not attachments. Versioned, required or not, and the same text for everybody who signs it.",
      hold: 3000,
      set: { screen: "docs" },
    },
    {
      id: "add-press",
      chapter: "send",
      caption: "This season needs one more.",
      hold: 2000,
      cursor: "add-waiver",
      press: true,
    },
    {
      id: "templates",
      chapter: "send",
      caption:
        "The templates are written for Ontario, which is where this league plays. Nobody starts from a blank page at eleven at night.",
      hold: 3000,
      set: { panel: true },
    },
    {
      id: "pick-template",
      chapter: "send",
      caption: "Rowan's Law: the concussion code every athlete under 26 has to confirm.",
      hold: 2800,
      cursor: "tmpl-concussion",
      press: true,
      set: { template: "concussion" },
    },
    {
      id: "preview",
      chapter: "send",
      caption:
        "Here is the part that saves a league a season. It renews yearly, so last year's signature is not an answer, and the product knows that without anybody remembering it.",
      hold: 3400,
      cursor: "doc-preview",
      hover: "doc-preview",
    },
    {
      id: "add-doc",
      chapter: "send",
      caption: "Added, required, version one.",
      hold: 2200,
      cursor: "add-doc",
      press: true,
    },
    {
      id: "added",
      chapter: "send",
      caption:
        "And this is the whole send. There is no list to pick, because the roster is the list: every approved team's parents get it the moment that team is approved.",
      hold: 3400,
      set: { panel: false, added: true },
      toast: "Concussion Code of Conduct added",
    },
    {
      id: "status-open",
      chapter: "send",
      caption:
        "The season's own page counts it in signatures, not in emails sent. A hundred and thirty two are needed and none of them exist yet.",
      hold: 3200,
      url: URL_STATUS,
      set: { screen: "status", signed: 0 },
    },
    {
      id: "expand",
      chapter: "send",
      caption: "Every team opens to the family behind the number.",
      hold: 2600,
      cursor: "team-ravens",
      press: true,
      set: { expanded: true },
    },
    {
      id: "resend",
      chapter: "send",
      caption:
        "Re-send is the only button, and it exists for the roster addition and the lost email rather than for the first send.",
      hold: 2600,
      cursor: "resend-all",
      press: true,
      set: { notice: "Sent 110 emails." },
    },

    /* ── 2. Sign on the phone ─────────────────────────────────────────── */
    {
      id: "push",
      chapter: "sign",
      caption: "It lands as the thing a parent can actually act on.",
      hold: 3000,
      stage: "split",
      set: { push: true, phone: "home" },
    },
    {
      id: "tap-push",
      chapter: "sign",
      caption: "One tap, no app to install and no account to make.",
      hold: 2200,
      cursor: "phone-push",
      press: true,
    },
    {
      id: "doc-on-phone",
      chapter: "sign",
      caption:
        "The document is the document. Same text, on the phone, with the child's name on it and the yearly renewal stated.",
      hold: 3200,
      set: { push: false, phone: "sign" },
    },
    {
      id: "type-name",
      chapter: "sign",
      caption: "Her name, typed by her.",
      hold: 2800,
      cursor: "name-field",
      type: { key: "name", text: PARENT },
    },
    {
      id: "relation",
      chapter: "sign",
      caption:
        "Then who she is signing as, because a player over eighteen signs for themselves and a nine year old cannot.",
      hold: 2600,
      cursor: "rel-parent",
      press: true,
      set: { relation: "parent" },
    },
    {
      id: "sign-pad",
      chapter: "sign",
      caption: "The signature is drawn with a finger.",
      hold: 3000,
      cursor: "sign-pad",
      press: true,
      set: { drawn: true },
    },
    {
      id: "ack",
      chapter: "sign",
      caption:
        "The acknowledgment is a full sentence naming the child, not a tick box that says I agree to nothing in particular.",
      hold: 3000,
      cursor: "ack-check",
      press: true,
      set: { acked: true },
    },
    {
      id: "submit",
      chapter: "sign",
      caption: "Sign and submit.",
      hold: 2200,
      cursor: "submit",
      press: true,
    },
    {
      id: "recorded",
      chapter: "sign",
      caption:
        "Recorded, with the exact text she signed kept beside her name and the time. Editing the document later never changes what anybody already agreed to.",
      hold: 3400,
      set: { phone: "done" },
    },

    /* ── 3. Green across the board ────────────────────────────────────── */
    {
      id: "flip",
      chapter: "green",
      caption: "On the league's grid her cell turns green while you watch, with her name in it.",
      hold: 3000,
      set: { belloSigned: true, signed: 48, notice: "" },
    },
    {
      id: "climb",
      chapter: "green",
      caption: "The rest of the evening looks like this. Nobody is at a printer.",
      hold: 2800,
      set: { signed: 88 },
    },
    {
      id: "stragglers",
      chapter: "green",
      caption:
        "A hundred and eight of a hundred and ten, and the two are named. Only missing is one press away from the list a coach would otherwise build by hand.",
      hold: 3400,
      cursor: "only-missing",
      hover: "only-missing",
      set: { signed: 108, stragglers: true },
    },
    {
      id: "reminders",
      chapter: "green",
      caption:
        "And nobody chases anybody. The reminders go out on their own, seven days before the season and again twenty four hours before, and they stop the moment somebody signs.",
      hold: 3600,
      set: { reminded: true },
    },
    {
      id: "all-green",
      chapter: "green",
      caption:
        "A hundred and ten of a hundred and ten, five teams cleared, before the first whistle instead of at the door.",
      hold: 3600,
      set: { signed: TOTAL, stragglers: false, reminded: false },
      toast: "Every player is cleared to play",
    },
    {
      id: "end-card",
      chapter: "green",
      caption: "Signed, recorded, and nobody stood at a gym door with a clipboard.",
      hold: 3800,
      set: { endCard: true },
    },
  ],

  render: ({ get, typingKey }) => {
    const screen = get<string>("screen", "docs")
    const phone = get<string>("phone", "")
    const signed = get("signed", 0)
    const endCard = get("endCard", false)

    const desktop = (
      <div className="relative flex h-full flex-col">
        <MockTopBar
          workspace={LEAGUE}
          tabs={["Dashboard", "Seasons", "Clubs", "Waivers"]}
          activeTab="Waivers"
        />

        <div key={screen} className="demo-fade-in flex min-h-0 flex-1 flex-col">
          {screen === "docs" && (
            <DocsScreen
              panel={get("panel", false)}
              template={get<string>("template", "")}
              added={get("added", false)}
            />
          )}
          {screen === "status" && (
            <StatusScreen
              signed={signed}
              expanded={get("expanded", false)}
              belloSigned={get("belloSigned", false)}
              stragglers={get("stragglers", false)}
              reminded={get("reminded", false)}
              notice={get<string>("notice", "")}
            />
          )}
        </div>

        {endCard && (
          <MockEndCard
            eyebrow="Chapter 10 of 10"
            title="Waivers, start to finish"
            line="One document, sent by the roster rather than by a person, signed with a finger, and a grid that goes green on its own."
            cta="Back to the demo directory"
          />
        )}
      </div>
    )

    const phoneNode = (
      <div className="relative h-full">
        {phone === "sign" || phone === "done" ? (
          <SignScreen
            done={phone === "done"}
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
        ) : (
          <InboxScreen />
        )}

        {get("push", false) && (
          <PhonePushBanner
            id="phone-push"
            app="Mail"
            title={`Action needed: sign ${DOC_SHORT} for Amara`}
            body={`Before Amara can participate with ${LEAGUE}, a parent or guardian needs to review and sign this document. It takes about a minute.`}
          />
        )}
      </div>
    )

    return { desktop, phone: phoneNode }
  },
}

/* ── Desktop: the documents page ──────────────────────────────────────────── */

function DocsScreen({
  panel,
  template,
  added,
}: {
  panel: boolean
  template: string
  added: boolean
}) {
  return (
    <>
      <MockBand
        eyebrow={`${LEAGUE} · League workspace`}
        title="Waivers"
        description="Required waivers are emailed automatically to every parent on a team's roster the moment that team is approved for a season."
        action={
          <MockButton id="add-waiver" tone="court">
            {panel ? "Cancel" : "Add waiver"}
          </MockButton>
        }
      />
      <div className="bg-ink-50/60 min-h-0 flex-1 px-6 py-3">
        {panel && (
          <section className="border-ink-100 live-pop rounded-2xl border bg-white px-4 py-2.5 shadow-sm">
            <h3 className="text-ink-900 text-[14px] font-bold">Add a waiver</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <TemplateChip id="tmpl-risk" label={RISK_DOC} on={template === "risk"} />
              <TemplateChip id="tmpl-concussion" label={DOC} on={template === "concussion"} />
              <TemplateChip id="tmpl-media" label="Photo and Media Consent" on={template === "media"} />
              <TemplateChip id="tmpl-custom" label="Custom document" on={template === "custom"} />
            </div>

            {template === "concussion" && (
              <div className="live-row-in mt-2">
                <p className="text-ink-500 text-[11.5px] leading-snug">
                  Ontario&apos;s concussion code under Rowan&apos;s Law. Every athlete under 26, and
                  the parent of every athlete under 18, confirms it once a year.
                </p>
                <div
                  data-demo-target="doc-preview"
                  className="border-ink-200 bg-ink-50/70 mt-1.5 h-[100px] overflow-hidden rounded-xl border px-3 py-1.5 transition-all duration-200 motion-reduce:transition-none data-[demo-hover=true]:border-play-300 data-[demo-hover=true]:ring-play-100 data-[demo-hover=true]:ring-2"
                >
                  <pre className="text-ink-700 whitespace-pre-wrap font-sans text-[10px] leading-[1.4]">
                    {DOC_BODY_PHONE}
                  </pre>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <MockButton id="add-doc" size="sm">
                    Add &quot;{DOC_SHORT}&quot;
                  </MockButton>
                  <MockPill tone="gold">Renews yearly</MockPill>
                  <MockPill tone="play">Required</MockPill>
                </div>
              </div>
            )}
          </section>
        )}

        <section
          className={cn(
            "border-ink-100 overflow-hidden rounded-2xl border bg-white shadow-sm",
            panel && "mt-2.5"
          )}
        >
          <header className="border-ink-100 flex items-center gap-3 border-b px-4 py-2">
            <h2 className="text-ink-900 text-[14.5px] font-bold">Waivers &amp; agreements</h2>
            <span className="text-ink-400 text-[11.5px]">
              Documents parents sign before their child participates
            </span>
          </header>
          <DocRow
            title={RISK_DOC}
            meta="Risk & indemnity · 214 signatures"
            badges={
              <>
                <MockPill tone="neutral">v2</MockPill>
                <MockPill tone="play">Required</MockPill>
              </>
            }
          />
          {added && (
            <DocRow
              fresh
              title={DOC}
              meta="Concussion code · 0 signatures"
              badges={
                <>
                  <MockPill tone="neutral">v1</MockPill>
                  <MockPill tone="play">Required</MockPill>
                  <MockPill tone="gold">Renews yearly</MockPill>
                </>
              }
            />
          )}
          <DocRow
            title="Photo and Media Consent"
            meta="Media consent · 198 signatures"
            badges={
              <>
                <MockPill tone="neutral">v1</MockPill>
                <MockPill tone="neutral">Optional</MockPill>
              </>
            }
          />
        </section>

        <p className="text-ink-400 mt-2 text-[10.5px] leading-snug">
          Templates are starting points, not legal advice. Have a lawyer review your final text.
          Editing a waiver&apos;s text creates a new version and everyone signs the new text;
          existing signatures keep the exact text they signed.
        </p>
      </div>
    </>
  )
}

function TemplateChip({ id, label, on }: { id: string; label: string; on: boolean }) {
  return (
    <span
      data-demo-target={id}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-all duration-200 motion-reduce:transition-none",
        on ? "border-play-600 bg-play-600 text-white shadow-sm" : "border-ink-200 text-ink-700 bg-white",
        !on && "data-[demo-hover=true]:border-play-300 data-[demo-hover=true]:bg-play-50/60",
        "data-[demo-press=true]:scale-[0.96]"
      )}
    >
      {label}
    </span>
  )
}

function DocRow({
  title,
  meta,
  badges,
  fresh,
}: {
  title: string
  meta: string
  badges: ReactNode
  fresh?: boolean
}) {
  return (
    <div
      className={cn(
        "border-ink-50 flex items-center gap-3 border-b px-4 py-2 last:border-b-0",
        fresh && "live-row-in"
      )}
    >
      <span className="bg-ink-50 text-ink-400 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[13px]">
        §
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-ink-900 block truncate text-[13px] font-bold">{title}</span>
        <span className="text-ink-400 block text-[11px]">{meta}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">{badges}</span>
      <span className="text-ink-400 shrink-0 text-[11.5px] font-semibold">Edit</span>
    </div>
  )
}

/* ── Desktop: the signing grid ────────────────────────────────────────────── */

function StatusScreen({
  signed,
  expanded,
  belloSigned,
  stragglers,
  reminded,
  notice,
}: {
  signed: number
  expanded: boolean
  belloSigned: boolean
  stragglers: boolean
  reminded: boolean
  notice: string
}) {
  const outstanding = TOTAL - signed
  const complete = outstanding === 0

  return (
    <>
      <MockBand
        eyebrow={`${LEAGUE} · ${SEASON}`}
        title="Signing status"
        description="Who has signed the league's required waivers, team by team. Waiver emails go out automatically when a team is approved."
        action={
          <MockButton id="resend-all" tone="quiet">
            Re-send all outstanding
          </MockButton>
        }
      />
      <div className="bg-ink-50/60 min-h-0 flex-1 px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="bg-court-50 text-court-700 ring-court-100 inline-flex items-center gap-1 rounded-full px-3 py-[3px] text-[12.5px] font-bold ring-1 ring-inset">
            <MockCounter value={signed} />
            signed
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-3 py-[3px] text-[12.5px] font-bold ring-1 ring-inset",
              complete ? "bg-ink-50 text-ink-600 ring-ink-200" : "bg-amber-50 text-amber-700 ring-amber-100"
            )}
          >
            <MockCounter value={outstanding} />
            outstanding
          </span>
          <span
            data-demo-target="only-missing"
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-all duration-200 motion-reduce:transition-none",
              stragglers ? "border-gold-400 bg-gold-100 text-gold-600" : "border-ink-200 text-ink-600 bg-white",
              "data-[demo-hover=true]:border-play-400"
            )}
          >
            Only missing
          </span>
          {notice && (
            <span className="text-court-700 live-pop ml-auto text-[12px] font-semibold">
              {notice}
            </span>
          )}
        </div>

        <div className="border-ink-100 mt-2.5 overflow-hidden rounded-2xl border bg-white shadow-sm">
          {TEAMS.map((t, i) => {
            /* One arithmetic, so the badges, the roster and the two counters
               can never disagree: the Ravens fill first and stop one short of
               their last cell until Wendy Chan answers, and everything left
               spills into the other five teams in order. */
            const ravensSigned = complete ? 22 : belloSigned ? 21 : 0
            const teamSigned = isRavensIndex(i)
              ? ravensSigned
              : clamp(signed - ravensSigned - 22 * (i - 1), 0, 22)
            const done = teamSigned === 22
            const isRavens = isRavensIndex(i)
            return (
              <div key={t.club} className="border-ink-50 border-b last:border-b-0">
                <div
                  data-demo-target={isRavens ? "team-ravens" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 px-4 py-1.5 transition-all duration-200 motion-reduce:transition-none",
                    "data-[demo-hover=true]:bg-play-50/50",
                    "data-[demo-press=true]:scale-[0.997]"
                  )}
                >
                  <span className="text-ink-400 text-[11px]">
                    {isRavens && expanded ? "▾" : "▸"}
                  </span>
                  <Crest name={t.club} size="xs" />
                  <span className="text-ink-900 text-[12.5px] font-bold">
                    {t.club} <span className="text-ink-400 font-semibold">{t.team}</span>
                  </span>
                  <span className="ml-auto flex shrink-0 items-center gap-2">
                    {done ? (
                      <MockPill tone="court">All signed</MockPill>
                    ) : (
                      <MockPill tone="gold">{teamSigned}/22 signed</MockPill>
                    )}
                    <span
                      className={cn(
                        "border-ink-200 text-ink-600 rounded-lg border bg-white px-2 py-0.5 text-[11px] font-semibold",
                        done && "opacity-40"
                      )}
                    >
                      Re-send
                    </span>
                  </span>
                </div>

                {isRavens && expanded && (
                  <div className="border-ink-50 live-row-in border-t px-4 pb-1.5 pt-1">
                    <table className="w-full table-fixed">
                      <thead>
                        <tr>
                          <th className="text-ink-500 w-[210px] py-1 text-left text-[10px] font-bold uppercase tracking-[0.1em]">
                            Player
                          </th>
                          <th className="text-ink-500 py-1 text-left text-[10px] font-bold uppercase tracking-[0.1em]">
                            {RISK_DOC}
                          </th>
                          <th className="text-ink-500 w-[240px] py-1 text-left text-[10px] font-bold uppercase tracking-[0.1em]">
                            {DOC_SHORT}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {ROSTER.map((r, ri) => {
                          const isBello = ri === 0
                          const isStraggler = ri === ROSTER.length - 1
                          const concussionSigned = complete
                            ? true
                            : isBello
                              ? belloSigned
                              : isStraggler
                                ? false
                                : belloSigned
                          return (
                            <tr key={r.player} className="align-top">
                              <td className="py-[2px]">
                                <span className="text-ink-900 truncate text-[11.5px] font-semibold">
                                  {r.player}
                                </span>
                                <span className="text-ink-400 ml-1.5 text-[10px]">{r.email}</span>
                              </td>
                              <td className="py-[2px]">
                                <Cell signed name={r.parent} />
                              </td>
                              <td className="py-[2px]">
                                <Cell
                                  signed={concussionSigned}
                                  name={r.parent}
                                  flash={isBello && belloSigned}
                                  reminded={isStraggler && reminded}
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    <p className="text-ink-400 mt-1 text-[10.5px]">
                      7 more players on this roster.
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {reminded && (
          <div className="border-gold-400 bg-gold-50 live-row-in mt-2 flex items-center gap-2.5 rounded-2xl border px-3.5 py-1.5">
            <span className="bg-gold-400 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] text-[#0b1628]">
              ⏱
            </span>
            <p className="text-gold-600 min-w-0 flex-1 text-[11.5px] font-semibold leading-snug">
              Reminder sent automatically to Wendy Chan and Priya Anand, 7 days before the season
              starts. The 24 hour reminder is queued and drops the moment they sign.
            </p>
            <MockPill tone="gold">Nobody chased anybody</MockPill>
          </div>
        )}
      </div>
    </>
  )
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const isRavensIndex = (i: number) => i === 0

/** One player against one document: signed by whom, or still pending. */
function Cell({
  signed,
  name,
  flash,
  reminded,
}: {
  signed: boolean
  name: string
  flash?: boolean
  reminded?: boolean
}) {
  if (signed) {
    return (
      <span
        className={cn(
          "text-court-700 inline-block text-[11.5px] font-semibold",
          flash && "demo-pulse-green"
        )}
      >
        ✓ {name}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[11.5px] font-semibold text-amber-600">Pending</span>
      {reminded && (
        <span className="border-gold-400 bg-gold-50 text-gold-600 live-pop rounded-full border px-1.5 py-px text-[9.5px] font-bold">
          Reminded
        </span>
      )}
    </span>
  )
}

/* ── Phone: the inbox and the signing page ────────────────────────────────── */

/** Where the email lands. A parent does not start inside our app. */
function InboxScreen() {
  return (
    <div className="flex h-full flex-col bg-[#f6f7f9]">
      <div className="border-ink-100 shrink-0 border-b bg-white px-4 pb-2 pt-2">
        <p className="text-ink-900 text-[15px] font-bold">Inbox</p>
        <p className="text-ink-400 text-[10.5px]">ngozi.bello@gmail.com</p>
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 px-3 py-2.5">
        {[
          { from: "Riverside Ravens", subject: "Practice moved to Court 1", when: "Tue" },
          { from: "School Council", subject: "Pizza day forms", when: "Mon" },
          { from: "Metro West Basketball", subject: "Fall 2026 schedule is published", when: "Sun" },
        ].map((m) => (
          <div key={m.subject} className="border-ink-100 rounded-xl border bg-white px-2.5 py-2">
            <div className="flex items-baseline gap-2">
              <span className="text-ink-800 min-w-0 flex-1 truncate text-[11.5px] font-bold">
                {m.from}
              </span>
              <span className="text-ink-400 shrink-0 text-[10px]">{m.when}</span>
            </div>
            <p className="text-ink-500 truncate text-[11px]">{m.subject}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function SignScreen({
  done,
  name,
  relation,
  drawn,
  acked,
}: {
  done: boolean
  name: ReactNode
  relation: string
  drawn: boolean
  acked: boolean
}) {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="relative isolate shrink-0 overflow-hidden bg-[#0b1628] px-4 pb-3 pt-2">
        <CourtBackdropLayer variant="navy" intensity="band" />
        <div className="relative z-10">
          <p className="text-gold-400 text-[9px] font-bold uppercase tracking-[0.18em]">{LEAGUE}</p>
          <h2 className="mt-0.5 text-[13.5px] font-bold leading-tight text-white">{DOC_SHORT}</h2>
          <p className="mt-0.5 text-[10.5px] text-white/70">
            For <span className="font-bold text-white">{PLAYER}</span> · renews yearly
          </p>
        </div>
      </div>

      {done ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 text-center">
          <span className="bg-court-600 live-pop flex h-14 w-14 items-center justify-center rounded-full text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-7 w-7">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <h3 className="text-ink-900 mt-3 text-[15px] font-bold">Signed and recorded</h3>
          <p className="text-ink-500 mt-1.5 text-[11.5px] leading-relaxed">
            Thank you. {LEAGUE} now has your signed copy on file for {PLAYER}. You can close this
            page.
          </p>
          <div className="border-ink-100 mt-3 w-full rounded-xl border px-3 py-2 text-left">
            <Row label="Signed by" value={PARENT} />
            <Row label="As" value="Parent or guardian" />
            <Row label="Recorded" value="14 Oct, 8:41 PM" />
            <Row label="Renews" value="14 Oct 2027" />
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col px-3.5 py-2.5">
          {/* The scrolling document box, at the size the frame can hold. */}
          <div className="border-ink-200 h-[122px] shrink-0 overflow-hidden rounded-xl border px-2.5 py-1.5">
            <pre className="text-ink-700 whitespace-pre-wrap font-sans text-[7.5px] leading-[1.5]">
              {DOC_BODY_PHONE}
            </pre>
          </div>
          <p className="text-ink-400 mt-1 shrink-0 text-[9px]">
            Six commitments in full. Scroll to read all of it.
          </p>

          <div className="mt-2 shrink-0">
            <p className="text-ink-600 mb-1 text-[9.5px] font-bold uppercase tracking-[0.1em]">
              Your full name
            </p>
            <span
              data-demo-target="name-field"
              className="border-ink-200 flex min-h-[30px] w-full items-center rounded-xl border bg-white px-2.5 text-[11.5px] transition-all duration-200 motion-reduce:transition-none data-[demo-hover=true]:border-play-400 data-[demo-hover=true]:ring-play-100 data-[demo-hover=true]:ring-2"
            >
              {name}
            </span>
          </div>

          <div className="mt-2 shrink-0">
            <p className="text-ink-600 mb-1 text-[9.5px] font-bold uppercase tracking-[0.1em]">
              Relationship to player
            </p>
            <div className="flex gap-1.5">
              <RelChip id="rel-parent" label="Parent or guardian" on={relation === "parent"} />
              <RelChip label="Player (18 or older)" on={relation === "player"} />
            </div>
          </div>

          <div className="mt-2 shrink-0">
            <div className="flex items-baseline justify-between">
              <p className="text-ink-600 text-[9.5px] font-bold uppercase tracking-[0.1em]">
                Signature
              </p>
              <p className="text-ink-400 text-[9px]">Draw with your finger or mouse</p>
            </div>
            <span
              data-demo-target="sign-pad"
              className={cn(
                "border-ink-300 mt-1 block h-[62px] w-full rounded-xl border-2 border-dashed bg-white transition-all duration-200 motion-reduce:transition-none",
                "data-[demo-hover=true]:border-play-400",
                "data-[demo-press=true]:scale-[0.99]"
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
                <span className="text-ink-400 flex h-full items-center justify-center text-[10px] font-semibold">
                  Sign here with your finger
                </span>
              )}
            </span>
            {drawn && (
              <p className="text-ink-500 mt-0.5 text-right text-[9px] underline">Clear signature</p>
            )}
          </div>

          <span
            data-demo-target="ack-check"
            className={cn(
              "mt-2 flex shrink-0 items-start gap-1.5 rounded-xl border px-2 py-1.5 transition-all duration-200 motion-reduce:transition-none",
              acked ? "border-play-300 bg-play-50/60" : "border-ink-200 bg-white",
              "data-[demo-hover=true]:border-play-400",
              "data-[demo-press=true]:scale-[0.99]"
            )}
          >
            <span
              className={cn(
                "mt-px flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border-2",
                acked ? "border-play-600 bg-play-600" : "border-ink-300 bg-white"
              )}
            >
              {acked && (
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" className="h-2 w-2">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            <span className="text-ink-700 text-[9px] leading-snug">
              I have read and understood this document, and I confirm that I am authorized to sign
              it for {PLAYER}.
            </span>
          </span>

          <span
            data-demo-target="submit"
            className={cn(
              "bg-court-600 mt-2 block shrink-0 rounded-xl px-3 py-2 text-center text-[12px] font-bold text-white transition-all duration-200 motion-reduce:transition-none",
              !(acked && drawn) && "opacity-40",
              "data-[demo-hover=true]:brightness-110 data-[demo-hover=true]:shadow-md",
              "data-[demo-press=true]:scale-[0.98]"
            )}
          >
            Sign and submit
          </span>
          <p className="text-ink-400 mt-1 shrink-0 text-[8.5px] leading-snug">
            Your signature, name, the exact document text, and the date and time are stored securely
            as your signed record.
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
        "flex min-w-0 flex-1 items-center justify-center rounded-lg border px-1.5 py-1 text-[9.5px] font-bold transition-all duration-200 motion-reduce:transition-none",
        on ? "border-play-600 bg-play-600 text-white" : "border-ink-200 text-ink-600 bg-white",
        "data-[demo-hover=true]:border-play-400",
        "data-[demo-press=true]:scale-[0.96]"
      )}
    >
      {label}
    </span>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-[3px] text-[10.5px]">
      <span className="text-ink-500">{label}</span>
      <span className="text-ink-900 font-semibold">{value}</span>
    </div>
  )
}
