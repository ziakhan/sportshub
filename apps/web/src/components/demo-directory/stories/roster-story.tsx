"use client"

import type { ReactNode } from "react"
import { TypeText } from "../motion"
import {
  MockBand,
  MockButton,
  MockChips,
  MockChoiceCards,
  MockCounter,
  MockDialog,
  MockEmptyState,
  MockEndCard,
  MockField,
  MockListbox,
  MockPanel,
  MockPill,
  MockRosterTable,
  MockRow,
  MockTile,
  MockTopBar,
  PhoneAction,
  PhoneLabel,
  PhoneMoneyRow,
  PhoneOfferCard,
  PhoneProgramCard,
  PhoneSheet,
  PhoneShell,
  PhoneSuccess,
  type MockRosterPlayer,
} from "../mock-ui"
import { Crest } from "@/components/ui/crest"
import { PlayerMug } from "@/components/ui/player-mug"
import type { DemoScript } from "../types"

/**
 * Story 1: "Build a team, fill the roster" (full cut, 2026-08-15).
 *
 * The first cut stopped at the tryout reaching a phone, and the owner ruled it
 * incomplete: a story about filling a roster has to END WITH THE ROSTER FILLED.
 * This is the whole arc, in five chapters, and it obeys the content law that
 * came with the ruling.
 *
 * THE CONTENT LAW (owner, 2026-08-15). A demo earns its length by showing the
 * PAINFUL DETAIL the product removes, never by montaging past it. Named
 * explicitly for this story: after the parent accepts, the demo SHOWS THE
 * DETAILS SUBMISSION — uniform size, tracksuit size, shoe size and jersey
 * number — because collecting those is, in the owner's words, "a very hard,
 * troublesome period for the parents in the club". Chapter four is therefore
 * the longest chapter in the cut, and every field is picked on camera.
 *
 * TRUTH TO THE PRODUCT. The mock beats mirror real surfaces field for field:
 *   · the accept flow — apps/web/src/app/(platform)/offers/offer-response-form.tsx
 *     (package, uniform / tracksuit / shoe listboxes, jersey preferences 1st
 *     and 2nd, pay in full against a payment plan with the schedule written
 *     out, the card already on file, "Pay $X & Accept");
 *   · the roster — app/(platform)/clubs/[id]/teams/[teamId]/roster/page.tsx
 *     (mug carrying the jersey number, player, position, uniform, tracksuit,
 *     shoes, waivers, finalized) and its "No players on roster" empty state;
 *   · the tryout signups table and its per-player "Make offer".
 *
 * MOTION. Nothing pans, zooms or scrolls. The stage is fixed, the phone slides
 * into a slot reserved from the first frame, screens crossfade in place, and
 * every state a beat sets is derived by replaying beats, so a chapter jump
 * lands on exactly the same frame as watching it through.
 */

/* ── Cast ────────────────────────────────────────────────────────────────── */

const ROSTER: MockRosterPlayer[] = [
  { name: "Amara Bello", number: "23", position: "Guard", uniform: "YM", tracksuit: "YL", shoes: "7" },
  { name: "Sofia Njoku", number: "3", position: "Guard", uniform: "YM", tracksuit: "YM", shoes: "6.5" },
  { name: "Hannah Reyes", number: "5", position: "Forward", uniform: "YL", tracksuit: "YL", shoes: "7.5" },
  { name: "Mia Kaur", number: "7", position: "Guard", uniform: "YS", tracksuit: "YM", shoes: "6" },
  { name: "Elena Petrov", number: "8", position: "Forward", uniform: "YL", tracksuit: "YL", shoes: "7" },
  { name: "Zara Ahmed", number: "10", position: "Centre", uniform: "AS", tracksuit: "AS", shoes: "8" },
  { name: "Chloe Tremblay", number: "11", position: "Guard", uniform: "YM", tracksuit: "YM", shoes: "6.5" },
  { name: "Ava Donnelly", number: "12", position: "Forward", uniform: "YM", tracksuit: "YL", shoes: "7" },
  { name: "Leila Haddad", number: "14", position: "Guard", uniform: "YS", tracksuit: "YS", shoes: "5.5" },
  { name: "Nora Fitzgerald", number: "21", position: "Centre", uniform: "AS", tracksuit: "AM", shoes: "8.5" },
]

const EXISTING_TEAMS = [
  { name: "U9 Boys Development", meta: "Fall 2026 · House", roster: "11 of 12" },
  { name: "U11 Boys Rep", meta: "Fall 2026 · Rep", roster: "10 of 10" },
  { name: "U13 Girls Rep", meta: "Fall 2026 · Rep", roster: "12 of 12" },
  { name: "U13 Boys Rep", meta: "Fall 2026 · Rep", roster: "11 of 12" },
  { name: "U16 Girls Rep", meta: "Fall 2026 · Rep", roster: "10 of 12" },
  { name: "U16 Boys Rep", meta: "Fall 2026 · Rep", roster: "12 of 12" },
]

const SIGNUPS = [
  { name: "Sofia Njoku", born: "2015", paid: true },
  { name: "Hannah Reyes", born: "2015", paid: true },
  { name: "Mia Kaur", born: "2016", paid: true },
  { name: "Elena Petrov", born: "2015", paid: true },
]

