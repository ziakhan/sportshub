import type { DemoScene } from "./demo-player"
import { DW } from "./demo-world"
import { ActionBtn, Avatar, Cascade, Chip, Field, PlayerRow, Row, Swap } from "./mock-ui"
import { DesktopShell, Duo, PhoneShell } from "./flow-shells"

/**
 * v4 flow scenes, from scratch (owner spec 2026-07-19). Every screen is
 * functionally mirrored from the real product pages before drawing:
 * tryout/signup fields, offer packages + sizes + jersey preferences
 * (offer-response-form.tsx), console actions +2/+3/FT/REB/AST with
 * On the floor tiles (scoring-console.tsx), game page with linescore.
 * Operator steps = DesktopShell. Family steps = full PhoneShell.
 * Side-by-side moments = Duo, which never stacks.
 */

const CLUB_NAV = ["My Club", "Teams", "Tryouts", "Offers", "Payments", "Chat", "Settings"]
const CLUB_WHO = `${DW.headCoach} · ${DW.club}`
const PARENT_WHO = DW.parent

/* =============== chapter 1 · tryouts =============== */

export const F_TRYOUT_CREATE: DemoScene = {
  label: "Create the tryout",
  caption: "The club fills in one form: sessions, gym, capacity, fee, and who is eligible.",
  role: "CLUB",
  screen: (
    <DesktopShell url="sportshubone.com/clubs/ridgeview-rockets/tryouts/new" who={CLUB_WHO} nav={CLUB_NAV} active="Tryouts" pageTitle="New tryout" pageAction={<Chip tone="ink">Draft</Chip>}>
      <Cascade className="grid grid-cols-2 gap-2.5 space-y-0 sm:grid-cols-3">
        <Field label="Title" value={`${DW.team} Tryout`} />
        <Field label="Team" value={DW.team} />
        <Field label="Eligibility" value="Born 2013" active />
        <Field label="Session 1" value="Sun Oct 5 · 6 to 8 PM" active />
        <Field label="Session 2" value="Tue Oct 7 · 6 to 8 PM" active />
        <Field label="Venue" value={`${DW.venue} · ${DW.gym}`} />
        <Field label="Capacity" value="40 players" />
        <Field label="Fee" value={DW.tryoutFee} />
        <Field label="Visibility" value="Public" />
      </Cascade>
      <div className="mt-4 flex justify-end">
        <ActionBtn>Save and preview</ActionBtn>
      </div>
    </DesktopShell>
  ),
}

export const F_TRYOUT_PUBLISH: DemoScene = {
  label: "Publish it",
  caption: "One click puts it on the club's public page where families can find it.",
  role: "CLUB",
  screen: (
    <DesktopShell url="sportshubone.com/clubs/ridgeview-rockets/tryouts" who={CLUB_WHO} nav={CLUB_NAV} active="Tryouts" pageTitle="Tryouts" pageAction={<Chip tone="blue">1 draft</Chip>}>
      <Cascade>
        <Row tone="active">
          <div className="min-w-0 flex-1">
            <div className="text-ink-950 text-[13px] font-bold">{DW.team} Tryout</div>
            <div className="text-ink-500 text-[11.5px]">Oct 5 and Oct 7 · {DW.venue} · 40 spots · {DW.tryoutFee}</div>
          </div>
          <ActionBtn>Publish</ActionBtn>
        </Row>
        <Row tone="done">
          <div className="min-w-0 flex-1 text-[13px] font-bold">U11 Boys Rep Tryout</div>
          <Chip tone="green">Published · 31 / 36 registered</Chip>
        </Row>
        <div className="flex gap-1.5 pt-1">
          <Chip tone="green" late={1}>✓ Live on your club page</Chip>
          <Chip tone="blue" late={2}>Link ready to share</Chip>
        </div>
      </Cascade>
    </DesktopShell>
  ),
}

