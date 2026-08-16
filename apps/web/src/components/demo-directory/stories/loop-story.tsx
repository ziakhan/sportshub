"use client"

import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import { Btn, Chip, StatusChip } from "../scene-kit"
import type { DemoBeat, DemoScript } from "../types"

/**
 * "Everyone in the loop", rebuilt 2026-08-16 to the gold standard set by the
 * season story, the schedule-change demo, the waivers demo, game day, the
 * referees demo, the roster story and the money picture.
 *
 * THE OWNER'S RULING FOR THIS CUT, AND WHAT THE PRODUCT ACTUALLY SHIPS:
 *
 *   Ruled: "the announcement becomes a PRACTICE gym change (the club's own
 *   event, one team, honest recipient count derived from the real roster)."
 *
 *   Shipped: `PATCH /api/teams/[id]/practices/[practiceId]` takes exactly
 *   three actions, `move` (with a new `scheduledAt`), `cancel` and `restore`.
 *   **It cannot change a practice's venue.** The create route takes a
 *   `venueId`; the move route does not. So a club that loses its gym has to
 *   cancel the practice and create another one, which is two notifications and
 *   a lost RSVP list.
 *
 * This demo therefore films the change the product REALLY makes, a practice
 * moved in time on the club's own event, with the gym named in the message
 * because the gym is what families get wrong. The missing venue edit is punch
 * 1 in `docs/roadmap/loop-numbers.md` rather than a fabricated screen.
 *
 * THE THREE LAWS:
 *   1. PRESENTATION (audit D2). Two handsets at 390 logical, scale 1.0. The
 *      owner's phone-first chart authorizes composing the club's side as a
 *      phone; the family's side is not a composition at all.
 *   2. PACING. Stop, explain, act, one voice.
 *   3. EVERY NUMBER DERIVED. The team, the practice, its gym, its time, the
 *      recipient count, the chat and the poll with its real questions, options
 *      and vote counts all came out of the local seeded database, and each is
 *      written down in the numbers sheet.
 *
 * TWO THINGS THIS CUT DOES NOT SHOW, AND DOES NOT TALK ABOUT EITHER (sweep,
 * 2026-08-16, the owner's no-confession rule: a demo does not stop to admit
 * what it is missing).
 *
 *   1. THE READ METER. `TeamChatRead(userId, teamId, lastReadAt)` is written on
 *      every read, but the only reader is `getUnreadChatCounts`, which answers
 *      "how many have I not read". Nothing answers "who has read mine". The
 *      2026-08-15 cut drew a meter counting eleven of twelve; the 08-16 cut
 *      replaced it with a beat CONFESSING the gap on camera. Both are gone. The
 *      chapter now ends on the pin, and the meter stays punch 2 in the numbers
 *      sheet for the product backlog.
 *   2. THE "WHO WAS TOLD" PANEL. The move route notifies through `notifyTeam`
 *      and returns no recipient count to any screen, so a panel counting
 *      guardians was demo furniture wearing product clothes. Deleted. The
 *      fan-out is now proved the way the product proves it, by the notification
 *      and the email arriving on the guardian's phone, with the count spoken in
 *      the demo's own voice rather than drawn as a screen.
 *
 * TRUTH TO THE PRODUCT, SCREEN BY SCREEN:
 *   · the team calendar and its Move control are `teams/[teamId]/calendar/team-calendar.tsx`;
 *   · the refusal is `intraOrgConflictMessage` in `lib/venues/conflicts.ts`,
 *     verbatim, including the quoted title and the time;
 *   · the notification, push and email are the move branch of the practices
 *     PATCH route, word for word, and the audience is `getChatMembers`;
 *   · the thread is `teams/[teamId]/chat/team-chat.tsx`, down to the STAFF
 *     badge, the sender context line, the reaction row and the pin strip;
 *   · the poll is `components/polls/poll-card.tsx` and the in-chat
 *     `components/chat/poll-bubble.tsx`.
 */

/* ── Cast, all read out of the seeded world ──────────────────────────────── */

