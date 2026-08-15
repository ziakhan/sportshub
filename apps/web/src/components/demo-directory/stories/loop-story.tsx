"use client"

import type { ReactNode } from "react"
import { TypeText } from "../motion"
import {
  MockBand,
  MockButton,
  MockDialog,
  MockEmailPreview,
  MockEndCard,
  MockField,
  MockListbox,
  MockPanel,
  MockPill,
  MockPollResults,
  MockReadMeter,
  MockRow,
  MockTextArea,
  MockTile,
  MockTopBar,
  PhoneChatBubble,
  PhoneChatComposer,
  PhoneChatDay,
  PhonePinnedStrip,
  PhonePollBubble,
  PhonePostCard,
  PhonePushBanner,
  PhoneShell,
  PhoneTypingLine,
  type MockPollOption,
} from "../mock-ui"
import { Crest } from "@/components/ui/crest"
import type { DemoScript } from "../types"

/**
 * Story 2: "Everyone in the loop" (owner-signed script, 2026-08-15).
 *
 * THE ARGUMENT. Every club already has a way to tell families things. It is a
 * group chat, a phone tree, and a parent who forwards. This story is about the
 * three moments that costs them: the message that only some people got, the
 * question answered privately eleven times, and the decision nobody can find
 * afterwards.
 *
 * THE PAINFUL DETAIL (owner's law, named for this story): SHOW THE AUDIENCE
 * PICK AND SHOW THE READ COUNTS. A club sending to "the whole club" when it
 * meant one team is the reason families tune the channel out, and a club that
 * cannot see who has read it is the reason somebody ends up forwarding. So the
 * audience is chosen on camera, and chapter two is built around a number
 * climbing to eleven of twelve with the twelfth family named.
 *
 * TRUTH TO THE PRODUCT. Every surface here mirrors one that ships today:
 *   · the composer — components/comms/message-composer.tsx: the audience list
 *     with its live recipient counts, subject and body with their "n/max"
 *     counters, the preview pane, and the "Send to ~N recipients?" confirm
 *     that stands between a draft and twelve inboxes;
 *   · the audience labels come from lib/comms/audiences.ts, which really does
 *     offer "Everyone engaged with the club (n)" beside a per-team option. The
 *     separator is a middot here because the product's own label uses an
 *     em-dash, which the house copy rule does not allow;
 *   · the thread — app/(platform)/teams/[teamId]/chat/team-chat.tsx: play-600
 *     for your own bubbles, court-50 for everyone else, the STAFF badge, the
 *     six-emoji reaction row, "Dana Michaels is typing…", "Message the team…";
 *   · the poll — clubs/[id]/polls/club-polls.tsx and components/polls/
 *     poll-card.tsx, including "Also post to team chats" (off by default) and
 *     the staff-only line of voter names under each option;
 *   · the poll in the thread — components/chat/poll-bubble.tsx.
 *
 * The read meter is the one panel that reads a number the product currently
 * only counts in the other direction: TeamChatRead (userId, teamId,
 * lastReadAt) is what the unread badge is built on, and this is the same
 * cursor asked "who has opened it" instead of "have I".
 *
 * MOTION. Nothing pans, zooms or scrolls. The read bar and the poll bars are
 * width transitions on elements that persist across beats, so they travel
 * rather than cut; the counters tween; the cursor fades out on beats where
 * nobody's hand is involved.
 */

/* ── Cast ────────────────────────────────────────────────────────────────── */

/** The twelve families on the team, in the order they opened the message. */
const FAMILIES = [
  "Ngozi Bello",
  "Ruth Njoku",
  "Carmen Reyes",
  "Simran Kaur",
  "Irina Petrov",
  "Yusra Ahmed",
  "Marie Tremblay",
  "Clare Donnelly",
  "Rania Haddad",
  "Deirdre Fitzgerald",
  "Paulo Okafor",
]
/** The twelfth. She is the whole point of the read meter. */
const LAST_FAMILY = "Wendy Chan"
const TEAM_SIZE = 12

