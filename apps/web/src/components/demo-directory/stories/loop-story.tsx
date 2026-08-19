"use client"

import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import type { DemoBeat, DemoScript } from "../types"
import { AppIcon } from "./your-week-story"

/**
 * "Everyone in the loop", rebuilt 2026-08-16 to the gold standard and
 * completed 2026-08-19 to the REALISM standard (mock-ui.tsx R1–R8) on the
 * owner's ruling: every screen to the real component's anatomy, every flow to
 * its real end state, the OS drawn as the OS, and the balloons cut to the ones
 * that say something a screen cannot.
 *
 * WHAT THE 08-16 CUT HAD, AND WHY THIS ONE DOES NOT: white cards standing in
 * for chat bubbles (the product has asymmetric bubbles and a STAFF badge that
 * only the OTHER side sees), a hand-drawn notifications list with an invented
 * "the same change, by email" eyebrow over an invented email panel, a poll
 * whose percentages were computed out of the roster instead of the voters, a
 * refusal drawn inside the row instead of the page's own error banner, and a
 * poll chapter that stopped at a tinted option instead of pressing Vote.
 *
 * TWO HANDSETS. The LEFT one is Marcus Bell, the coach; the RIGHT one is
 * Jordan Reyes, a guardian on that team. Both sides are RESPONSIVE PAGES the
 * product already serves to a phone, so nothing here is a phone composition of
 * a desktop-only screen: /teams/[id]/calendar, /teams/[id]/chat,
 * /teams/[id]/polls and /notifications are the same pages on both.
 *
 * THE PRODUCT'S OWN LIMIT, FILMED RATHER THAN FAKED:
 *   `PATCH /api/teams/[id]/practices/[practiceId]` takes exactly three
 *   actions, `move` (with a new `scheduledAt`), `cancel` and `restore`. It
 *   cannot change a practice's VENUE. So this demo films the change the
 *   product really makes, a practice moved in time on the club's own event,
 *   with the gym named in the message because the gym is what families get
 *   wrong. The missing venue edit is punch 1 in `docs/roadmap/loop-numbers.md`
 *   rather than a fabricated screen.
 *
 * TRUTH TO THE PRODUCT, SCREEN BY SCREEN (R1: classes copied, files cited):
 *   · the team calendar is `teams/[teamId]/calendar/team-calendar.tsx` in its
 *     AGENDA projection (phones never get the grid, line 118): the notice and
 *     error banners at the top of the page, the practice-days card with its
 *     slot summary, `AddToPhone`'s "📅 Add to phone" and the staff Manage
 *     button, then `components/calendar/agenda-list.tsx` (sticky uppercase
 *     month header, the 60px date tile on the left rail) with the page's own
 *     practice / game cards. Staff get Move and Cancel plus `RsvpRollup`;
 *     families get `RsvpControl`, which is the same page telling two people
 *     two different things;
 *   · the Move controls are the real ones: two `DateTimePicker` triggers
 *     (min-h-[44px], `formatDisplay` writes the date as "Aug 18, 2026" and the
 *     time in 24 hour "18:30"), Save and Cancel;
 *   · the refusal is `intraOrgConflictMessage` in `lib/venues/conflicts.ts`
 *     line 184, verbatim except the em-dash the house rule turns into a
 *     middot, rendered where the page really renders it: the red banner at the
 *     TOP of the calendar, because `practiceAction` puts the 409's message in
 *     `error`. `DB` the club's own Grade 10 Girls practice really does sit on
 *     that court at 7:00 p.m. that evening;
 *   · the notification, the push and the email are the move branch of the
 *     practices PATCH route, word for word, and `practice_change` really is in
 *     `PUSH_TYPES` (lib/notifications.ts line 184), so the banner is not a
 *     flourish. The bell page is `app/(platform)/notifications/page.tsx`: the
 *     Inbox eyebrow chip, the display-face h1 with its unread count, "Mark all
 *     as read", and rows carrying read-state (`border-play-200 bg-play-50/30`
 *     + the play-500 dot) with the dismiss ×;
 *   · the email is the route's own `emailHtml`, rendered where email is really
 *     read: an iOS Mail reading view (R8 OS chrome), sender
 *     `SportsHubOne <no-reply@sportshubone.com>`, which is the live box sender;
 *   · the thread is `teams/[teamId]/chat/team-chat.tsx`: the pinned gold strip
 *     with 📌 and Unpin, the members bar, the day divider, and REAL bubbles,
 *     which is the screen the last cut got most wrong. Mine are right aligned
 *     and `bg-play-600 text-white` with no name over them; everyone else's are
 *     left aligned `bg-court-50` with the sender line, so the STAFF badge and
 *     the "Darius's parent" context (`getSenderContexts`) appear on the OTHER
 *     person's phone and never on your own. The hover row (Edit / Delete /
 *     Pin / React) and the reaction pills are the page's;
 *   · the poll is `components/polls/poll-card.tsx` on `teams/[teamId]/polls`,
 *     both sides of it: staff get Edit / Close / Delete and the voter names
 *     under each option, families get the same card without them. Percentages
 *     are the real arithmetic, `option.count / question.voterCount`, and the
 *     bars are relative to the LEADING option, not to the roster.
 *
 * TWO PRODUCT CORRECTIONS, DECLARED RATHER THAN HIDDEN (the demo shows what
 * the page means, and the gaps go in the numbers sheet):
 *   1. `notifications/page.tsx` writes `bg-white` and then `bg-play-50/30` in
 *      one class list, so the unread tint R2 asks for never wins and every row
 *      renders white. The demo tints the unread row.
 *   2. House copy law: the product's notification titles, the conflict message
 *      and the saved notice all carry em-dashes. The demo renders the middot,
 *      as every other story does.
 *
 * THE READ METER, STILL ABSENT AND STILL NOT DISCUSSED (owner's no-confession
 * rule: a demo does not stop to admit what it is missing).
 * `TeamChatRead(userId, teamId, lastReadAt)` is written on every read, but the
 * only reader is `getUnreadChatCounts`, which answers "how many have I not
 * read". Nothing answers "who has read mine". The chapter ends on the pin, and
 * the meter stays punch 2 in the numbers sheet for the product backlog.
 *
 * INVENTED-CONTENT LEDGER (everything not read out of the database):
 *   · the coach's name, Marcus Bell: the seed picks staff names per reset from
 *     its ADULT_NAMES / LAST_NAMES pools, so this is a pool name, not a
 *     fixture (the roster story declares the same one);
 *   · the thread's five messages, and the 👍 4 on the answer. The seeded
 *     thread is empty of this exchange. Carlos Diallo really is Ibrahim
 *     White's guardian in this database, so the earlier pair is at least cast
 *     out of the real team;
 *   · the other guardians' names on the poll's voter lines. Four of them are
 *     this club's real seeded guardians (Carlos Diallo, Robin Osei, Nadia Kim,
 *     Mark Young); the remaining five are pool names, because the seed does
 *     not record WHO voted for what;
 *   · Jordan's name is shown FIRST on the voter line when her vote lands. The
 *     API does not promise an order, and the line is `truncate`, so the newest
 *     vote is put where it can be seen;
 *   · the two older bell rows, which use real product titles ("Practice
 *     schedule · {team}" from the announce route, "New Team Offer" from
 *     `lib/offers/create-offer.ts`) on this world's own events;
 *   · the Mail app's chrome (nav bar, sender block, timestamps). OS, not
 *     product.
 *
 * COMPOSITION TRIMS (what a 390 by ~406 handset could not hold): the chat and
 * polls page headers drop their button pair (Polls / Team Chat / SmartBack),
 * none of which the story presses; the chat's mute row goes with them; the
 * calendar drops the staff "+ Add event" row (the row the sm-only Agenda /
 * Grid toggle shares, and a control the story never uses) so the error banner
 * and the acted row can be on screen together; the notifications panel is p-4
 * rather than p-6; and the polls card is filmed in its TWO SCROLL POSITIONS,
 * question one then question two with the Vote button, which is what a phone
 * really does with a two question poll. Below those positions each page keeps
 * scrolling exactly as the product does: the coach's Saturday game and the
 * third bell row sit under the fold rather than being deleted.
 *
 * `DB` THE TUESDAY PRACTICE IS THE SAME EVENT the your-week demo receives:
 * 6:30 becoming 8:00 on Darius's Tuesday at The Playground. Two ends of one
 * change, and the two stories are kept to the minute.
 */

