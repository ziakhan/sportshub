"use client"

import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import { Btn, Chip, ConsoleTabs, Dialog, Panel, StatusChip } from "../scene-kit"
import type { DemoBeat, DemoScript } from "../types"

/**
 * "A team drops out" (scenario audit C2, the owner's pitch journey).
 *
 * A club asks out of a season that is already drawn. The league approves it,
 * the team's future games come off by themselves, the opponents' clubs are
 * told, and then the beat the demo exists for: the schedule says exactly who
 * is now short of the games they were promised, and the fix ADDS ONLY THE
 * MISSING GAMES. Nobody else's weekend moves.
 *
 * Built to the gold standard set by `season-story.tsx` and
 * `schedule-change-story.tsx` on 2026-08-16, to the same three laws:
 *
 *   1. PRESENTATION (audit D2). One focused working REGION composed at 1160
 *      logical, rendered at scale 1.0, no browser chrome and no site header,
 *      one slim context strip. League planning surfaces stay DESKTOP by the
 *      owner's own exception in the audit's D table, so this demo never
 *      fabricates a handset. `scripts/demo/readability-audit.mjs` is the gate:
 *      nothing here is authored under 14px.
 *   2. PACING. Stop, explain, act. Every dwell is computed from the balloon's
 *      own word count, and a beat carrying a balloon silences the caption bar
 *      so the viewer is never read to twice.
 *   3. EVERY NUMBER DERIVED. The league, the season, the withdrawal request,
 *      the division, the ten games, the nine short teams and their counts are
 *      read out of the local seeded database, and every one of them is written
 *      down with its source in `docs/roadmap/team-drops-out-numbers.md`.
 *
 * THE TRUST LINE IS EARNED, NOT ASSERTED. "Nobody else's weekend moved" is
 * only speakable because `fillGapsOnly` genuinely adds without moving, proven
 * at three layers and recorded in the numbers sheet section E:
 *   · `schedule-tab.tsx` `commitGaps` posts `{ fillGapsOnly: true }`;
 *   · `api/seasons/[id]/schedule/commit/route.ts` line 76 forces
 *     `replaceExisting = false`, so the `deleteMany` branch is unreachable;
 *   · `lib/scheduler/generate.ts` books every existing game's teams, courts
 *     and day caps as busy before it places anything, so the new games can
 *     only land in what is left.
 * The product's own line under the buttons says it too: "Nobody's existing
 * games move."
 *
 * TRUTH TO THE PRODUCT, SCREEN BY SCREEN:
 *   · the withdrawal queue is `components/withdrawal-requests-panel.tsx` on
 *     the season console's Teams tab, amber, with its real sentence "These
 *     clubs are asking to leave the season. Approving cancels their upcoming
 *     games and notifies opponents." and its real row shape;
 *   · the guarantee callout is `schedule-tab.tsx` lines 679 to 707 verbatim,
 *     including the per-team list format "Name (count) · +N more" and the two
 *     buttons "Preview the fix" and "Add ONLY the missing games";
 *   · the commit confirmation is the product's own `confirm()` sentence;
 *   · the draft banner is the same file's `draftCount` strip.
 *
 * THREE THINGS THE PRODUCT CANNOT HONESTLY SHOW, AND THEY ARE NOT STAGED.
 * All three are punch items in the numbers sheet, section F:
 *   1. NO FAMILY FAN-OUT. The withdrawal cascade notifies the opponents' CLUB
 *      OFFICES and nobody else: no families, no coaches, and no email at all.
 *      The demo says exactly that and counts club offices, not people.
 *   2. NO REASON ON THE CANCELLED GAMES. `Game.statusReason` is never written
 *      by this cascade, so the cancelled rows carry no reason.
 *   3. NO CASCADE RECEIPT. Nothing in the product shows the operator what the
 *      approval did. That beat is drawn as an explicit NARRATION card, navy,
 *      with no console chrome on it.
 */

/* ── Cast, all read out of the seeded world ──────────────────────────────── */