const SUBJECT = "Gym change for Saturday"
const BODY =
  "Saturday's game moves to Riverside CC, Court 2. Same 9:00 AM tip, doors at 8:30."

const AUDIENCES = [
  { value: "everyone", label: "Everyone engaged with the club (214)" },
  { value: "u11g", label: "Team · U11 Girls Rep families (12)" },
  { value: "u13g", label: "Team · U13 Girls Rep families (12)" },
  { value: "tryout", label: "Tryout · U11 Girls Fall Tryout registrants (14)" },
]
const AUDIENCE_PICKED = AUDIENCES[1].label

const URL_MESSAGES = "/manage/clubs/riverside-ravens/messages"
const URL_SENT = "/manage/clubs/riverside-ravens/messages/gym-change-saturday"
const URL_POLLS = "/manage/clubs/riverside-ravens/polls"

/** Who voted for what, which is the line only staff see on a poll card. */
const FRIDAY_VOTERS = [
  "Ngozi Bello",
  "Ruth Njoku",
  "Carmen Reyes",
  "Simran Kaur",
  "Irina Petrov",
  "Yusra Ahmed",
  "Marie Tremblay",
  "Clare Donnelly",
]
const SUNDAY_VOTERS = ["Rania Haddad", "Deirdre Fitzgerald", "Paulo Okafor"]

