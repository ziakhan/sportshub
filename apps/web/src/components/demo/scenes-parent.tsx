import type { DemoScene } from "./demo-player"
import { ActionBtn, Chip, Field, Row, Screen } from "./mock-ui"

/** Parent journey: discover → details → register → pay → confirmed → accept offer. */
export const PARENT_SCENES: DemoScene[] = [
  {
    label: "Find a tryout",
    caption: "Families browse real tryouts near them — age group, dates, and fee up front.",
    screen: (
      <Screen title="Tryouts near Mississauga" badge="12 open">
        <div className="space-y-2">
          <Row tone="active">
            <div className="min-w-0 flex-1">
              <div className="text-ink-950 text-[13px] font-bold">U13 Boys Rep Tryout — Ridgeview Rockets</div>
              <div className="text-ink-500 text-[11.5px]">Sun Oct 5 &amp; Tue Oct 7 · Maplewood CC, Gym A</div>
            </div>
            <Chip tone="orange">$25</Chip>
            <Chip tone="green">12 spots left</Chip>
          </Row>
          <Row>
            <div className="min-w-0 flex-1">
              <div className="text-ink-950 text-[13px] font-bold">U11 Girls Skills Camp — North Star</div>
              <div className="text-ink-500 text-[11.5px]">Oct 11–12 · Brookfield High</div>
            </div>
            <Chip tone="orange">$60</Chip>
          </Row>
          <Row>
            <div className="min-w-0 flex-1">
              <div className="text-ink-950 text-[13px] font-bold">U15 Boys House League — Lakeside</div>
              <div className="text-ink-500 text-[11.5px]">Season starts Nov 2 · 2 gyms</div>
            </div>
            <Chip tone="orange">$395</Chip>
          </Row>
        </div>
      </Screen>
    ),
  },
  {
    label: "See the details",
    caption: "Every listing is a real page — sessions, venue, fee, and how many spots remain.",
    screen: (
      <Screen title="U13 Boys Rep Tryout" badge="Ridgeview Rockets">
        <div className="mb-3 grid grid-cols-2 gap-2">
          <Field label="Session 1" value="Sun Oct 5 · 6–8 PM" />
          <Field label="Session 2" value="Tue Oct 7 · 6–8 PM" />
          <Field label="Venue" value="Maplewood CC — Gym A" />
          <Field label="Fee" value="$25 · card or installments" />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            <Chip tone="green">28 / 40 registered</Chip>
            <Chip tone="blue">Born 2013–2014</Chip>
          </div>
          <ActionBtn>Register</ActionBtn>
        </div>
      </Screen>
    ),
  },
  {
    label: "Register",
    caption: "Two minutes of typing — player, guardian, contact — and no paper forms, ever.",
    screen: (
      <Screen title="Register — U13 Boys Rep Tryout" badge="Step 1 of 2">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Player" value="Jordan Lee" active />
          <Field label="Birth year" value="2013" />
          <Field label="Guardian" value="Sam Lee" />
          <Field label="Phone" value="(416) 555-0192" />
        </div>
        <div className="mt-3 flex justify-end">
          <ActionBtn>Continue to payment</ActionBtn>
        </div>
      </Screen>
    ),
  },
  {
    label: "Pay online",
    caption: "Pay by card right there. Receipt lands in your inbox — no e-transfer to a stranger's number.",
    screen: (
      <Screen title="Payment" badge="Step 2 of 2">
        <Row>
          <div className="min-w-0 flex-1">
            <div className="text-ink-950 text-[13px] font-bold">Tryout fee</div>
            <div className="text-ink-500 text-[11.5px]">U13 Boys Rep · Jordan Lee</div>
          </div>
          <div className="text-ink-950 text-lg font-black tabular-nums">$25.00</div>
        </Row>
        <div className="mt-2">
          <Field label="Card" value="•••• •••• •••• 4242 · 09/28" active />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <Chip tone="green">✓ Receipt emailed automatically</Chip>
          <ActionBtn>Pay $25.00</ActionBtn>
        </div>
      </Screen>
    ),
  },
  {
    label: "On the calendar",
    caption: "Both sessions land on your calendar with RSVP buttons — and sync to your phone.",
    screen: (
      <Screen title="Your calendar" badge="Synced">
        <div className="space-y-2">
          <Row tone="done">
            <div className="min-w-0 flex-1">
              <div className="text-ink-950 text-[13px] font-bold">Tryout · Session 1</div>
              <div className="text-ink-500 text-[11.5px]">Sun Oct 5 · 6–8 PM · Maplewood CC</div>
            </div>
            <Chip tone="green">Going ✓</Chip>
          </Row>
          <Row>
            <div className="min-w-0 flex-1">
              <div className="text-ink-950 text-[13px] font-bold">Tryout · Session 2</div>
              <div className="text-ink-500 text-[11.5px]">Tue Oct 7 · 6–8 PM · Maplewood CC</div>
            </div>
            <div className="flex gap-1">
              <Chip tone="green">Going</Chip>
              <Chip>Can&apos;t</Chip>
            </div>
          </Row>
          <Row>
            <div className="min-w-0 flex-1">
              <div className="text-ink-500 text-[11.5px]">Add to Apple / Google calendar</div>
            </div>
            <Chip tone="blue">1 tap</Chip>
          </Row>
        </div>
      </Screen>
    ),
  },
  {
    label: "Accept the offer",
    caption: "Made the team? The offer arrives in-app — uniform, fees, installments — accept and pay the deposit in one flow.",
    screen: (
      <Screen title="Offer — Ridgeview Rockets U13 Rep" badge="Action needed">
        <div className="mb-3 grid grid-cols-2 gap-2">
          <Field label="Season" value="Nov 1 – Apr 30" />
          <Field label="Uniform" value="Included (jersey + shorts)" />
          <Field label="Season fee" value="$2,400" />
          <Field label="Plan" value="$500 deposit + 4 × $475" active />
        </div>
        <div className="flex items-center justify-between">
          <Chip tone="gold">Expires in 5 days</Chip>
          <div className="flex gap-2">
            <ActionBtn secondary>Decline</ActionBtn>
            <ActionBtn>Accept &amp; pay deposit</ActionBtn>
          </div>
        </div>
      </Screen>
    ),
  },
]
