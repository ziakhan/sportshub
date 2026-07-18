import type { DemoScene } from "./demo-player"
import { ActionBtn, Avatar, Chip, Field, Row, Screen } from "./mock-ui"

/**
 * Club journey: claim → teams → staff → tryout setup → publish → signups →
 * attendance → offer template → send → acceptances → final roster.
 */
export const CLUB_SCENES: DemoScene[] = [
  {
    label: "Claim your club",
    caption: "Your club probably already has a page here — claim it, or start one fresh in minutes.",
    screen: (
      <Screen title="Find your club" badge="190+ clubs listed">
        <div className="space-y-2">
          <Row tone="active">
            <div className="min-w-0 flex-1">
              <div className="text-ink-950 text-[13px] font-bold">Ridgeview Rockets Basketball</div>
              <div className="text-ink-500 text-[11.5px]">Mississauga, ON · 6 teams on record</div>
            </div>
            <Chip tone="gold">Unclaimed</Chip>
            <ActionBtn>Claim this club</ActionBtn>
          </Row>
          <Row>
            <div className="min-w-0 flex-1">
              <div className="text-ink-500 text-[12px]">Not listed?</div>
            </div>
            <Chip tone="blue">Create a new club</Chip>
          </Row>
        </div>
      </Screen>
    ),
  },
  {
    label: "Create teams",
    caption: "Spin up your age groups — rep, house league, camps — each team gets its own home.",
    screen: (
      <Screen title="Teams — Ridgeview Rockets" badge="3 teams">
        <div className="space-y-2">
          <Row tone="done">
            <div className="min-w-0 flex-1 text-[13px] font-bold">U11 Boys Rep</div>
            <Chip tone="green">Created</Chip>
          </Row>
          <Row tone="done">
            <div className="min-w-0 flex-1 text-[13px] font-bold">U13 Boys Rep</div>
            <Chip tone="green">Created</Chip>
          </Row>
          <Row tone="active">
            <div className="min-w-0 flex-1">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Age group" value="U13 Girls" active />
                <Field label="Level" value="Rep — AA" />
              </div>
            </div>
            <ActionBtn>Add team</ActionBtn>
          </Row>
        </div>
      </Screen>
    ),
  },
  {
    label: "Assign staff",
    caption: "Head coach, assistant, team manager — assign people you have, invite the ones you don't by email.",
    screen: (
      <Screen title="Staff — U13 Boys Rep" badge="Roles">
        <div className="space-y-2">
          <Row>
            <Avatar n={0} name="Dana Whitfield" />
            <div className="min-w-0 flex-1 text-[13px] font-bold">Dana Whitfield</div>
            <Chip tone="blue">Head Coach</Chip>
          </Row>
          <Row>
            <Avatar n={1} name="Alex Romero" />
            <div className="min-w-0 flex-1 text-[13px] font-bold">Alex Romero</div>
            <Chip tone="blue">Assistant Coach</Chip>
          </Row>
          <Row>
            <Avatar n={2} name="Priya Nair" />
            <div className="min-w-0 flex-1 text-[13px] font-bold">Priya Nair</div>
            <Chip tone="blue">Team Manager</Chip>
          </Row>
          <Row tone="active">
            <div className="min-w-0 flex-1">
              <Field label="Invite by email" value="coach.marcus@gmail.com" active />
            </div>
            <Chip tone="gold">Invite pending</Chip>
          </Row>
        </div>
      </Screen>
    ),
  },
  {
    label: "Create a tryout",
    caption: "Dates, venue, capacity, fee — the tryout is a real event with real bookkeeping, not a Google Form.",
    screen: (
      <Screen title="New tryout — U13 Boys Rep" badge="Draft">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Title" value="U13 Boys Rep Tryout" />
          <Field label="Fee" value="$25" />
          <Field label="Session 1" value="Sun Oct 5 · 6–8 PM" active />
          <Field label="Session 2" value="Tue Oct 7 · 6–8 PM" active />
          <Field label="Venue" value="Maplewood CC — Gym A" />
          <Field label="Capacity" value="40 players" />
        </div>
      </Screen>
    ),
  },
  {
    label: "Publish it",
    caption: "One click and it's live on your public club page — shareable link, findable by every family nearby.",
    screen: (
      <Screen title="U13 Boys Rep Tryout" badge="Ready">
        <Row tone="active">
          <div className="min-w-0 flex-1">
            <div className="text-ink-950 text-[13px] font-bold">Preview looks good?</div>
            <div className="text-ink-500 text-[11.5px]">ridgeview-rockets · /tryout/u13-boys-rep</div>
          </div>
          <ActionBtn>Publish tryout</ActionBtn>
        </Row>
        <div className="mt-2 flex gap-1.5">
          <Chip tone="green">✓ Live on your club page</Chip>
          <Chip tone="blue">Link copied</Chip>
        </div>
      </Screen>
    ),
  },
  {
    label: "Watch signups",
    caption: "Registrations and payments roll in live — you always know exactly who's coming.",
    screen: (
      <Screen title="Signups — U13 Boys Rep Tryout" badge="28 / 40">
        <div className="space-y-2">
          {[
            ["Jordan Lee", "2013", 0],
            ["Marcus Okafor", "2013", 1],
            ["Theo Brandt", "2014", 2],
          ].map(([n, y, i]) => (
            <Row key={n as string}>
              <Avatar n={i as number} name={n as string} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold">{n}</div>
                <div className="text-ink-500 text-[11px]">Born {y}</div>
              </div>
              <Chip tone="green">Paid ✓</Chip>
            </Row>
          ))}
          <div className="text-ink-400 pt-1 text-center text-[11px] font-semibold">+ 25 more · 12 spots left</div>
        </div>
      </Screen>
    ),
  },
  {
    label: "Take attendance",
    caption: "On tryout night, check players in from your phone — evaluators see who's actually on the floor.",
    screen: (
      <Screen title="Attendance — Session 1 · Oct 5" badge="24 / 28 in">
        <div className="space-y-2">
          <Row tone="done">
            <Avatar n={0} name="Jordan Lee" />
            <div className="min-w-0 flex-1 text-[13px] font-bold">Jordan Lee</div>
            <Chip tone="green">Present ✓</Chip>
          </Row>
          <Row tone="done">
            <Avatar n={1} name="Marcus Okafor" />
            <div className="min-w-0 flex-1 text-[13px] font-bold">Marcus Okafor</div>
            <Chip tone="green">Present ✓</Chip>
          </Row>
          <Row tone="active">
            <Avatar n={2} name="Theo Brandt" />
            <div className="min-w-0 flex-1 text-[13px] font-bold">Theo Brandt</div>
            <div className="flex gap-1">
              <Chip tone="green">Here</Chip>
              <Chip tone="red">No-show</Chip>
            </div>
          </Row>
        </div>
      </Screen>
    ),
  },
  {
    label: "Build the offer",
    caption: "Offer templates carry everything: uniform, season dates, fee, deposit, installment plan — practices can come later.",
    screen: (
      <Screen title="Offer template — U13 Rep" badge="Template">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Season" value="Nov 1 – Apr 30" />
          <Field label="Uniform" value="Included" active />
          <Field label="Season fee" value="$2,400" />
          <Field label="Deposit" value="$500 on accept" active />
          <Field label="Installments" value="4 × $475 monthly" active />
          <Field label="Practices" value="Tue / Thu — finalized later" />
        </div>
      </Screen>
    ),
  },
  {
    label: "Send offers",
    caption: "Pick your players and send — every family gets the same clean offer, no BCC email chains.",
    screen: (
      <Screen title="Send offers — U13 Boys Rep" badge="15 selected">
        <div className="space-y-2">
          <Row tone="done">
            <Avatar n={0} name="Jordan Lee" />
            <div className="min-w-0 flex-1 text-[13px] font-bold">Jordan Lee</div>
            <Chip tone="blue">Selected ✓</Chip>
          </Row>
          <Row tone="done">
            <Avatar n={1} name="Marcus Okafor" />
            <div className="min-w-0 flex-1 text-[13px] font-bold">Marcus Okafor</div>
            <Chip tone="blue">Selected ✓</Chip>
          </Row>
          <div className="flex items-center justify-between pt-1">
            <span className="text-ink-400 text-[11px] font-semibold">+ 13 more selected</span>
            <ActionBtn>Send 15 offers</ActionBtn>
          </div>
        </div>
      </Screen>
    ),
  },
  {
    label: "Track acceptances",
    caption: "Accepted means deposit paid — your roster fills itself with committed, paid-up families.",
    screen: (
      <Screen title="Offers — U13 Boys Rep" badge="Live status">
        <div className="space-y-2">
          <Row tone="done">
            <div className="min-w-0 flex-1 text-[13px] font-bold">Accepted &amp; deposit paid</div>
            <div className="text-lg font-black tabular-nums text-emerald-600">11</div>
          </Row>
          <Row>
            <div className="min-w-0 flex-1 text-[13px] font-bold">Awaiting response</div>
            <div className="text-ink-500 text-lg font-black tabular-nums">3</div>
          </Row>
          <Row>
            <div className="min-w-0 flex-1 text-[13px] font-bold">Declined</div>
            <div className="text-lg font-black tabular-nums text-red-500">1</div>
          </Row>
          <div className="pt-1 text-center">
            <Chip tone="gold">Reminder nudge scheduled for pending offers</Chip>
          </div>
        </div>
      </Screen>
    ),
  },
  {
    label: "Finalize the roster",
    caption: "Jerseys assigned, roster locked — and submitted to your league in one click. No re-typing anyone's name.",
    screen: (
      <Screen title="Roster — U13 Boys Rep" badge="12 players">
        <div className="space-y-2">
          <Row>
            <span className="text-ink-400 w-7 text-center text-[12px] font-black tabular-nums">4</span>
            <div className="min-w-0 flex-1 text-[13px] font-bold">Jordan Lee</div>
            <Chip tone="green">Deposit ✓</Chip>
          </Row>
          <Row>
            <span className="text-ink-400 w-7 text-center text-[12px] font-black tabular-nums">7</span>
            <div className="min-w-0 flex-1 text-[13px] font-bold">Marcus Okafor</div>
            <Chip tone="green">Deposit ✓</Chip>
          </Row>
          <div className="flex items-center justify-between pt-1">
            <span className="text-ink-400 text-[11px] font-semibold">+ 10 more · all paid</span>
            <ActionBtn>Submit roster to league</ActionBtn>
          </div>
        </div>
      </Screen>
    ),
  },
]