export const loopStory: DemoScript = {
  desktopUrl: URL_MESSAGES,
  initialStage: "desktop",
  chapters: [
    { id: "announce", title: "The announcement" },
    { id: "phones", title: "Every phone at once" },
    { id: "talk", title: "The conversation" },
    { id: "poll", title: "The poll" },
  ],

  beats: [
    /* ── 1. The announcement ──────────────────────────────────────────── */
    {
      id: "compose-open",
      chapter: "announce",
      caption:
        "Riverside Ravens have a gym change for Saturday and twelve families who need to know about it.",
      hold: 2600,
      set: { screen: "compose" },
    },
    {
      id: "open-audience",
      chapter: "announce",
      caption: "Who it goes to is the first field, not an afterthought at the end.",
      hold: 2000,
      cursor: "audience",
      press: true,
      set: { audOpen: true },
    },
    {
      id: "pick-audience",
      chapter: "announce",
      caption:
        "The whole club is right there, with 214 people behind it. This one is for a single team, so it goes to a single team.",
      hold: 2800,
      cursor: "audience-opt-u11g",
      press: true,
      set: { audience: AUDIENCE_PICKED, recipients: 12 },
    },
    {
      id: "type-subject",
      chapter: "announce",
      caption: "Subject.",
      hold: 2500,
      cursor: "field-subject",
      type: { key: "subject", text: SUBJECT },
      set: { audOpen: false },
    },
    {
      id: "type-body",
      chapter: "announce",
      caption: "Then the message itself.",
      hold: 4400,
      cursor: "field-body",
      type: { key: "body", text: BODY },
    },
    {
      id: "preview",
      chapter: "announce",
      caption:
        "Beside it is the thing a family actually receives, down to the unsubscribe line.",
      hold: 2200,
      cursor: "preview-pane",
      hover: "preview-pane",
    },
    {
      id: "press-send",
      chapter: "announce",
      caption: "Nothing this club sends goes out on one click.",
      hold: 2200,
      cursor: "send-message",
      press: true,
      set: { dialog: "confirm" },
    },
    {
      id: "confirm-send",
      chapter: "announce",
      caption: "Twelve families, all of them, at the same moment.",
      hold: 2600,
      cursor: "confirm-send",
      press: true,
      toast: "Sent to 12 families",
    },

    /* ── 2. Every phone at once ───────────────────────────────────────── */
    {
      id: "push",
      chapter: "phones",
      caption:
        "It lands on every phone on the team at once. Nobody has to be told, and nobody has to forward it.",
      hold: 2800,
      stage: "split",
      url: URL_SENT,
      set: { dialog: "", screen: "sent", phone: "home", push: true, read: 2 },
    },
    {
      id: "read-7",
      chapter: "phones",
      caption: "The club can watch it land. Seven of twelve inside two minutes.",
      hold: 2600,
      set: { read: 7 },
    },
    {
      id: "tap-push",
      chapter: "phones",
      caption: "She taps it and lands on the message itself, on her team's page.",
      hold: 2400,
      cursor: "phone-push",
      press: true,
      set: { phone: "post" },
    },
    {
      id: "read-11",
      chapter: "phones",
      caption: "Eleven of twelve.",
      hold: 2400,
      set: { read: 11, push: false },
    },
    {
      id: "outstanding",
      chapter: "phones",
      caption:
        "And the twelfth is not a mystery. The family who has not opened it is named, with the nudge sitting next to the name.",
      hold: 3000,
      cursor: "remind",
      hover: "remind",
    },

    /* ── 3. The conversation ──────────────────────────────────────────── */
    {
      id: "open-chat",
      chapter: "talk",
      caption:
        "The question comes back through the team's own thread, not to the coach's personal number at 9 at night.",
      hold: 2600,
      stage: "phone",
      set: { phone: "chat" },
    },
    {
      id: "type-question",
      chapter: "talk",
      caption: "She asks it once.",
      hold: 3000,
      cursor: "chat-input",
      type: { key: "question", text: "Is 8:30 for warmup or just doors open?" },
    },
    {
      id: "send-question",
      chapter: "talk",
      caption: "Where all twelve families can see it, which is the point.",
      hold: 2200,
      cursor: "chat-send",
      press: true,
      set: { msgs: 1 },
    },
    {
      id: "typing",
      chapter: "talk",
      caption: "The coach is on it.",
      hold: 1800,
      set: { typing: true },
    },
    {
      id: "coach-reply",
      chapter: "talk",
      caption: "Answered once, for everybody, in about forty seconds.",
      hold: 2600,
      set: { typing: false, msgs: 2, reactRow: true },
    },
    {
      id: "react",
      chapter: "talk",
      caption:
        "A thumbs up is the whole reply. Reactions do not notify anybody, so eleven other phones stay quiet.",
      hold: 2700,
      cursor: "react-thumb",
      press: true,
      set: { reacted: true },
    },

    /* ── 4. The poll ──────────────────────────────────────────────────── */
    {
      id: "polls-open",
      chapter: "poll",
      caption: "The other thing that lives in a group chat is deciding something.",
      hold: 2300,
      stage: "split",
      url: URL_POLLS,
      set: { screen: "polls", reactRow: false },
    },
    {
      id: "new-poll",
      chapter: "poll",
      caption: "A poll is the same shape as the announcement. Ask it, choose who, send it.",
      hold: 2000,
      cursor: "new-poll",
      press: true,
      set: { dialog: "poll" },
    },
    {
      id: "type-poll-title",
      chapter: "poll",
      caption: "The question.",
      hold: 2900,
      cursor: "field-poll-title",
      type: { key: "pollTitle", text: "Team dinner: Friday or Sunday?" },
    },
    {
      id: "type-opt-1",
      chapter: "poll",
      caption: "Two options, spelled out so nobody answers a different question.",
      hold: 2600,
      cursor: "field-opt1",
      type: { key: "opt1", text: "Friday after practice" },
    },
    {
      id: "type-opt-2",
      chapter: "poll",
      caption: "And the second.",
      hold: 2000,
      cursor: "field-opt2",
      type: { key: "opt2", text: "Sunday lunch" },
    },
    {
      id: "relay",
      chapter: "poll",
      caption:
        "It can drop straight into the thread the conversation already happened in. That is off by default, so it is a decision, not a default.",
      hold: 2500,
      cursor: "relay",
      press: true,
      set: { relay: true },
    },
    {
      id: "publish-poll",
      chapter: "poll",
      caption: "Published.",
      hold: 2400,
      cursor: "publish-poll",
      press: true,
      toast: "Poll published. Also posted to 1 team chat.",
      set: { pollLive: true, fri: 0, sun: 0 },
    },
    {
      id: "phone-poll",
      chapter: "poll",
      caption: "On her phone it is two buttons in the thread, not forty messages under it.",
      hold: 2100,
      set: { dialog: "", pollInChat: true },
    },
    {
      id: "vote",
      chapter: "poll",
      caption: "She taps Friday.",
      hold: 2200,
      cursor: "vote-friday",
      press: true,
      set: { voted: true, fri: 1, sun: 0 },
    },
    {
      id: "bars-1",
      chapter: "poll",
      caption: "The bars on the club side fill as the answers come in.",
      hold: 2400,
      set: { fri: 5, sun: 2 },
    },
    {
      id: "bars-2",
      chapter: "poll",
      caption:
        "Eleven of twelve answered before dinner, and the club can see exactly which family chose what.",
      hold: 2600,
      set: { fri: 8, sun: 3 },
    },
    {
      id: "close-poll",
      chapter: "poll",
      caption: "Friday wins. Closing it stops the answer moving.",
      hold: 2200,
      cursor: "close-poll",
      press: true,
      set: { closed: true },
    },
    {
      id: "pin",
      chapter: "poll",
      caption:
        "Then the coach pins the result to the thread, so it is the first thing anybody opening the chat sees. Nobody scrolls back through a week to find it.",
      hold: 3100,
      toast: "Pinned to the team chat",
      set: { pinned: true },
    },
    {
      id: "end-card",
      chapter: "poll",
      caption:
        "One message everybody read, one question answered once, one decision on the record.",
      hold: 4000,
      set: { endCard: true },
    },
  ],

  render: ({ get, typingKey }) => {
    const screen = get<string>("screen", "compose")
    const dialog = get<string>("dialog", "")
    const phone = get<string>("phone", "")
    const endCard = get("endCard", false)

    const typed: Typed = (key, placeholder) => (
      <TypeText
        text={get<string>(key, "")}
        typing={typingKey === key}
        placeholder={placeholder}
      />
    )
    /**
     * The same value, NOT animated. Two TypeText instances on one key would
     * each roll their own uneven cadence and visibly drift apart, so the
     * preview pane waits out the keystrokes and lands finished, which is also
     * what a preview pane looks like from across a room.
     */
    const settled: Typed = (key, placeholder) => {
      const value = get<string>(key, "")
      if (!value || typingKey === key) {
        return <span className="text-ink-400">{placeholder}</span>
      }
      return <span>{value}</span>
    }
    /** Length of a typed value, for the composer's live character counters. */
    const len = (key: string) => get<string>(key, "").length

    const read = get("read", 0)
    const fri = get("fri", 0)
    const sun = get("sun", 0)
    const voted = get("voted", false)
    const closed = get("closed", false)

    const pollOptions: MockPollOption[] = [
      {
        id: "friday",
        label: "Friday after practice",
        count: fri,
        mine: voted,
        voters: FRIDAY_VOTERS.slice(0, fri),
      },
      {
        id: "sunday",
        label: "Sunday lunch",
        count: sun,
        voters: SUNDAY_VOTERS.slice(0, sun),
      },
    ]

    /* ── Desktop ──────────────────────────────────────────────────────── */

    const desktop = (
      <div className="relative flex h-full flex-col">
        <MockTopBar
          workspace="Riverside Ravens"
          tabs={["Dashboard", "Teams", "Programs", "Polls", "Messages"]}
          activeTab={screen === "polls" ? "Polls" : "Messages"}
        />

        <div key={screen} className="demo-fade-in flex min-h-0 flex-1 flex-col">
          {screen === "compose" && (
            <ComposeScreen
              typed={typed}
              settled={settled}
              audience={get<string>("audience", "")}
              audOpen={get("audOpen", false)}
              recipients={get("recipients", 0)}
              subjectLen={len("subject")}
              bodyLen={len("body")}
            />
          )}
          {screen === "sent" && <SentScreen read={read} />}
          {screen === "polls" && (
            <PollsScreen
              live={get("pollLive", false)}
              closed={closed}
              options={pollOptions}
              voterCount={fri + sun}
            />
          )}
        </div>

        <ConfirmSendDialog open={dialog === "confirm"} />
        <NewPollDialog
          open={dialog === "poll"}
          typed={typed}
          relay={get("relay", false)}
        />

        {endCard && (
          <MockEndCard
            eyebrow="Story 2 of 10"
            title="Everyone in the loop"
            line="One gym change, twelve families, a question answered in the open and a decision that is still there next week."
            next="A season, planned to published"
          />
        )}
      </div>
    )

    /* ── Phone ────────────────────────────────────────────────────────── */

    const phoneNode = (
      <div className="relative h-full">
        {phone === "post" ? (
          <PhoneShell title="U11 Girls Rep" subtitle="Team page" activeTab="Teams">
            {/* A team page is a page, not one card on a white field: the new
                message sits on top of the week that was already there. */}
            <div className="space-y-2.5">
              <PhonePostCard
                club="Riverside Ravens"
                kind="Announcement"
                title={SUBJECT}
                body={BODY}
                meta="Dana Michaels, head coach · 2 minutes ago"
                audience="Sent to all 12 families on this team"
              />
              <div>
                <p className="text-ink-500 mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
                  Earlier this week
                </p>
                <div className="space-y-2">
                  <WeekRow day="Sat" title="Game vs Lakeshore Lightning" meta="9:00 AM · Riverside CC, Court 2" />
                  <WeekRow day="Thu" title="Practice" meta="6:00 PM · Riverside CC, Court 1" />
                </div>
              </div>
            </div>
          </PhoneShell>
        ) : phone === "chat" ? (
          <PhoneShell title="U11 Girls Rep" subtitle="Team chat" activeTab="Teams">
            <ChatScreen
              typed={typed}
              msgs={get("msgs", 0)}
              typingNow={get("typing", false)}
              reactRow={get("reactRow", false)}
              reacted={get("reacted", false)}
              pollInChat={get("pollInChat", false)}
              pollOptions={pollOptions}
              voterCount={fri + sun}
              voted={voted}
              closed={closed}
              pinned={get("pinned", false)}
            />
          </PhoneShell>
        ) : (
          <PhoneShell title="This week" subtitle="Bello family">
            <WeekScreen />
          </PhoneShell>
        )}

        {get("push", false) && (
          <PhonePushBanner
            id="phone-push"
            title={`Riverside Ravens: ${SUBJECT}`}
            body={BODY}
          />
        )}
      </div>
    )

    return { desktop, phone: phoneNode }
  },
}

