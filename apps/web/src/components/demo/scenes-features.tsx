import type { DemoScene } from "./demo-player"
import { DW } from "./demo-world"
import { ActionBtn, Avatar, Bubble, Cascade, Chip, Field, Phone, PlayerRow, Row, Screen, Split, Swap } from "./mock-ui"

/**
 * Feature scenes added in walkthrough v2 (plan: docs/marketing/walkthrough-plan.md).
 * Exported one by one so clips.ts and scenes-season.ts can compose them freely.
 */

/* ---------- payments ---------- */

export const LEDGER: DemoScene = {
  label: "The ledger",
  caption: "Who has paid and who still owes, per player, without opening a spreadsheet.",
  screen: (
    <Screen title={`Payments · ${DW.team}`} badge="Season 2026-27">
      <Cascade>
        <PlayerRow n={0} name={DW.players[0]} sub="Deposit + 2 of 4 installments" right={<Chip tone="green">$1,450 paid</Chip>} />
        <PlayerRow n={1} name={DW.players[1]} sub="Deposit + 3 of 4 installments" right={<Chip tone="green">$1,925 paid</Chip>} />
        <PlayerRow n={2} name={DW.players[2]} sub="Deposit only" right={<Chip tone="gold">$475 due Fri</Chip>} />
        <PlayerRow n={3} name={DW.players[3]} sub="Paid in full up front" right={<Chip tone="green">$2,400 ✓</Chip>} />
        <Row tone="done">
          <div className="min-w-0 flex-1 text-[13px] font-bold">Team total</div>
          <div className="text-[13px] font-black tabular-nums text-emerald-700">$21,150 of $28,800 collected</div>
        </Row>
      </Cascade>
    </Screen>
  ),
}

export const AUTOCHARGE: DemoScene = {
  label: "Installments run themselves",
  caption: "Cards are charged on schedule. Receipts go out on their own and late payments get a polite nudge.",
  screen: (
    <Screen title="Nov 1 installment run" badge="Automatic">
      <Cascade>
        <Row tone="done">
          <div className="min-w-0 flex-1 text-[13px] font-bold">11 cards charged $475</div>
          <Chip tone="green">Receipts emailed ✓</Chip>
        </Row>
        <Row>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold">{DW.players[2]}</div>
            <div className="text-ink-500 text-[11px]">Card declined, retry scheduled</div>
          </div>
          <Chip tone="gold" late={1}>
            Reminder sent to {DW.parent.split(" ")[0]} ✓
          </Chip>
        </Row>
        <div className="pt-1 text-center">
          <Chip tone="blue">You did nothing. That&apos;s the point.</Chip>
        </div>
      </Cascade>
    </Screen>
  ),
}

/* ---------- comms ---------- */

export const ANNOUNCEMENT: DemoScene = {
  label: "Announcements that stick",
  caption: "Coach posts once. It lands pinned in team chat and pings every family's phone.",
  screen: (
    <Screen title={`Team chat · ${DW.team}`} badge="14 members">
      <Cascade>
        <Bubble who={`${DW.headCoach} (Head Coach)`} pinned>
          Practice moves to {DW.venue2} this Thursday. Same time, 6:30 sharp.
        </Bubble>
        <Bubble who={DW.parent} mine>
          Thanks! Does Jordan need the white jersey?
        </Bubble>
        <Bubble who={`${DW.headCoach} (Head Coach)`}>White this week. Reversibles arrive Friday.</Bubble>
        <div className="flex justify-center gap-1.5 pt-1">
          <Chip tone="blue" late={0}>
            14 phones pinged ✓
          </Chip>
          <Chip tone="green" late={1}>
            Pinned for whoever missed it
          </Chip>
        </div>
      </Cascade>
    </Screen>
  ),
}

export const POLL_COACH: DemoScene = {
  label: "Ask the team",
  caption: "Need a decision? Post a poll instead of counting thumbs in a group chat.",
  screen: (
    <Screen title="Poll · Holiday practice" badge="Closes Fri">
      <Cascade>
        <div className="text-ink-950 text-[13.5px] font-bold">Keep the Dec 23 practice?</div>
        <Row tone="done">
          <div className="min-w-0 flex-1 text-[13px] font-bold">Yes, we&apos;ll be there</div>
          <div className="bg-ink-100 h-2 w-24 overflow-hidden rounded-full">
            <div className="h-full w-[75%] rounded-full bg-emerald-500" />
          </div>
          <Chip tone="green">9</Chip>
        </Row>
        <Row>
          <div className="min-w-0 flex-1 text-[13px] font-bold">Out of town</div>
          <div className="bg-ink-100 h-2 w-24 overflow-hidden rounded-full">
            <div className="bg-ink-300 h-full w-[25%] rounded-full" />
          </div>
          <Chip>3</Chip>
        </Row>
        <div className="text-center">
          <Chip tone="blue" late={1}>
            12 of 14 answered, 2 reminded automatically
          </Chip>
        </div>
      </Cascade>
    </Screen>
  ),
}