/* ── Cast, all read out of the seeded world ──────────────────────────────── */

/** `DB` Tenant dcd497e7, "Toronto Lords". */
const CLUB = "Toronto Lords"
/** `DB` Team 77311a01, 10 ACTIVE players, 10 distinct guardians. */
const TEAM = "Toronto Lords Grade 9"
const GUARDIANS = 10
/** `ARITH` the ten guardians plus the head coach the seed puts on every team. */
const MEMBERS = GUARDIANS + 1

/**
 * `DB` Practice f256efde on that team: SCHEDULED, 2026-08-18T22:30Z, which is
 * 6:30 p.m. America/Toronto, 90 minutes, at The Playground.
 * `PRODUCT` `formatPracticeDate` writes "Tue, Aug 18, 6:30 p.m." in en-CA;
 * the agenda writes the same time as "6:30 PM".
 */
const OLD_WHEN = "Tue, Aug 18, 6:30 p.m."
const NEW_WHEN = "Tue, Aug 18, 8:00 p.m."
const OLD_TIME = "6:30 PM"
const NEW_TIME = "8:00 PM"
const GYM = "The Playground"
const DURATION = 90

/**
 * `PRODUCT` `DateTimePicker` `formatDisplay`: date mode writes "Aug 18, 2026",
 * time mode writes 24 hour. `PRODUCT` team-calendar.tsx line 743 seeds the
 * field with the practice's current time, so the picker opens at 18:30.
 */
const PICK_DATE = "Aug 18, 2026"
const PICK_NOW = "18:30"
const PICK_SEVEN = "19:00"
const PICK_EIGHT = "20:00"

/** `DB` the team's two practice slots. `PRODUCT` `formatSlotSummary`. */
const SLOT_SUMMARY = "Tuesdays 6:30 PM · Thursdays 7:00 PM"
const ANNOUNCED = "Schedule announced Aug 3"

/**
 * The refusal. `PRODUCT` `intraOrgConflictMessage`, verbatim except the
 * em-dash, which the house rule turns into a middot.
 */
const CONFLICT =
  'Your organization already has a practice at this venue then · "Toronto Lords Grade 10 Girls practice" (Aug 18, 7:00 p.m.). Pick a different time or venue.'

/** `PRODUCT` team-calendar.tsx line 254, the notice after any practice action
 *  (middot for the shipped em-dash). */
const NOTICE = "Change saved · the team has been notified."

/** `PRODUCT` the move branch of the practices PATCH route, lines 79 to 84. */
const NOTIF_TITLE = `Practice moved · ${TEAM}`
const NOTIF_MSG = `${OLD_WHEN} → ${NEW_WHEN}`
const EMAIL_SUBJECT = `Practice moved · ${TEAM}: now ${NEW_WHEN}`
const EMAIL_TAIL = "(subscribed phone calendars update automatically)"

/** `DB` the guardian this whole demo directory follows, and her son. */
const PARENT = "Jordan Reyes"
const PLAYER = "Darius Reyes"
const PLAYER_FIRST = "Darius"
/** `PRODUCT` `getSenderContexts`: one kid on the team reads "{first}'s parent". */
const SENDER_CONTEXT = `${PLAYER_FIRST}'s parent`

/** `SEED` a name from the ADULT_NAMES / LAST_NAMES pools. */
const COACH = "Marcus Bell"

/** `PRODUCT` `team-chat.tsx` composer placeholder. */
const CHAT_PLACEHOLDER = "Message the team…"
const QUESTION = "Is the door still on Century Dr at 8?"
const ANSWER = "Yes, Century Dr door. We are on Court 2."

/**
 * `DB` Poll d2a61a8d, "August tournament plans", OPEN, on this team, with two
 * real questions and their real vote counts.
 */
const POLL_TITLE = "August tournament plans"
const POLL_META_DATE = "Aug 14"

interface PollOption {
  id: string
  label: string
  count: number
  voters?: string[]
}
const Q1: { prompt: string; multi: boolean; voterCount: number; options: PollOption[] } = {
  prompt: "Should we enter the Waterloo Summer Classic? ($95/player)",
  multi: false,
  voterCount: 9,
  options: [
    {
      id: "yes",
      label: "Yes, count us in",
      count: 6,
      voters: ["Carlos Diallo", "Robin Osei", "Nadia Kim", "Mark Young", "Priya Anand", "Tom Beaulieu"],
    },
    { id: "carpool", label: "Yes, if we can carpool", count: 2, voters: ["Alicia Grant", "Ben Osei"] },
    { id: "no", label: "No, sitting this one out", count: 1, voters: ["Dana Whyte"] },
  ],
}
const Q2: { prompt: string; multi: boolean; voterCount: number; options: PollOption[] } = {
  prompt: "Which August weekends can your family travel?",
  multi: true,
  voterCount: 3,
  options: [
    { id: "w1", label: "Aug 8-9", count: 3, voters: ["Nadia Kim", "Mark Young", "Robin Osei"] },
    { id: "w2", label: "Aug 15-16", count: 3, voters: ["Nadia Kim", "Mark Young", "Carlos Diallo"] },
    { id: "w3", label: "Aug 22-23", count: 3, voters: ["Nadia Kim", "Robin Osei", "Carlos Diallo"] },
  ],
}