/* ── Desktop screens ──────────────────────────────────────────────────────── */

function ComposeScreen({
  typed,
  settled,
  audience,
  audOpen,
  recipients,
  subjectLen,
  bodyLen,
}: {
  typed: Typed
  settled: Typed
  audience: string
  audOpen: boolean
  recipients: number
  subjectLen: number
  bodyLen: number
}) {
  return (
    <>
      <MockBand
        eyebrow="Club workspace"
        title="Messages"
        description="Reach one team or the whole club. Consent is checked automatically on every send."
        action={
          recipients > 0 ? <MockPill tone="play">~{recipients} recipients</MockPill> : undefined
        }
      />
      <div className="bg-ink-50/60 min-h-0 flex-1 px-6 py-5">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] gap-6">
          <div className="space-y-3.5">
            <div>
              <MockListbox
                id="audience"
                label="Audience"
                value={audience}
                open={audOpen}
                placeholder="Select an audience"
                options={AUDIENCES}
              />
              <p className="text-ink-400 mt-1 text-[11px] leading-snug">
                Audiences are counted live from who is actually involved with the club.
              </p>
            </div>

            <div>
              <MockField id="field-subject" label="Subject">
                {typed("subject", "Tryouts for next season are open")}
              </MockField>
              <p className="text-ink-400 mt-1 text-right text-[11px] tabular-nums">
                {subjectLen}/150
              </p>
            </div>

            <MockTextArea
              id="field-body"
              label="Message"
              rows={5}
              counter={`${bodyLen}/5000`}
            >
              {typed("body", "Hi families,")}
            </MockTextArea>

            <MockButton id="send-message">Send message</MockButton>
          </div>

          <MockEmailPreview
            id="preview-pane"
            org="Riverside Ravens"
            subject={settled("subject", "Your subject line")}
            body={settled("body", "Your message will appear here as you type.")}
          />
        </div>
      </div>
    </>
  )
}