export const PARENT_CHAT_PHONE: DemoScene = {
  label: "Chat on your phone",
  caption: "Announcements, coach DMs and mute controls in the app. The old group chat can retire.",
  screen: (
    <Phone title="Rockets U13 · Chat" badge="2 new">
      <Cascade>
        <Bubble who={`${DW.headCoach} (Head Coach)`} pinned>
          Game moved to 10:30 Sunday. Calendar is already updated.
        </Bubble>
        <Bubble who="You" mine>
          Got it. Jordan will be there.
        </Bubble>
        <div className="flex justify-center pt-1">
          <Chip tone="blue">Mute until game day 🔕 available anytime</Chip>
        </div>
      </Cascade>
    </Phone>
  ),
}

/* ---------- practices & calendar ---------- */

export const PRACTICES: DemoScene = {
  label: "Set practices once",
  caption: "Recurring practices go on every family calendar with one form, and stay in sync.",
  screen: (
    <Screen title={`Practices · ${DW.team}`} badge="Recurring">
      <Cascade className="grid grid-cols-2 gap-2 space-y-0">
        <Field label="Days" value="Tue and Thu" active />
        <Field label="Time" value="6:30 to 8:00 PM" />
        <Field label="Venue" value={`${DW.venue2} · Main Gym`} />
        <Field label="Runs" value="Nov 4 to Mar 19" />
      </Cascade>
      <div className="mt-3 flex items-center justify-between">
        <Chip tone="green" late={1}>
          ✓ 38 practices on 14 family calendars
        </Chip>
        <ActionBtn press>Save schedule</ActionBtn>
      </div>
    </Screen>
  ),
}

export const POSTPONE: DemoScene = {
  label: "A game moves",
  caption: "Snow day. The league moves the game once and every calendar, chat and phone follows. Nobody forwards anything.",
  screen: (
    <Screen title="Reschedule · Rockets vs Storm" badge="League admin">
      <Cascade>
        <Row tone="active">
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold">
              Sun Jan 18 · 9:00 →{" "}
              <Swap from="cancelled" to="Sat Jan 24 · 2:00" className="font-black" />
            </div>
            <div className="text-ink-500 text-[11px]">
              {DW.venue} · {DW.gym}
            </div>
          </div>
          <ActionBtn press>Confirm new time</ActionBtn>
        </Row>
        <div className="flex flex-wrap justify-center gap-1.5 pt-1">
          <Chip tone="green" late={0}>
            28 calendars updated ✓
          </Chip>
          <Chip tone="green" late={1}>
            Both team chats posted ✓
          </Chip>
          <Chip tone="green" late={2}>
            28 phones pinged ✓
          </Chip>
          <Chip tone="green" late={3}>
            Referees re-invited ✓
          </Chip>
        </div>
      </Cascade>
    </Screen>
  ),
}

/* ---------- game night ---------- */

export const GUEST_SCOREKEEPER: DemoScene = {
  label: "Hand off the scoring",
  caption: "Text a one-time link to whoever runs the table tonight. No account, no app install, just the console.",
  screen: (
    <Screen title="Game setup · Rockets vs Storm" badge="Pre-game">
      <Cascade>
        <Row>
          <div className="min-w-0 flex-1 text-[13px] font-bold">Scorekeeper</div>
          <Chip tone="blue">{DW.teamManager}</Chip>
        </Row>
        <Row tone="active">
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold">Or send a guest link</div>
            <div className="text-ink-500 text-[11px]">Works once, for this game only</div>
          </div>
          <ActionBtn press>Copy guest link</ActionBtn>
        </Row>
        <div className="text-center">
          <Chip tone="green" late={1}>
            ✓ Link copied. Text it to the table.
          </Chip>
        </div>
      </Cascade>
    </Screen>
  ),
}