/** `PRODUCT` poll-card.tsx line 154: the share is out of the QUESTION's voters. */
const share = (count: number, voterCount: number) =>
  voterCount > 0 ? Math.round((count / voterCount) * 100) : 0

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

export const loopStory: DemoScript = {
  presentation: "scene",
  scenePhones: true,
  desktopUrl: "/teams/lords-grade-9/calendar",
  initialStage: "desktop",
  /* Who is driving (owner 2026-08-19): the desk is the COACH's calendar, the
     handset is the parent's — except for the two beats where the story shows
     the coach's own phone, annotated back to the coach explicitly. */
  roles: {
    desktop: { label: "Coach", tone: "club" },
    phone: { label: "Parent", tone: "parent" },
  },
  chapters: [
    { id: "change", title: "The change" },
    { id: "phones", title: "Every phone" },
    { id: "thread", title: "In the open" },
    { id: "poll", title: "The poll" },
  ],

  /* ENGINE LAW (learned on the roster conversion): a beat's `set` is applied
     the moment the beat STARTS, so a beat must never delete its own cursor
     target. Every press that swaps a screen presses on one beat and lands on
     the next, which is also how a press reads to a person. */
  beats: [
    /* ── 1. The change ────────────────────────────────────────────────── */
    paced({
      id: "open",
      chapter: "change",
      caption: `The coach's team calendar. Tuesday's practice at ${GYM} has to move.`,
      emphasize: "c-tue",
      callout: `${GUARDIANS} families already have this practice on their phones.`,
    }),
    paced({
      id: "move-press",
      chapter: "change",
      caption: "Move is on the practice itself.",
      cursor: "move-btn",
      press: true,
    }),
    paced({
      id: "move-open",
      chapter: "change",
      caption: "One date, one time, in place on the row. Nothing to write to anybody.",
      set: { view: "move" },
      emphasize: "time-field",
    }),
    paced({
      id: "pick-seven",
      chapter: "change",
      caption: "He tries seven o'clock.",
      cursor: "time-field",
      press: true,
      set: { picked: PICK_SEVEN },
    }),
    paced({
      id: "save-press",
      chapter: "change",
      caption: "Save.",
      cursor: "save-btn",
      press: true,
    }),
    paced({
      id: "refuse",
      chapter: "change",
      caption: "The product refuses that time, and names the booking in the way.",
      set: { conflict: true },
      emphasize: "c-error",
    }),
    paced({
      id: "pick-eight",
      chapter: "change",
      caption: "Eight o'clock, then.",
      cursor: "time-field",
      press: true,
      set: { picked: PICK_EIGHT, conflict: false },
    }),
    paced({
      id: "save-again",
      chapter: "change",
      caption: "Save.",
      cursor: "save-btn",
      press: true,
    }),
    paced({
      id: "saved",
      chapter: "change",
      caption: "Moved, and the team already told.",
      set: { view: "moved" },
      emphasize: "c-notice",
      callout: "Nobody was asked who to tell. The roster is the audience.",
    }),

    /* ── 2. Every phone ───────────────────────────────────────────────── */
    paced({
      id: "arrive",
      actor: "phone", // the parent still has the old time
      chapter: "phones",
      caption: `${PARENT} is one of those ${GUARDIANS} guardians, and still has the old time.`,
      stage: "split",
      emphasize: "p-tue",
    }),
    paced({
      id: "push",
      chapter: "phones",
      caption: "The push arrives the way a phone delivers things.",
      set: { banner: true },
      hold: 2800,
    }),
    paced({
      id: "tap",
      chapter: "phones",
      caption: "She taps it.",
      cursor: "p-push",
      press: true,
    }),
    paced({
      id: "landed",
      chapter: "phones",
      caption: "The same row, now at eight, with the answer she already gave still on it.",
      set: { banner: false, moved: true },
      emphasize: "p-tue",
    }),
    paced({
      id: "bell",
      chapter: "phones",
      caption: "The same change in the bell, unread.",
      set: { phone: "bell" },
      emphasize: "p-notif",
      callout: "One function writes the push, this row and the email, so the three cannot disagree.",
    }),
    paced({
      id: "email",
      chapter: "phones",
      caption: "And in her mail, where the last line ends the phone calls.",
      set: { phone: "email" },
      emphasize: "p-tail",
    }),

    /* ── 3. In the open ───────────────────────────────────────────────── */
    paced({
      id: "thread",
      chapter: "thread",
      caption: "She has a question about the door, and asks it in the team thread.",
      set: { phone: "chat", view: "chat" },
      emphasize: "p-thread",
    }),
    paced({
      id: "typing",
      chapter: "thread",
      caption: "She types it.",
      cursor: "p-composer",
      type: { key: "typed", text: QUESTION },
    }),
    paced({
      id: "send-press",
      chapter: "thread",
      caption: "Sent.",
      cursor: "p-send",
      press: true,
    }),
    paced({
      id: "asked",
      actor: "desktop", // the coach's OWN phone — coach, not parent
      chapter: "thread",
      caption: "On the coach's phone it arrives with who she is written under her name.",
      set: { asked: true },
      emphasize: "c-ask",
    }),
    paced({
      id: "answer",
      chapter: "thread",
      caption: "He answers once.",
      set: { answered: true },
      emphasize: "c-answer",
      callout: `One answer instead of ${GUARDIANS - 1} identical text messages.`,
    }),
    paced({
      id: "pin-press",
      chapter: "thread",
      caption: "And pins it.",
      cursor: "pin-btn",
      press: true,
    }),
    paced({
      id: "pinned",
      chapter: "thread",
      caption: "Pinned to the top of the thread, on every phone.",
      set: { pinned: true },
      emphasize: "p-pin",
      callout: "The family who opens this on Tuesday afternoon finds it without scrolling.",
    }),

    /* ── 4. The poll ──────────────────────────────────────────────────── */
    paced({
      id: "poll-open",
      chapter: "poll",
      caption: "The same team, and an open poll about the August tournament.",
      set: { view: "poll", phone: "poll" },
      emphasize: "p-poll",
      callout: "The fee is in the question, so nobody votes yes and then asks the price.",
    }),
    paced({
      id: "vote-one",
      chapter: "poll",
      caption: "She picks hers.",
      cursor: "p-opt-yes",
      press: true,
      set: { pick1: true },
    }),
    paced({
      id: "second-question",
      chapter: "poll",
      caption: "The second question takes any number of answers.",
      set: { pScroll: true },
      emphasize: "p-q2",
    }),
    paced({
      id: "weekend-one",
      actor: "phone", // the parent answers the poll
      chapter: "poll",
      caption: "Two weekends work for them.",
      cursor: "p-opt-w2",
      press: true,
      set: { pickA: true },
    }),
    paced({
      id: "weekend-two",
      chapter: "poll",
      caption: "And the one after it.",
      cursor: "p-opt-w3",
      press: true,
      set: { pickB: true },
    }),
    paced({
      id: "submit",
      chapter: "poll",
      caption: "One press answers both questions.",
      cursor: "p-vote-btn",
      press: true,
    }),
    paced({
      id: "voted",
      chapter: "poll",
      caption: "Recorded, and still hers to change.",
      set: { voted: true },
      emphasize: "p-vote-foot",
    }),
    paced({
      id: "coach-count",
      actor: "desktop", // the count moves on the coach's phone
      chapter: "poll",
      caption: "On the coach's phone the count moves.",
      emphasize: "c-opt-yes",
      callout: "Staff see the names under each option. A family only ever sees the count.",
    }),
    paced({
      id: "coach-weekends",
      chapter: "poll",
      caption: "A count per weekend, rather than a scroll through replies.",
      set: { cScroll: true },
      emphasize: "c-q2",
    }),
    paced({
      id: "end",
      chapter: "poll",
      caption:
        "A practice moved in two presses, ten families told without a list, the question answered where all of them could read it, and the weekend settled by a count.",
      hold: 4400,
      set: { endCard: true },
    }),
  ],

  /* ── Render ────────────────────────────────────────────────────────── */

  render: ({ get, typingKey }) => {
    const view = get<string>("view", "calendar")
    const asked = get("asked", false)
    const answered = get("answered", false)
    const pinned = get("pinned", false)
    const voted = get("voted", false)

    const coach = (
      <div className="relative flex h-full flex-col">
        <CoachPhone
          view={view}
          picked={get<string>("picked", PICK_NOW)}
          conflict={get("conflict", false)}
          asked={asked}
          answered={answered}
          pinned={pinned}
          voted={voted}
          scrolled={get("cScroll", false)}
        />
        {get("endCard", false) && <EndCard />}
      </div>
    )

    const parent = (
      <ParentPhone
        view={get<string>("phone", "team-cal")}
        moved={get("moved", false)}
        banner={get("banner", false)}
        typed={get<string>("typed", "")}
        typing={typingKey === "typed"}
        asked={asked}
        answered={answered}
        pinned={pinned}
        pick1={get("pick1", false)}
        pickA={get("pickA", false)}
        pickB={get("pickB", false)}
        voted={voted}
        scrolled={get("pScroll", false)}
      />
    )

    return {
      desktop: coach,
      phone: parent,
      frameLabels: { left: `${COACH} · coach`, right: `${PARENT} · parent` },
    }
  },
}