function SentScreen({ read }: { read: number }) {
  return (
    <>
      <MockBand
        eyebrow="Messages · Sent 2 minutes ago"
        title={SUBJECT}
        action={<MockPill tone="court">12 recipients</MockPill>}
      />
      <div className="bg-ink-50/60 min-h-0 flex-1 px-6 py-4">
        <div className="grid grid-cols-3 gap-3">
          <MockTile compact label="Delivered" value="12" tone="court" />
          <MockTile compact label="Skipped for consent" value="0" />
          <MockTile compact label="Audience" value={<span className="text-[15px]">U11 Girls Rep</span>} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <MockPanel title="What went out" meta="Dana Michaels">
            <div className="px-4 py-3">
              <p className="text-ink-400 text-[11px]">From Riverside Ravens via SportsHub</p>
              <p className="text-ink-950 mt-1.5 text-[14px] font-bold">{SUBJECT}</p>
              <p className="text-ink-700 mt-2 text-[12.5px] leading-relaxed">{BODY}</p>
              <div className="border-ink-100 mt-3 flex flex-wrap gap-1.5 border-t pt-2.5">
                <MockPill tone="play">Email</MockPill>
                <MockPill tone="play">Phone notification</MockPill>
                <MockPill tone="neutral">Team page</MockPill>
              </div>
            </div>
          </MockPanel>

          <MockPanel title="Read receipts" meta="Live">
            <MockReadMeter
              read={read}
              total={TEAM_SIZE}
              readers={FAMILIES}
              outstanding={read >= TEAM_SIZE - 1 && read < TEAM_SIZE ? [LAST_FAMILY] : []}
              remindId="remind"
            />
          </MockPanel>
        </div>
      </div>
    </>
  )
}