/** Clothing sizes, trimmed to the five a U11 team actually orders. */
const CLOTHING = [
  { value: "YS", label: "YS" },
  { value: "YM", label: "YM" },
  { value: "YL", label: "YL" },
  { value: "AS", label: "AS" },
  { value: "AM", label: "AM" },
]
const SHOES = ["5.5", "6", "6.5", "7", "7.5", "8"].map((s) => ({ value: s, label: s }))

const URL_TEAMS = "/manage/clubs/riverside-ravens/teams"
const URL_ROSTER = "/manage/clubs/riverside-ravens/teams/u11-girls-rep/roster"
const URL_PROGRAMS = "/manage/clubs/riverside-ravens/programs"
const URL_SIGNUPS = "/manage/clubs/riverside-ravens/tryouts/u11-girls-fall/signups"

export const rosterStory: DemoScript = {
  desktopUrl: URL_TEAMS,
  initialStage: "desktop",
  chapters: [
    { id: "build", title: "Build the team" },
    { id: "post", title: "Post the tryout" },
    { id: "family", title: "A family signs up" },
    { id: "offer", title: "The offer, accepted" },
    { id: "roster", title: "The roster fills" },
  ],

  beats: [
    /* ── 1. Build the team ────────────────────────────────────────────── */
    {
      id: "teams-open",
      chapter: "build",
      caption:
        "Riverside Ravens run six teams this fall. The U11 girls team does not exist yet.",
      hold: 2800,
      set: { screen: "teams" },
    },
    {
      id: "press-new-team",
      chapter: "build",
      caption: "Creating it is one button and one short form.",
      hold: 1900,
      cursor: "new-team",
      press: true,
      set: { dialog: "team" },
    },
    {
      id: "type-team-name",
      chapter: "build",
      caption: "Name the team.",
      hold: 2500,
      cursor: "field-team-name",
      type: { key: "teamName", text: "U11 Girls Rep" },
    },
    {
      id: "pick-age",
      chapter: "build",
      caption: "Age group is a set of chips, not a dropdown to hunt through.",
      hold: 1800,
      cursor: "chip-age-U11",
      press: true,
      set: { age: "U11" },
    },
    {
      id: "pick-gender",
      chapter: "build",
      caption: "Division next.",
      hold: 1600,
      cursor: "chip-gender-Girls",
      press: true,
      set: { gender: "Girls" },
    },
    {
      id: "open-coach",
      chapter: "build",
      caption: "The head coach is already on staff, so she is one pick away.",
      hold: 1700,
      cursor: "coach",
      press: true,
      set: { coachOpen: true },
    },
    {
      id: "pick-coach",
      chapter: "build",
      caption: "Dana Michaels takes the team. Her access starts the moment it is saved.",
      hold: 2000,
      cursor: "coach-opt-dana",
      press: true,
      set: { coach: "Dana Michaels", coachOpen: false },
    },
    {
      id: "create-team",
      chapter: "build",
      caption: "The team exists.",
      hold: 2500,
      cursor: "create-team",
      press: true,
      toast: "Team created",
      url: URL_ROSTER,
      set: { dialog: "", teamCreated: true, screen: "roster", roster: 0 },
    },
    {
      id: "empty-roster",
      chapter: "build",
      caption:
        "And the roster behind it is empty, which is the actual work every club starts the season with.",
      hold: 2800,
    },

    /* ── 2. Post the tryout ───────────────────────────────────────────── */
    {
      id: "programs-open",
      chapter: "post",
      caption: "Nobody tries out for a team they cannot find, so the tryout goes up next.",
      hold: 2500,
      url: URL_PROGRAMS,
      set: { screen: "programs" },
    },
    {
      id: "press-post",
      chapter: "post",
      caption: "One button opens the form. Nothing to set up first.",
      hold: 1800,
      cursor: "post-tryout",
      press: true,
      set: { dialog: "tryout" },
    },
    {
      id: "type-title",
      chapter: "post",
      caption: "Name it.",
      hold: 2500,
      cursor: "field-title",
      type: { key: "title", text: "U11 Girls Fall Tryout" },
    },
    {
      id: "pick-when",
      chapter: "post",
      caption: "Pick the date and the gym that is already on file.",
      hold: 2200,
      cursor: "field-when",
      set: {
        when: "Saturday 12 September, 6:00 PM",
        gym: "Riverside Community Centre, Court 2",
      },
    },
    {
      id: "type-fee",
      chapter: "post",
      caption: "Set the tryout fee. It is collected when a family registers, not at the door.",
      hold: 2100,
      cursor: "field-fee",
      type: { key: "fee", text: "25" },
      emphasize: true,
      callout:
        "The fee is charged at registration, so no volunteer is standing at the door with a cash box on tryout night.",
    },
    {
      id: "publish",
      chapter: "post",
      caption: "Published to the club page, the league listing and the marketplace in one press.",
      hold: 2600,
      cursor: "publish-tryout",
      press: true,
      toast: "Tryout published",
      set: { dialog: "", published: true, openPrograms: "1" },
    },

    /* ── 3. A family signs up ─────────────────────────────────────────── */
    {
      id: "phone-in",
      chapter: "family",
      caption:
        "Over the next week thirteen families register. This is the fourteenth, on her phone.",
      hold: 2800,
      stage: "split",
      url: URL_SIGNUPS,
      set: { screen: "signups", signups: 13, phone: "programs" },
    },
    {
      id: "press-register",
      chapter: "family",
      caption: "She found the club through the league listing. Registering starts on the card.",
      hold: 2200,
      cursor: "phone-register",
      press: true,
      set: { phone: "register" },
    },
    {
      id: "pick-kid",
      chapter: "family",
      caption: "She picks which of her two kids is trying out. Both are already on her account.",
      hold: 2100,
      cursor: "chip-kid-amara",
      press: true,
      set: { kid: "amara" },
    },
    {
      id: "press-pay",
      chapter: "family",
      caption: "The tryout fee is paid here, in the same flow, not in cash at the gym door.",
      hold: 2300,
      cursor: "phone-pay",
      press: true,
      set: { paySheet: true },
    },
    {
      id: "confirm-pay",
      chapter: "family",
      caption: "Two taps with the card already on file, and the club side updates as she does it.",
      hold: 3000,
      cursor: "phone-pay-confirm",
      press: true,
      set: { paySheet: false, phone: "registered", signups: 14, newSignup: true },
    },
    {
      id: "club-count",
      chapter: "family",
      caption:
        "Fourteen registered, fourteen paid, and nobody is reconciling a list against a cash box.",
      hold: 2600,
    },

    /* ── 4. The offer, accepted properly ──────────────────────────────── */
    {
      id: "hover-offer",
      chapter: "offer",
      caption: "The tryout runs. The coach picks his team, and every pick is an offer.",
      hold: 2200,
      cursor: "make-offer",
    },
    {
      id: "press-offer",
      chapter: "offer",
      caption: "Offers go out from the signup list itself.",
      hold: 1900,
      cursor: "make-offer",
      press: true,
      set: { dialog: "offer" },
    },
    {
      id: "offer-package",
      chapter: "offer",
      caption: "The offer carries the package, the fee, the gear and the deadline to respond.",
      hold: 2400,
      cursor: "field-package",
      set: { offerReady: true },
    },
    {
      id: "send-offer",
      chapter: "offer",
      caption: "Sent.",
      hold: 2400,
      cursor: "send-offer",
      press: true,
      toast: "Offer sent to the Bello family",
      set: { dialog: "", offerSent: true },
    },
    {
      id: "phone-offer",
      chapter: "offer",
      caption: "It arrives as an offer she can act on, not an email thread she has to answer.",
      hold: 2700,
      set: { phone: "offer" },
    },
    {
      id: "press-accept",
      chapter: "offer",
      caption:
        "Accepting opens the part clubs chase families for all season. It happens once, here.",
      hold: 2500,
      cursor: "phone-accept",
      press: true,
      set: { phone: "accept" },
    },
    {
      id: "pick-uniform",
      chapter: "offer",
      caption: "Uniform size.",
      hold: 1800,
      cursor: "chip-uniform-YM",
      press: true,
      set: { uniform: "YM" },
      emphasize: true,
      callout:
        "Sizes are collected here, so nobody chases families in a group chat later.",
    },
    {
      id: "pick-tracksuit",
      chapter: "offer",
      caption: "Tracksuit size.",
      hold: 1700,
      cursor: "chip-tracksuit-YL",
      press: true,
      set: { tracksuit: "YL" },
    },
    {
      id: "open-shoe",
      chapter: "offer",
      caption: "Shoe size, in half sizes, because that is how shoes are ordered.",
      hold: 1700,
      cursor: "shoe",
      press: true,
      set: { shoeOpen: true },
    },
    {
      id: "pick-shoe",
      chapter: "offer",
      caption: "Picked.",
      hold: 1800,
      cursor: "shoe-opt-7",
      press: true,
      set: { shoe: "7", shoeOpen: false },
    },
    {
      id: "type-jersey",
      chapter: "offer",
      caption: "Jersey number, first choice.",
      hold: 2200,
      cursor: "field-jersey1",
      type: { key: "jersey1", text: "23" },
    },
    {
      id: "type-jersey-2",
      chapter: "offer",
      caption: "And a fallback, in case another kid on the team already wears it.",
      hold: 2000,
      cursor: "field-jersey2",
      type: { key: "jersey2", text: "3" },
    },
    {
      id: "pick-plan",
      chapter: "offer",
      caption:
        "The club offered a payment plan, so she takes it. The schedule is spelled out before she agrees to it.",
      hold: 2900,
      cursor: "plan-INSTALLMENTS",
      press: true,
      set: { plan: "INSTALLMENTS" },
    },
    {
      id: "accept-pay",
      chapter: "offer",
      caption:
        "One pass on a phone: sizes, number, plan, deposit, waiver. This is the six weeks of chasing that clubs do every single season.",
      hold: 3200,
      cursor: "phone-accept-pay",
      press: true,
      toast: "Offer accepted",
      set: { phone: "accepted", accepted: true },
    },

    /* ── 5. The roster fills itself ───────────────────────────────────── */
    {
      id: "roster-first",
      chapter: "roster",
      caption:
        "Everything she chose is already on the roster: number 23, three sizes, waiver signed at accept. Nobody typed it twice.",
      hold: 3300,
      stage: "desktop",
      url: URL_ROSTER,
      set: { screen: "roster", roster: 1, rosterFrom: 0 },
    },
    {
      id: "roster-four",
      chapter: "roster",
      caption: "The rest of the offers come back over the week.",
      hold: 2200,
      set: { roster: 4, rosterFrom: 1 },
    },
    {
      id: "roster-seven",
      chapter: "roster",
      caption: "Every one of them arrives the same way, finished.",
      hold: 2000,
      set: { roster: 7, rosterFrom: 4 },
    },
    {
      id: "roster-full",
      chapter: "roster",
      caption:
        "Ten players, ten sets of sizes, ten signed waivers, ten fees on plan or paid. None of it chased.",
      hold: 3300,
      toast: "Roster complete",
      set: { roster: 10, rosterFrom: 7 },
      emphasize: "roster-tiles",
      callout:
        "Every counter filled itself as families accepted, so the club knows the team is ready without auditing a spreadsheet.",
    },
    {
      id: "end-card",
      chapter: "roster",
      caption: "That is one team, from an empty page to a full roster.",
      hold: 4200,
      set: { endCard: true },
    },
  ],

  render: ({ get, typingKey }) => {
    const screen = get<string>("screen", "teams")
    const dialog = get<string>("dialog", "")
    const phone = get<string>("phone", "")
    const endCard = get("endCard", false)

    /* One field types at a time, and which one is a property of the beat. The
       screens take this closure rather than the raw key, so no component has
       to know how the script names its state. */
    const typed: Typed = (key, placeholder) => (
      <TypeText text={get<string>(key, "")} typing={typingKey === key} placeholder={placeholder} />
    )

    /* ── Desktop ──────────────────────────────────────────────────────── */

    const activeTab =
      screen === "programs" || screen === "signups" ? "Programs" : "Teams"

    const desktop = (
      <div className="relative flex h-full flex-col">
        <MockTopBar
          workspace="Riverside Ravens"
          tabs={["Dashboard", "Teams", "Programs", "Payments", "People"]}
          activeTab={activeTab}
        />

        {/* Screens crossfade in place: opacity only, so nothing the pointer
            is aiming at ever moves under it. */}
        <div key={screen} className="demo-fade-in flex min-h-0 flex-1 flex-col">
          {screen === "teams" && <TeamsScreen teamCreated={get("teamCreated", false)} />}
          {screen === "roster" && (
            <RosterScreen count={get("roster", 0)} from={get("rosterFrom", 0)} />
          )}
          {screen === "programs" && (
            <ProgramsScreen
              published={get("published", false)}
              openPrograms={get<string>("openPrograms", "0")}
            />
          )}
          {screen === "signups" && (
            <SignupsScreen
              count={get("signups", 13)}
              fresh={get("newSignup", false)}
              offerSent={get("offerSent", false)}
            />
          )}
        </div>

        <CreateTeamDialog
          open={dialog === "team"}
          typed={typed}
          age={get<string>("age", "")}
          gender={get<string>("gender", "")}
          coach={get<string>("coach", "")}
          coachOpen={get("coachOpen", false)}
        />
        <PostTryoutDialog
          open={dialog === "tryout"}
          typed={typed}
          when={get<string>("when", "")}
          gym={get<string>("gym", "")}
        />
        <SendOfferDialog open={dialog === "offer"} ready={get("offerReady", false)} />

        {endCard && (
          <MockEndCard
            eyebrow="Story 1 of 10"
            title="Build a team, fill the roster"
            line="Posted, registered, paid, offered, accepted and rostered. One club, one family, no spreadsheet in sight."
            next="Everyone in the loop"
          />
        )}
      </div>
    )

    /* ── Phone ────────────────────────────────────────────────────────── */

    const phoneNode = (
      <div className="relative h-full">
        {phone === "register" ? (
          <PhoneShell title="U11 Girls Fall Tryout" subtitle="Riverside Ravens">
            <RegisterScreen kid={get<string>("kid", "")} />
          </PhoneShell>
        ) : phone === "registered" ? (
          <PhoneShell title="You are registered" subtitle="Riverside Ravens">
            <PhoneSuccess
              title="Amara is registered for the U11 Girls Fall Tryout"
              body="It is on your calendar, and the club has her details already."
              rows={[
                { label: "When", value: "Sat 12 Sep, 6:00 PM" },
                { label: "Where", value: "Riverside CC, Court 2" },
                { label: "Paid", value: "$25.00" },
              ]}
            />
          </PhoneShell>
        ) : phone === "offer" ? (
          <PhoneShell title="You have an offer" subtitle="Riverside Ravens">
            <PhoneOfferCard
              club="Riverside Ravens"
              team="U11 Girls Rep"
              season="Fall 2026"
              packageLabel="Full season, gear included"
              includes="Uniform, tracksuit, shoes and a game ball. 3 practices a week plus league games."
              fee="$525.00"
              expires="Friday 19 September"
              acceptId="phone-accept"
            />
          </PhoneShell>
        ) : phone === "accept" ? (
          <PhoneShell title="Accept the offer" subtitle="U11 Girls Rep">
            <AcceptScreen
              typed={typed}
              uniform={get<string>("uniform", "")}
              tracksuit={get<string>("tracksuit", "")}
              shoe={get<string>("shoe", "")}
              shoeOpen={get("shoeOpen", false)}
              plan={get<string>("plan", "")}
            />
          </PhoneShell>
        ) : phone === "accepted" ? (
          <PhoneShell title="Amara is on the team" subtitle="U11 Girls Rep">
            <PhoneSuccess
              title="Amara Bello is on the U11 Girls Rep roster"
              body="Her sizes and number went to the club with the acceptance. Practices are already on your calendar."
              rows={[
                { label: "Jersey", value: "23" },
                { label: "Uniform / tracksuit", value: "YM / YL" },
                { label: "Shoes", value: "7" },
                { label: "Paid today", value: "$175.00" },
                { label: "Next payment", value: "15 Oct, $175.00" },
              ]}
            />
          </PhoneShell>
        ) : (
          <PhoneShell title="Riverside Ravens" subtitle="Following">
            <p className="text-ink-500 mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em]">
              Programs near you
            </p>
            <div className="space-y-2.5">
              <PhoneProgramCard
                kind="Tryout"
                title="U11 Girls Fall Tryout"
                club="Riverside Ravens"
                meta="Saturday 12 September, 6:00 PM at Riverside Community Centre"
                fee="$25"
                action="Register"
                actionId="phone-register"
              />
              <PhoneProgramCard
                kind="House league"
                title="House League Fall registration"
                club="Riverside Ravens"
                meta="Opens 1 September, ages 8 to 14"
                fee="$210"
              />
            </div>
          </PhoneShell>
        )}

        <PhoneSheet
          open={get("paySheet", false)}
          title="Pay $25.00"
          subtitle="Tryout fee for Amara Bello"
        >
          <div className="space-y-3">
            <div className="border-ink-100 rounded-xl border bg-white px-3 py-2">
              <PhoneMoneyRow label="U11 Girls Fall Tryout" value="$25.00" />
              <PhoneMoneyRow label="Due now" value="$25.00" strong />
            </div>
            <div className="border-ink-200 flex items-center gap-2 rounded-xl border bg-white px-2.5 py-2">
              <span className="bg-ink-900 flex h-5 w-7 shrink-0 items-center justify-center rounded text-[7px] font-bold uppercase tracking-wide text-white">
                Visa
              </span>
              <span className="text-ink-800 text-[12px] font-semibold">•••• 4242</span>
              <MockPill tone="neutral">Default</MockPill>
            </div>
            <PhoneAction id="phone-pay-confirm">Pay $25.00</PhoneAction>
            <p className="text-ink-400 text-center text-[10px]">
              Card handled by Stripe. The club never sees the number.
            </p>
          </div>
        </PhoneSheet>
      </div>
    )

    return { desktop, phone: phoneNode }
  },
}