export const F_PARENT_FIND: DemoScene = {
  label: "A family finds it",
  caption: "Now on the parent's phone. Tryouts near them, with dates and fees up front.",
  role: "PARENT",
  screen: (
    <PhoneShell title="Tryouts near you" who={PARENT_WHO} active="Home">
      <Cascade>
        <Row tone="active">
          <div className="min-w-0 flex-1">
            <div className="text-ink-950 text-[13px] font-bold">{DW.team} Tryout</div>
            <div className="text-ink-500 text-[11px]">{DW.club} · Oct 5 &amp; 7 · {DW.venue}</div>
          </div>
          <Chip tone="orange">{DW.tryoutFee}</Chip>
        </Row>
        <Row>
          <div className="min-w-0 flex-1">
            <div className="text-ink-950 text-[13px] font-bold">U11 Girls Skills Camp</div>
            <div className="text-ink-500 text-[11px]">{DW.club2} · Oct 11 to 12</div>
          </div>
          <Chip tone="orange">$60</Chip>
        </Row>
        <Row>
          <div className="min-w-0 flex-1">
            <div className="text-ink-950 text-[13px] font-bold">U15 Boys House League</div>
            <div className="text-ink-500 text-[11px]">{DW.club3} · starts Nov 2</div>
          </div>
          <Chip tone="orange">$395</Chip>
        </Row>
        <div className="flex justify-end pt-1">
          <ActionBtn>View tryout</ActionBtn>
        </div>
      </Cascade>
    </PhoneShell>
  ),
}

export const F_PARENT_DETAILS: DemoScene = {
  label: "The details",
  caption: "The listing is a real page: both sessions, the gym, the fee, spots left, who can register.",
  role: "PARENT",
  screen: (
    <PhoneShell title={`${DW.team} Tryout`} who={PARENT_WHO} active="Home">
      <Cascade>
        <Field label="Club" value={DW.club} />
        <Field label="Session 1" value="Sun Oct 5 · 6 to 8 PM" />
        <Field label="Session 2" value="Tue Oct 7 · 6 to 8 PM" />
        <Field label="Venue" value={`${DW.venue} · ${DW.gym}`} />
        <div className="flex gap-1.5">
          <Chip tone="green">28 / 40 registered</Chip>
          <Chip tone="blue">Born 2013</Chip>
        </div>
        <div className="flex justify-end pt-1">
          <ActionBtn>Register · {DW.tryoutFee}</ActionBtn>
        </div>
      </Cascade>
    </PhoneShell>
  ),
}

export const F_PARENT_REGISTER: DemoScene = {
  label: "Register",
  caption: "Player and guardian details, two minutes, no paper.",
  role: "PARENT",
  screen: (
    <PhoneShell title="Register" who={PARENT_WHO} active="Home">
      <Cascade>
        <Field label="Player" value={DW.kid} active />
        <Field label="Birth year" value={DW.kidYear} />
        <Field label="Guardian" value={DW.parent} />
        <Field label="Phone" value="(416) 555-0192" />
        <div className="flex justify-end pt-1">
          <ActionBtn>Continue to payment</ActionBtn>
        </div>
      </Cascade>
    </PhoneShell>
  ),
}

export const F_PARENT_PAY: DemoScene = {
  label: "Pay the fee",
  caption: "Card payment right in the flow. Receipt lands in the inbox on its own.",
  role: "PARENT",
  screen: (
    <PhoneShell title="Payment" who={PARENT_WHO} active="Home">
      <Cascade>
        <Row>
          <div className="min-w-0 flex-1">
            <div className="text-ink-950 text-[13px] font-bold">Tryout fee</div>
            <div className="text-ink-500 text-[11px]">{DW.kid} · {DW.team} Tryout</div>
          </div>
          <span className="text-ink-950 text-base font-black tabular-nums">$25.00</span>
        </Row>
        <Field label="Card" value="•••• •••• •••• 4242 · 09/28" active />
        <div className="flex items-center justify-between pt-1">
          <Chip tone="green" late={1}>✓ Both sessions added to your calendar</Chip>
          <ActionBtn>Pay $25.00</ActionBtn>
        </div>
      </Cascade>
    </PhoneShell>
  ),
}