const CLUB = "Toronto Lords"
/** `DB` Team 77311a01, 10 ACTIVE players, 10 distinct guardians. */
const TEAM = "Toronto Lords Grade 9"
const PLAYERS = 10
const GUARDIANS = 10

/**
 * `DB` Practice f256efde on that team: SCHEDULED, 2026-08-18T22:30Z, which is
 * 6:30 p.m. America/Toronto, 90 minutes, at The Playground.
 * `PRODUCT` `formatPracticeDate` writes "Tue, Aug 18, 6:30 p.m." in en-CA.
 */
const OLD_WHEN = "Tue, Aug 18, 6:30 p.m."
const NEW_WHEN = "Tue, Aug 18, 8:00 p.m."
const GYM = "The Playground"
const DURATION = 90

/**
 * The rest of the team's August, so the calendar reads as a calendar.
 *
 * `DB` this team practises TWICE A WEEK at the same gym, Tuesdays at 6:30 and
 * Thursdays at 7:00: Practice `08222f01` (Aug 20) and `797b8318` (Aug 25) are
 * the two after the one being moved, and `24399b30` (Aug 13) is a real
 * CANCELLED row, which is why the list carries a cancelled state.
 */
const CANCELLED_ROW = {
  when: "Thu, Aug 13, 7:00 p.m.",
  where: `${GYM} · ${DURATION} min`,
}
const REST_OF_WEEK = [
  { when: "Thu, Aug 20, 7:00 p.m.", kind: "Practice", where: `${GYM} · ${DURATION} min` },
  { when: "Tue, Aug 25, 6:30 p.m.", kind: "Practice", where: `${GYM} · ${DURATION} min` },
]

/**
 * The refusal. `PRODUCT` `intraOrgConflictMessage` in `lib/venues/conflicts.ts`
 * line 184, verbatim except the em-dash, which the house rule turns into a
 * middot. `DB` the club's own Grade 10 Girls practice really does sit on that
 * court at 7:00 p.m. that evening.
 */
const CONFLICT =
  'Your organization already has a practice at this venue then · "Toronto Lords Grade 10 Girls practice" (Aug 18, 7:00 p.m.). Pick a different time or venue.'

/** `PRODUCT` the move branch of the practices PATCH route, lines 79 to 84. */
const NOTIF_TITLE = `Practice moved · ${TEAM}`
const NOTIF_MSG = `${OLD_WHEN} → ${NEW_WHEN}`
const EMAIL_SUBJECT = `Practice moved · ${TEAM}: now ${NEW_WHEN}`
const EMAIL_TAIL = "Team calendar (subscribed phone calendars update automatically)"

/** `DB` the guardian this whole demo directory follows. */
const PARENT = "Jordan Reyes"
const PLAYER = "Darius Reyes"

/** `PRODUCT` `team-chat.tsx`: the composer, the badge and the context line. */
const CHAT_PLACEHOLDER = "Message the team…"
const COACH = "Marcus Bell"

/**
 * `DB` Poll d2a61a8d, "August tournament plans", OPEN, on this team, with two
 * real questions and their real vote counts.
 */
const POLL_TITLE = "August tournament plans"
const Q1 = {
  prompt: "Should we enter the Waterloo Summer Classic? ($95/player)",
  multi: false,
  options: [
    { label: "Yes, count us in", votes: 6 },
    { label: "Yes, if we can carpool", votes: 2 },
    { label: "No, sitting this one out", votes: 1 },
  ],
}
const Q2 = {
  prompt: "Which August weekends can your family travel?",
  multi: true,
  options: [
    { label: "Aug 8-9", votes: 3 },
    { label: "Aug 15-16", votes: 3 },
    { label: "Aug 22-23", votes: 3 },
  ],
}
/** `ARITH` nine votes on question one, out of ten guardians. */
const Q1_VOTED = 9

const pct = (v: number, all: number) => (all === 0 ? 0 : Math.round((v / all) * 100))

/* ── Pacing ──────────────────────────────────────────────────────────────── */