const LEAGUE = "NPH Showcase League"
const SEASON = "Fall/Winter 2026-27"
const CTX_TEAMS = `${LEAGUE} · ${SEASON} · Teams`
const CTX_SCHEDULE = `${LEAGUE} · ${SEASON} · Schedule`

/** The season as it stands before anybody leaves. `DB` season 160b2f09. */
const TEAMS_IN = 145
const GAMES_IN = 725
const GUARANTEE = 10

/** The withdrawal. `DB` WithdrawalRequest 0f2e947b, CLUB_FROM_LEAGUE, PENDING. */
const TEAM = "Orillia Lakers"
const DIVISION = "Grade 10 Boys · Division D"
/**
 * The reason, verbatim from the row. The product stores it with an em-dash;
 * the house copy rule turns that into a middot, exactly as the season story
 * does with the auditor's sentence and the schedule-change story with the
 * cancellation email.
 */
const REASON = "Not enough committed players to travel this winter · we have to pull out."
const ASKED_ON = "Aug 2"

/** What the approval cancels. `DB` ten future SCHEDULED games, nine opponents. */
const CANCELLED = 10
const OPPONENT_CLUBS = 9

/**
 * The cascade, in the order `lib/withdrawals/requests.ts` runs it inside one
 * transaction. This is narration, not a screen: nothing in the product shows
 * an operator what the approval did.
 */
const CASCADE = [
  {
    n: "1",
    label: "The entry goes to WITHDRAWN",
    note: "The team leaves the registered list, and stays in the season's history.",
  },
  {
    n: "2",
    label: "An unpaid entry fee is cancelled with it",
    note: "A fee already paid is left alone, because refunding is the league's call.",
  },
  {
    n: "3",
    label: "Their open schedule requests are closed",
    note: "Reason recorded: Team withdrew from the season.",
  },
  {
    n: `${CANCELLED}`,
    label: "future games cancelled, in the same transaction",
    note: "Games already played are untouched, so the table keeps its history.",
  },
]

/** The notification, verbatim from `lib/withdrawals/requests.ts` lines 337 to 339. */
const NOTICE = {
  title: "Games Cancelled · Opponent Withdrew",
  body: `${TEAM} has withdrawn from ${LEAGUE}. ${CANCELLED} upcoming game(s) against them have been cancelled.`,
}

/**
 * The guarantee callout, `schedule-tab.tsx` lines 679 to 707. The count, the
 * target and every name and number in the list are `DB`: the whole of Division
 * D minus the club that left, with Vanguard North Prep on 8 because they were
 * drawn against the Lakers twice.
 */
const SHORT_TEAMS = [
  { name: "FEIA (Fort Erie)", count: 9 },
  { name: "Alpha Elite", count: 9 },
  { name: "Retro Elite", count: 9 },
  { name: "Vaughan Panthers", count: 9 },
  { name: "EM Elite", count: 9 },
  { name: "Malton Sting Basketball", count: 9 },
  { name: "Vanguard North Prep", count: 8 },
  { name: "Toronto Top Tier East", count: 9 },
  { name: "Dragons de Gatineau (DMV CHILL)", count: 9 },
]
const SHORT_COUNT = SHORT_TEAMS.length
/** `ARITH` the shortfall in team-slots, and the games that closes it. */
const SLOTS_SHORT = SHORT_TEAMS.reduce((a, t) => a + (GUARANTEE - t.count), 0)
const NEW_GAMES = SLOTS_SHORT / 2
/** `ARITH` every approved team that is NOT short, and therefore not moving. */
const UNTOUCHED = TEAMS_IN - 1 - SHORT_COUNT

/**
 * The Team check rows, Division D as it stands after the withdrawal: the nine
 * short teams at their real counts plus Burloak Elite, who were never drawn
 * against the Lakers and are therefore the one team in the division that
 * still has its ten. `DB`, all eleven counts read from the games table.
 */
const CHECK_ROWS = [...SHORT_TEAMS, { name: "Burloak Elite (PRIME)", count: GUARANTEE }]

