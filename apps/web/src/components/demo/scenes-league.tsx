import type { DemoScene } from "./demo-player"
import { DW } from "./demo-world"
import { ActionBtn, Cascade, Chip, Field, Row, Screen } from "./mock-ui"

/**
 * League journey: season, sessions and venues, referees, publish,
 * club submissions with payment, schedule generation, live season.
 */
export const LEAGUE_SCENES: DemoScene[] = [
  {
    label: "Create the season",
    caption: "Name the season, set the division and the window. The league takes shape in one form.",
    screen: (
      <Screen title={`New season · ${DW.league}`} badge="Setup">
        <Cascade className="grid grid-cols-2 gap-2 space-y-0">
          <Field label="Season" value={DW.season} active />
          <Field label="Division" value={`${DW.team.replace(" Rep", "")} Rep`} />
          <Field label="Starts" value="Sun Nov 9" />
          <Field label="Ends" value="Mar 22, then playoffs" />
          <Field label="Team fee" value={DW.teamFee} active />
          <Field label="Roster lock" value="Nov 1" />
        </Cascade>
      </Screen>
    ),
  },
  {
    label: "Sessions & venues",
    caption: "Set your game days and gyms once. The scheduler works inside exactly these slots.",
    screen: (
      <Screen title={`Sessions · ${DW.season}`} badge="18 Sundays">
        <Cascade>
          <Row>
            <div className="min-w-0 flex-1 text-[13px] font-bold">Sundays · 9 AM to 5 PM</div>
            <Chip tone="blue">Nov 9 to Mar 22</Chip>
          </Row>
          <Row>
            <div className="min-w-0 flex-1 text-[13px] font-bold">
              {DW.venue} · {DW.gym} and {DW.gym2}
            </div>
            <Chip tone="green">2 courts</Chip>
          </Row>
          <Row>
            <div className="min-w-0 flex-1 text-[13px] font-bold">{DW.venue2} · Main Gym</div>
            <Chip tone="green">1 court</Chip>
          </Row>
          <Row tone="active">
            <div className="min-w-0 flex-1 text-[13px] font-bold">Holiday blackout</div>
            <Chip tone="gold">Dec 21 and 28 skipped</Chip>
          </Row>
        </Cascade>
      </Screen>
    ),
  },
  {
    label: "Referees",
    caption: "Build the officials pool and assign crews per session. Refs confirm from their own view.",
    screen: (
      <Screen title={`Officials · ${DW.season}`} badge="Pool: 9">
        <Cascade>
          <Row>
            <div className="min-w-0 flex-1 text-[13px] font-bold">{DW.refs[0]}</div>
            <Chip tone="green">Confirmed · Nov 9, both courts</Chip>
          </Row>
          <Row>
            <div className="min-w-0 flex-1 text-[13px] font-bold">{DW.refs[1]}</div>
            <Chip tone="gold">Invited</Chip>
          </Row>
          <Row>
            <div className="min-w-0 flex-1 text-[13px] font-bold">{DW.refs[2]}</div>
            <Chip tone="green">Confirmed · Nov 16</Chip>
          </Row>
          <Row tone="active">
            <div className="min-w-0 flex-1 text-[13px] font-bold">Nov 16 · 6 games</div>
            <ActionBtn press>Auto-assign crews</ActionBtn>
          </Row>
          <div className="text-right">
            <Chip tone="green" late={1}>
              ✓ 6 games covered
            </Chip>
          </div>
        </Cascade>
      </Screen>
    ),
  },
  {
    label: "Publish the league",
    caption: "Publish and registration opens. Clubs see the fee, the format and the schedule window.",
    screen: (
      <Screen title={`${DW.season} · U13 Boys Rep`} badge="Ready">
        <Row tone="active">
          <div className="min-w-0 flex-1">
            <div className="text-ink-950 text-[13px] font-bold">Open registration to clubs?</div>
            <div className="text-ink-500 text-[11.5px]">
              {DW.teamFee} per team · 18 game days · playoffs included
            </div>
          </div>
          <ActionBtn press>Publish league</ActionBtn>
        </Row>
        <div className="mt-2 flex gap-1.5">
          <Chip tone="green" late={1}>
            ✓ Public league page live
          </Chip>
          <Chip tone="blue" late={2}>
            Clubs notified
          </Chip>
        </div>
      </Screen>
    ),
  },
  {
    label: "Clubs submit",
    caption: "Clubs enter with one click. The finalized roster and the team fee arrive together.",
    screen: (
      <Screen title="Team entries · U13 Boys Rep" badge="8 teams in">
        <Cascade>
          <Row tone="done">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold">{DW.club} U13</div>
              <div className="text-ink-500 text-[11px]">Roster of 12, submitted from the club account</div>
            </div>
            <Chip tone="green">Paid {DW.teamFee} ✓</Chip>
          </Row>
          <Row tone="done">
            <div className="min-w-0 flex-1 text-[13px] font-bold">{DW.club2} U13</div>
            <Chip tone="green">Paid ✓</Chip>
          </Row>
          <Row tone="done">
            <div className="min-w-0 flex-1 text-[13px] font-bold">{DW.club4} U13</div>
            <Chip tone="green">Paid ✓</Chip>
          </Row>
          <Row>
            <div className="min-w-0 flex-1 text-[13px] font-bold">{DW.club3} U13</div>
            <Chip tone="gold">Roster in · payment pending</Chip>
          </Row>
        </Cascade>
      </Screen>
    ),
  },
  {
    label: "Generate schedule",
    caption: "Lock the field and press generate. A fair round robin lands inside your real gym slots, and every family's calendar fills in.",
    screen: (
      <Screen title={`Schedule · ${DW.season}`} badge="Generated">
        <Cascade>
          <Row>
            <Chip tone="blue">Nov 9</Chip>
            <div className="min-w-0 flex-1 text-[12.5px] font-bold">
              Rockets vs Storm · 9:00 · {DW.gym}
            </div>
            <Chip>Wk 1</Chip>
          </Row>
          <Row>
            <Chip tone="blue">Nov 9</Chip>
            <div className="min-w-0 flex-1 text-[12.5px] font-bold">
              Lords vs Chargers · 10:30 · {DW.gym2}
            </div>
            <Chip>Wk 1</Chip>
          </Row>
          <Row>
            <Chip tone="blue">Nov 16</Chip>
            <div className="min-w-0 flex-1 text-[12.5px] font-bold">
              Storm vs Lords · 9:00 · {DW.venue2}
            </div>
            <Chip>Wk 2</Chip>
          </Row>
          <Row tone="done">
            <div className="min-w-0 flex-1 text-[13px] font-bold">72 games · 18 weeks · 0 conflicts</div>
            <Chip tone="green" late={1}>
              Every family notified ✓
            </Chip>
          </Row>
        </Cascade>
      </Screen>
    ),
  },
  {
    label: "Season runs live",
    caption: "Live scoring feeds standings, stat leaders and recaps on their own. The playoff bracket seeds itself from the table.",
    screen: (
      <Screen title="Standings · U13 Boys Rep" badge="Week 7 · LIVE">
        <Cascade>
          <Row tone="active">
            <span className="text-ink-400 w-5 text-center text-[12px] font-black">1</span>
            <div className="min-w-0 flex-1 text-[13px] font-bold">{DW.club}</div>
            <Chip tone="green">11-2</Chip>
            <Chip tone="orange">LIVE 42-39</Chip>
          </Row>
          <Row>
            <span className="text-ink-400 w-5 text-center text-[12px] font-black">2</span>
            <div className="min-w-0 flex-1 text-[13px] font-bold">{DW.club2}</div>
            <Chip tone="green">10-3</Chip>
          </Row>
          <Row>
            <span className="text-ink-400 w-5 text-center text-[12px] font-black">3</span>
            <div className="min-w-0 flex-1 text-[13px] font-bold">{DW.club3}</div>
            <Chip tone="green">8-5</Chip>
          </Row>
          <Row>
            <span className="text-ink-400 w-5 text-center text-[12px] font-black">4</span>
            <div className="min-w-0 flex-1 text-[13px] font-bold">{DW.club4}</div>
            <Chip tone="green">7-6</Chip>
          </Row>
          <div className="pt-1 text-center">
            <Chip tone="gold">The playoff bracket seeds from these standings on its own</Chip>
          </div>
        </Cascade>
      </Screen>
    ),
  },
]