export const F_CLUB_SIGNUPS: DemoScene = {
  label: "Signups & attendance",
  caption: "Back at the club: paid signups in real time, and check-in on tryout night.",
  role: "CLUB",
  screen: (
    <DesktopShell url="sportshubone.com/clubs/ridgeview-rockets/tryouts/u13" who={CLUB_WHO} nav={CLUB_NAV} active="Tryouts" pageTitle={`${DW.team} Tryout · signups`} pageAction={<Chip tone="green">29 / 40</Chip>}>
      <Cascade>
        {DW.players.slice(0, 5).map((name, idx) => (
          <PlayerRow
            key={name}
            n={idx}
            name={name}
            sub="Born 2013 · paid online"
            tone={idx < 3 ? "done" : "plain"}
            right={
              idx < 3 ? <Chip tone="green">Present ✓</Chip> : <div className="flex gap-1"><Chip tone="green">Here</Chip><Chip tone="red">No-show</Chip></div>
            }
          />
        ))}
        <div className="flex items-center justify-between pt-1">
          <span className="text-ink-400 text-[11px] font-semibold">+ 24 more · session 1 check-in</span>
          <ActionBtn>Go to offers</ActionBtn>
        </div>
      </Cascade>
    </DesktopShell>
  ),
}

/* =============== chapter 2 · offers =============== */

export const F_OFFER_TEMPLATE: DemoScene = {
  label: "Build the offer",
  caption: "One template: season window, fee, deposit, installments, what gear is included. Practice times can come later.",
  role: "CLUB",
  screen: (
    <DesktopShell url="sportshubone.com/clubs/ridgeview-rockets/offer-templates" who={CLUB_WHO} nav={CLUB_NAV} active="Offers" pageTitle="Offer template · Rep Package" pageAction={<Chip tone="blue">Template</Chip>}>
      <Cascade className="grid grid-cols-2 gap-2.5 space-y-0 sm:grid-cols-3">
        <Field label="Season" value="Nov 1 to Apr 30" />
        <Field label="Season fee" value={DW.seasonFee} active />
        <Field label="Deposit on accept" value={DW.deposit} active />
        <Field label="Payment" value="4 installments" active />
        <Field label="Includes" value="Uniform ✓ · Tracksuit ✓" />
        <Field label="Practices" value="Tue and Thu · times later" />
      </Cascade>
      <div className="mt-4 flex justify-end">
        <ActionBtn>Save template</ActionBtn>
      </div>
    </DesktopShell>
  ),
}

function PaneCard({ title, children, dark }: { title: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-xl border shadow-lg ${dark ? "border-[#1e2d4d] bg-gradient-to-br from-[#1e2d4d] to-[#0b1628] text-white" : "border-ink-200 bg-white"}`}>
      <div className={`truncate border-b px-2.5 py-1.5 text-[10.5px] font-bold sm:text-[12px] ${dark ? "border-white/10 text-white/80" : "border-ink-100 text-ink-950"}`}>
        {title}
      </div>
      <div className="p-2 sm:p-3">{children}</div>
    </div>
  )
}

export const F_OFFER_SEND_DUO: DemoScene = {
  label: "Send · it arrives",
  caption: "Side by side: the club presses send, and the offer lands on the family's phone in the same moment.",
  role: "CLUB",
  screen: (
    <Duo
      leftLabel={`Club office · ${DW.headCoach.split(" ")[0]}'s laptop`}
      rightLabel={`${DW.parent.split(" ")[0]}'s phone`}
      left={
        <PaneCard title="Send offers · 12 selected">
          <div className="space-y-1.5">
            {DW.players.slice(0, 3).map((name, idx) => (
              <div key={name} className="border-ink-100 flex items-center gap-1.5 rounded-lg border px-2 py-1.5">
                <Avatar n={idx} name={name} />
                <span className="text-ink-950 min-w-0 flex-1 truncate text-[11px] font-bold sm:text-[12.5px]">{name}</span>
              </div>
            ))}
            <div className="text-ink-400 text-center text-[10px] font-semibold">+ 9 more</div>
            <div className="flex justify-end pt-0.5">
              <ActionBtn>Send 12 offers</ActionBtn>
            </div>
          </div>
        </PaneCard>
      }
      right={
        <PaneCard title="SportsHub" dark>
          <div className="space-y-1.5">
            <div className="rounded-lg bg-white/10 px-2 py-1.5">
              <div className="text-[10px] font-bold text-white/60">now</div>
              <div className="demo-late text-[11px] font-bold sm:text-[12.5px]" style={{ animationDelay: "1.2s" }}>
                Offer from {DW.club}
              </div>
              <div className="demo-late text-[10px] text-white/70" style={{ animationDelay: "1.35s" }}>
                {DW.team} · Rep Package {DW.seasonFee}
              </div>
            </div>
            <div className="text-center">
              <span className="demo-late inline-block rounded-full bg-emerald-400/20 px-2 py-0.5 text-[9.5px] font-bold text-emerald-300" style={{ animationDelay: "1.6s" }}>
                12 families pinged at once
              </span>
            </div>
          </div>
        </PaneCard>
      }
    />
  ),
}