/* ── Shared atoms, copied from the pages themselves ──────────────────────── */

/** `agenda-list.tsx` lines 81 to 84: the sticky uppercase month header. */
function MonthHeader() {
  return (
    <div className="bg-ink-50/95 -mx-1 px-1 py-1.5">
      <p className="text-ink-500 text-xs font-bold uppercase tracking-widest">August 2026</p>
    </div>
  )
}

/** `agenda-list.tsx` lines 98 to 112: the 60px date tile and the day's items. */
function AgendaDay({ day, weekday, children }: { day: string; weekday: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="bg-ink-100/70 text-ink-700 flex h-[60px] w-[60px] shrink-0 flex-col items-center justify-center rounded-2xl">
        <span className="text-2xl font-extrabold leading-none">{day}</span>
        <span className="text-ink-400 mt-0.5 text-[10px] font-semibold uppercase">{weekday}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">{children}</div>
    </div>
  )
}

/** `team-calendar.tsx` lines 740 to 769: the staff Move / Cancel pair. */
function StaffButton({ id, children, danger }: { id?: string; children: ReactNode; danger?: boolean }) {
  return (
    <span
      data-demo-target={id}
      className={cn(
        "rounded-lg border px-2.5 py-1 text-xs font-semibold",
        danger ? "border-red-200 text-red-600" : "border-ink-200 text-ink-600"
      )}
    >
      {children}
    </span>
  )
}

/** `date-time-picker.tsx` line 242: the picker trigger, date or time faced. */
function PickerTrigger({
  id,
  value,
  mode,
  className,
}: {
  id?: string
  value: string
  mode: "date" | "time"
  className: string
}) {
  return (
    <span
      data-demo-target={id}
      className={cn(
        "border-ink-200 text-ink-900 flex min-h-[44px] cursor-pointer items-center justify-between gap-1 rounded-xl border bg-white px-3 py-2.5 text-left text-sm shadow-sm",
        className
      )}
    >
      <span className="truncate">{value}</span>
      <svg
        className="text-ink-400 h-4 w-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        {mode === "time" ? (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" strokeLinecap="round" />
          </>
        ) : (
          <>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
          </>
        )}
      </svg>
    </span>
  )
}

/** `rsvp-control.tsx` OPTIONS: the family's three answer buttons. */
function RsvpButtons({ answer }: { answer: "GOING" | "MAYBE" | "NOT_GOING" | null }) {
  const opts = [
    { key: "GOING", mark: "✓", label: "Going", on: "border-court-600 bg-court-600 text-white" },
    { key: "MAYBE", mark: "?", label: "Maybe", on: "border-amber-500 bg-amber-500 text-white" },
    { key: "NOT_GOING", mark: "✕", label: "Can't go", on: "border-red-600 bg-red-600 text-white" },
  ] as const
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {opts.map((o) => (
        <span
          key={o.key}
          className={cn(
            "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[13px] font-bold",
            answer === o.key ? o.on : "border-ink-200 text-ink-600"
          )}
        >
          <span aria-hidden="true">{o.mark}</span>
          {o.label}
        </span>
      ))}
    </div>
  )
}

/* ── The team calendar, one page telling two people two things ───────────── */

