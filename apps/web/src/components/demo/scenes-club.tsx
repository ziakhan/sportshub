import type { DemoScene } from "./demo-player"
import { DW } from "./demo-world"
import { ActionBtn, Avatar, Cascade, Chip, Field, PlayerRow, Row, Screen } from "./mock-ui"

/**
 * Club journey: claim, teams, staff, tryout setup, publish, signups,
 * attendance, offer template, send, acceptances, final roster.
 */
export const CLUB_SCENES: DemoScene[] = [
  {
    label: "Claim your club",
    caption: "Your club probably already has a page here. Claim it, or start one fresh in minutes.",
    screen: (
      <Screen title="Find your club" badge="190+ clubs listed">
        <Cascade>
          <Row tone="active">
            <div className="min-w-0 flex-1">
              <div className="text-ink-950 text-[13px] font-bold">{DW.club} Basketball</div>
              <div className="text-ink-500 text-[11.5px]">Mississauga, ON · 6 teams on record</div>
            </div>
            <Chip tone="gold">Unclaimed</Chip>
            <ActionBtn press>Claim this club</ActionBtn>
          </Row>
          <Row>
            <div className="min-w-0 flex-1">
              <div className="text-ink-500 text-[12px]">Not listed?</div>
            </div>
            <Chip tone="blue">Create a new club</Chip>
          </Row>
          <div className="text-right">
            <Chip tone="green" late={1}>
              ✓ Claim started · verify and it&apos;s yours
            </Chip>
          </div>
        </Cascade>
      </Screen>
    ),
  },
  {
    label: "Create teams",
    caption: "Set up your age groups. Rep, house league, camps. Each team gets its own home.",
    screen: (
      <Screen title={`Teams · ${DW.club}`} badge="4 teams">
        <Cascade>
          <Row tone="done">
            <div className="min-w-0 flex-1 text-[13px] font-bold">U11 Boys Rep</div>
            <Chip tone="green">Created</Chip>
          </Row>
          <Row tone="done">
            <div className="min-w-0 flex-1 text-[13px] font-bold">U13 Boys Rep</div>
            <Chip tone="green">Created</Chip>
          </Row>
          <Row tone="done">
            <div className="min-w-0 flex-1 text-[13px] font-bold">U13 Girls Rep AA</div>
            <Chip tone="green">Created</Chip>
          </Row>
          <Row tone="active">
            <div className="min-w-0 flex-1">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Age group" value="U15 Boys" active />
                <Field label="Level" value="House league" />
              </div>
            </div>
            <ActionBtn press>Add team</ActionBtn>
          </Row>
        </Cascade>
      </Screen>
    ),
  },
  {
    label: "Assign staff",
    caption: "Head coach, assistant, team manager. Assign the people you have and invite the rest by email.",
    screen: (
      <Screen title={`Staff · ${DW.team}`} badge="Roles">
        <Cascade>
          <Row>
            <Avatar n={0} name={DW.headCoach} />
            <div className="min-w-0 flex-1 text-[13px] font-bold">{DW.headCoach}</div>
            <Chip tone="blue">Head Coach</Chip>
          </Row>
          <Row>
            <Avatar n={1} name={DW.assistantCoach} />
            <div className="min-w-0 flex-1 text-[13px] font-bold">{DW.assistantCoach}</div>
            <Chip tone="blue">Assistant Coach</Chip>
          </Row>
          <Row>
            <Avatar n={2} name={DW.teamManager} />
            <div className="min-w-0 flex-1 text-[13px] font-bold">{DW.teamManager}</div>
            <Chip tone="blue">Team Manager</Chip>
          </Row>
          <Row tone="active">
            <div className="min-w-0 flex-1">
              <Field label="Invite by email" value={DW.invitedCoach} active />
            </div>
            <Chip tone="gold" late={1}>
              Invite sent ✓
            </Chip>
          </Row>
        </Cascade>
      </Screen>
    ),
  },
  {
    label: "Create a tryout",
    caption: "Dates, venue, capacity, fee. A real event with real bookkeeping, not a Google Form.",
    screen: (
      <Screen title={`New tryout · ${DW.team}`} badge="Draft">
        <Cascade className="grid grid-cols-2 gap-2 space-y-0">
          <Field label="Title" value={`${DW.team} Tryout`} />
          <Field label="Fee" value={DW.tryoutFee} />
          <Field label="Session 1" value="Sun Oct 5 · 6 to 8 PM" active />
          <Field label="Session 2" value="Tue Oct 7 · 6 to 8 PM" active />
          <Field label="Venue" value={`${DW.venue} · ${DW.gym}`} />
          <Field label="Capacity" value="40 players" />
        </Cascade>
      </Screen>
    ),
  },
  {
    label: "Publish it",
    caption: "One click and it goes live on your public club page, findable by every family nearby.",
    screen: (
      <Screen title={`${DW.team} Tryout`} badge="Ready">
        <Row tone="active">
          <div className="min-w-0 flex-1">
            <div className="text-ink-950 text-[13px] font-bold">Preview looks good?</div>
            <div className="text-ink-500 text-[11.5px]">ridgeview-rockets · /tryout/u13-boys-rep</div>
          </div>
          <ActionBtn press>Publish tryout</ActionBtn>
        </Row>
        <div className="mt-2 flex gap-1.5">
          <Chip tone="green" late={1}>
            ✓ Live on your club page
          </Chip>
          <Chip tone="blue" late={2}>
            Share link copied
          </Chip>
        </div>
      </Screen>
    ),
  },
  {
    label: "Watch signups",
    caption: "Registrations and payments roll in live. You always know who's coming.",
    screen: (
      <Screen title={`Signups · ${DW.team} Tryout`} badge="28 / 40">
        <Cascade>
          {DW.players.slice(0, 6).map((name, i) => (
            <PlayerRow
              key={name}
              n={i}
              name={name}
              sub={`Born ${i % 2 === 0 ? "2013" : "2014"}`}
              right={<Chip tone="green">Paid ✓</Chip>}
            />
          ))}
          <div className="text-ink-400 pt-1 text-center text-[11px] font-semibold">
            + 22 more · 12 spots left
          </div>
        </Cascade>
      </Screen>
    ),
  },
  {
    label: "Take attendance",
    caption: "On tryout night, check players in from your phone. Evaluators see who is on the floor.",
    screen: (
      <Screen title="Attendance · Session 1 · Oct 5" badge="26 / 28 in">
        <Cascade>
          {DW.players.slice(0, 5).map((name, i) => (
            <PlayerRow key={name} n={i} name={name} tone="done" right={<Chip tone="green">Present ✓</Chip>} />
          ))}
          <Row tone="active">
            <Avatar n={5} name={DW.players[5]} />
            <div className="min-w-0 flex-1 text-[13px] font-bold">{DW.players[5]}</div>
            <div className="flex gap-1">
              <Chip tone="green">Here</Chip>
              <Chip tone="red">No-show</Chip>
            </div>
          </Row>
        </Cascade>
      </Screen>
    ),
  },
  {
    label: "Build the offer",
    caption: "One template carries it all: uniform, season dates, fee, deposit, installment plan. Practice times can come later.",
    screen: (
      <Screen title="Offer template · U13 Rep" badge="Template">
        <Cascade className="grid grid-cols-2 gap-2 space-y-0">
          <Field label="Season" value="Nov 1 to Apr 30" />
          <Field label="Uniform" value="Included" active />
          <Field label="Season fee" value={DW.seasonFee} />
          <Field label="Deposit" value={`${DW.deposit} on accept`} active />
          <Field label="Installments" value={`${DW.installments} monthly`} active />
          <Field label="Practices" value="Tue and Thu, finalized later" />
        </Cascade>
      </Screen>
    ),
  },
  {
    label: "Send offers",
    caption: "Pick your players and press send. Every family gets the same clean offer at the same moment.",
    screen: (
      <Screen title={`Send offers · ${DW.team}`} badge="12 selected">
        <Cascade>
          {DW.players.slice(0, 5).map((name, i) => (
            <PlayerRow
              key={name}
              n={i}
              name={name}
              right={
                <Chip tone="green" late={i}>
                  Offer sent ✓
                </Chip>
              }
            />
          ))}
          <div className="flex items-center justify-between pt-1">
            <span className="text-ink-400 text-[11px] font-semibold">+ 7 more selected</span>
            <ActionBtn press>Send 12 offers</ActionBtn>
          </div>
        </Cascade>
      </Screen>
    ),
  },
  {
    label: "Track acceptances",
    caption: "Accepted means the deposit is paid. The roster fills itself with committed families.",
    screen: (
      <Screen title={`Offers · ${DW.team}`} badge="Live status">
        <Cascade>
          <Row tone="done">
            <div className="min-w-0 flex-1 text-[13px] font-bold">Accepted, deposit paid</div>
            <div className="text-lg font-black tabular-nums text-emerald-600">9</div>
          </Row>
          <Row>
            <div className="min-w-0 flex-1 text-[13px] font-bold">Awaiting response</div>
            <div className="text-ink-500 text-lg font-black tabular-nums">2</div>
          </Row>
          <Row>
            <div className="min-w-0 flex-1 text-[13px] font-bold">Declined</div>
            <div className="text-lg font-black tabular-nums text-red-500">1</div>
          </Row>
          <div className="pt-1 text-center">
            <Chip tone="gold">Reminder scheduled for the 2 pending offers</Chip>
          </div>
        </Cascade>
      </Screen>
    ),
  },
  {
    label: "Finalize the roster",
    caption: "Jerseys assigned, roster locked, and one click sends it to your league. Nobody retypes a name.",
    screen: (
      <Screen title={`Roster · ${DW.team}`} badge="12 players">
        <Cascade>
          {DW.players.slice(0, 5).map((name, i) => (
            <Row key={name}>
              <span className="text-ink-400 w-7 text-center text-[12px] font-black tabular-nums">
                {[4, 7, 11, 23, 30][i]}
              </span>
              <div className="min-w-0 flex-1 text-[13px] font-bold">{name}</div>
              <Chip tone="green">Deposit ✓</Chip>
            </Row>
          ))}
          <div className="flex items-center justify-between pt-1">
            <span className="text-ink-400 text-[11px] font-semibold">+ 7 more, all paid</span>
            <ActionBtn press>Submit roster to league</ActionBtn>
          </div>
        </Cascade>
      </Screen>
    ),
  },
]