export const F_OFFER_PACKAGE: DemoScene = {
  label: "Pick the package",
  caption: "The family opens it and picks a package. Fee and included gear are spelled out on each.",
  role: "PARENT",
  screen: (
    <PhoneShell title="Accept Offer" who={PARENT_WHO} active="Home">
      <Cascade>
        <div className="text-ink-800 text-[12px] font-semibold">Choose your package <span className="text-red-500">*</span></div>
        <div className="border-play-400 ring-play-200 rounded-xl border bg-white p-2.5 ring-1">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="border-play-500 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2"><span className="bg-play-500 h-1.5 w-1.5 rounded-full" /></span>
              <span className="text-ink-950 text-[12.5px] font-bold">Rep Package</span>
            </span>
            <span className="text-ink-950 text-[12.5px] font-black">{DW.seasonFee}</span>
          </div>
          <div className="text-ink-500 pl-5 text-[10.5px]">Includes Uniform, Tracksuit</div>
        </div>
        <div className="border-ink-200 rounded-xl border bg-white p-2.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="border-ink-300 h-3.5 w-3.5 rounded-full border-2" />
              <span className="text-ink-950 text-[12.5px] font-bold">Rep, own gear</span>
            </span>
            <span className="text-ink-950 text-[12.5px] font-black">$2,250</span>
          </div>
          <div className="text-ink-500 pl-5 text-[10.5px]">No gear included</div>
        </div>
        <div className="flex justify-end pt-1">
          <ActionBtn>Continue</ActionBtn>
        </div>
      </Cascade>
    </PhoneShell>
  ),
}

export const F_OFFER_SIZES: DemoScene = {
  label: "Sizes & number",
  caption: "Uniform and tracksuit sizes plus three jersey number choices, collected right here. No follow-up emails.",
  role: "PARENT",
  screen: (
    <PhoneShell title="Accept Offer" who={PARENT_WHO} active="Home">
      <Cascade>
        <Field label="Uniform Size *" value="Youth Large" active />
        <Field label="Tracksuit Size *" value="Youth Large" active />
        <div className="grid grid-cols-3 gap-1.5">
          <Field label="Jersey 1st *" value="4" active />
          <Field label="2nd" value="11" />
          <Field label="3rd" value="23" />
        </div>
        <div className="text-ink-400 text-[10.5px]">Number choices must all be different.</div>
        <div className="flex justify-end pt-1">
          <ActionBtn>Accept and pay {DW.deposit} deposit</ActionBtn>
        </div>
      </Cascade>
    </PhoneShell>
  ),
}

export const F_OFFER_CONFIRMED: DemoScene = {
  label: "Spot confirmed",
  caption: "Deposit in, spot locked, installments scheduled. Done from the couch.",
  role: "PARENT",
  screen: (
    <PhoneShell title="Offer accepted" who={PARENT_WHO} active="Home">
      <Cascade>
        <Row tone="done">
          <div className="min-w-0 flex-1">
            <div className="text-ink-950 text-[13px] font-bold">Deposit paid · {DW.deposit}</div>
            <div className="text-ink-500 text-[11px]">Visa •••• 4242 · receipt emailed</div>
          </div>
          <Chip tone="green">✓</Chip>
        </Row>
        <Row>
          <div className="min-w-0 flex-1 text-[12px] font-semibold">Remaining {DW.installments}, monthly from Dec 1. Charged automatically.</div>
        </Row>
        <div className="text-center pt-1">
          <Chip tone="green" late={1}>✓ {DW.kid} is on the {DW.team} roster</Chip>
        </div>
        <div className="flex justify-end pt-1">
          <ActionBtn>Done</ActionBtn>
        </div>
      </Cascade>
    </PhoneShell>
  ),
}