function PollsScreen({
  live,
  closed,
  options,
  voterCount,
}: {
  live: boolean
  closed: boolean
  options: MockPollOption[]
  voterCount: number
}) {
  return (
    <>
      <MockBand
        eyebrow="Club workspace"
        title="Polls"
        description="Ask the club or one team something, and keep the answer where everybody can find it."
        action={
          <MockButton id="new-poll" tone="court">
            New Poll
          </MockButton>
        }
      />
      <div className="bg-ink-50/60 min-h-0 flex-1 px-6 py-4">
        {live && (
          <section className="border-ink-100 live-row-in rounded-2xl border bg-white px-4 py-3.5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-ink-900 truncate text-[15px] font-bold">
                    Team dinner: Friday or Sunday?
                  </h3>
                  <MockPill tone={closed ? "neutral" : "court"}>
                    {closed ? "Closed" : "Open"}
                  </MockPill>
                  <MockPill tone="play">U11 Girls Rep</MockPill>
                </div>
                <p className="text-ink-400 mt-0.5 text-[11px]">
                  Dana Michaels · Sep 24 · {voterCount} {voterCount === 1 ? "vote" : "votes"}
                </p>
              </div>
              <div className="shrink-0">
                <MockButton id="close-poll" tone="quiet" size="sm">
                  {closed ? "Reopen" : "Close"}
                </MockButton>
              </div>
            </div>
            <div className="mt-3">
              <MockPollResults
                prompt=""
                options={options}
                voterCount={voterCount}
                staff
                closed={closed}
              />
            </div>
          </section>
        )}

        <MockPanel
          title="Earlier polls"
          meta="This season"
          className="mt-3"
          action={<MockPill tone="neutral">3 closed</MockPill>}
        >
          <MockRow
            title="Which weekend works for the season kickoff?"
            meta="Closed 4 September · 186 votes"
            right={<MockPill>Closed</MockPill>}
            muted
          />
          <MockRow
            title="Warm up shirt colour for the rep teams"
            meta="Closed 28 August · 141 votes"
            right={<MockPill>Closed</MockPill>}
            muted
          />
        </MockPanel>
      </div>
    </>
  )
}

/* ── Desktop dialogs ──────────────────────────────────────────────────────── */