/* ── Desktop screens ──────────────────────────────────────────────────────── */

function TeamsScreen({ teamCreated }: { teamCreated: boolean }) {
  return (
    <>
      <MockBand
        eyebrow="Club workspace"
        title="Teams"
        description="Every team the club runs this season, with the roster each one is carrying."
        action={
          <MockButton id="new-team" icon={<PlusIcon />}>
            Create a team
          </MockButton>
        }
      />
      <div className="bg-ink-50/60 min-h-0 flex-1 px-6 py-5">
        <div className="grid grid-cols-3 gap-3">
          {EXISTING_TEAMS.map((t) => (
            <TeamCard key={t.name} {...t} />
          ))}
          {teamCreated && (
            <TeamCard
              name="U11 Girls Rep"
              meta="Fall 2026 · Rep · Dana Michaels"
              roster="0 of 10"
              fresh
            />
          )}
        </div>
      </div>
    </>
  )
}

function TeamCard({
  name,
  meta,
  roster,
  fresh,
}: {
  name: string
  meta: string
  roster: string
  fresh?: boolean
}) {
  const empty = roster.startsWith("0 ")
  return (
    <div
      className={`border-ink-100 rounded-2xl border bg-white px-3.5 py-3 shadow-[0_10px_28px_-24px_rgba(15,23,42,0.6)] ${
        fresh ? "live-row-in ring-play-200 ring-2" : ""
      }`}
    >
      <div className="flex items-center gap-2.5">
        <Crest name={name} size="sm" />
        <div className="min-w-0">
          <p className="text-ink-900 truncate text-[13px] font-bold leading-tight">{name}</p>
          <p className="text-ink-400 truncate text-[11px]">{meta}</p>
        </div>
      </div>
      <div className="mt-2.5">
        <MockPill tone={empty ? "hoop" : "court"}>Roster {roster}</MockPill>
      </div>
    </div>
  )
}

