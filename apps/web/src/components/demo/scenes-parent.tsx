import type { DemoScene } from "./demo-player"
import { DW } from "./demo-world"
import { ActionBtn, Cascade, Chip, Field, Row, Screen } from "./mock-ui"

/** Parent journey: discover, details, register, pay, calendar, accept the offer. */
export const PARENT_SCENES: DemoScene[] = [
  {
    label: "Find a tryout",
    caption: "Families search tryouts near them. Age group, dates and fee are right on the card.",
    screen: (
      <Screen title="Tryouts near Mississauga" badge="12 open">
        <Cascade>
          <Row tone="active">
            <div className="min-w-0 flex-1">
              <div className="text-ink-950 text-[13px] font-bold">
                {DW.team} Tryout · {DW.club}
              </div>
              <div className="text-ink-500 text-[11.5px]">
                Sun Oct 5 &amp; Tue Oct 7 · {DW.venue}, {DW.gym}
              </div>
            </div>
            <Chip tone="orange">{DW.tryoutFee}</Chip>
            <Chip tone="green">12 spots left</Chip>
          </Row>
          <Row>
            <div className="min-w-0 flex-1">
              <div className="text-ink-950 text-[13px] font-bold">U11 Girls Skills Camp · {DW.club2}</div>
              <div className="text-ink-500 text-[11.5px]">Oct 11 to 12 · {DW.venue2}</div>
            </div>
            <Chip tone="orange">$60</Chip>
          </Row>
          <Row>
            <div className="min-w-0 flex-1">
              <div className="text-ink-950 text-[13px] font-bold">U15 Boys House League · {DW.club3}</div>
              <div className="text-ink-500 text-[11.5px]">Season starts Nov 2 · 2 gyms</div>
            </div>
            <Chip tone="orange">$395</Chip>
          </Row>
          <Row>
            <div className="min-w-0 flex-1">
              <div className="text-ink-950 text-[13px] font-bold">U13 Girls Rep Tryout · {DW.club4}</div>
              <div className="text-ink-500 text-[11.5px]">Oct 14 · {DW.venue2}</div>
            </div>
            <Chip tone="orange">$30</Chip>
          </Row>
        </Cascade>
      </Screen>
    ),
  },
  {
    label: "See the details",
    caption: "Every listing is a real page. Sessions, venue, fee, and how many spots are left.",
    screen: (
      <Screen title={`${DW.team} Tryout`} badge={DW.club}>
        <Cascade className="mb-3 grid grid-cols-2 gap-2 space-y-0">
          <Field label="Session 1" value="Sun Oct 5 · 6 to 8 PM" />
          <Field label="Session 2" value="Tue Oct 7 · 6 to 8 PM" />
          <Field label="Venue" value={`${DW.venue} · ${DW.gym}`} />
          <Field label="Fee" value={`${DW.tryoutFee}, card or installments`} />
        </Cascade>
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            <Chip tone="green">28 / 40 registered</Chip>
            <Chip tone="blue">Born 2013</Chip>
          </div>
          <ActionBtn>Register</ActionBtn>
        </div>
      </Screen>
    ),
  },
  {
    label: "Register",
    caption: "Two minutes of typing. Player, guardian, contact. No paper forms.",
    screen: (
      <Screen title={`Register · ${DW.team} Tryout`} badge="Step 1 of 2">
        <Cascade className="grid grid-cols-2 gap-2 space-y-0">
          <Field label="Player" value={DW.kid} active />
          <Field label="Birth year" value={DW.kidYear} />
          <Field label="Guardian" value={DW.parent} />
          <Field label="Phone" value="(416) 555-0192" />
        </Cascade>
        <div className="mt-3 flex justify-end">
          <ActionBtn press>Continue to payment</ActionBtn>
        </div>
      </Screen>
    ),
  },
  {
    label: "Pay online",
    caption: "Pay by card right there. The receipt lands in your inbox on its own.",
    screen: (
      <Screen title="Payment" badge="Step 2 of 2">
        <Cascade>
          <Row>
            <div className="min-w-0 flex-1">
              <div className="text-ink-950 text-[13px] font-bold">Tryout fee</div>
              <div className="text-ink-500 text-[11.5px]">
                {DW.team} · {DW.kid}
              </div>
            </div>
            <div className="text-ink-950 text-lg font-black tabular-nums">$25.00</div>
          </Row>
          <Field label="Card" value="•••• •••• •••• 4242 · 09/28" active />
        </Cascade>
        <div className="mt-3 flex items-center justify-between gap-2">
          <Chip tone="green" late={1}>
            ✓ Paid · receipt emailed
          </Chip>
          <ActionBtn press>Pay $25.00</ActionBtn>
        </div>
      </Screen>
    ),
  },
  {
    label: "On the calendar",
    caption: "Both sessions land on your calendar with RSVP buttons, and sync to your phone.",
    screen: (
      <Screen title="Your calendar" badge="Synced">
        <Cascade>
          <Row tone="done">
            <div className="min-w-0 flex-1">
              <div className="text-ink-950 text-[13px] font-bold">Tryout · Session 1</div>
              <div className="text-ink-500 text-[11.5px]">Sun Oct 5 · 6 to 8 PM · {DW.venue}</div>
            </div>
            <Chip tone="green">Going ✓</Chip>
          </Row>
          <Row>
            <div className="min-w-0 flex-1">
              <div className="text-ink-950 text-[13px] font-bold">Tryout · Session 2</div>
              <div className="text-ink-500 text-[11.5px]">Tue Oct 7 · 6 to 8 PM · {DW.venue}</div>
            </div>
            <div className="flex gap-1">
              <Chip tone="green">Going</Chip>
              <Chip>Can&apos;t</Chip>
            </div>
          </Row>
          <Row>
            <div className="min-w-0 flex-1">
              <div className="text-ink-500 text-[11.5px]">Add to Apple or Google calendar</div>
            </div>
            <Chip tone="blue">1 tap</Chip>
          </Row>
        </Cascade>
      </Screen>
    ),
  },
  {
    label: "Accept the offer",
    caption: "Made the team? The offer arrives in the app. Accept it and pay the deposit in one flow.",
    screen: (
      <Screen title={`Offer · ${DW.club} ${DW.team}`} badge="Action needed">
        <Cascade className="mb-3 grid grid-cols-2 gap-2 space-y-0">
          <Field label="Season" value="Nov 1 to Apr 30" />
          <Field label="Uniform" value="Included, jersey and shorts" />
          <Field label="Season fee" value={DW.seasonFee} />
          <Field label="Plan" value={`${DW.deposit} deposit + ${DW.installments}`} active />
        </Cascade>
        <div className="flex items-center justify-between gap-2">
          <Chip tone="gold">Expires in 5 days</Chip>
          <div className="flex gap-2">
            <ActionBtn secondary>Decline</ActionBtn>
            <ActionBtn press>Accept and pay deposit</ActionBtn>
          </div>
        </div>
        <div className="mt-2 text-right">
          <Chip tone="green" late={2}>
            ✓ Roster spot confirmed
          </Chip>
        </div>
      </Screen>
    ),
  },
]