/** The commit confirmation, verbatim from `schedule-tab.tsx` line 429. */
const COMMIT_CONFIRM =
  "Add ONLY the missing games? Nobody's existing schedule changes · the new games are saved as drafts until you publish."

/* ── Pacing ──────────────────────────────────────────────────────────────── */

/**
 * Stop, explain, act (owner ruling 2026-08-16: "slow is the point"). The hand
 * takes about 620ms to reach its target and the balloon lands with it, so a
 * beat holds for the travel, plus long enough to READ the balloon at about
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

export const teamDropsOutStory: DemoScript = {
  presentation: "scene",
  desktopUrl:
    "/manage/leagues/nph-showcase/seasons/fall-winter-2026-27/manage?tab=teams",
  context: CTX_TEAMS,
  initialStage: "desktop",
  chapters: [
    { id: "ask", title: "The club asks out" },
    { id: "approve", title: "What approving does" },
    { id: "short", title: "Who is now short" },
    { id: "fix", title: "Only the missing games" },
  ],

  beats: [
    /* ── 1. The club asks out ─────────────────────────────────────────── */
    paced({
      id: "open",
      chapter: "ask",
      caption: `${TEAMS_IN} teams are in, and the whole season is already drawn.`,
      emphasize: "season-strip",
      callout: `${TEAMS_IN} teams and ${GAMES_IN} games are already on the board.`,
    }),
    paced({
      id: "queue",
      chapter: "ask",
      caption: "One club is asking to leave.",
      emphasize: "wd-panel",
      callout:
        "A club that is already approved cannot just walk. The league has to sign it off.",
    }),
    paced({
      id: "reason",
      chapter: "ask",
      caption: "The club had to write down why.",
      emphasize: "wd-reason",
      callout: "The reason is required, so a league is never guessing what happened.",
    }),
    paced({
      id: "warning",
      chapter: "ask",
      caption: "The screen names what Approve will do before it is pressed.",
      emphasize: "wd-warn",
      callout: "Ten cancelled games and a dead entry fee, said in advance.",
    }),
    paced({
      id: "approve",
      chapter: "ask",
      caption: "Approved.",
      cursor: "wd-approve",
      press: true,
      toast: `${TEAM} withdrawn · ${CANCELLED} games cancelled`,
      set: { approved: true },
      callout: "Everything after this press runs on its own.",
    }),

    /* ── 2. What approving does ───────────────────────────────────────── */
    paced({
      id: "cascade",
      chapter: "approve",
      caption: "Four things happened, and all four are one transaction.",
      /* The strip stops naming a product screen, because this card is not
         one: the cascade runs on the server and nothing shows it. Punch 3. */
      context: undefined,
      set: { cascade: true, step: 0 },
      emphasize: "cascade-card",
      callout: "All four writes are one transaction. If any of them failed, none of them happened.",
    }),
    paced({
      id: "casc-1",
      chapter: "approve",
      caption: "The entry goes to withdrawn, and stays in the history.",
      set: { step: 1 },
      hold: 2500,
    }),
    paced({
      id: "casc-2",
      chapter: "approve",
      caption: "An unpaid entry fee dies with it. A paid one does not.",
      set: { step: 2 },
      hold: 2800,
    }),
    paced({
      id: "casc-3",
      chapter: "approve",
      caption: "Their open schedule requests close themselves, with a reason on each.",
      set: { step: 3 },
      hold: 2700,
    }),
    paced({
      id: "casc-4",
      chapter: "approve",
      caption: `And ${CANCELLED} future games come off the board.`,
      set: { step: 4 },
      hold: 3000,
    }),
    paced({
      id: "told",
      chapter: "approve",
      caption: `The ${OPPONENT_CLUBS} clubs they were due to play are told.`,
      set: { notice: true },
      emphasize: "notice-card",
      callout: "The list is the fixtures that were cancelled, so nobody assembles it.",
    }),
    paced({
      id: "told-honest",
      chapter: "approve",
      caption: "Club offices, because this schedule is not published to families yet.",
      emphasize: "notice-foot",
      callout: "Families hear it from their own club, which is who told them they were entered.",
    }),

    /* ── 3. Who is now short ──────────────────────────────────────────── */
    paced({
      id: "schedule",
      chapter: "short",
      caption: "Ten games came off a season that was already drawn.",
      context: CTX_SCHEDULE,
      set: { cascade: false, notice: false, shortView: true },
      emphasize: "gap-callout",
      callout: "Somebody is now owed games the league guaranteed them.",
    }),
    paced({
      id: "count",
      chapter: "short",
      caption: `${SHORT_COUNT} teams are under the ${GUARANTEE} game guarantee, and it names them.`,
      emphasize: "gap-line",
      callout: "The screen names them and carries each one's real count.",
    }),
    paced({
      id: "vanguard",
      chapter: "short",
      caption: "One of them is short by two, because they were drawn against the Lakers twice.",
      emphasize: "gap-list",
      callout:
        "Vanguard North Prep is on eight, not nine. The arithmetic is per team, not per division.",
      set: { showAll: true },
    }),
    paced({
      id: "rest",
      chapter: "short",
      caption: `Every one of the other ${UNTOUCHED} teams still has its ${GUARANTEE}.`,
      emphasize: "gap-rest",
      callout: "The damage is contained to one division, and the screen proves it.",
    }),

    /* ── 4. Only the missing games ────────────────────────────────────── */
    paced({
      id: "preview",
      chapter: "fix",
      caption: "The fix is checked before it is run.",
      cursor: "gap-preview",
      press: true,
      set: { previewed: true },
      callout: "Preview first. See what would be added before anything is written.",
    }),
    paced({
      id: "result",
      chapter: "fix",
      caption: `${NEW_GAMES} new games close all ${SLOTS_SHORT} of the missing slots.`,
      emphasize: "gap-result",
      callout:
        "Five games, because ten team-slots short is five games. And zero existing games touched.",
    }),
    paced({
      id: "add",
      chapter: "fix",
      caption: "Add ONLY the missing games.",
      cursor: "gap-add",
      press: true,
      set: { dialog: true },
      callout: "The season is not regenerated. Five games are appended to it.",
    }),
    paced({
      id: "confirm",
      chapter: "fix",
      caption: "The dialog says it in the product's own words.",
      cursor: "confirm-add",
      press: true,
      toast: `${NEW_GAMES} games added · nothing else changed`,
      set: { dialog: false, committed: true },
      callout: "Every game already on the board is treated as immovable.",
    }),
    paced({
      id: "proof",
      chapter: "fix",
      caption: "The warning is gone, and every team has its ten.",
      emphasize: "gap-clear",
      callout: "Same courts, same times, same weekends for everybody who was already scheduled.",
    }),
    paced({
      id: "draft",
      chapter: "fix",
      caption: "And the new games are drafts until the league says so.",
      emphasize: "draft-strip",
      callout: "Five new games, visible only to the league, until one publish sends them out.",
    }),
    paced({
      id: "end",
      chapter: "fix",
      caption:
        "A club left, ten games came off, nine teams were made whole, and nobody else's weekend moved.",
      hold: 5400,
      set: { endCard: true },
    }),
  ],

  /* ── Render ────────────────────────────────────────────────────────── */

  render: ({ get }) => {
    const cascade = get("cascade", false)
    const shortView = get("shortView", false)
    const key = cascade ? "cascade" : shortView ? "schedule" : "teams"

    const desktop = (
      <div className="relative flex h-full flex-col">
        <div key={key} className="demo-fade-in flex min-h-0 flex-1 flex-col">
          {cascade ? (
            <CascadeCard step={get("step", 0)} notice={get("notice", false)} />
          ) : shortView ? (
            <ScheduleScreen
              previewed={get("previewed", false)}
              committed={get("committed", false)}
              showAll={get("showAll", false)}
            />
          ) : (
            <TeamsScreen approved={get("approved", false)} />
          )}
        </div>

        {/* The product's own confirm(), and all of it: one sentence, two
            buttons, no options. Nothing is added here. */}
        <Dialog
          open={get("dialog", false)}
          title={COMMIT_CONFIRM}
          footer={
            <>
              <Btn tone="quiet" size="sm">
                Cancel
              </Btn>
              <Btn id="confirm-add" size="sm">
                OK
              </Btn>
            </>
          }
        />

        {get("endCard", false) && <EndCard />}
      </div>
    )

    return { desktop }
  },
}