function RosterScreen({ count, from }: { count: number; from: number }) {
  const players = ROSTER.slice(0, count)
  const complete = count >= ROSTER.length
  return (
    <>
      <MockBand
        eyebrow="U11 Girls Rep · Fall 2026 · Dana Michaels"
        title="Roster"
        action={
          <MockPill tone={complete ? "court" : count === 0 ? "hoop" : "gold"}>
            {complete ? "Roster complete" : count === 0 ? "Nobody on it yet" : "Filling"}
          </MockPill>
        }
      />
      <div className="bg-ink-50/60 min-h-0 flex-1 px-6 py-4">
        {/* The four counters are one object as far as the script is concerned:
            the roster-complete beat rings them together. */}
        <div data-demo-target="roster-tiles" className="grid grid-cols-4 gap-3">
          <MockTile
            compact
            label="Roster"
            tone={complete ? "court" : "neutral"}
            value={
              <span>
                <MockCounter value={count} /> of {ROSTER.length}
              </span>
            }
          />
          <MockTile
            compact
            label="Sizes recorded"
            value={
              <span>
                <MockCounter value={count} /> of {ROSTER.length}
              </span>
            }
          />
          <MockTile
            compact
            label="Waivers signed"
            tone={complete ? "court" : "neutral"}
            value={
              <span>
                <MockCounter value={count} /> of {ROSTER.length}
              </span>
            }
          />
          <MockTile compact label="Fees paid or on plan" value={<MockCounter value={count} />} />
        </div>

        <MockPanel
          title="Players"
          meta={complete ? "Kit order ready" : "Offers still out"}
          className="mt-3"
          action={<MockPill tone="play">Fall 2026</MockPill>}
        >
          {count === 0 ? (
            <div className="px-6 py-6">
              <MockEmptyState
                title="No players on roster"
                body="Players appear here once they accept their offers."
                icon={<PeopleIcon />}
              />
            </div>
          ) : (
            <MockRosterTable players={players} freshFrom={from} />
          )}
        </MockPanel>
      </div>
    </>
  )
}