export const F_OFFER_BOARD: DemoScene = {
  label: "Back at the club",
  caption: "The club sees the acceptance with sizes and number preferences recorded, and number 4 assigned.",
  role: "CLUB",
  screen: (
    <DesktopShell url="sportshubone.com/clubs/ridgeview-rockets/offers/summary" who={CLUB_WHO} nav={CLUB_NAV} active="Offers" pageTitle="Offers · summary" pageAction={<Chip tone="green">9 of 12 accepted</Chip>}>
      <Cascade>
        <Row tone="done">
          <Avatar n={0} name={DW.kid} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold">{DW.kid}</div>
            <div className="text-ink-500 text-[11px]">Uniform YL · Tracksuit YL · prefers 4, 11, 23</div>
          </div>
          <Chip tone="green" late={0}>Accepted ✓</Chip>
          <Chip tone="blue" late={1}>#4 assigned</Chip>
        </Row>
        <Row tone="done">
          <Avatar n={1} name={DW.players[1]} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold">{DW.players[1]}</div>
            <div className="text-ink-500 text-[11px]">Uniform YM · Tracksuit YM · prefers 7, 12</div>
          </div>
          <Chip tone="green">Accepted ✓</Chip>
          <Chip tone="blue">#7 assigned</Chip>
        </Row>
        <Row>
          <div className="min-w-0 flex-1 text-[13px] font-bold">Awaiting response</div>
          <Chip tone="gold">2 pending · reminder scheduled</Chip>
        </Row>
        <div className="flex justify-end pt-1">
          <ActionBtn>Finalize roster</ActionBtn>
        </div>
      </Cascade>
    </DesktopShell>
  ),
}

export const F_ROSTER_SUBMIT: DemoScene = {
  label: "Roster to league",
  caption: "Roster locked with jerseys set, and one click sends it to the league with the team fee. Nobody retypes a name.",
  role: "CLUB",
  screen: (
    <DesktopShell url="sportshubone.com/clubs/ridgeview-rockets/teams/u13/roster" who={CLUB_WHO} nav={CLUB_NAV} active="Teams" pageTitle={`Roster · ${DW.team}`} pageAction={<Chip tone="green">12 players · all paid</Chip>}>
      <Cascade>
        {DW.players.slice(0, 4).map((name, idx) => (
          <Row key={name}>
            <span className="text-ink-400 w-7 text-center text-[12px] font-black tabular-nums">{[4, 7, 11, 23][idx]}</span>
            <div className="min-w-0 flex-1 text-[13px] font-bold">{name}</div>
            <Chip tone="green">Deposit ✓</Chip>
          </Row>
        ))}
        <div className="flex items-center justify-between pt-1">
          <span className="text-ink-400 text-[11px] font-semibold">+ 8 more</span>
          <ActionBtn>Submit to {DW.league} · {DW.teamFee}</ActionBtn>
        </div>
      </Cascade>
    </DesktopShell>
  ),
}

/* =============== chapter 3 · game night =============== */

export const F_PREGAME: DemoScene = {
  label: "Pre-game setup",
  caption: "Before tip-off: scorekeeper set, clock on, and a one-time guest link for whoever runs the table.",
  role: "CLUB",
  screen: (
    <DesktopShell url="sportshubone.com/games/rockets-vs-storm" who={CLUB_WHO} nav={CLUB_NAV} active="Teams" pageTitle="Game setup · Rockets vs Storm" pageAction={<Chip tone="gold">Sun 9:00 AM</Chip>}>
      <Cascade>
        <Row tone="done">
          <div className="min-w-0 flex-1 text-[13px] font-bold">Scorekeeper</div>
          <Chip tone="blue">{DW.teamManager}</Chip>
        </Row>
        <Row tone="done">
          <div className="min-w-0 flex-1 text-[13px] font-bold">Run the game clock?</div>
          <Chip tone="green">On</Chip>
        </Row>
        <Row tone="active">
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold">Guest scorekeeper link</div>
            <div className="text-ink-500 text-[11px]">Works once, for this game only. No account needed.</div>
          </div>
          <Chip tone="green" late={1}>Copied ✓</Chip>
        </Row>
        <div className="flex justify-end pt-1">
          <ActionBtn>Start the game</ActionBtn>
        </div>
      </Cascade>
    </DesktopShell>
  ),
}