function paced(b: Omit<DemoBeat, "hold"> & { hold?: number }): DemoBeat {
  if (b.hold) return b as DemoBeat
  const arrive = b.cursor ? 620 : 220
  const settle = 500
  const read = b.callout ? b.callout.trim().split(/\s+/).length * 180 + 900 : 2400
  return { ...b, hold: Math.round(arrive + read + (b.callout ? settle : 0)) }
}

/* ── The script ──────────────────────────────────────────────────────────── */

export const loopStory: DemoScript = {
  presentation: "scene",
  scenePhones: true,
  desktopUrl: "/teams/lords-grade-9/calendar",
  initialStage: "desktop",
  chapters: [
    { id: "change", title: "The change" },
    { id: "phones", title: "Every phone" },
    { id: "thread", title: "In the open" },
    { id: "poll", title: "The poll" },
  ],

  beats: [
    /* ── 1. The change ────────────────────────────────────────────────── */
    paced({
      id: "open",
      chapter: "change",
      caption: `The coach's team calendar. Tuesday's practice at ${GYM} has to move.`,
      emphasize: "cal-list",
      callout: `${GUARDIANS} families already have this practice on their calendars.`,
    }),
    paced({
      id: "move",
      chapter: "change",
      caption: "Move is on the practice itself.",
      cursor: "move-btn",
      press: true,
      set: { view: "move" },
      callout: "Moving it is the whole job. Nobody writes a message.",
    }),
    paced({
      id: "pick",
      chapter: "change",
      caption: "He picks seven o'clock.",
      cursor: "time-field",
      press: true,
      set: { picked: "7:00 p.m." },
    }),
    paced({
      id: "refuse",
      chapter: "change",
      caption: "The product refuses that time.",
      cursor: "save-btn",
      press: true,
      set: { conflict: true },
      callout: "His own club has the Grade 10 Girls on that floor at seven, and it says so.",
    }),
    paced({
      id: "retry",
      chapter: "change",
      caption: "Eight o'clock, then.",
      cursor: "time-field",
      press: true,
      set: { picked: "8:00 p.m.", conflict: false },
    }),
    paced({
      id: "save",
      chapter: "change",
      caption: "Saved.",
      cursor: "save-btn",
      press: true,
      toast: `Practice moved · ${NEW_WHEN}`,
      set: { view: "moved" },
      callout: "Nobody was asked who to tell. The roster is the audience.",
    }),

    /* ── 2. Every phone ───────────────────────────────────────────────── */
    paced({
      id: "phone-in",
      chapter: "phones",
      caption: `It reaches ${PARENT}, one of the ${GUARDIANS} guardians on that roster.`,
      stage: "split",
      set: { phone: "notif" },
      emphasize: "p-notif",
      callout: "The list came off the team. No coach typed a name.",
    }),
    paced({
      id: "strike",
      chapter: "phones",
      caption: "The old time struck through, the new one in bold.",
      emphasize: "p-strike",
      callout: "One function writes the push, the bell entry and the email, so they agree.",
    }),
    paced({
      id: "calendar",
      chapter: "phones",
      caption: "The last line of the email.",
      emphasize: "p-tail",
      callout: "A subscribed phone calendar updates itself. There is nothing to edit.",
    }),

    /* ── 3. In the open ───────────────────────────────────────────────── */
    paced({
      id: "ask",
      chapter: "thread",
      caption: "She has a question, and asks it in the team thread.",
      set: { phone: "chat", view: "chat" },
      cursor: "composer",
      type: { key: "typed", text: "Is the door still on Century Dr at 8?" },
      callout: "One thread per team, so the answer reaches everybody at once.",
    }),
    paced({
      id: "sent",
      chapter: "thread",
      caption: "Asked in the open.",
      cursor: "send-msg",
      press: true,
      set: { asked: true },
      callout: `The thread says who she is, "${PLAYER}'s parent", under her name.`,
    }),
    paced({
      id: "answer",
      chapter: "thread",
      caption: "The coach answers once.",
      set: { answered: true },
      emphasize: "coach-msg",
      callout: "The staff badge marks it as the coach rather than another parent.",
    }),
    paced({
      id: "pin",
      chapter: "thread",
      caption: "Pinned to the top of the thread.",
      cursor: "pin-btn",
      press: true,
      set: { pinned: true },
      callout: "The family who opens the thread on Tuesday finds it without scrolling.",
    }),

    /* ── 4. The poll ──────────────────────────────────────────────────── */
    paced({
      id: "poll-open",
      chapter: "poll",
      caption: "The same team, and an open poll about the August tournament.",
      set: { view: "poll", phone: "poll" },
      emphasize: "poll-card",
      callout: "The fee is in the question, so nobody votes yes and then asks the price.",
    }),
    paced({
      id: "vote",
      chapter: "poll",
      caption: "She answers on her phone in one tap.",
      cursor: "p-opt-1",
      press: true,
      set: { voted: true },
      callout: "She can change her answer later, and the count follows her.",
    }),
    paced({
      id: "bars",
      chapter: "poll",
      caption: "The coach watches the count settle.",
      emphasize: "poll-q1",
      callout: `${Q1_VOTED} of ${GUARDIANS} answered, and two of the yeses need a carpool.`,
    }),
    paced({
      id: "multi",
      chapter: "poll",
      caption: "The second question takes any number of answers.",
      emphasize: "poll-q2",
      callout: "A count per weekend, rather than a scroll through replies.",
    }),
    paced({
      id: "end",
      chapter: "poll",
      caption:
        "A practice moved in two presses, every family told, the question answered in the open, and the weekend decided by a count.",
      hold: 4400,
      set: { endCard: true },
    }),
  ],

  /* ── Render ────────────────────────────────────────────────────────── */

  render: ({ get, typingKey }) => {
    const view = get<string>("view", "calendar")

    const club = (
      <div className="relative flex h-full flex-col">
        <CoachPhone
          view={view}
          picked={get<string>("picked", "")}
          conflict={get("conflict", false)}
          asked={get("asked", false)}
          answered={get("answered", false)}
          pinned={get("pinned", false)}
          voted={get("voted", false)}
        />
        {get("endCard", false) && <EndCard />}
      </div>
    )

    const phone = (
      <ParentPhone
        view={get<string>("phone", "notif")}
        typed={get<string>("typed", "")}
        typing={typingKey === "typed"}
        asked={get("asked", false)}
        answered={get("answered", false)}
        voted={get("voted", false)}
      />
    )

    return {
      desktop: club,
      phone,
      frameLabels: { left: `${COACH} · coach`, right: `${PARENT} · parent` },
    }
  },
}

