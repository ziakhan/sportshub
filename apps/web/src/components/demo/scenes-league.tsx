import type { DemoScene } from "./demo-player"
import { ActionBtn, Chip, Field, Row, Screen } from "./mock-ui"

/**
 * League journey: season → sessions/venues → referees → publish →
 * club one-click submit + payment → finalize + generate schedule → live.
 */
export const LEAGUE_SCENES: DemoScene[] = [
  {
    label: "Create the season",
    caption: "Name the season, set the division and the window — the league takes shape in one form.",
    screen: (
      <Screen title="New season — Metro Youth Basketball" badge="Setup">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Season" value="Winter 2026–27" active />
          <Field label="Division" value="U13 Boys — Rep" />
          <Field label="Starts" value="Sun Nov 9" />
          <Field label="Ends" value="Sun Mar 22 + playoffs" />
          <Field label="Team fee" value="$1,850" active />
          <Field label="Roster lock" value="Nov 1" />
        </div>
      </Screen>
    ),
  },
  {
    label: "Sessions & venues",
    caption: "Define your game days and gyms once — the scheduler works inside exactly these slots.",
    screen: (
      <Screen title="Sessions — Winter 2026–27" badge="18 Sundays">
        <div className="space-y-2">
          <Row>
            <div className="min-w-0 flex-1 text-[13px] font-bold">Sundays · 9 AM – 5 PM</div>
            <Chip tone="blue">Nov 9 → Mar 22</Chip>
          </Row>
          <Row>
            <div className="min-w-0 flex-1 text-[13px] font-bold">Maplewood CC — Gym A &amp; B</div>
            <Chip tone="green">2 courts</Chip>
          </Row>
          <Row>
            <div className="min-w-0 flex-1 text-[13px] font-bold">Brookfield High — Main Gym</div>
            <Chip tone="green">1 court</Chip>
          </Row>
          <Row tone="active">
            <div className="min-w-0 flex-1 text-[13px] font-bold">Holiday blackout</div>
            <Chip tone="gold">Dec 21 &amp; 28 skipped</Chip>
          </Row>
        </div>
      </Screen>
    ),
  },
  {
    label: "Referees",
    caption: "Build your officials pool and assign crews per session — refs confirm from their own app.",
    screen: (
      <Screen title="Officials — Winter 2026–27" badge="Pool: 9">
        <div className="space-y-2">
          <Row>
            <div className="min-w-0 flex-1 text-[13px] font-bold">Mike Reyes</div>
            <Chip tone="green">Confirmed · Nov 9, both courts</Chip>
          </Row>
          <Row>
            <div className="min-w-0 flex-1 text-[13px] font-bold">Sofia Grant</div>
            <Chip tone="gold">Invited</Chip>
          </Row>
          <Row tone="active">
            <div className="min-w-0 flex-1 text-[13px] font-bold">Nov 16 · 6 games</div>
            <ActionBtn>Auto-assign crews</ActionBtn>
          </Row>
        </div>
      </Screen>
    ),
  },
  {
    label: "Publish the league",
    caption: "Publish and registration opens — clubs see the fee, the format, and the schedule window.",
    screen: (
      <Screen title="Winter 2026–27 — U13 Boys Rep" badge="Ready">
        <Row tone="active">
          <div className="min-w-0 flex-1">
            <div className="text-ink-950 text-[13px] font-bold">Open registration to clubs?</div>
            <div className="text-ink-500 text-[11.5px]">$1,850 per team · 18 game days · playoffs included</div>
          </div>
          <ActionBtn>Publish league</ActionBtn>
        </Row>
        <div className="mt-2 flex gap-1.5">
          <Chip tone="green">✓ Public league page live</Chip>
          <Chip tone="blue">Clubs notified</Chip>
        </div>
      </Screen>
    ),
  },
  {
    label: "Clubs submit",
    caption: "Clubs enter with one click — the finalized roster and the team fee come through together.",
    screen: (
      <Screen title="Team entries — U13 Boys Rep" badge="8 teams in">
        <div className="space-y-2">
          <Row tone="done">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold">Ridgeview Rockets U13</div>
              <div className="text-ink-500 text-[11px]">Roster of 12 · submitted from club account</div>
            </div>
            <Chip tone="green">Paid $1,850 ✓</Chip>
          </Row>
          <Row tone="done">
            <div className="min-w-0 flex-1 text-[13px] font-bold">North Star Storm U13</div>
            <Chip tone="green">Paid ✓</Chip>
          </Row>
          <Row>
            <div className="min-w-0 flex-1 text-[13px] font-bold">Lakeside Lords U13</div>
            <Chip tone="gold">Roster in · payment pending</Chip>
          </Row>
        </div>
      </Screen>
    ),
  },
  {
    label: "Generate schedule",
    caption: "Lock the field and generate — a fair round-robin lands inside your real gym slots. Change a game, everyone's calendar updates.",
    screen: (
      <Screen title="Schedule — Winter 2026–27" badge="Generated">
        <div className="space-y-2">
          <Row>
            <Chip tone="blue">Nov 9</Chip>
            <div className="min-w-0 flex-1 text-[12.5px] font-bold">Rockets vs Storm · 9:00 · Gym A</div>
            <Chip>Wk 1</Chip>
          </Row>
          <Row>
            <Chip tone="blue">Nov 9</Chip>
            <div className="min-w-0 flex-1 text-[12.5px] font-bold">Lords vs Chargers · 10:30 · Gym B</div>
            <Chip>Wk 1</Chip>
          </Row>
          <Row tone="done">
            <div className="min-w-0 flex-1 text-[13px] font-bold">72 games · 18 weeks · 0 conflicts</div>
            <Chip tone="green">Every family notified</Chip>
          </Row>
        </div>
      </Screen>
    ),
  },
  {
    label: "Season runs live",
    caption: "Live scoring feeds standings, stat leaders and recaps automatically — and the playoff bracket builds itself from the table.",
    screen: (
      <Screen title="Standings — U13 Boys Rep" badge="Week 7 · LIVE">
        <div className="space-y-2">
          <Row tone="active">
            <span className="text-ink-400 w-5 text-center text-[12px] font-black">1</span>
            <div className="min-w-0 flex-1 text-[13px] font-bold">Ridgeview Rockets</div>
            <Chip tone="green">11–2</Chip>
            <Chip tone="orange">LIVE 42–39</Chip>
          </Row>
          <Row>
            <span className="text-ink-400 w-5 text-center text-[12px] font-black">2</span>
            <div className="min-w-0 flex-1 text-[13px] font-bold">North Star Storm</div>
            <Chip tone="green">10–3</Chip>
          </Row>
          <Row>
            <span className="text-ink-400 w-5 text-center text-[12px] font-black">3</span>
            <div className="min-w-0 flex-1 text-[13px] font-bold">Lakeside Lords</div>
            <Chip tone="green">8–5</Chip>
          </Row>
          <div className="pt-1 text-center">
            <Chip tone="gold">Playoff bracket seeds from these standings — automatically</Chip>
          </div>
        </div>
      </Screen>
    ),
  },
]