export const F_LIVE_DUO: DemoScene = {
  label: "Score it live",
  caption: "The table presses +2. Every phone and laptop watching the game page updates in the same breath.",
  role: "SCOREKEEPER",
  screen: (
    <Duo
      leftLabel="Scoring console · at the table"
      rightLabel="Live game page · everyone watching"
      left={
        <PaneCard title="Console · Q3 · 4:12 · Rockets 42, Storm 39">
          <div className="space-y-1.5">
            <div className="text-[9px] font-black uppercase tracking-wide text-ink-400">On the floor</div>
            <div className="border-play-300 bg-play-50/60 flex items-center gap-1.5 rounded-lg border px-2 py-1">
              <span className="text-ink-950 text-[11px] font-black tabular-nums">#4</span>
              <span className="text-ink-950 min-w-0 flex-1 truncate text-[11px] font-bold">{DW.kid}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            </div>
            <div className="border-ink-100 flex items-center gap-1.5 rounded-lg border px-2 py-1">
              <span className="text-ink-950 text-[11px] font-black tabular-nums">#7</span>
              <span className="text-ink-950 min-w-0 flex-1 truncate text-[11px] font-bold">{DW.players[1]}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            </div>
            <div className="grid grid-cols-3 gap-1 pt-0.5">
              <ActionBtn>+2</ActionBtn>
              <span className="border-ink-200 text-ink-700 inline-flex items-center justify-center rounded-lg border bg-white py-1.5 text-[11px] font-bold">+3</span>
              <span className="border-ink-200 text-ink-700 inline-flex items-center justify-center rounded-lg border bg-white py-1.5 text-[11px] font-bold">FT</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="border-ink-200 text-ink-500 inline-flex items-center justify-center rounded-lg border bg-white py-1 text-[10px] font-bold">REB</span>
              <span className="border-ink-200 text-ink-500 inline-flex items-center justify-center rounded-lg border bg-white py-1 text-[10px] font-bold">AST</span>
              <span className="border-ink-200 text-ink-500 inline-flex items-center justify-center rounded-lg border bg-white py-1 text-[10px] font-bold">PF</span>
            </div>
          </div>
        </PaneCard>
      }
      right={
        <PaneCard title="Rockets vs Storm · LIVE" dark>
          <div className="text-center">
            <div className="text-[9px] font-black uppercase tracking-widest text-white/50">Q3 · 4:12</div>
            <div className="flex items-center justify-around py-1">
              <div>
                <div className="text-[9.5px] font-bold text-white/70">RRK</div>
                <div className="text-2xl font-black tabular-nums sm:text-3xl"><Swap from="42" to="44" /></div>
              </div>
              <div className="text-[10px] font-black text-white/40">·</div>
              <div>
                <div className="text-[9.5px] font-bold text-white/70">NSS</div>
                <div className="text-2xl font-black tabular-nums sm:text-3xl">39</div>
              </div>
            </div>
            <div className="rounded-md bg-white/10 px-2 py-1 text-left text-[9.5px] font-semibold sm:text-[11px]">
              <span className="demo-late" style={{ animationDelay: "1.5s" }}>
                {DW.kid} scores 2, assisted by {DW.players[1].split(" ")[0]}
              </span>
            </div>
          </div>
        </PaneCard>
      }
    />
  ),
}

