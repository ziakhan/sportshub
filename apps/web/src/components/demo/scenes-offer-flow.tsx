import type { DemoScene } from "./demo-player"
import { DW } from "./demo-world"
import { ActionBtn, Avatar, Cascade, Chip, Field, PCFrame, Phone, PlayerRow, Row } from "./mock-ui"

/**
 * THE OFFER FLOW, grounded in the real product screens (checked against
 * offers/offer-response-form.tsx and clubs/[id]/offers 2026-07-19):
 * packages carry a label, fee and included gear; acceptance collects
 * uniform/tracksuit sizes (Youth Small through Adult XL) and three jersey
 * number preferences; the club's summary shows sizes and the assigned
 * number. Persona switches between scenes are explicit: PC frame = club
 * admin, phone frame = the family.
 */

const CLUB_NAV = ["Dashboard", "Teams", "Tryouts", "Offers", "Payments", "Chat"]

export const OFFER_SEND: DemoScene = {
  label: "Send offers",
  caption: "The club picks the evaluated players and sends the same offer package to all of them at once.",
  role: "CLUB",
  screen: (
    <PCFrame url={`sportshubone.com/clubs/${DW.club.toLowerCase().split(" ")[0]}/offers`} who={`${DW.headCoach} · ${DW.club}`} nav={CLUB_NAV} active="Offers">
      <Cascade>
        <Row tone="active">
          <div className="min-w-0 flex-1">
            <div className="text-ink-950 text-[13px] font-bold">Rep Package · {DW.seasonFee}</div>
            <div className="text-ink-500 text-[11px]">Includes Uniform, Tracksuit · 4 installments · expires in 7 days</div>
          </div>
          <Chip tone="blue">Template</Chip>
        </Row>
        {DW.players.slice(0, 4).map((name, i) => (
          <PlayerRow key={name} n={i} name={name} sub="Evaluated · shortlist" right={<Chip tone="blue">Selected ✓</Chip>} />
        ))}
        <div className="flex items-center justify-between pt-1">
          <span className="text-ink-400 text-[11px] font-semibold">12 of 26 selected</span>
          <ActionBtn press>Send 12 offers</ActionBtn>
        </div>
      </Cascade>
    </PCFrame>
  ),
}

export const OFFER_ARRIVES: DemoScene = {
  label: "The offer arrives",
  caption: "Now on the family's phone. The offer is waiting with the package, the fee and the deadline.",
  role: "PARENT",
  screen: (
    <Phone title="Offers" badge="1 new">
      <Cascade>
        <Row tone="active">
          <div className="min-w-0 flex-1">
            <div className="text-ink-950 text-[13px] font-bold">
              {DW.club} · {DW.team}
            </div>
            <div className="text-ink-500 text-[11px]">
              Offer for {DW.kid} · Rep Package {DW.seasonFee}
            </div>
          </div>
          <Chip tone="gold">7 days left</Chip>
        </Row>
        <div className="text-ink-500 rounded-lg bg-white px-2.5 py-1.5 text-[11.5px] shadow-sm">
          Season Nov 1 to Apr 30 · Includes Uniform, Tracksuit
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <ActionBtn secondary>Decline</ActionBtn>
          <ActionBtn press>Accept Offer</ActionBtn>
        </div>
      </Cascade>
    </Phone>
  ),
}

export const OFFER_PACKAGE: DemoScene = {
  label: "Choose the package",
  caption: "If the club offered more than one package, the family picks one. Fee and included gear are spelled out on each.",
  role: "PARENT",
  screen: (
    <Phone title="Accept Offer" badge="Step 1 of 3">
      <Cascade>
        <div className="text-ink-800 text-[12px] font-semibold">
          Choose your package <span className="text-red-500">*</span>
        </div>
        <div className="border-play-400 ring-play-200 rounded-xl border bg-white p-2.5 ring-1">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="border-play-500 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2">
                <span className="bg-play-500 h-1.5 w-1.5 rounded-full" />
              </span>
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
          <ActionBtn press>Continue</ActionBtn>
        </div>
      </Cascade>
    </Phone>
  ),
}