/** `/teams/[teamId]/calendar` — the agenda a phone is forced into. */
function TeamCalendar({
  staff,
  stage,
  picked,
  conflict,
  moved,
}: {
  staff: boolean
  /** Staff only: "calendar" | "move" | "moved". */
  stage?: string
  picked?: string
  conflict?: boolean
  /** Family only: the practice has been moved under her. */
  moved?: boolean
}) {
  const moving = stage === "move"
  const done = stage === "moved" || moved
  const time = done ? NEW_TIME : OLD_TIME
  return (
    <div className="h-full space-y-2 overflow-hidden px-3 py-2.5">
      {/* The page's own banners: the notice on success, the error on a 409. */}
      {conflict && (
        <p data-demo-target="c-error" className="live-pop rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">
          {CONFLICT}
        </p>
      )}
      {stage === "moved" && (
        <p data-demo-target="c-notice" className="bg-court-50 text-court-700 live-pop rounded-xl px-4 py-2 text-sm">
          {NOTICE}
        </p>
      )}

      {/* Practice days summary + staff manage. */}
      <div className="border-ink-100 rounded-2xl border bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-ink-800 text-sm font-semibold">{SLOT_SUMMARY}</p>
            <p className="text-ink-400 mt-0.5 text-xs">{ANNOUNCED}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="border-ink-200 text-ink-700 rounded-xl border px-3 py-1.5 text-xs font-semibold">
              📅 Add to phone
            </span>
            {staff && (
              <span className="border-ink-200 text-ink-700 rounded-xl border px-3 py-1.5 text-xs font-semibold">
                Manage
              </span>
            )}
          </div>
        </div>
      </div>

      <div>
        <MonthHeader />
        <div className="space-y-3 py-2">
          <AgendaDay day="18" weekday="Tue">
            {/* The card is the page's, unchanged: a moved practice gets no
                tint in the product, so the change is the TIME changing and
                the demo's own arrival motion, nothing invented. */}
            <div
              key={time}
              data-demo-target={staff ? "c-tue" : "p-tue"}
              className={cn(
                "border-ink-100 rounded-xl border bg-white px-4 py-2.5",
                done && "live-row-in"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-ink-800 text-sm font-semibold">Practice · {time}</p>
                  <p className="text-ink-400 text-xs">
                    {DURATION} min · {GYM}
                  </p>
                </div>
                {staff && !moving && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <StaffButton id="move-btn">Move</StaffButton>
                    <StaffButton danger>Cancel</StaffButton>
                  </div>
                )}
                {staff && moving && (
                  /* The real cluster is `flex shrink-0`, which at 390 pushes
                     Save and Cancel off the card. A phone wraps them under the
                     two pickers, which is what this width really does. */
                  <div className="flex w-full flex-wrap items-center gap-1.5">
                    <PickerTrigger value={PICK_DATE} mode="date" className="w-36" />
                    <PickerTrigger id="time-field" value={picked ?? PICK_NOW} mode="time" className="w-28" />
                    <span
                      data-demo-target="save-btn"
                      className="bg-play-600 rounded-lg px-2.5 py-1 text-xs font-semibold text-white data-[demo-press=true]:brightness-95"
                    >
                      Save
                    </span>
                    <span className="text-ink-500 text-xs font-semibold">Cancel</span>
                  </div>
                )}
              </div>
              <div className="border-ink-100 mt-2 border-t pt-2">
                {staff ? (
                  <span className="text-ink-500 text-xs font-medium">
                    6 going · 1 out · 2 maybe · 1 no reply ▾
                  </span>
                ) : (
                  <RsvpButtons answer="GOING" />
                )}
              </div>
            </div>
          </AgendaDay>

          <AgendaDay day="20" weekday="Thu">
            <div className="border-ink-100 rounded-xl border bg-white px-4 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-ink-800 text-sm font-semibold">Practice · 7:00 PM</p>
                  <p className="text-ink-400 text-xs">
                    {DURATION} min · {GYM}
                  </p>
                </div>
                {staff && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <StaffButton>Move</StaffButton>
                    <StaffButton danger>Cancel</StaffButton>
                  </div>
                )}
              </div>
              <div className="border-ink-100 mt-2 border-t pt-2">
                {staff ? (
                  <span className="text-ink-500 text-xs font-medium">
                    5 going · 3 maybe · 2 no reply ▾
                  </span>
                ) : (
                  <RsvpButtons answer={null} />
                )}
              </div>
            </div>
          </AgendaDay>

          {/* `DB` the Saturday league game, the same one the your-week demo
              answers. Games carry the play tint on this page. */}
          <AgendaDay day="22" weekday="Sat">
            <div className="border-play-200 bg-play-50/50 rounded-xl border px-4 py-2.5">
              <p className="text-ink-800 text-sm font-semibold">
                Game · 9:00 AM vs Oakville Panthers Grade 9
              </p>
              <p className="text-ink-400 text-xs">{GYM}</p>
            </div>
          </AgendaDay>
        </div>
      </div>
    </div>
  )
}

/* ── The team thread ─────────────────────────────────────────────────────── */

interface Msg {
  id: string
  who: string
  body: string
  time: string
  staff: boolean
  /** The family context line the product writes under a guardian's name. */
  context?: string
  reactions?: Array<{ emoji: string; count: number; mine: boolean }>
  fresh?: boolean
}