/* ── The Teams tab ───────────────────────────────────────────────────────── */

function TeamsScreen({ approved }: { approved: boolean }) {
  return (
    <>
      <ConsoleTabs active="Teams" />
      <div className="bg-ink-50/70 min-h-0 flex-1 px-6 py-4">
        <div data-demo-target="season-strip" className="mb-3 flex items-center gap-2.5">
          <Chip tone="court" strong>
            Open for registration
          </Chip>
          <span className="text-ink-700 text-[15px] font-bold tabular-nums">
            {TEAMS_IN} teams approved
          </span>
          <span className="text-ink-500 text-[14px] font-semibold tabular-nums">
            {GAMES_IN} games drawn · 16 divisions
          </span>
          <span className="text-ink-500 ml-auto text-[14px] font-semibold">
            {GUARANTEE} game guarantee
          </span>
        </div>

        {/* `components/withdrawal-requests-panel.tsx`: amber card, count badge,
            the standing sentence, then one row per request. */}
        <div
          data-demo-target="wd-panel"
          className={cn(
            "rounded-2xl border px-5 py-4 transition-opacity duration-500 motion-reduce:transition-none",
            approved ? "border-ink-200 bg-white opacity-60" : "border-amber-200 bg-amber-50/60"
          )}
        >
          <div className="flex items-center gap-2.5">
            <span className="bg-amber-500 h-4 w-[3px] shrink-0 rounded-full" />
            <h3 className="font-display text-ink-900 text-[17px] font-extrabold uppercase tracking-[0.02em]">
              Withdrawal requests
            </h3>
            <Chip tone="gold" strong>
              {approved ? "0" : "1"}
            </Chip>
          </div>
          <p
            data-demo-target="wd-warn"
            className="text-ink-600 mt-1.5 text-[15px] font-medium leading-snug"
          >
            These clubs are asking to leave the season. Approving cancels their upcoming games and
            notifies opponents.
          </p>

          {approved ? (
            <p className="text-ink-500 mt-3 text-[15px] font-semibold">
              Nothing waiting. {TEAM} was withdrawn.
            </p>
          ) : (
            <div className="border-ink-100 live-pop mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3">
              <div className="min-w-0">
                <p className="text-ink-900 text-[16px] font-bold">
                  {TEAM} <span className="text-ink-400 font-semibold">·</span> withdraw from{" "}
                  {SEASON}
                </p>
                <p
                  data-demo-target="wd-reason"
                  className="text-ink-600 mt-1 text-[15px] font-medium leading-snug"
                >
                  &ldquo;{REASON}&rdquo; <span className="text-ink-400">· {ASKED_ON}</span>
                </p>
                <p className="text-ink-500 mt-1 text-[14px] font-semibold">{DIVISION}</p>
              </div>
              <span className="flex shrink-0 gap-2">
                <Btn id="wd-approve" size="sm">
                  Approve
                </Btn>
                <Btn tone="quiet" size="sm">
                  Decline
                </Btn>
              </span>
            </div>
          )}
        </div>

        {/* A slice of the registered list, so the withdrawal has a season
            around it. Real Division D rows, `DB`. */}
        <Panel
          className="mt-4"
          title="Registered teams"
          meta={DIVISION}
          action={
            <Chip tone="neutral" strong>
              11 of {TEAMS_IN}
            </Chip>
          }
        >
          <div className="space-y-1 px-4 py-2.5">
            {SHORT_TEAMS.slice(0, 3).map((t) => (
              <TeamLine key={t.name} name={t.name} status="APPROVED" />
            ))}
            <TeamLine name={TEAM} status={approved ? "WITHDRAWN" : "APPROVED"} changed={approved} />
            <p className="text-ink-400 px-1 pt-1 text-[14px] font-semibold">
              and seven more in this division
            </p>
          </div>
        </Panel>
      </div>
    </>
  )
}