export const OFFER_SIZES: DemoScene = {
  label: "Sizes & jersey number",
  caption: "Gear sizes and three jersey number preferences, collected right in the acceptance. No follow-up email asking for sizes.",
  role: "PARENT",
  screen: (
    <Phone title="Accept Offer" badge="Step 2 of 3">
      <Cascade>
        <Field label="Uniform Size *" value="Youth Large" active />
        <Field label="Tracksuit Size *" value="Youth Large" active />
        <div className="grid grid-cols-3 gap-1.5">
          <Field label="Jersey 1st *" value="4" active />
          <Field label="2nd" value="11" />
          <Field label="3rd" value="23" />
        </div>
        <div className="text-ink-400 text-[10.5px]">Number preferences must all be different.</div>
        <div className="flex justify-end pt-1">
          <ActionBtn press>Accept and pay deposit</ActionBtn>
        </div>
      </Cascade>
    </Phone>
  ),
}

export const OFFER_PAID: DemoScene = {
  label: "Deposit paid",
  caption: "The deposit goes through and the spot is locked. The rest runs on the installment schedule.",
  role: "PARENT",
  screen: (
    <Phone title="Accept Offer" badge="Step 3 of 3">
      <Cascade>
        <Row tone="done">
          <div className="min-w-0 flex-1">
            <div className="text-ink-950 text-[13px] font-bold">Deposit paid · {DW.deposit}</div>
            <div className="text-ink-500 text-[11px]">Visa •••• 4242 · receipt emailed</div>
          </div>
          <Chip tone="green">✓</Chip>
        </Row>
        <Row>
          <div className="min-w-0 flex-1 text-[12px] font-semibold">Remaining: {DW.installments} monthly, starts Dec 1</div>
        </Row>
        <div className="text-center">
          <Chip tone="green" late={1}>
            ✓ {DW.kid}&apos;s roster spot is confirmed
          </Chip>
        </div>
        <div className="flex justify-end pt-1">
          <ActionBtn press>Done</ActionBtn>
        </div>
      </Cascade>
    </Phone>
  ),
}

export const OFFER_BOARD: DemoScene = {
  label: "Back at the club",
  caption: "Back on the club's screen. The acceptance is in with sizes and number preferences already recorded, and #4 is assigned.",
  role: "CLUB",
  screen: (
    <PCFrame url={`sportshubone.com/clubs/${DW.club.toLowerCase().split(" ")[0]}/offers/summary`} who={`${DW.headCoach} · ${DW.club}`} nav={CLUB_NAV} active="Offers">
      <Cascade>
        <Row tone="done">
          <Avatar n={0} name={DW.kid} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold">{DW.kid}</div>
            <div className="text-ink-500 text-[11px]">Uniform YL · Tracksuit YL · prefers 4, 11, 23</div>
          </div>
          <Chip tone="green" late={0}>
            Accepted ✓
          </Chip>
          <Chip tone="blue" late={1}>
            #4 assigned
          </Chip>
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
          <div className="min-w-0 flex-1 text-[13px] font-bold">Still out</div>
          <Chip tone="gold">2 pending</Chip>
          <Chip tone="red">1 declined</Chip>
        </Row>
        <div className="flex items-center justify-between pt-1">
          <span className="text-ink-400 text-[11px] font-semibold">9 of 12 accepted · deposits in</span>
          <ActionBtn press>Continue</ActionBtn>
        </div>
      </Cascade>
    </PCFrame>
  ),
}

export const OFFER_FLOW: DemoScene[] = [OFFER_SEND, OFFER_ARRIVES, OFFER_PACKAGE, OFFER_SIZES, OFFER_PAID, OFFER_BOARD]