function ProgramsScreen({
  published,
  openPrograms,
}: {
  published: boolean
  openPrograms: string
}) {
  return (
    <>
      <MockBand
        eyebrow="Club workspace"
        title="Programs"
        description="Tryouts, camps and house leagues families can find and pay for."
        action={
          <MockButton id="post-tryout" icon={<PlusIcon />}>
            Post a tryout
          </MockButton>
        }
      />
      <div className="bg-ink-50/60 min-h-0 flex-1 px-6 py-5">
        <div className="grid grid-cols-4 gap-3">
          <MockTile label="Teams" value="7" />
          <MockTile label="Registered players" value="74" />
          <MockTile
            label="Open programs"
            value={openPrograms}
            tone={published ? "court" : "neutral"}
          />
          <MockTile label="Waitlist" value="12" tone="hoop" />
        </div>

        <MockPanel
          title="This season"
          meta="Fall 2026"
          className="mt-4"
          action={<MockPill tone="neutral">4 programs</MockPill>}
        >
          {published && (
            <div className="live-row-in border-court-100 bg-court-50/50 flex items-center gap-3 border-b px-4 py-3">
              <span className="bg-court-600 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white">
                <CheckIcon />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-ink-900 truncate text-[13px] font-semibold">
                  U11 Girls Fall Tryout
                </p>
                <p className="text-ink-500 truncate text-[11px]">
                  Saturday 12 September, 6:00 PM at Riverside Community Centre
                </p>
              </div>
              <MockPill tone="court">Published</MockPill>
            </div>
          )}
          <MockRow
            title="House League Fall registration"
            meta="Opens 1 September, 48 spots"
            right={<MockPill tone="gold">Draft</MockPill>}
          />
          <MockRow
            title="Spring Skills Camp"
            meta="Finished 22 June, 36 registered"
            right={<MockPill>Closed</MockPill>}
            muted
          />
          <MockRow
            title="U16 Girls Fall Tryout"
            meta="Saturday 12 September, 8:00 PM"
            right={<MockPill tone="gold">Draft</MockPill>}
          />
        </MockPanel>
      </div>
    </>
  )
}