export const SPLIT_LIVE: DemoScene = {
  label: "Score it, everyone sees it",
  caption: "The table presses one button. Every phone watching the game updates in the same breath.",
  screen: (
    <Split
      leftLabel="Scoring console · at the table"
      rightLabel="Live game page · everyone else"
      left={
        <Screen title="Console · Q3 4:12" badge="LIVE">
          <div className="mb-2 grid grid-cols-3 gap-1.5">
            <ActionBtn press>+2 made</ActionBtn>
            <span className="border-ink-200 text-ink-700 inline-flex items-center justify-center rounded-xl border bg-white px-2 py-2 text-[12px] font-bold">
              +3 made
            </span>
            <span className="border-ink-200 text-ink-700 inline-flex items-center justify-center rounded-xl border bg-white px-2 py-2 text-[12px] font-bold">
              Free throw
            </span>
          </div>
          <Row tone="active">
            <Avatar n={0} name={DW.players[0]} />
            <div className="min-w-0 flex-1 text-[13px] font-bold">#4 {DW.players[0]}</div>
            <Chip tone="blue">selected</Chip>
          </Row>
        </Screen>
      }
      right={
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e2d4d] to-[#0b1628] p-4 text-white shadow-xl">
          <div className="mb-1 text-center text-[10px] font-black uppercase tracking-[0.18em] text-white/50">
            Q3 · 4:12 · LIVE
          </div>
          <div className="flex items-center justify-around">
            <div className="text-center">
              <div className="text-[11px] font-bold text-white/70">Rockets</div>
              <div className="text-3xl font-black tabular-nums">
                <Swap from="42" to="44" />
              </div>
            </div>
            <div className="text-[11px] font-black text-white/40">vs</div>
            <div className="text-center">
              <div className="text-[11px] font-bold text-white/70">Storm</div>
              <div className="text-3xl font-black tabular-nums">39</div>
            </div>
          </div>
          <div className="mt-2 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold">
            <span className="demo-late" style={{ animationDelay: "1.5s" }}>
              {DW.players[0]} scores 2, assisted by {DW.players[4]}
            </span>
          </div>
        </div>
      }
    />
  ),
}

export const BOX_SCORE: DemoScene = {
  label: "The box score writes itself",
  caption: "Final buzzer and the full box score is already public. Leaders, quarters, the works.",
  screen: (
    <Screen title="Final · Rockets 58, Storm 51" badge="Box score">
      <Cascade>
        <Row>
          <div className="min-w-0 flex-1 text-[13px] font-bold">{DW.players[0]}</div>
          <Chip tone="blue">18 PTS</Chip>
          <Chip>7 REB</Chip>
          <Chip>3 AST</Chip>
        </Row>
        <Row>
          <div className="min-w-0 flex-1 text-[13px] font-bold">{DW.players[4]}</div>
          <Chip tone="blue">12 PTS</Chip>
          <Chip>9 AST</Chip>
        </Row>
        <Row>
          <div className="min-w-0 flex-1 text-[13px] font-bold">{DW.players[6]}</div>
          <Chip tone="blue">10 PTS</Chip>
          <Chip>11 REB</Chip>
        </Row>
        <Row tone="done">
          <div className="min-w-0 flex-1 text-[12.5px] font-bold">Quarters: 14-12 · 13-11 · 17-15 · 14-13</div>
          <Chip tone="green">Official ✓</Chip>
        </Row>
      </Cascade>
    </Screen>
  ),
}

export const PHONE_LIVE: DemoScene = {
  label: "Follow from anywhere",
  caption: "Stuck at work or driving the other kid? The game is in your pocket, play by play.",
  screen: (
    <Phone title="Rockets vs Storm" badge="LIVE Q4">
      <div className="mb-2 rounded-xl bg-gradient-to-br from-[#1e2d4d] to-[#0b1628] p-3 text-center text-white">
        <div className="text-[9px] font-black uppercase tracking-widest text-white/50">Q4 · 2:07</div>
        <div className="text-2xl font-black tabular-nums">
          <Swap from="52-49" to="54-49" />
        </div>
      </div>
      <Cascade>
        <div className="text-ink-700 rounded-lg bg-white px-2.5 py-1.5 text-[11.5px] font-semibold shadow-sm">
          {DW.players[0]} scores 2, and one coming
        </div>
        <div className="text-ink-500 rounded-lg bg-white px-2.5 py-1.5 text-[11.5px] shadow-sm">
          Timeout, {DW.club2}
        </div>
        <div className="text-center">
          <Chip tone="orange" late={1}>
            Jordan: 16 PTS tonight
          </Chip>
        </div>
      </Cascade>
    </Phone>
  ),
}

/* ---------- content ---------- */