/** `team-chat.tsx` lines 554 to 700: one bubble, from the reader's side. */
function Bubble({
  msg,
  mine,
  pin,
  target,
}: {
  msg: Msg
  mine: boolean
  pin?: boolean
  target?: string
}) {
  return (
    <div className={cn("group mb-2 flex", mine ? "justify-end" : "justify-start", msg.fresh && "live-row-in")}>
      <div
        data-demo-target={target}
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2",
          mine ? "bg-play-600 text-white" : "bg-court-50 text-ink-900"
        )}
      >
        {!mine && (
          <div className="mb-0.5 flex items-center gap-1.5">
            <span className="text-ink-800 text-xs font-semibold">
              {msg.who}
              {msg.context && <span className="text-ink-400 font-normal"> · {msg.context}</span>}
            </span>
            {msg.staff && (
              <span className="bg-play-100 text-play-700 rounded-full px-1.5 py-px text-[10px] font-bold">
                STAFF
              </span>
            )}
          </div>
        )}
        <p className="whitespace-pre-line break-words text-sm">{msg.body}</p>
        <div
          className={cn(
            "mt-0.5 flex items-center justify-end gap-2 text-[10px]",
            mine ? "text-play-100" : "text-ink-400"
          )}
        >
          {pin && (
            <span data-demo-target="pin-btn" className="font-semibold underline underline-offset-2">
              Pin
            </span>
          )}
          <span>{msg.time}</span>
        </div>
        {msg.reactions && (
          <div className="mt-1 flex flex-wrap gap-1">
            {msg.reactions.map((r) => (
              <span
                key={r.emoji}
                className={cn(
                  "rounded-full border px-1.5 py-0.5 text-xs",
                  r.mine ? "border-play-300 bg-play-50 text-play-700" : "border-ink-200 bg-white text-ink-600"
                )}
              >
                {r.emoji} {r.count}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** `/teams/[teamId]/chat` from one side of it. */
function TeamThread({
  me,
  asked,
  answered,
  pinned,
  typed,
  typing,
  target,
}: {
  me: "coach" | "parent"
  asked: boolean
  answered: boolean
  pinned: boolean
  typed?: string
  typing?: boolean
  /** `data-demo-target` for the thread as a whole. */
  target?: string
}) {
  const coachSide = me === "coach"
  /* An existing thread, not an empty one: the two messages above hers are
     what a team chat looks like on any Monday, and they scroll off the top as
     new ones arrive, exactly as the real list does. */
  const messages: Msg[] = [
    {
      id: "m0",
      who: "Carlos Diallo",
      context: "Ibrahim's parent",
      body: "Is there a game Saturday, or just the practice?",
      time: "3:58 p.m.",
      staff: false,
    },
    {
      id: "m0b",
      who: COACH,
      body: "Game Saturday, 9:00 at The Playground, Court 1.",
      time: "4:02 p.m.",
      staff: true,
    },
    {
      id: "m1",
      who: COACH,
      body: "Bring both jerseys Saturday, we are the home team.",
      time: "4:41 p.m.",
      staff: true,
    },
  ]
  if (asked) {
    messages.push({
      id: "m2",
      who: PARENT,
      context: SENDER_CONTEXT,
      body: QUESTION,
      time: "5:14 p.m.",
      staff: false,
      fresh: true,
    })
  }
  if (answered) {
    messages.push({
      id: "m3",
      who: COACH,
      body: ANSWER,
      time: "5:15 p.m.",
      staff: true,
      reactions: [{ emoji: "👍", count: 4, mine: !coachSide }],
      fresh: true,
    })
  }

  return (
    <div className="flex h-full flex-col px-3 py-2.5">
      {/* The page header, trimmed of its button pair. */}
      <div className="mb-2 min-w-0 shrink-0">
        <h2 className="text-ink-900 truncate text-xl font-bold">{TEAM}</h2>
        <p className="text-ink-500 truncate text-sm">{CLUB} • Team chat</p>
      </div>

      <div className="border-ink-100 shadow-soft flex min-h-0 flex-1 flex-col rounded-2xl border bg-white">
        {pinned && (
          <div
            data-demo-target={coachSide ? "c-pin" : "p-pin"}
            className="border-gold-100 bg-gold-50 live-pop shrink-0 border-b px-4 py-2"
          >
            <div className="flex items-start gap-2 py-0.5">
              <span className="text-gold-600 mt-0.5 text-xs" aria-hidden="true">
                📌
              </span>
              <p className="text-ink-800 min-w-0 flex-1 truncate text-xs">
                <span className="font-semibold">{COACH}:</span> {ANSWER}
              </p>
              {coachSide && <span className="text-gold-600 shrink-0 text-[10px] font-semibold">Unpin</span>}
            </div>
          </div>
        )}

        <div className="border-ink-100 shrink-0 border-b">
          <div className="text-ink-600 flex w-full items-center justify-between px-4 py-2 text-xs font-semibold">
            <span>{MEMBERS} members</span>
            <span className="text-ink-400">Show ▾</span>
          </div>
        </div>

        <div
          data-demo-target={target}
          className="flex min-h-0 flex-1 flex-col justify-end overflow-hidden p-3"
        >
          <div className="my-2 shrink-0 text-center">
            <span className="bg-court-50 text-ink-400 rounded-full px-3 py-0.5 text-[11px] font-medium">
              Today
            </span>
          </div>
          {messages.map((m) => (
            <Bubble
              key={m.id}
              msg={m}
              mine={coachSide ? m.staff : !m.staff}
              pin={coachSide && m.id === "m3" && !pinned}
              target={
                coachSide && m.id === "m2"
                  ? "c-ask"
                  : coachSide && m.id === "m3"
                    ? "c-answer"
                    : undefined
              }
            />
          ))}
        </div>

        <div className="border-ink-100 flex shrink-0 gap-2 border-t p-3">
          <span className="border-ink-200 text-ink-500 shrink-0 rounded-xl border px-3 py-2.5 text-sm font-semibold">
            📊
          </span>
          <span
            data-demo-target={coachSide ? undefined : "p-composer"}
            className={cn(
              "border-ink-200 min-w-0 flex-1 truncate rounded-xl border px-3.5 py-2.5 text-sm",
              !coachSide && typed && !asked ? "text-ink-900" : "text-ink-400"
            )}
          >
            {!coachSide && typed && !asked ? typed : CHAT_PLACEHOLDER}
            {typing && <span className="bg-play-600 ml-0.5 inline-block h-4 w-[2px] align-middle" />}
          </span>
          <span
            data-demo-target={coachSide ? undefined : "p-send"}
            className={cn(
              "bg-play-600 shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold text-white data-[demo-press=true]:brightness-95",
              coachSide && "opacity-50"
            )}
          >
            Send
          </span>
        </div>
      </div>
    </div>
  )
}

/* ── The poll, both sides of the same card ───────────────────────────────── */

/** `poll-card.tsx` QuestionBlock, lines 127 to 194. */
function QuestionBlock({
  id,
  prompt,
  multi,
  voterCount,
  options,
  staff,
  chosen,
  mine,
  flash,
  idPrefix,
  clip,
}: {
  id?: string
  prompt: string
  multi: boolean
  voterCount: number
  options: PollOption[]
  staff: boolean
  /** Tapped but not submitted: the real card rings these and nothing else. */
  chosen: Set<string>
  /** Submitted and hers: only these carry "✓ your pick". */
  mine: Set<string>
  /** Option ids that just changed, for the count pop. */
  flash?: Set<string>
  idPrefix: string
  /** Mid-scroll: the prompt has scrolled off and only the last N options show. */
  clip?: number
}) {
  const maxCount = Math.max(1, ...options.map((o) => o.count))
  const shown = clip ? options.slice(-clip) : options
  return (
    <div data-demo-target={id}>
      {!clip && (
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-ink-800 text-sm font-semibold">{prompt}</p>
          <p className="text-ink-400 shrink-0 text-[11px]">
            {multi ? "Pick any" : "Pick one"} · {voterCount} voted
          </p>
        </div>
      )}
      <div className={cn("space-y-1.5", !clip && "mt-2")}>
        {shown.map((o) => {
          const selected = chosen.has(o.id)
          return (
            <div
              key={o.id}
              data-demo-target={`${idPrefix}-opt-${o.id}`}
              className={cn(
                "relative block w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-sm",
                selected ? "border-play-400 ring-play-200 ring-1" : "border-ink-100"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-y-0 left-0 transition-[width] duration-500 motion-reduce:transition-none",
                  selected ? "bg-play-100" : "bg-ink-50"
                )}
                style={{ width: `${(o.count / maxCount) * 100}%` }}
              />
              <span className="relative flex items-center justify-between gap-2">
                <span className="text-ink-800 min-w-0 truncate">
                  {o.label}
                  {mine.has(o.id) && (
                    <span className="text-play-600 ml-1.5 text-xs font-semibold">✓ your pick</span>
                  )}
                </span>
                <span
                  className={cn(
                    "text-ink-500 shrink-0 text-xs font-semibold",
                    flash?.has(o.id) && "live-pop"
                  )}
                >
                  {o.count} · {share(o.count, voterCount)}%
                </span>
              </span>
              {staff && o.voters && o.voters.length > 0 && (
                <span
                  className={cn(
                    "text-ink-400 relative mt-0.5 block truncate text-[11px]",
                    flash?.has(o.id) && "live-row-in"
                  )}
                >
                  {o.voters.join(", ")}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** `/teams/[teamId]/polls`, filmed in its two scroll positions. */
function PollScreen({
  staff,
  scrolled,
  pick1,
  pickA,
  pickB,
  voted,
}: {
  staff: boolean
  scrolled: boolean
  pick1: boolean
  pickA: boolean
  pickB: boolean
  voted: boolean
}) {
  const prefix = staff ? "c" : "p"
  /* Her vote only moves the counts once it is SUBMITTED, which is what the
     real page does: tapping an option is a selection, not a vote. */
  const q1Options = Q1.options.map((o) =>
    voted && o.id === "yes"
      ? { ...o, count: o.count + 1, voters: [PARENT, ...(o.voters ?? [])] }
      : o
  )
  const q2Options = Q2.options.map((o) =>
    voted && (o.id === "w2" || o.id === "w3")
      ? { ...o, count: o.count + 1, voters: [PARENT, ...(o.voters ?? [])] }
      : o
  )
  const q1Voters = Q1.voterCount + (voted ? 1 : 0)
  const q2Voters = Q2.voterCount + (voted ? 1 : 0)
  const total = 9 + (voted ? 1 : 0)

  const q1Chosen = new Set<string>(staff ? [] : pick1 ? ["yes"] : [])
  const q2Chosen = new Set<string>(
    staff ? [] : [...(pickA ? ["w2"] : []), ...(pickB ? ["w3"] : [])]
  )
  const q1Mine = new Set<string>(!staff && voted ? ["yes"] : [])
  const q2Mine = new Set<string>(!staff && voted ? ["w2", "w3"] : [])
  const flash = voted ? new Set(["yes", "w2", "w3"]) : undefined

  return (
    <div className="h-full overflow-hidden px-3 py-2.5">
      {/* The page header, trimmed of its button pair. */}
      {!scrolled && (
        <div className="mb-3 min-w-0">
          <h2 className="text-ink-900 truncate text-xl font-bold">{TEAM}</h2>
          <p className="text-ink-500 truncate text-sm">{CLUB} • Polls &amp; surveys</p>
        </div>
      )}

      {/* Two questions and a Vote button do not fit one handset, so the card
          is filmed in its two scroll positions: question one, then question
          two with the button, the tail of question one still above it. */}
      <div
        data-demo-target={`${prefix}-poll`}
        className={cn(
          "border-ink-100 border bg-white p-4 shadow-sm",
          scrolled ? "rounded-b-2xl border-t-0 pt-0" : "rounded-2xl"
        )}
      >
        {!scrolled && (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-ink-900 truncate text-base font-bold">{POLL_TITLE}</h3>
                <span className="bg-court-50 text-court-700 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                  Open
                </span>
              </div>
              <p className="text-ink-400 mt-0.5 text-xs">
                {COACH} · {POLL_META_DATE} · {total} votes
              </p>
            </div>
            {staff && (
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="border-ink-200 text-ink-600 rounded-lg border px-2.5 py-1 text-xs font-semibold">
                  Close
                </span>
                <span className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600">
                  Delete
                </span>
              </div>
            )}
          </div>
        )}

        <div className={cn("space-y-5", !scrolled && "mt-4")}>
          <QuestionBlock
            id={scrolled ? undefined : `${prefix}-q1`}
            prompt={Q1.prompt}
            multi={Q1.multi}
            voterCount={q1Voters}
            options={q1Options}
            staff={staff}
            chosen={q1Chosen}
            mine={q1Mine}
            flash={flash}
            idPrefix={prefix}
            clip={scrolled ? (staff ? 1 : 2) : undefined}
          />
          <QuestionBlock
            id={`${prefix}-q2`}
            prompt={Q2.prompt}
            multi={Q2.multi}
            voterCount={q2Voters}
            options={q2Options}
            staff={staff}
            chosen={q2Chosen}
            mine={q2Mine}
            flash={flash}
            idPrefix={prefix}
          />
        </div>

        <div
          data-demo-target={`${prefix}-vote-foot`}
          className="mt-4 flex items-center justify-between gap-3"
        >
          {/* `answeredAll` is per READER: the coach has not voted in his own
              poll, so his footer keeps asking him to. */}
          <p className="text-ink-400 text-xs">
            {!staff && voted
              ? "You've voted. Pick different options to change your answer."
              : "Tap an option to choose, then submit."}
          </p>
          <span
            data-demo-target={staff ? undefined : "p-vote-btn"}
            className={cn(
              "bg-play-600 shrink-0 rounded-xl px-4 py-2 text-sm font-semibold text-white data-[demo-press=true]:brightness-95",
              (staff || !pick1) && "opacity-40"
            )}
          >
            {!staff && voted ? "Update Vote" : "Vote"}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ── The coach's handset ─────────────────────────────────────────────────── */

function CoachPhone({
  view,
  picked,
  conflict,
  asked,
  answered,
  pinned,
  voted,
  scrolled,
}: {
  view: string
  picked: string
  conflict: boolean
  asked: boolean
  answered: boolean
  pinned: boolean
  voted: boolean
  scrolled: boolean
}) {
  const screen = view === "chat" ? "chat" : view === "poll" ? "poll" : "calendar"
  return (
    <div className="flex h-full flex-col bg-[#f6f7f9]">
      <div className="flex items-baseline gap-2 bg-[#0b1628] px-4 pb-2 pt-1.5 text-white">
        <p className="text-[14px] font-bold leading-tight">{COACH}</p>
        <p className="text-[12px] font-medium text-white/60">Head coach · {TEAM}</p>
      </div>

      <div key={screen} className="demo-fade-in relative min-h-0 flex-1 overflow-hidden">
        {screen === "calendar" && (
          <TeamCalendar staff stage={view} picked={picked} conflict={conflict} />
        )}
        {screen === "chat" && (
          <TeamThread me="coach" asked={asked} answered={answered} pinned={pinned} />
        )}
        {screen === "poll" && (
          <PollScreen staff scrolled={scrolled} pick1={false} pickA={false} pickB={false} voted={voted} />
        )}
      </div>

      <TabBar
        tabs={["Home", "Chat", "Calendar", "My Team", "Social"]}
        active={screen === "chat" ? "Chat" : screen === "poll" ? "My Team" : "Calendar"}
      />
    </div>
  )
}

/* ── The parent's handset ────────────────────────────────────────────────── */

function ParentPhone({
  view,
  moved,
  banner,
  typed,
  typing,
  asked,
  answered,
  pinned,
  pick1,
  pickA,
  pickB,
  voted,
  scrolled,
}: {
  view: string
  moved: boolean
  banner: boolean
  typed: string
  typing: boolean
  asked: boolean
  answered: boolean
  pinned: boolean
  pick1: boolean
  pickA: boolean
  pickB: boolean
  voted: boolean
  scrolled: boolean
}) {
  const under = view === "email" ? "bell" : view
  return (
    <div className="relative flex h-full flex-col bg-[#f6f7f9]">
      <div className="flex items-baseline gap-2 bg-[#0b1628] px-4 pb-2 pt-1.5 text-white">
        <p className="text-[14px] font-bold leading-tight">{PARENT}</p>
        <p className="text-[12px] font-medium text-white/60">Parent · {PLAYER_FIRST} and Danielle</p>
      </div>

      <div key={under} className="demo-fade-in relative min-h-0 flex-1 overflow-hidden">
        {under === "team-cal" && <TeamCalendar staff={false} moved={moved} />}
        {under === "bell" && <Bell />}
        {under === "chat" && (
          <TeamThread
            me="parent"
            asked={asked}
            answered={answered}
            pinned={pinned}
            typed={typed}
            typing={typing}
            target="p-thread"
          />
        )}
        {under === "poll" && (
          <PollScreen
            staff={false}
            scrolled={scrolled}
            pick1={pick1}
            pickA={pickA}
            pickB={pickB}
            voted={voted}
          />
        )}
      </div>

      {/* OS chrome sits over the whole handset, tab bar included. */}
      {view === "email" && <MailTakeover />}
      {banner && <PushBanner />}

      <TabBar
        tabs={["Home", "Chat", "Calendar", "My Kids", "Social"]}
        active={
          under === "chat"
            ? "Chat"
            : under === "team-cal"
              ? "Calendar"
              : under === "poll"
                ? "My Kids"
                : "Home"
        }
      />
    </div>
  )
}

/** An iOS-style push dropping from the top of the handset (R8). */
function PushBanner() {
  return (
    <div className="demo-banner-in absolute left-1.5 right-1.5 top-1.5 z-30">
      <div
        data-demo-target="p-push"
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
            <p className="text-ink-950 text-[13px] font-semibold leading-tight">{NOTIF_TITLE}</p>
            <p className="text-ink-600 text-[12px] leading-snug">{NOTIF_MSG}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** `/notifications` — the bell page, with its read-state tints. */
function Bell() {
  return (
    <div className="h-full space-y-2 overflow-hidden px-3 py-2.5">
      <p className="text-ink-500 text-xs font-semibold">← Account</p>

      <div className="border-ink-100 shadow-soft rounded-[28px] border bg-white p-4">
        <div className="border-play-100 bg-play-50 text-play-600 mb-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
          Inbox
        </div>
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-ink-950 text-2xl font-bold">
            Notifications
            <span className="text-ink-500 ml-2 text-sm font-normal">(1 unread)</span>
          </h1>
          <span className="text-play-600 shrink-0 text-sm font-semibold">Mark all as read</span>
        </div>
      </div>

      <div className="space-y-2">
        <NotifRow
          id="p-notif"
          title={NOTIF_TITLE}
          message={NOTIF_MSG}
          when="Aug 17, 5:12 PM"
          unread
        />
        <NotifRow
          title={`Practice schedule · ${TEAM}`}
          message={SLOT_SUMMARY}
          when="Aug 3, 9:04 AM"
        />
        <NotifRow
          title="New Team Offer"
          message={`${CLUB} has sent an offer for ${PLAYER} to join Lords Grade 10 Fall/Winter 2026-27.`}
          when="Jul 28, 6:15 PM"
        />
      </div>
    </div>
  )
}

/** `notifications/page.tsx` lines 195 to 260, one row. */
function NotifRow({
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
        /* PRODUCT CORRECTION: the shipped row writes `bg-white` and then
           `bg-play-50/30` in the same class list, so the unread tint R2 asks
           for never wins and every row renders white. The demo renders what
           the page means. Written down in the numbers sheet. */
        "shadow-soft rounded-2xl border p-4",
        unread ? "border-play-200 bg-play-50/40" : "border-ink-100 bg-white"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className={cn("text-sm font-semibold", unread ? "text-ink-900" : "text-ink-700")}>
              {title}
            </h3>
            {unread && <span className="bg-play-500 h-2 w-2 shrink-0 rounded-full" />}
          </div>
          <p className="text-ink-600 mt-1 text-sm">{message}</p>
          <p className="text-ink-400 mt-1 text-xs">{when}</p>
        </div>
        <span className="text-ink-300 ml-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm">
          ✕
        </span>
      </div>
    </div>
  )
}

/**
 * The Mail app taking the screen (R8): OS chrome around the route's own
 * `emailHtml`, rendered the way an unstyled email really renders.
 */
function MailTakeover() {
  return (
    <div className="demo-fade-in absolute inset-0 z-30 flex flex-col bg-white">
      <div className="border-ink-100 flex shrink-0 items-center justify-between border-b bg-[#f7f7f9] px-3 py-2.5">
        <span className="text-[15px] font-medium text-[#0b5fd7]">‹ Inbox</span>
        <span className="flex items-center gap-4 text-[#0b5fd7]" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinecap="round" />
          </svg>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M9 14 4 9l5-5M4 9h9a7 7 0 0 1 7 7v3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-4 py-3">
        <p className="text-ink-950 text-[19px] font-bold leading-tight">{EMAIL_SUBJECT}</p>
        <div className="mt-3 flex items-center gap-2.5">
          <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full">
            <AppIcon className="h-9 w-9" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-ink-950 text-[14px] font-semibold">SportsHub One</p>
            <p className="text-ink-500 truncate text-[12.5px]">To: {PARENT}</p>
          </div>
          <p className="text-ink-400 shrink-0 text-[12.5px]">5:12 PM</p>
        </div>

        <div className="border-ink-100 text-ink-900 mt-3 space-y-3 border-t pt-3 text-[15px] leading-relaxed">
          <p>
            A <strong>{TEAM}</strong> practice moved:
          </p>
          <p>
            <s className="text-ink-400">{OLD_WHEN}</s> → <strong>{NEW_WHEN}</strong> at {GYM}
          </p>
          <p data-demo-target="p-tail">
            <span className="text-[#0b5fd7] underline">Team calendar</span> {EMAIL_TAIL}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── Shared ──────────────────────────────────────────────────────────────── */

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

function EndCard(): ReactNode {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0b1628] px-8 text-white">
      <div className="live-pop max-w-[340px] text-center">
        <p className="text-gold-400 text-[15px] font-bold uppercase tracking-[0.18em]">
          A club story
        </p>
        <h3 className="font-display mt-2 text-[26px] font-extrabold leading-tight">
          Everyone in the loop
        </h3>
        <p className="mt-3 text-[15px] leading-relaxed text-white/75">
          A practice moved in two presses, refused once by the club&apos;s own booking with that
          booking named, then ten families told by push, bell and email with nobody building a list.
          The question answered where all ten could read it, pinned for whoever reads it late, and
          the tournament weekend settled by a count.
        </p>
        <p className="mt-4 text-[14px] font-semibold text-white/50">Next: your week</p>
      </div>
    </div>
  )
}