/* ── The coach's phone ───────────────────────────────────────────────────── */

function CoachPhone({
  view,
  picked,
  conflict,
  asked,
  answered,
  pinned,
  voted,
}: {
  view: string
  picked: string
  conflict: boolean
  asked: boolean
  answered: boolean
  pinned: boolean
  voted: boolean
}) {
  return (
    <div className="flex h-full flex-col bg-[#f6f7f9]">
      <div className="flex items-baseline gap-2 bg-[#0b1628] px-4 pb-2.5 pt-2 text-white">
        <p className="text-[15px] font-bold leading-tight">{TEAM}</p>
        <p className="text-[14px] font-medium text-white/60">{CLUB}</p>
      </div>

      <div key={view} className="demo-fade-in min-h-0 flex-1 overflow-hidden px-3 py-2.5">
        {(view === "calendar" || view === "move" || view === "moved") && (
          <TeamCalendar stage={view} picked={picked} conflict={conflict} />
        )}
        {view === "chat" && (
          <CoachChat asked={asked} answered={answered} pinned={pinned} />
        )}
        {view === "poll" && <CoachPoll voted={voted} />}
      </div>

      <TabBar tabs={["Home", "Chat", "Calendar", "My Team", "Social"]} active="Calendar" />
    </div>
  )
}