export const RECAP_NEWS: DemoScene = {
  label: "The recap posts itself",
  caption: "Minutes after the final buzzer there's a written recap on your public page. Families share it, you did nothing.",
  screen: (
    <Screen title="News · Metro Youth Basketball" badge="Auto-published">
      <Cascade>
        <div className="border-ink-100 rounded-xl border bg-white p-3">
          <div className="text-ink-950 text-[13.5px] font-black leading-snug">
            Rockets hold off Storm 58-51 behind {DW.players[0].split(" ")[0]}&apos;s 18
          </div>
          <p className="text-ink-500 mt-1 text-[11.5px] leading-snug">
            {DW.club} won their fourth straight on Sunday at {DW.venue}, pulling away in a 17-15
            third quarter. {DW.players[6]} added a 10 and 11 double-double...
          </p>
          <div className="mt-2 flex gap-1.5">
            <Chip tone="blue">Published 8 min after the buzzer</Chip>
            <Chip tone="green" late={1}>
              Shared 23 times ✓
            </Chip>
          </div>
        </div>
      </Cascade>
    </Screen>
  ),
}

export const REVIEWS: DemoScene = {
  label: "Reviews, earned",
  caption: "When the season wraps, families get one invite to review the club. Real reviews from real rosters.",
  screen: (
    <Screen title={`Reviews · ${DW.club}`} badge="4.8 ★">
      <Cascade>
        <div className="border-ink-100 rounded-xl border bg-white p-3">
          <div className="flex items-center gap-2">
            <Avatar n={0} name={DW.parent} />
            <div className="text-[12.5px] font-bold">{DW.parent}</div>
            <Chip tone="gold">★★★★★</Chip>
            <Chip tone="green">Verified family</Chip>
          </div>
          <p className="text-ink-500 mt-1.5 text-[11.5px] leading-snug">
            Second season with the Rockets. Communication is night and day compared to our old
            club. My son improved a ton and I always knew where to be.
          </p>
        </div>
        <div className="text-center">
          <Chip tone="blue" late={1}>
            Review invites go out when the season ends
          </Chip>
        </div>
      </Cascade>
    </Screen>
  ),
}

/* ---------- league extras ---------- */

export const STAT_LEADERS: DemoScene = {
  label: "Leaders update nightly",
  caption: "Points, rebounds and assists leaders publish themselves after every game night.",
  screen: (
    <Screen title="Leaders · U13 Boys Rep" badge="Through Wk 7">
      <Cascade>
        <PlayerRow n={0} name={DW.players[0]} sub={DW.club} right={<Chip tone="blue">19.4 PPG</Chip>} />
        <PlayerRow n={1} name="Isaiah Grant" sub={DW.club2} right={<Chip tone="blue">17.8 PPG</Chip>} />
        <PlayerRow n={2} name="Owen Park" sub={DW.club3} right={<Chip>11.2 RPG</Chip>} />
        <PlayerRow n={3} name="Devin Clarke" sub={DW.club4} right={<Chip>7.1 APG</Chip>} />
      </Cascade>
    </Screen>
  ),
}

export const PLAYOFFS: DemoScene = {
  label: "Playoffs build themselves",
  caption: "Pick a format that fits your field. The bracket seeds from the standings and rounds fill in as winners emerge.",
  screen: (
    <Screen title={`Playoffs · ${DW.season}`} badge="Bracket">
      <Cascade>
        <Row tone="active">
          <div className="min-w-0 flex-1 text-[13px] font-bold">Format: top 4, single elimination</div>
          <ActionBtn press>Generate bracket</ActionBtn>
        </Row>
        <Row>
          <Chip tone="blue">SF1</Chip>
          <div className="min-w-0 flex-1 text-[12.5px] font-bold">(1) Rockets vs (4) Chargers</div>
          <Chip tone="green" late={1}>
            Seeded ✓
          </Chip>
        </Row>
        <Row>
          <Chip tone="blue">SF2</Chip>
          <div className="min-w-0 flex-1 text-[12.5px] font-bold">(2) Storm vs (3) Lords</div>
          <Chip tone="green" late={2}>
            Seeded ✓
          </Chip>
        </Row>
        <Row>
          <Chip tone="gold">FINAL</Chip>
          <div className="text-ink-400 min-w-0 flex-1 text-[12.5px] font-bold">Fills in when the semis end</div>
        </Row>
      </Cascade>
    </Screen>
  ),
}

