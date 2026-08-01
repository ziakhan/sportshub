/**
 * Demo scenario registry (owner 2026-08-01): the ONE source both the seeder
 * and the admin console read. Loading a scenario replaces the demo world;
 * fast-forwarding a staged scenario is an ADDITIVE top-up — whatever was
 * demoed live between stages survives.
 */
export interface DemoStage {
  n: number
  title: string
  whatToShow: string
}

export interface DemoScenario {
  key: string
  title: string
  description: string
  estMinutes: number
  /** Staged scenarios expose fast-forward buttons per stage. */
  stages?: DemoStage[]
  /** Registered but not yet loadable (later build wave). */
  implemented: boolean
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    key: "pitch",
    title: "Pitch world — clubs, tryouts, running season",
    description:
      "The classic demo: 16 clubs, tryouts and offers in flight, a running league with live scoring history, registration-phase Showcase League, family accounts, social feed.",
    estMinutes: 1,
    implemented: true,
  },
  {
    key: "nph-pitch-journey",
    title: "NPH full-scale journey — every real league, staged",
    description:
      "All 230 real NPH team entries (Showcase, D1, NPA, WNPA — real club and venue names, fictional players). Walk the whole story: registration → approvals → scheduling at true scale → requests → drop-outs → game day.",
    estMinutes: 4,
    implemented: true,
    stages: [
      {
        n: 1,
        title: "Registration in flight",
        whatToShow:
          "D1/NPA/WNPA fully approved and schedule-ready; Showcase League mid-registration (~25 of 146 in). Live: a club submits a team, the league approves one, payment options.",
      },
      {
        n: 2,
        title: "Everyone's in",
        whatToShow:
          "Every remaining census team submitted (pending). Live: submit one more, approve it, see the fee flow.",
      },
      {
        n: 3,
        title: "Ready to schedule",
        whatToShow:
          "All approved, league finalized — and one court short on purpose. Live: run the whole-season schedule, hit the capacity message, add Six Park Court 6, re-run, distribute by venue, commit. Far-team requests + a pending withdrawal are seeded.",
      },
      {
        n: 4,
        title: "Game day",
        whatToShow:
          "Mid-season: completed games with stats and standings, referees assigned, one game queued live for the scoring demo (lineups set, families RSVP'd).",
      },
    ],
  },
]

export function getScenario(key: string): DemoScenario | undefined {
  return DEMO_SCENARIOS.find((s) => s.key === key)
}