/** The step between a draft and twelve inboxes. */
function ConfirmSendDialog({ open }: { open: boolean }) {
  return (
    <MockDialog
      open={open}
      title="Send to ~12 recipients?"
      subtitle="Recipients without marketing consent are skipped automatically."
      footer={
        <>
          <MockButton tone="quiet" size="sm">
            Cancel
          </MockButton>
          <MockButton id="confirm-send" size="sm">
            Send now
          </MockButton>
        </>
      }
    >
      <div className="border-ink-100 rounded-2xl border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Crest name="Riverside Ravens" size="sm" />
          <div className="min-w-0">
            <p className="text-ink-900 text-[13px] font-bold">{AUDIENCE_PICKED}</p>
            <p className="text-ink-500 text-[11px]">
              Every parent and guardian on the U11 Girls Rep roster.
            </p>
          </div>
        </div>
        <div className="border-ink-100 mt-2.5 border-t pt-2.5">
          <p className="text-ink-500 text-[11px] font-semibold uppercase tracking-[0.1em]">
            Subject
          </p>
          <p className="text-ink-900 mt-0.5 text-[13px] font-semibold">{SUBJECT}</p>
        </div>
      </div>
    </MockDialog>
  )
}

function NewPollDialog({
  open,
  typed,
  relay,
}: {
  open: boolean
  typed: Typed
  relay: boolean
}) {
  return (
    <MockDialog
      open={open}
      title="New poll"
      subtitle="Riverside Ravens · Fall 2026"
      footer={
        <>
          <MockButton tone="quiet" size="sm">
            Cancel
          </MockButton>
          <MockButton id="publish-poll" size="sm">
            Publish Poll
          </MockButton>
        </>
      }
    >
      <div className="space-y-3">
        <MockField id="field-poll-title" label="Title">
          {typed("pollTitle", "Which weekend works for the season kickoff?")}
        </MockField>

        <div className="border-ink-100 bg-ink-50/50 space-y-2 rounded-xl border p-3">
          <div className="flex items-center justify-between">
            <span className="text-ink-700 text-[11px] font-semibold uppercase tracking-[0.1em]">
              Question 1
            </span>
            <span className="text-ink-400 text-[11px]">Allow multiple choices</span>
          </div>
          <MockField id="field-opt1" label="Option 1">
            {typed("opt1", "Option 1")}
          </MockField>
          <MockField id="field-opt2" label="Option 2">
            {typed("opt2", "Option 2")}
          </MockField>
          <span className="text-play-600 block text-[11px] font-semibold">+ Add option</span>
        </div>

        <div className="border-ink-100 rounded-xl border p-3">
          <span
            data-demo-target="relay"
            className="flex items-center gap-2 transition-all duration-200 motion-reduce:transition-none data-[demo-press=true]:scale-[0.99]"
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${
                relay ? "border-play-600 bg-play-600" : "border-ink-300 bg-white"
              }`}
            >
              {relay && (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="4"
                  className="h-2.5 w-2.5"
                >
                  <path d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            <span className="text-ink-700 text-[12.5px] font-semibold">
              Also post to team chats
            </span>
          </span>
          <p className="text-ink-400 mt-1 text-[11px]">
            Off by default. Pick specific teams to post this poll into their chat too.
          </p>
          {relay && (
            <div className="live-row-in mt-2 flex flex-wrap gap-1.5">
              <MockPill tone="play">U11 Girls Rep</MockPill>
              <MockPill tone="neutral">U13 Girls Rep</MockPill>
              <MockPill tone="neutral">U16 Boys Rep</MockPill>
            </div>
          )}
        </div>
      </div>
    </MockDialog>
  )
}

/* ── Phone screens ────────────────────────────────────────────────────────── */

function WeekScreen() {
  return (
    <div className="space-y-2">
      <p className="text-ink-500 mb-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
        Amara · U11 Girls Rep
      </p>
      <WeekRow day="Thu" title="Practice" meta="6:00 PM · Riverside CC, Court 1" />
      <WeekRow day="Sat" title="Game vs Lakeshore Lightning" meta="9:00 AM · Home" />
      <WeekRow day="Tue" title="Practice" meta="6:00 PM · Riverside CC, Court 1" />
      <p className="text-ink-500 mb-1 mt-3 text-[10px] font-semibold uppercase tracking-[0.12em]">
        Noah · U13 Boys Rep
      </p>
      <WeekRow day="Fri" title="Practice" meta="7:30 PM · Northside HS" />
    </div>
  )
}

function WeekRow({ day, title, meta }: { day: string; title: string; meta: string }) {
  return (
    <div className="border-ink-100 flex items-center gap-2.5 rounded-xl border bg-white px-2.5 py-2">
      <span className="bg-court-50 text-court-700 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold uppercase">
        {day}
      </span>
      <div className="min-w-0">
        <p className="text-ink-900 truncate text-[12px] font-semibold">{title}</p>
        <p className="text-ink-400 truncate text-[10.5px]">{meta}</p>
      </div>
    </div>
  )
}

/**
 * The thread. Everything the story adds to it arrives in the same column, so
 * the screen never reflows around the pointer: the pinned strip sits above the
 * day marker, the poll comes in under the last bubble, and the composer is
 * pinned to the bottom of the phone the whole time.
 */
function ChatScreen({
  typed,
  msgs,
  typingNow,
  reactRow,
  reacted,
  pollInChat,
  pollOptions,
  voterCount,
  voted,
  closed,
  pinned,
}: {
  typed: Typed
  msgs: number
  typingNow: boolean
  reactRow: boolean
  reacted: boolean
  pollInChat: boolean
  pollOptions: MockPollOption[]
  voterCount: number
  voted: boolean
  closed: boolean
  pinned: boolean
}) {
  return (
    <div className="flex h-full flex-col">
      {pinned && (
        <div className="mb-1.5 shrink-0">
          <PhonePinnedStrip author="Dana Michaels">
            Team dinner is Friday after practice.
          </PhonePinnedStrip>
        </div>
      )}

      {/* The phone frame never scrolls, so the thread makes room the way a real
          thread does: once the poll arrives, the oldest message is above the
          fold. Both trims happen on beats with no pointer on screen. */}
      <div className="min-h-0 flex-1">
        {!pollInChat && (
          <>
            <PhoneChatDay>Today</PhoneChatDay>
            <PhoneChatBubble
              author="Dana Michaels"
              context="Head coach"
              staff
              time="4:12 PM"
            >
              Gym change is up on the team page. Riverside CC, Court 2 on Saturday.
            </PhoneChatBubble>
          </>
        )}

        {msgs >= 1 && (
          <PhoneChatBubble mine author="You" time="4:31 PM">
            Is 8:30 for warmup or just doors open?
          </PhoneChatBubble>
        )}

        {typingNow && <PhoneTypingLine name="Dana Michaels" />}

        {msgs >= 2 && (
          <PhoneChatBubble
            author="Dana Michaels"
            context="Head coach"
            staff
            time="4:32 PM"
            reactId="react-thumb"
            showReactRow={reactRow}
            reactions={reacted ? [{ emoji: "👍", count: 1, mine: true }] : undefined}
          >
            Doors at 8:30, warmup starts 8:40. Full kit please.
          </PhoneChatBubble>
        )}

        {pollInChat && (
          <PhonePollBubble
            question="Team dinner: Friday or Sunday?"
            options={pollOptions}
            voterCount={voterCount}
            voted={voted}
            closed={closed}
            idPrefix="vote"
          />
        )}
      </div>

      {/* Sending empties the box, the way it does in the product. */}
      <div className="-mx-3 -mb-3 mt-1 shrink-0">
        <PhoneChatComposer inputId="chat-input" sendId="chat-send">
          {msgs >= 1 ? (
            <span className="text-ink-400">Message the team…</span>
          ) : (
            typed("question", "Message the team…")
          )}
        </PhoneChatComposer>
      </div>
    </div>
  )
}

/* ── Bits ─────────────────────────────────────────────────────────────────── */

/** Renders one state key as text that types itself when the beat says so. */
type Typed = (key: string, placeholder?: string) => ReactNode