export const REF_VIEW: DemoScene = {
  label: "Refs run their own night",
  caption: "Officials see their assignments, confirm with a tap and sign the score after the game.",
  screen: (
    <Screen title={`My games · ${DW.refs[0]}`} badge="Referee">
      <Cascade>
        <Row tone="done">
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold">Sun 9:00 · Rockets vs Storm</div>
            <div className="text-ink-500 text-[11px]">
              {DW.venue} · {DW.gym}
            </div>
          </div>
          <Chip tone="green">Confirmed ✓</Chip>
        </Row>
        <Row tone="active">
          <div className="min-w-0 flex-1 text-[13px] font-bold">Sun 10:30 · Lords vs Chargers</div>
          <ActionBtn press>Confirm</ActionBtn>
        </Row>
        <Row>
          <div className="min-w-0 flex-1 text-[13px] font-bold">Final 58-51 · sign off</div>
          <Chip tone="gold">PIN entry</Chip>
        </Row>
      </Cascade>
    </Screen>
  ),
}

/* ---------- families ---------- */

export const MY_KIDS: DemoScene = {
  label: "Every kid, one login",
  caption: "Two kids, three teams, one account. Each kid gets their own schedule, chat and stats.",
  screen: (
    <Phone title="My kids" badge="2">
      <Cascade>
        <Row tone="active">
          <Avatar n={0} name={DW.kid} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold">{DW.kid}</div>
            <div className="text-ink-500 text-[11px]">{DW.club} U13 · game Sun 9:00</div>
          </div>
          <Chip tone="orange">16 PPG</Chip>
        </Row>
        <Row>
          <Avatar n={3} name="Maya Lee" />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold">Maya Lee</div>
            <div className="text-ink-500 text-[11px]">{DW.club2} U11 · practice Thu 6:00</div>
          </div>
          <Chip tone="blue">RSVP due</Chip>
        </Row>
        <div className="text-center">
          <Chip tone="green" late={1}>
            One calendar shows both
          </Chip>
        </div>
      </Cascade>
    </Phone>
  ),
}

export const KID_STATS: DemoScene = {
  label: "Their season on the record",
  caption: "Game logs and season stats build up all year. Players 13 and up get their own page and handle.",
  screen: (
    <Phone title={`${DW.kid} · #4`} badge="U13 Rep">
      <Cascade>
        <div className="rounded-xl bg-gradient-to-br from-[#1e2d4d] to-[#0b1628] p-3 text-center text-white">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="text-xl font-black">16.2</div>
              <div className="text-[9px] font-bold uppercase text-white/50">PPG</div>
            </div>
            <div>
              <div className="text-xl font-black">6.8</div>
              <div className="text-[9px] font-bold uppercase text-white/50">RPG</div>
            </div>
            <div>
              <div className="text-xl font-black">3.1</div>
              <div className="text-[9px] font-bold uppercase text-white/50">APG</div>
            </div>
          </div>
        </div>
        <Row>
          <div className="min-w-0 flex-1 text-[12px] font-bold">vs Storm · W 58-51</div>
          <Chip tone="blue">18 PTS</Chip>
        </Row>
        <Row>
          <div className="min-w-0 flex-1 text-[12px] font-bold">vs Lords · W 61-44</div>
          <Chip tone="blue">14 PTS</Chip>
        </Row>
        <div className="text-center">
          <Chip tone="gold">Mentioned in 4 recaps this season</Chip>
        </div>
      </Cascade>
    </Phone>
  ),
}

export const CLUB_PAGE_PUBLIC: DemoScene = {
  label: "A front door that sells",
  caption: "Your public page carries programs, teams, news and reviews. Families find you without a Facebook group.",
  screen: (
    <Screen title={`${DW.club} · public page`} badge="4.8 ★ · 31 reviews">
      <Cascade>
        <Row tone="active">
          <div className="min-w-0 flex-1 text-[13px] font-bold">U13 Boys Rep Tryout</div>
          <Chip tone="orange">Open · 12 spots</Chip>
        </Row>
        <Row>
          <div className="min-w-0 flex-1 text-[13px] font-bold">March Break Skills Camp</div>
          <Chip tone="blue">Opens Jan 5</Chip>
        </Row>
        <Row>
          <div className="min-w-0 flex-1 text-[12.5px] font-semibold text-ink-700">
            Latest: Rockets hold off Storm 58-51
          </div>
          <Chip>News</Chip>
        </Row>
        <div className="text-center">
          <Chip tone="green" late={1}>
            Found on Google, not in a group chat
          </Chip>
        </div>
      </Cascade>
    </Screen>
  ),
}
