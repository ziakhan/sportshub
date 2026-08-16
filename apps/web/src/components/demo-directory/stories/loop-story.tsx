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
 * THE READ METER IS NOT STAGED, AND THAT IS A DECISION, NOT AN OMISSION.
 * `TeamChatRead(userId, teamId, lastReadAt)` exists and is written on every
 * read, but the ONLY code that reads it is `getUnreadChatCounts`, which
 * answers "how many have I not read". Nothing anywhere answers "who has read
 * mine". The 2026-08-15 cut of this demo drew a read meter counting eleven of
 * twelve with the twelfth family named; no such panel exists in the product.
 * It is gone, replaced by a beat that says what the product really gives a
 * sender, and the meter is punch 2 in the numbers sheet. This is a standing
 * owner decision: build the small panel or keep the beat honest.
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
      caption: "A coach with a problem, on the phone he actually has on him.",
      emphasize: "cal-list",
      callout: `Tuesday's practice at ${GYM} has to move, and ${GUARDIANS} families do not know yet.`,
    }),
    paced({
      id: "move",
      chapter: "change",
      caption: "There is one control for it, on the practice itself.",
      cursor: "move-btn",
      press: true,
      set: { view: "move" },
      callout: "Move. Not a message to write, not a list to build, not a group chat to open.",
    }),
    paced({
      id: "pick",
      chapter: "change",
      caption: "He picks a time.",
      cursor: "time-field",
      press: true,
      set: { picked: "7:00 p.m." },
      callout: "Seven o'clock, which is the obvious answer and also the wrong one.",
    }),
    paced({
      id: "refuse",
      chapter: "change",
      caption: "And the product refuses him.",
      cursor: "save-btn",
      press: true,
      set: { conflict: true },
      callout:
        "His own club already has the Grade 10 Girls on that floor at seven. It names the booking rather than just saying no.",
    }),
    paced({
      id: "retry",
      chapter: "change",
      caption: "Eight o'clock, then.",
      cursor: "time-field",
      press: true,
      set: { picked: "8:00 p.m.", conflict: false },
      callout: "The same gym, ninety minutes, an hour and a half later.",
    }),
    paced({
      id: "save",
      chapter: "change",
      caption: "Saved.",
      cursor: "save-btn",
      press: true,
      toast: `Practice moved · ${NEW_WHEN}`,
      set: { view: "moved" },
      callout: "That is the whole job. Nobody was asked who should be told.",
    }),

    /* ── 2. Every phone ───────────────────────────────────────────────── */
    paced({
      id: "audience",
      chapter: "phones",
      caption: "Because the product already knows.",
      emphasize: "audience-card",
      callout:
        "The audience is the roster and the staff on it, worked out from the team, not typed by a coach.",
    }),
    paced({
      id: "phone-in",
      chapter: "phones",
      caption: `It lands on ${PARENT}'s phone before he has put his own down.`,
      stage: "split",
      set: { phone: "notif" },
      emphasize: "p-notif",
      callout: "A push, a bell entry and an email, from one function, so they cannot disagree.",
    }),
    paced({
      id: "strike",
      chapter: "phones",
      caption: "And look at how it says it.",
      emphasize: "p-strike",
      callout: "The old time struck through and the new one in bold. She reads it without opening anything.",
    }),
    paced({
      id: "calendar",
      chapter: "phones",
      caption: "The last line is the one that ends the phone calls.",
      emphasize: "p-tail",
      callout: "Subscribed phone calendars update themselves. She does not edit anything.",
    }),

    /* ── 3. In the open ───────────────────────────────────────────────── */
    paced({
      id: "ask",
      chapter: "thread",
      caption: "She has a question, and the product gives it somewhere to go.",
      set: { phone: "chat", view: "chat" },
      cursor: "composer",
      type: { key: "typed", text: "Is the door still on Century Dr at 8?" },
      callout: "The team thread, not a private text to the coach at ten at night.",
    }),
    paced({
      id: "sent",
      chapter: "thread",
      caption: "Asked in front of everybody.",
      cursor: "send-msg",
      press: true,
      set: { asked: true },
      callout: `The thread says who she is, "${PLAYER}'s parent", so nobody has to work it out.`,
    }),
    paced({
      id: "answer",
      chapter: "thread",
      caption: "And answered where all ten families can read it.",
      set: { answered: true },
      emphasize: "coach-msg",
      callout: "One answer instead of ten. The staff badge says it is the coach talking.",
    }),
    paced({
      id: "pin",
      chapter: "thread",
      caption: "Then it gets pinned, which is the part that saves the next question.",
      cursor: "pin-btn",
      press: true,
      set: { pinned: true },
      callout: "Pinned to the top of the thread, so the family who reads it on Tuesday finds it.",
    }),
    paced({
      id: "read",
      chapter: "thread",
      caption: "One honest thing about read receipts.",
      emphasize: "unread-note",
      callout:
        "Each person gets an unread badge for what they have not opened. The sender is not shown who has read it, and this demo will not draw a meter the product does not have.",
    }),

    /* ── 4. The poll ──────────────────────────────────────────────────── */
    paced({
      id: "poll-open",
      chapter: "poll",
      caption: "The other thing a team argues about is money and weekends.",
      set: { view: "poll", phone: "poll" },
      emphasize: "poll-card",
      callout: "A real poll on this team, with the price in the question where it belongs.",
    }),
    paced({
      id: "vote",
      chapter: "poll",
      caption: "She answers on her phone in one tap.",
      cursor: "p-opt-1",
      press: true,
      set: { voted: true },
      callout: "Pick one, submit, done. She can change it later and the count follows her.",
    }),
    paced({
      id: "bars",
      chapter: "poll",
      caption: "And the coach watches it settle.",
      emphasize: "poll-q1",
      callout: "Nine of ten families answered, and two of the yeses want a carpool. That is a plan.",
    }),
    paced({
      id: "multi",
      chapter: "poll",
      caption: "The second question is the one a group chat can never do.",
      emphasize: "poll-q2",
      callout: "Pick any weekend that works, and the answer is a count per weekend rather than a scroll.",
    }),
    paced({
      id: "end",
      chapter: "poll",
      caption:
        "One practice moved, ten families told without a list, the question asked and answered in the open, and the tournament decided by a count.",
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
          {moved ? (
            <p className="text-court-700 mt-1 text-[14px] font-bold">
              Moved · {GUARDIANS} families told
            </p>
          ) : stage === "move" ? (
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

        <div className="border-ink-200 rounded-xl border bg-white px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-ink-900 text-[15px] font-bold">Thu, Aug 20, 7:00 p.m.</span>
            <Chip tone="neutral">Practice</Chip>
          </div>
          <p className="text-ink-500 mt-0.5 text-[14px] font-medium">
            {GYM} · {DURATION} min
          </p>
        </div>
      </div>

      {moved && (
        <div
          data-demo-target="audience-card"
          className="border-court-200 bg-court-50/60 live-pop rounded-2xl border px-3 py-2"
        >
          <p className="text-court-800 text-[15px] font-bold">Who was told</p>
          <div className="mt-1 space-y-0.5">
            <AudienceRow label="Guardians on the roster" value={`${GUARDIANS}`} />
            <AudienceRow label="Players" value={`${PLAYERS}`} />
            <AudienceRow label="Lists built by a human" value="0" />
          </div>
          <p className="text-court-700 mt-1 text-[14px] font-medium leading-snug">
            The roster is the audience. Add a player tomorrow and the next change reaches them too.
          </p>
        </div>
      )}
    </div>
  )
}

function AudienceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-court-800 w-[36px] shrink-0 text-[17px] font-extrabold tabular-nums">
        {value}
      </span>
      <span className="text-court-700 text-[14px] font-semibold">{label}</span>
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

      <p
        data-demo-target="unread-note"
        className="border-ink-200 text-ink-500 mt-1.5 shrink-0 rounded-xl border bg-white px-2.5 py-1.5 text-[14px] font-medium leading-snug"
      >
        Everyone on this thread carries their own unread badge. What the product does not do today is
        tell the sender who has opened it.
      </p>
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
    <div data-demo-target="poll-card" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-ink-900 min-w-0 truncate text-[17px] font-extrabold">{POLL_TITLE}</p>
        <StatusChip tone="court">Open</StatusChip>
      </div>
      <p className="text-ink-400 text-[14px] font-medium">
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
    <div data-demo-target={id} className="border-ink-200 rounded-xl border bg-white px-2.5 py-2">
      <p className="text-ink-900 text-[15px] font-bold leading-snug">{prompt}</p>
      <p className="text-ink-400 mt-0.5 text-[14px] font-semibold">
        {multi ? "Pick any" : "Pick one"} · {voted} voted
      </p>
      <div className="mt-1.5 space-y-1">
        {options.map((o, i) => (
          <div
            key={o.label}
            className={cn(
              "border-ink-100 relative overflow-hidden rounded-lg border bg-white px-2 py-1",
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
        And the same thing by email
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

      <p className="text-ink-500 text-[14px] font-medium leading-snug">
        A push, a bell entry and an email. She has not opened the app yet.
      </p>
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
      <p className="text-ink-500 text-[14px] font-medium leading-snug">
        The same poll, in the thread she is already in. No link, no sign-in, no form.
      </p>
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
          A practice moved in two presses, refused once by the club&apos;s own booking and named,
          then ten families told by push, bell and email with nobody building a list. The question
          answered where all ten could read it, and the tournament settled by a count instead of an
          argument.
        </p>
        <p className="mt-4 text-[14px] font-semibold text-white/50">Next: your week</p>
      </div>
    </div>
  )
}