function SignupsScreen({
  count,
  fresh,
  offerSent,
}: {
  count: number
  fresh: boolean
  offerSent: boolean
}) {
  return (
    <>
      <MockBand
        eyebrow="U11 Girls Fall Tryout · 12 September"
        title="Signups"
        action={<MockPill tone="court">Open</MockPill>}
      />
      <div className="bg-ink-50/60 min-h-0 flex-1 px-6 py-4">
        <div className="grid grid-cols-4 gap-3">
          <MockTile
            label="Registered"
            tone="court"
            value={<MockCounter value={count} />}
          />
          <MockTile label="Fees paid" value={<MockCounter value={count} />} />
          <MockTile label="Spots at the tryout" value="24" />
          <MockTile label="Offers out" value={offerSent ? "1" : "0"} tone="hoop" />
        </div>

        <MockPanel
          title="Signups"
          meta="Five most recent"
          className="mt-3"
          action={<MockPill tone="neutral">All paid</MockPill>}
        >
          {fresh && (
            <SignupRow
              name="Amara Bello"
              born="2015"
              fresh
              action={
                offerSent ? (
                  <MockPill tone="play">Offer sent</MockPill>
                ) : (
                  <MockButton id="make-offer" size="sm" tone="court">
                    Make offer
                  </MockButton>
                )
              }
            />
          )}
          {SIGNUPS.map((s) => (
            <SignupRow key={s.name} name={s.name} born={s.born} />
          ))}
        </MockPanel>
      </div>
    </>
  )
}

function SignupRow({
  name,
  born,
  fresh,
  action,
}: {
  name: string
  born: string
  fresh?: boolean
  action?: React.ReactNode
}) {
  return (
    <div
      className={`border-ink-50 flex items-center gap-3 border-b px-4 py-2 last:border-b-0 ${
        fresh ? "live-row-in bg-court-50/40" : ""
      }`}
    >
      <PlayerMug name={name} accentKey={name} sizeClassName="h-7 w-7 rounded-full" />
      <div className="min-w-0 flex-1">
        <p className="text-ink-900 truncate text-[12.5px] font-semibold">{name}</p>
        <p className="text-ink-400 truncate text-[11px]">Born {born} · Registered and paid</p>
      </div>
      <MockPill tone="court">Paid $25</MockPill>
      <div className="w-[104px] text-right">{action}</div>
    </div>
  )
}