export const F_PARENT_LIVE: DemoScene = {
  label: "Watching from work",
  caption: "The parent who could not make it follows the same moment on their phone.",
  role: "PARENT",
  screen: (
    <PhoneShell title="Rockets vs Storm" who={PARENT_WHO} active="Scores">
      <div className="mb-2 rounded-xl bg-gradient-to-br from-[#1e2d4d] to-[#0b1628] p-3 text-center text-white">
        <div className="text-[9px] font-black uppercase tracking-widest text-white/50">LIVE · Q3 · 4:02</div>
        <div className="text-3xl font-black tabular-nums">44 · 39</div>
        <div className="text-[10px] font-semibold text-white/60">Rockets lead</div>
      </div>
      <Cascade>
        <div className="text-ink-700 rounded-lg bg-white px-2.5 py-1.5 text-[11.5px] font-semibold shadow-sm">
          {DW.kid} scores 2, assisted by {DW.players[1].split(" ")[0]}
        </div>
        <div className="text-ink-500 rounded-lg bg-white px-2.5 py-1.5 text-[11.5px] shadow-sm">Timeout, {DW.club2}</div>
        <div className="text-center">
          <Chip tone="orange" late={1}>{DW.kid.split(" ")[0]}: 16 PTS tonight</Chip>
        </div>
        <div className="flex justify-end pt-1">
          <ActionBtn>Continue</ActionBtn>
        </div>
      </Cascade>
    </PhoneShell>
  ),
}

export const F_FINAL_BOX: DemoScene = {
  label: "Final & box score",
  caption: "At the buzzer the box score is already public: quarters, leaders, everything official.",
  role: "EVERYONE",
  screen: (
    <DesktopShell url="sportshubone.com/game/rockets-vs-storm" who="Public game page" nav={["Game", "Stats", "Plays"]} active="Game" pageTitle="Final · Rockets 58, Storm 51" pageAction={<Chip tone="gold">Official ✓</Chip>}>
      <Cascade>
        <Row>
          <div className="min-w-0 flex-1 text-[12.5px] font-bold">Quarters</div>
          <span className="text-ink-700 text-[12.5px] font-black tabular-nums">14-12 · 13-11 · 17-15 · 14-13</span>
        </Row>
        <Row>
          <Avatar n={0} name={DW.kid} />
          <div className="min-w-0 flex-1 text-[13px] font-bold">{DW.kid}</div>
          <Chip tone="blue">18 PTS</Chip>
          <Chip>7 REB</Chip>
          <Chip>3 AST</Chip>
        </Row>
        <Row>
          <Avatar n={1} name={DW.players[1]} />
          <div className="min-w-0 flex-1 text-[13px] font-bold">{DW.players[1]}</div>
          <Chip tone="blue">12 PTS</Chip>
          <Chip>9 AST</Chip>
        </Row>
        <div className="flex justify-end pt-1">
          <ActionBtn>Continue</ActionBtn>
        </div>
      </Cascade>
    </DesktopShell>
  ),
}

export const F_RECAP_STANDINGS: DemoScene = {
  label: "Recap & standings",
  caption: "Minutes later a written recap is on the news page and the standings have already moved. Nobody typed anything.",
  role: "EVERYONE",
  screen: (
    <DesktopShell url="sportshubone.com/news" who="Public league pages" nav={["Scores", "News", "Standings", "Leaders"]} active="News" pageTitle={DW.league} pageAction={<Chip tone="blue">Auto-published</Chip>}>
      <Cascade>
        <div className="border-ink-100 rounded-xl border bg-white p-3">
          <div className="text-ink-950 text-[13.5px] font-black leading-snug">
            Rockets hold off Storm 58-51 behind {DW.kid.split(" ")[0]}&apos;s 18
          </div>
          <p className="text-ink-500 mt-1 text-[11.5px] leading-snug">
            {DW.club} won their fourth straight on Sunday at {DW.venue}, pulling away in a 17-15 third quarter...
          </p>
        </div>
        <Row tone="active">
          <span className="text-ink-400 w-5 text-center text-[12px] font-black">1</span>
          <div className="min-w-0 flex-1 text-[13px] font-bold">{DW.club}</div>
          <Chip tone="green">12-2</Chip>
          <Chip tone="gold" late={1}>▲ stays first</Chip>
        </Row>
        <div className="flex justify-end pt-1">
          <ActionBtn>Finish</ActionBtn>
        </div>
      </Cascade>
    </DesktopShell>
  ),
}