function TeamLine({
  name,
  status,
  changed,
}: {
  name: string
  status: "APPROVED" | "WITHDRAWN"
  changed?: boolean
}) {
  const dead = status === "WITHDRAWN"
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-2 transition-colors duration-300 motion-reduce:transition-none",
        dead ? "border-hoop-200 bg-hoop-50/50" : "border-court-100 bg-court-50/50"
      )}
    >
      <span
        className={cn(
          "text-[15px] font-bold",
          dead ? "text-ink-500 line-through" : "text-ink-900",
          changed && "live-pop"
        )}
      >
        {name}
      </span>
      <span className="text-play-700 text-[14px] font-semibold">{DIVISION}</span>
      <span className="ml-auto">
        <StatusChip tone={dead ? "hoop" : "court"}>{status}</StatusChip>
      </span>
    </div>
  )
}

/* ── The cascade card ────────────────────────────────────────────────────── */

/**
 * NARRATION, NOT A SCREEN.
 *
 * `decideWithdrawalRequest` runs its four writes inside one transaction and
 * shows the operator nothing at all afterwards, so this card is drawn in navy
 * with no console chrome anywhere near it. It is punch item 3 in the numbers
 * sheet, and the fix is a receipt panel on the Teams tab.
 */
function CascadeCard({ step, notice }: { step: number; notice: boolean }) {
  return (
    <div
      data-demo-target="cascade-card"
      className="flex min-h-0 flex-1 flex-col justify-center bg-[#0b1628] px-10 py-5 text-white"
    >
      <p className="font-display text-[30px] font-extrabold leading-none">
        One transaction, four writes
      </p>
      <p className="mt-1.5 text-[16px] font-semibold text-white/70">
        {TEAM} · {DIVISION}
      </p>

      <div className="mt-4 space-y-2">
        {CASCADE.map((r, i) => (
          <div
            key={r.label}
            className={cn(
              "flex items-baseline gap-4 rounded-2xl border px-4 py-3 transition-opacity duration-500 motion-reduce:transition-none",
              i < step ? "border-white/15 bg-white/[0.07] opacity-100" : "border-white/5 opacity-20"
            )}
          >
            <span className="text-gold-400 w-[46px] shrink-0 text-[24px] font-extrabold leading-none tabular-nums">
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

      {notice && (
        <div
          data-demo-target="notice-card"
          className="live-pop mt-3 rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-2.5"
        >
          <p className="text-[15px] font-bold uppercase tracking-[0.06em] text-white/50">
            And then, by itself
          </p>
          <p className="mt-1 text-[17px] font-bold">{NOTICE.title}</p>
          <p className="mt-1 text-[15px] font-medium leading-snug text-white/75">{NOTICE.body}</p>
          <p
            data-demo-target="notice-foot"
            className="mt-2 border-t border-white/10 pt-2 text-[15px] font-medium text-white/55"
          >
            Sent to the front office of all {OPPONENT_CLUBS} opposing clubs. This schedule has not
            been published yet, so no family calendar carried these games.
          </p>
        </div>
      )}
    </div>
  )
}

/* ── The Schedule tab ────────────────────────────────────────────────────── */

function ScheduleScreen({
  previewed,
  committed,
  showAll,
}: {
  previewed: boolean
  committed: boolean
  showAll: boolean
}) {
  const shown = showAll ? SHORT_TEAMS : SHORT_TEAMS.slice(0, 4)
  return (
    <>
      <ConsoleTabs active="Schedule" />
      <div className="bg-ink-50/70 min-h-0 flex-1 px-6 py-4">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="text-ink-700 text-[15px] font-bold tabular-nums">
            {committed ? GAMES_IN - CANCELLED + NEW_GAMES : GAMES_IN - CANCELLED} games in the
            season
          </span>
          <Chip tone="neutral" strong>
            {GUARANTEE} game guarantee
          </Chip>
          <span className="text-ink-500 text-[14px] font-semibold">
            Built on plan · Showcase 2026-27
          </span>
        </div>

        {committed ? (
          <div
            data-demo-target="gap-clear"
            className="border-court-300 bg-court-50 live-pop rounded-2xl border px-5 py-4"
          >
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="bg-court-600 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[14px] font-black text-white"
              >
                ✓
              </span>
              <p className="text-court-800 text-[17px] font-bold">
                Every team has its {GUARANTEE} games
              </p>
            </div>
            <p className="text-court-900 mt-1.5 text-[15px] leading-snug">
              {NEW_GAMES} games added, {SLOTS_SHORT} missing slots closed, and{" "}
              {GAMES_IN - CANCELLED} existing games left exactly where they were.
            </p>
          </div>
        ) : (
          /* `schedule-tab.tsx` lines 679 to 707, verbatim. */
          <div
            data-demo-target="gap-callout"
            className="border-amber-200 bg-amber-50 live-pop rounded-2xl border px-5 py-4"
          >
            <p data-demo-target="gap-line" className="text-amber-900 text-[16px] font-bold">
              {SHORT_COUNT} teams are below the {GUARANTEE}-game guarantee{" · "}
              <span className="font-normal">
                usually a dropout, a late-added team, or a new make-up session.
              </span>
            </p>
            <p
              data-demo-target="gap-list"
              className="text-amber-800 mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-semibold"
            >
              {shown.map((t, i) => (
                <span key={t.name} className="flex items-center gap-2">
                  {i > 0 && (
                    <span aria-hidden="true" className="text-amber-500">
                      ·
                    </span>
                  )}
                  <span className={t.count < 9 ? "text-hoop-700 font-bold" : ""}>
                    {t.name} ({t.count})
                  </span>
                </span>
              ))}
              {!showAll && (
                <span className="text-amber-700">
                  · +{SHORT_TEAMS.length - 4} more
                </span>
              )}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <Btn id="gap-preview" size="sm">
                Preview the fix
              </Btn>
              <Btn id="gap-add" tone="court" size="sm">
                Add ONLY the missing games
              </Btn>
              <span className="text-amber-700 text-[15px] font-semibold">
                Nobody&apos;s existing games move.
              </span>
            </div>
          </div>
        )}

        {previewed && !committed && (
          <div
            data-demo-target="gap-result"
            className="border-play-300 live-pop mt-3 rounded-2xl border bg-white px-5 py-3.5"
          >
            <p className="text-ink-900 text-[16px] font-bold">
              The fix, previewed ·{" "}
              <span className="text-court-700">
                {NEW_GAMES} new games, {SLOTS_SHORT} slots closed
              </span>
            </p>
            <div className="text-ink-600 mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[15px] font-semibold">
              <span className="text-court-700">existing games moved 0</span>
              <span className="text-court-700">existing games deleted 0</span>
              <span className="text-court-700">teams still short 0</span>
              <span className="text-ink-500">new back-to-backs 0</span>
            </div>
            <p className="text-ink-500 mt-2 text-[14px] font-medium leading-snug">
              Every game already on the board is booked as busy time before a single new one is
              placed, so the five can only land in what is left.
            </p>
          </div>
        )}

        {committed && (
          <div
            data-demo-target="draft-strip"
            className="border-gold-300 bg-gold-50 live-pop mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-3"
          >
            <p className="text-gold-700 text-[15px] font-bold">
              {NEW_GAMES} draft games · visible only to you until you publish. Review below,
              re-run sessions freely, then publish once.
            </p>
            <Btn size="sm">Publish schedule · {NEW_GAMES} new</Btn>
          </div>
        )}

        {/* The rest of the league, which is the point. A compact strip rather
            than a panel: the scene is authored to a 600 logical box, and the
            Team check grid under it is what needs the room. */}
        <div
          data-demo-target="gap-rest"
          className="border-ink-200 mt-3 flex flex-wrap items-baseline gap-x-7 gap-y-1 rounded-2xl border bg-white px-5 py-2.5"
        >
          <span className="text-ink-500 text-[14px] font-bold uppercase tracking-[0.08em]">
            The rest of the league
          </span>
          <span className="flex items-baseline gap-2">
            <span className="text-court-700 text-[24px] font-extrabold leading-none tabular-nums">
              {UNTOUCHED}
            </span>
            <span className="text-ink-700 text-[15px] font-semibold">
              teams still on {GUARANTEE} of {GUARANTEE}
            </span>
          </span>
          <span className="flex items-baseline gap-2">
            <span className="text-court-700 text-[24px] font-extrabold leading-none tabular-nums">
              15
            </span>
            <span className="text-ink-700 text-[15px] font-semibold">
              other divisions untouched
            </span>
          </span>
          <span className="flex items-baseline gap-2">
            <span className="text-court-700 text-[24px] font-extrabold leading-none tabular-nums">
              0
            </span>
            <span className="text-ink-700 text-[15px] font-semibold">
              games moved to make room
            </span>
          </span>
        </div>

        {/* TEAM CHECK, the real `team-check.tsx` panel: one row per approved
            team, a count chip against the target, amber while short and a
            green tick when done, with the header's own "N of M teams fully
            scheduled" / "Every team has N games" pair. Division D only,
            because that is the division the withdrawal touched. */}
        {!(previewed && !committed) && (
        <div className="border-ink-200 mt-3 rounded-2xl border bg-white px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="bg-play-600 h-4 w-[3px] shrink-0 rounded-full" />
            <h3 className="font-display text-ink-900 text-[17px] font-extrabold uppercase tracking-[0.02em]">
              Team check
            </h3>
            <span className="text-ink-500 truncate text-[14px] font-semibold">{DIVISION}</span>
            <span className="ml-auto shrink-0">
              {committed ? (
                <Chip tone="court" strong>
                  Every team has {GUARANTEE} games
                </Chip>
              ) : (
                <span className="text-ink-500 text-[14px] font-semibold tabular-nums">
                  1 of {SHORT_COUNT + 1} teams fully scheduled
                </span>
              )}
            </span>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-1.5">
            {CHECK_ROWS.map((t) => {
              const n = committed ? GUARANTEE : t.count
              const done = n >= GUARANTEE
              return (
                <div
                  key={t.name}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-xl border px-3 py-1.5 transition-colors duration-500 motion-reduce:transition-none",
                    done ? "border-court-200 bg-court-50/60" : "border-amber-200 bg-amber-50/50"
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[14px] font-bold tabular-nums",
                        done ? "bg-court-600 text-white" : "bg-amber-400 text-white"
                      )}
                    >
                      {done ? "✓" : n}
                    </span>
                    <span className="text-ink-900 truncate text-[15px] font-medium">{t.name}</span>
                  </span>
                  <span className="text-ink-600 shrink-0 text-[14px] font-semibold tabular-nums">
                    {n} / {GUARANTEE} games
                  </span>
                </div>
              )
            })}
          </div>
        </div>
        )}

      </div>
    </>
  )
}

/* ── End card ────────────────────────────────────────────────────────────── */

function EndCard() {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0b1628] px-12 text-white">
      <div className="live-pop max-w-[780px] text-center">
        <p className="text-gold-400 text-[15px] font-bold uppercase tracking-[0.18em]">
          A league chapter
        </p>
        <h3 className="font-display mt-2 text-[34px] font-extrabold leading-tight">
          A team drops out
        </h3>
        <p className="mt-3 text-[17px] leading-relaxed text-white/75">
          One approval withdrew the club, cancelled {CANCELLED} games, told{" "}
          {OPPONENT_CLUBS} opposing clubs and left the season&apos;s history intact. The schedule
          named the {SHORT_COUNT} teams it had shortchanged, and {NEW_GAMES} added games made them
          whole without moving a single one of the {GAMES_IN - CANCELLED} games already drawn.
        </p>
        <p className="mt-5 text-[15px] font-semibold text-white/50">Next: the referees</p>
      </div>
    </div>
  )
}