/* ── Desktop dialogs ──────────────────────────────────────────────────────── */

function CreateTeamDialog({
  open,
  typed,
  age,
  gender,
  coach,
  coachOpen,
}: {
  open: boolean
  typed: Typed
  age: string
  gender: string
  coach: string
  coachOpen: boolean
}) {
  return (
    <MockDialog
      open={open}
      title="Create a team"
      subtitle="Rosters, schedules and payments all hang off the team you make here."
      footer={
        <>
          <MockButton tone="quiet" size="sm">
            Cancel
          </MockButton>
          <MockButton id="create-team" size="sm">
            Create team
          </MockButton>
        </>
      }
    >
      <div className="space-y-3.5">
        <MockField id="field-team-name" label="Team name">
          {typed("teamName", "Name this team")}
        </MockField>
        {/* The coach picker sits ABOVE the chips on purpose: its popover opens
            downward, and the dialog clips at its own rounded edge. */}
        <div className="grid grid-cols-2 gap-4">
          <MockListbox
            id="coach"
            label="Head coach"
            value={coach}
            open={coachOpen}
            placeholder="Choose from staff"
            options={[
              { value: "dana", label: "Dana Michaels" },
              { value: "priya", label: "Priya Raman" },
              { value: "marcus", label: "Marcus Webb" },
              { value: "sam", label: "Sam Oduya" },
            ]}
          />
          <MockField label="Season">
            <span className="text-ink-900">Fall 2026</span>
          </MockField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-ink-600 mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em]">
              Age group
            </span>
            <MockChips
              idPrefix="chip-age"
              value={age}
              options={["U9", "U11", "U13", "U16"].map((v) => ({ value: v, label: v }))}
            />
          </div>
          <div>
            <span className="text-ink-600 mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em]">
              Division
            </span>
            <MockChips
              idPrefix="chip-gender"
              value={gender}
              options={["Girls", "Boys", "Coed"].map((v) => ({ value: v, label: v }))}
            />
          </div>
        </div>
      </div>
    </MockDialog>
  )
}

function PostTryoutDialog({
  open,
  typed,
  when,
  gym,
}: {
  open: boolean
  typed: Typed
  when: string
  gym: string
}) {
  return (
    <MockDialog
      open={open}
      title="Post a tryout"
      subtitle="Families see this on your club page and on the marketplace."
      footer={
        <>
          <MockButton tone="quiet" size="sm">
            Cancel
          </MockButton>
          <MockButton id="publish-tryout" size="sm">
            Publish tryout
          </MockButton>
        </>
      }
    >
      <div className="space-y-3">
        <MockField id="field-title" label="Tryout name">
          {typed("title", "Name this tryout")}
        </MockField>
        <div className="grid grid-cols-2 gap-3">
          <MockField id="field-when" label="Date and time">
            <span className={when ? "text-ink-900" : "text-ink-400"}>
              {when || "Choose a date"}
            </span>
          </MockField>
          <MockField id="field-gym" label="Gym">
            <span className={gym ? "text-ink-900" : "text-ink-400"}>
              {gym || "Choose a venue"}
            </span>
          </MockField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MockField id="field-fee" label="Tryout fee" hint="Collected at registration">
            <span className="text-ink-400 mr-0.5">$</span>
            {typed("fee", "0")}
          </MockField>
          <MockField label="Team this feeds">
            <span className="text-ink-900">U11 Girls Rep</span>
          </MockField>
        </div>
      </div>
    </MockDialog>
  )
}