/** `teams/[teamId]/calendar`, composed at 390. */
function TeamCalendar({
  stage,
  picked,
  conflict,
}: {
  stage: string
  picked: string
  conflict: boolean
}) {
  const moved = stage === "moved"
  return (
    <div className="space-y-2">
      <p className="text-ink-900 text-[17px] font-extrabold">Team calendar</p>

      <div data-demo-target="cal-list" className="space-y-1.5">
        {/* `DB` Practice 24399b30, a real CANCELLED row on this team.
            `PRODUCT` the calendar strikes a cancelled practice through and
            chips it rather than removing it. */}
        <div className="border-ink-200 rounded-xl border bg-white px-3 py-2 opacity-60">
          <div className="flex items-center justify-between gap-2">
            <span className="text-ink-900 text-[15px] font-bold line-through">
              {CANCELLED_ROW.when}
            </span>
            <Chip tone="neutral">Cancelled</Chip>
          </div>
          <p className="text-ink-500 mt-0.5 text-[14px] font-medium">{CANCELLED_ROW.where}</p>
        </div>

        <div
          className={cn(
            "rounded-xl border bg-white px-3 py-2 transition-colors duration-300 motion-reduce:transition-none",
            moved ? "border-court-300 bg-court-50/60" : "border-play-300"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-ink-900 text-[15px] font-bold">
              {moved ? NEW_WHEN : OLD_WHEN}
            </span>
            <Chip tone={moved ? "court" : "play"}>Practice</Chip>
          </div>
          <p className="text-ink-500 mt-0.5 text-[14px] font-medium">
            {GYM} · {DURATION} min
          </p>
          {moved ? null : stage === "move" ? (
            <div className="mt-1.5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span
                  data-demo-target="time-field"
                  className={cn(
                    "border-ink-300 flex-1 rounded-lg border bg-white px-2.5 py-1.5 text-[15px] font-semibold",
                    picked ? "text-ink-900" : "text-ink-400"
                  )}
                >
                  {picked || "New time"}
                </span>
                <Btn id="save-btn" size="sm">
                  Save
                </Btn>
                <Btn tone="quiet" size="sm">
                  Cancel
                </Btn>
              </div>
              {conflict && (
                <p
                  data-demo-target="conflict"
                  className="border-hoop-300 bg-hoop-50 text-hoop-900 live-pop rounded-lg border px-2.5 py-1.5 text-[14px] font-semibold leading-snug"
                >
                  {CONFLICT}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-1.5 flex gap-1.5">
              <Btn id="move-btn" tone="quiet" size="sm">
                Move
              </Btn>
              <Btn tone="quiet" size="sm">
                Cancel
              </Btn>
            </div>
          )}
        </div>

        {/* The rest of the week, so the calendar reads as a calendar rather
            than one row with a control on it. `DB` the team's other seeded
            practices and its next league game. */}
        {REST_OF_WEEK.map((e) => (
          <div key={e.when} className="border-ink-200 rounded-xl border bg-white px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-ink-900 text-[15px] font-bold">{e.when}</span>
              <Chip tone="neutral">{e.kind}</Chip>
            </div>
            <p className="text-ink-500 mt-0.5 text-[14px] font-medium">{e.where}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/** `teams/[teamId]/chat`, the coach's end. */
function CoachChat({
  asked,
  answered,
  pinned,
}: {
  asked: boolean
  answered: boolean
  pinned: boolean
}) {
  return (
    <div className="flex h-full flex-col">
      <p className="text-ink-900 shrink-0 text-[17px] font-extrabold">Team chat</p>

      {pinned && (
        <div className="border-gold-400 bg-gold-50 live-pop mt-1.5 shrink-0 rounded-xl border px-2.5 py-1.5">
          <p className="text-gold-600 text-[14px] font-bold uppercase tracking-[0.06em]">Pinned</p>
          <p className="text-ink-800 text-[14px] font-semibold leading-snug">
            Century Dr door, 8:00. Court 2.
          </p>
        </div>
      )}

      <div className="mt-1.5 min-h-0 flex-1 space-y-1.5 overflow-hidden">
        <Bubble who="You" staff body={`Practice moved to ${NEW_WHEN}, same gym.`} time="5:12 p.m." />
        {asked && (
          <Bubble
            who={PARENT}
            context={`${PLAYER}'s parent`}
            body="Is the door still on Century Dr at 8?"
            time="5:14 p.m."
            fresh
          />
        )}
        {answered && (
          <Bubble
            who="You"
            staff
            body="Yes, Century Dr door. We are on Court 2."
            time="5:15 p.m."
            reactions={[["👍", 4]]}
            pin={!pinned}
            fresh
          />
        )}
      </div>

      {/* The composer, which the coach's end of the thread has too. */}
      <div className="mt-1.5 flex shrink-0 items-center gap-1.5">
        <span className="border-ink-300 text-ink-400 min-w-0 flex-1 truncate rounded-full border bg-white px-3 py-1.5 text-[15px] font-medium">
          {CHAT_PLACEHOLDER}
        </span>
        <span className="text-ink-500 shrink-0 text-[17px]" aria-hidden="true">
          📊
        </span>
        <Btn tone="quiet" size="sm">
          Send
        </Btn>
      </div>
    </div>
  )
}

function Bubble({
  who,
  context,
  staff,
  body,
  time,
  reactions,
  pin,
  fresh,
}: {
  who: string
  context?: string
  staff?: boolean
  body: string
  time: string
  reactions?: [string, number][]
  pin?: boolean
  fresh?: boolean
}) {
  return (
    <div
      className={cn(
        "border-ink-200 rounded-xl border bg-white px-2.5 py-1.5",
        staff && "border-play-200 bg-play-50/40",
        fresh && "live-row-in"
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-ink-900 text-[14px] font-bold">{who}</span>
        {staff && <StatusChip tone="play">Staff</StatusChip>}
        {context && <span className="text-ink-400 text-[14px] font-medium">{context}</span>}
        <span className="text-ink-400 ml-auto text-[14px] font-medium">{time}</span>
      </div>
      <p className="text-ink-800 mt-0.5 text-[15px] font-medium leading-snug">{body}</p>
      <div className="mt-1 flex items-center gap-1.5">
        {reactions?.map(([e, n]) => (
          <span
            key={e}
            className="border-ink-200 text-ink-700 rounded-full border bg-white px-1.5 text-[14px] font-semibold"
          >
            {e} {n}
          </span>
        ))}
        {pin && (
          <span
            data-demo-target="pin-btn"
            className="text-play-700 ml-auto text-[14px] font-bold"
          >
            Pin
          </span>
        )}
      </div>
    </div>
  )
}

/** `components/polls/poll-card.tsx`, the staff view. */
function CoachPoll({ voted }: { voted: boolean }) {
  return (
    <div data-demo-target="poll-card" className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-ink-900 min-w-0 truncate text-[17px] font-extrabold">{POLL_TITLE}</p>
        <StatusChip tone="court">Open</StatusChip>
      </div>
      <p className="text-ink-400 text-[14px] font-medium leading-tight">
        {COACH} · Aug 14 · {Q1_VOTED + (voted ? 1 : 0)} votes
      </p>

      <PollQuestion
        id="poll-q1"
        prompt={Q1.prompt}
        multi={Q1.multi}
        voted={Q1_VOTED + (voted ? 1 : 0)}
        options={Q1.options.map((o, i) => ({
          ...o,
          votes: o.votes + (voted && i === 0 ? 1 : 0),
        }))}
        total={GUARDIANS}
        flashFirst={voted}
      />
      <PollQuestion
        id="poll-q2"
        prompt={Q2.prompt}
        multi={Q2.multi}
        voted={3}
        options={Q2.options}
        total={GUARDIANS}
      />
    </div>
  )
}

function PollQuestion({
  id,
  prompt,
  multi,
  voted,
  options,
  total,
  flashFirst,
}: {
  id?: string
  prompt: string
  multi: boolean
  voted: number
  options: { label: string; votes: number }[]
  total: number
  flashFirst?: boolean
}) {
  const lead = Math.max(...options.map((o) => o.votes), 1)
  return (
    <div data-demo-target={id} className="border-ink-200 rounded-xl border bg-white px-2.5 py-1.5">
      <p className="text-ink-900 text-[15px] font-bold leading-tight">{prompt}</p>
      <p className="text-ink-400 text-[14px] font-semibold leading-tight">
        {multi ? "Pick any" : "Pick one"} · {voted} voted
      </p>
      <div className="mt-1 space-y-0.5">
        {options.map((o, i) => (
          <div
            key={o.label}
            className={cn(
              "border-ink-100 relative overflow-hidden rounded-lg border bg-white px-2 py-0.5",
              flashFirst && i === 0 && "live-pop"
            )}
          >
            <span
              aria-hidden="true"
              className="bg-play-100 absolute inset-y-0 left-0 transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${(o.votes / lead) * 100}%` }}
            />
            <span className="relative flex items-center justify-between gap-2">
              <span className="text-ink-900 truncate text-[14px] font-semibold">{o.label}</span>
              <span className="text-ink-600 shrink-0 text-[14px] font-bold tabular-nums">
                {o.votes} · {pct(o.votes, total)}%
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── The parent's phone ──────────────────────────────────────────────────── */

function ParentPhone({
  view,
  typed,
  typing,
  asked,
  answered,
  voted,
}: {
  view: string
  typed: string
  typing: boolean
  asked: boolean
  answered: boolean
  voted: boolean
}) {
  return (
    <div className="flex h-full flex-col bg-[#f6f7f9]">
      <div className="flex items-baseline gap-2 bg-[#0b1628] px-4 pb-2.5 pt-2 text-white">
        <p className="text-[15px] font-bold leading-tight">{PARENT}</p>
        <p className="text-[14px] font-medium text-white/60">Parent · two players</p>
      </div>

      <div key={view} className="demo-fade-in min-h-0 flex-1 overflow-hidden px-3 py-2.5">
        {view === "notif" && <Inbox />}
        {view === "chat" && (
          <ParentChat typed={typed} typing={typing} asked={asked} answered={answered} />
        )}
        {view === "poll" && <ParentPoll voted={voted} />}
      </div>

      <TabBar tabs={["Home", "Chat", "Calendar", "My Kids", "Social"]} active={view === "chat" ? "Chat" : "Home"} />
    </div>
  )
}

function Inbox() {
  return (
    <div className="space-y-2">
      <p className="text-ink-900 text-[17px] font-extrabold">Notifications</p>

      <div
        data-demo-target="p-notif"
        className="border-play-300 live-pop rounded-2xl border bg-white px-3 py-2.5"
      >
        <p className="text-ink-900 text-[15px] font-bold leading-snug">{NOTIF_TITLE}</p>
        <p data-demo-target="p-strike" className="text-ink-700 mt-1 text-[14px] font-semibold">
          <s className="text-ink-400">{OLD_WHEN}</s> <span aria-hidden="true">→</span>{" "}
          <span className="text-ink-950 font-bold">{NEW_WHEN}</span>
        </p>
      </div>

      <p className="text-ink-400 text-[14px] font-bold uppercase tracking-[0.1em]">
        The same change, by email
      </p>
      <div className="border-ink-200 rounded-2xl border bg-white px-3 py-2.5">
        <p className="text-ink-900 text-[15px] font-bold leading-snug">{EMAIL_SUBJECT}</p>
        <p className="text-ink-700 mt-1 text-[14px] font-semibold">
          <s className="text-ink-400">{OLD_WHEN}</s> <span aria-hidden="true">→</span>{" "}
          <span className="text-ink-950 font-bold">{NEW_WHEN}</span> at {GYM}
        </p>
        <p data-demo-target="p-tail" className="text-play-700 mt-1.5 text-[14px] font-bold leading-snug">
          {EMAIL_TAIL}
        </p>
      </div>
    </div>
  )
}

function ParentChat({
  typed,
  typing,
  asked,
  answered,
}: {
  typed: string
  typing: boolean
  asked: boolean
  answered: boolean
}) {
  return (
    <div className="flex h-full flex-col">
      <p className="text-ink-900 shrink-0 text-[17px] font-extrabold">{TEAM}</p>
      <div className="mt-1.5 min-h-0 flex-1 space-y-1.5 overflow-hidden">
        <Bubble who={COACH} staff body={`Practice moved to ${NEW_WHEN}, same gym.`} time="5:12 p.m." />
        {asked && (
          <Bubble
            who="You"
            context={`${PLAYER}'s parent`}
            body="Is the door still on Century Dr at 8?"
            time="5:14 p.m."
            fresh
          />
        )}
        {answered && (
          <Bubble
            who={COACH}
            staff
            body="Yes, Century Dr door. We are on Court 2."
            time="5:15 p.m."
            reactions={[["👍", 4]]}
            fresh
          />
        )}
      </div>
      <div className="mt-1.5 flex shrink-0 items-center gap-1.5">
        <span
          data-demo-target="composer"
          className={cn(
            "border-ink-300 min-w-0 flex-1 truncate rounded-full border bg-white px-3 py-1.5 text-[15px] font-medium",
            typed ? "text-ink-900" : "text-ink-400"
          )}
        >
          {asked ? CHAT_PLACEHOLDER : typed || CHAT_PLACEHOLDER}
          {typing && <span className="bg-play-600 ml-0.5 inline-block h-4 w-[2px] align-middle" />}
        </span>
        <span className="text-ink-500 shrink-0 text-[17px]" aria-hidden="true">
          📊
        </span>
        <Btn id="send-msg" size="sm">
          Send
        </Btn>
      </div>
    </div>
  )
}

/** `components/chat/poll-bubble.tsx`, the family's end. */
function ParentPoll({ voted }: { voted: boolean }) {
  const opts = Q1.options.map((o, i) => ({ ...o, votes: o.votes + (voted && i === 0 ? 1 : 0) }))
  const lead = Math.max(...opts.map((o) => o.votes), 1)
  const total = Q1_VOTED + (voted ? 1 : 0)
  return (
    <div className="space-y-2">
      <p className="text-ink-900 text-[17px] font-extrabold">{TEAM}</p>
      <div className="border-play-200 bg-play-50/40 rounded-2xl border px-3 py-2.5">
        <p className="text-ink-900 text-[15px] font-bold leading-snug">{Q1.prompt}</p>
        <div className="mt-1.5 space-y-1">
          {opts.map((o, i) => (
            <div
              key={o.label}
              data-demo-target={i === 0 ? "p-opt-1" : undefined}
              className={cn(
                "relative overflow-hidden rounded-lg border bg-white px-2 py-1.5",
                voted && i === 0 ? "border-court-400" : "border-ink-200"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-y-0 left-0 transition-[width] duration-500 motion-reduce:transition-none",
                  voted && i === 0 ? "bg-court-100" : "bg-play-100"
                )}
                style={{ width: voted ? `${(o.votes / lead) * 100}%` : "0%" }}
              />
              <span className="relative flex items-center justify-between gap-2">
                <span className="text-ink-900 truncate text-[14px] font-semibold">
                  {o.label}
                  {voted && i === 0 && <span className="text-court-700 ml-1.5">✓ your pick</span>}
                </span>
                {voted && (
                  <span className="text-ink-600 shrink-0 text-[14px] font-bold tabular-nums">
                    {o.votes} · {pct(o.votes, GUARDIANS)}%
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
        <p className="text-ink-500 mt-1.5 text-[14px] font-medium">
          {voted ? `${total} votes · tap to change` : "Tap an option to choose, then submit."}
        </p>
      </div>
      {/* The second question is on her phone too: the poll bubble carries
          every question in the poll. `DB` Poll d2a61a8d, question 2. */}
      <div className="border-ink-200 rounded-2xl border bg-white px-3 py-2.5">
        <p className="text-ink-900 text-[15px] font-bold leading-snug">{Q2.prompt}</p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {Q2.options.map((o) => (
            <span
              key={o.label}
              className="border-ink-200 text-ink-700 rounded-full border bg-white px-2 py-0.5 text-[14px] font-semibold"
            >
              {o.label}
            </span>
          ))}
        </div>
        <p className="text-ink-500 mt-1.5 text-[14px] font-medium">Pick any that work.</p>
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
          The question answered where all ten could read it, and the tournament weekend settled by a
          count.
        </p>
        <p className="mt-4 text-[14px] font-semibold text-white/50">Next: your week</p>
      </div>
    </div>
  )
}