function SendOfferDialog({ open, ready }: { open: boolean; ready: boolean }) {
  return (
    <MockDialog
      open={open}
      title="Send an offer to Amara Bello"
      subtitle="U11 Girls Rep · Fall 2026"
      footer={
        <>
          <MockButton tone="quiet" size="sm">
            Cancel
          </MockButton>
          <MockButton id="send-offer" size="sm">
            Send offer
          </MockButton>
        </>
      }
    >
      <div className="space-y-3">
        <div className="border-ink-100 flex items-center gap-3 rounded-2xl border px-3 py-2.5">
          <PlayerMug name="Amara Bello" accentKey="Amara Bello" sizeClassName="h-9 w-9 rounded-full" />
          <div className="min-w-0">
            <p className="text-ink-900 text-[13px] font-bold">Amara Bello</p>
            <p className="text-ink-500 text-[11px]">
              Born 2015 · Tried out 12 September · Guard
            </p>
          </div>
          <div className="ml-auto">
            <MockPill tone="court">Paid $25</MockPill>
          </div>
        </div>
        <MockField id="field-package" label="Package">
          <span className={ready ? "text-ink-900 font-semibold" : "text-ink-400"}>
            {ready ? "Full season, gear included · $525.00" : "Choose a package"}
          </span>
        </MockField>
        {ready && (
          <div className="flex flex-wrap gap-1.5">
            <MockPill tone="play">Uniform</MockPill>
            <MockPill tone="play">Tracksuit</MockPill>
            <MockPill tone="play">Shoes</MockPill>
            <MockPill tone="play">Game ball</MockPill>
            <MockPill tone="neutral">3 practices a week</MockPill>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <MockField label="Payment plan offered">
            <span className="text-ink-900">$175 deposit, then 2 payments of $175</span>
          </MockField>
          <MockField label="Respond by">
            <span className="text-ink-900">Friday 19 September</span>
          </MockField>
        </div>
      </div>
    </MockDialog>
  )
}

/* ── Phone screens ────────────────────────────────────────────────────────── */

function RegisterScreen({ kid }: { kid: string }) {
  return (
    <div className="space-y-3">
      <div className="border-ink-100 rounded-2xl border bg-white px-3 py-2.5">
        <p className="text-ink-900 text-[12px] font-bold">Saturday 12 September, 6:00 PM</p>
        <p className="text-ink-500 mt-0.5 text-[11px]">Riverside Community Centre, Court 2</p>
        <p className="text-ink-400 mt-1 text-[10.5px]">Ages 9 to 11 · 24 spots · 10 left</p>
      </div>

      <div>
        <PhoneLabel>Who is trying out</PhoneLabel>
        <MockChips
          idPrefix="chip-kid"
          value={kid}
          options={[
            { value: "amara", label: "Amara Bello, 10" },
            { value: "noah", label: "Noah Bello, 13" },
          ]}
        />
      </div>

      <div className="border-ink-100 rounded-2xl border bg-white px-3 py-2">
        <PhoneMoneyRow label="Tryout fee" value="$25.00" />
        <PhoneMoneyRow label="Due now" value="$25.00" strong />
      </div>

      <PhoneAction id="phone-pay">Pay $25.00 and register</PhoneAction>
      <p className="text-ink-400 text-center text-[10px]">
        Your spot is held as soon as the fee clears.
      </p>
    </div>
  )
}

/**
 * The details submission. This screen is the reason the story is long: it is
 * the paperwork clubs spend six weeks collecting by text message, done once,
 * by the person who actually knows the answers, at the moment she is already
 * saying yes.
 */
function AcceptScreen({
  typed,
  uniform,
  tracksuit,
  shoe,
  shoeOpen,
  plan,
}: {
  typed: Typed
  uniform: string
  tracksuit: string
  shoe: string
  shoeOpen: boolean
  plan: string
}) {
  return (
    <div className="space-y-2.5">
      <div>
        <PhoneLabel>Uniform size</PhoneLabel>
        <MockChips idPrefix="chip-uniform" value={uniform} options={CLOTHING} />
      </div>
      <div>
        <PhoneLabel>Tracksuit size</PhoneLabel>
        <MockChips idPrefix="chip-tracksuit" value={tracksuit} options={CLOTHING} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MockListbox
          id="shoe"
          label="Shoe"
          value={shoe}
          open={shoeOpen}
          placeholder="Size"
          options={SHOES}
        />
        <div>
          <span className="text-ink-600 mb-1 block text-[11px] font-semibold uppercase tracking-[0.1em]">
            Jersey 1st
          </span>
          <span
            data-demo-target="field-jersey1"
            className="border-ink-200 text-ink-900 flex min-h-[36px] items-center justify-center rounded-xl border bg-white px-2 text-[13px] font-bold shadow-sm transition-all duration-200 motion-reduce:transition-none data-[demo-hover=true]:border-play-300"
          >
            {typed("jersey1", "#")}
          </span>
        </div>
        <div>
          <span className="text-ink-600 mb-1 block text-[11px] font-semibold uppercase tracking-[0.1em]">
            2nd
          </span>
          <span
            data-demo-target="field-jersey2"
            className="border-ink-200 text-ink-900 flex min-h-[36px] items-center justify-center rounded-xl border bg-white px-2 text-[13px] font-bold shadow-sm transition-all duration-200 motion-reduce:transition-none data-[demo-hover=true]:border-play-300"
          >
            {typed("jersey2", "#")}
          </span>
        </div>
      </div>

      <div>
        <PhoneLabel>Payment</PhoneLabel>
        <MockChoiceCards
          idPrefix="plan"
          value={plan}
          options={[
            {
              value: "FULL",
              title: "Pay in full",
              description: <span className="text-ink-900 font-bold">$525.00</span>,
            },
            {
              value: "INSTALLMENTS",
              title: "Payment plan",
              badge: "Most families",
              description: (
                <>
                  <span className="text-ink-900 font-bold">$175.00</span> deposit now, then $175 on
                  15 Oct and $175 on 15 Nov, charged to your card automatically.
                </>
              ),
            },
          ]}
        />
      </div>

      <p className="text-ink-400 text-[10px]">
        Visa •••• 4242 on file. Season waiver is signed with this acceptance.
      </p>

      <PhoneAction id="phone-accept-pay">
        {plan === "FULL" ? "Pay $525.00 and accept" : "Pay $175.00 and accept"}
      </PhoneAction>
    </div>
  )
}

/* ── Bits ─────────────────────────────────────────────────────────────────── */

/** Renders one state key as text that types itself when the beat says so. */
type Typed = (key: string, placeholder?: string) => ReactNode

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-4 w-4">
      <path d="M5 13l4 4L19 7" />
    </svg>
  )
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9" />
    </svg>
  )
}
