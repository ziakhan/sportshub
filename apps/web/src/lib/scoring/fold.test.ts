import { describe, expect, it } from "vitest"
import { foldEvents, totalRebounds, type FoldEvent } from "./fold"

const HOME = "team-home"
const AWAY = "team-away"
const ctx = { homeTeamId: HOME, awayTeamId: AWAY }

let seqCounter = 0
function ev(partial: Partial<FoldEvent> & { eventType: FoldEvent["eventType"] }): FoldEvent {
  return { sequence: ++seqCounter, ...partial }
}

function lineupBoth(): FoldEvent[] {
  return [
    ev({
      eventType: "LINEUP",
      teamId: HOME,
      metadata: { playerIds: ["h1", "h2", "h3", "h4", "h5"] },
    }),
    ev({
      eventType: "LINEUP",
      teamId: AWAY,
      metadata: { playerIds: ["a1", "a2", "a3", "a4", "a5"] },
    }),
    ev({ eventType: "PERIOD_START", period: 1 }),
  ]
}

describe("foldEvents — scoring", () => {
  it("adds made shots to the right side and player; misses count attempts only", () => {
    const r = foldEvents(
      [
        ...lineupBoth(),
        ev({ eventType: "SCORE_2PT", teamId: HOME, playerId: "h1", made: true }),
        ev({ eventType: "SCORE_3PT", teamId: HOME, playerId: "h2", made: true }),
        ev({ eventType: "SCORE_3PT", teamId: AWAY, playerId: "a1", made: false }),
        ev({ eventType: "SCORE_FT", teamId: AWAY, playerId: "a1", made: true }),
      ],
      ctx
    )
    expect(r.homeScore).toBe(5)
    expect(r.awayScore).toBe(1)
    expect(r.players.h1.points).toBe(2)
    expect(r.players.h1.fgMade2).toBe(1)
    expect(r.players.a1.fgMiss3).toBe(1)
    expect(r.players.a1.ftMade).toBe(1)
    expect(r.players.a1.points).toBe(1)
  })

  it("voided events disappear from score and box (undo semantics)", () => {
    const shot = ev({ eventType: "SCORE_3PT", teamId: HOME, playerId: "h1", made: true })
    const base = [...lineupBoth(), shot]
    expect(foldEvents(base, ctx).homeScore).toBe(3)
    expect(foldEvents([...lineupBoth(), { ...shot, voided: true }], ctx).homeScore).toBe(0)
  })

  it("folds in sequence order regardless of array order", () => {
    const events = [
      ev({ eventType: "SCORE_2PT", teamId: HOME, playerId: "h1", made: true }),
      ...lineupBoth(),
    ]
    const r = foldEvents(events.reverse(), ctx)
    expect(r.homeScore).toBe(2)
  })
})

describe("foldEvents — rebounds, assists, defense", () => {
  it("splits offensive vs defensive rebounds via metadata", () => {
    const r = foldEvents(
      [
        ...lineupBoth(),
        ev({ eventType: "REBOUND", teamId: HOME, playerId: "h3", metadata: { offensive: true } }),
        ev({ eventType: "REBOUND", teamId: HOME, playerId: "h3", metadata: { offensive: false } }),
        ev({ eventType: "REBOUND", teamId: AWAY, playerId: "a2", metadata: {} }),
      ],
      ctx
    )
    expect(r.players.h3.offRebounds).toBe(1)
    expect(r.players.h3.defRebounds).toBe(1)
    expect(totalRebounds(r.players.h3)).toBe(2)
    expect(r.players.a2.defRebounds).toBe(1) // default = defensive
  })

  it("counts assists, steals, blocks, turnovers", () => {
    const r = foldEvents(
      [
        ...lineupBoth(),
        ev({ eventType: "ASSIST", teamId: HOME, playerId: "h2" }),
        ev({ eventType: "STEAL", teamId: AWAY, playerId: "a1" }),
        ev({ eventType: "BLOCK", teamId: AWAY, playerId: "a4" }),
        ev({ eventType: "TURNOVER", teamId: HOME, playerId: "h1" }),
      ],
      ctx
    )
    expect(r.players.h2.assists).toBe(1)
    expect(r.players.a1.steals).toBe(1)
    expect(r.players.a4.blocks).toBe(1)
    expect(r.players.h1.turnovers).toBe(1)
  })
})

describe("foldEvents — fouls", () => {
  it("accumulates team fouls per period and fouls out at the limit", () => {
    const fouls = Array.from({ length: 5 }, () =>
      ev({ eventType: "FOUL", teamId: HOME, playerId: "h5" })
    )
    const r = foldEvents([...lineupBoth(), ...fouls], ctx)
    expect(r.players.h5.fouls).toBe(5)
    expect(r.players.h5.fouledOut).toBe(true)
    expect(r.teamFouls[HOME][1]).toBe(5)
  })

  it("technical fouls count separately, add to personals, and eject at two", () => {
    const r = foldEvents(
      [
        ...lineupBoth(),
        ev({ eventType: "FOUL", teamId: HOME, playerId: "h2", metadata: { technical: true } }),
        ev({ eventType: "FOUL", teamId: HOME, playerId: "h2" }),
        ev({ eventType: "FOUL", teamId: HOME, playerId: "h2", metadata: { technical: true } }),
      ],
      ctx
    )
    expect(r.players.h2.fouls).toBe(3)
    expect(r.players.h2.technicalFouls).toBe(2)
    expect(r.players.h2.fouledOut).toBe(true) // two techs = done
    expect(r.teamFouls[HOME][1]).toBe(3)
  })

  it("team fouls reset per period", () => {
    const r = foldEvents(
      [
        ...lineupBoth(),
        ev({ eventType: "FOUL", teamId: AWAY, playerId: "a1" }),
        ev({ eventType: "PERIOD_END" }),
        ev({ eventType: "PERIOD_START", period: 2 }),
        ev({ eventType: "FOUL", teamId: AWAY, playerId: "a2" }),
        ev({ eventType: "FOUL", teamId: AWAY, playerId: "a3" }),
      ],
      ctx
    )
    expect(r.teamFouls[AWAY][1]).toBe(1)
    expect(r.teamFouls[AWAY][2]).toBe(2)
    expect(r.period).toBe(2)
  })
})

describe("foldEvents — lineups and substitutions", () => {
  it("LINEUP sets the five; SUBSTITUTION swaps and updates onFloor flags", () => {
    const r = foldEvents(
      [
        ...lineupBoth(),
        ev({
          eventType: "SUBSTITUTION",
          teamId: HOME,
          metadata: { inPlayerId: "h6", outPlayerId: "h1" },
        }),
      ],
      ctx
    )
    expect(r.onFloor.home.sort()).toEqual(["h2", "h3", "h4", "h5", "h6"])
    expect(r.players.h1.onFloor).toBe(false)
    expect(r.players.h6.onFloor).toBe(true)
    expect(r.onFloor.away).toHaveLength(5)
  })

  it("periodsPlayed counts each period a player appears in, once", () => {
    const r = foldEvents(
      [
        ...lineupBoth(),
        ev({ eventType: "SCORE_2PT", teamId: HOME, playerId: "h1", made: true }),
        ev({ eventType: "PERIOD_END" }),
        ev({ eventType: "PERIOD_START", period: 2 }),
        ev({ eventType: "SCORE_2PT", teamId: HOME, playerId: "h1", made: true }),
        ev({ eventType: "SCORE_2PT", teamId: HOME, playerId: "h1", made: true }),
      ],
      ctx
    )
    expect(r.players.h1.periodsPlayed).toBe(2)
    // h2 was in the lineup both periods even without stats
    expect(r.players.h2.periodsPlayed).toBe(2)
  })
})

describe("foldEvents — clock and minutes", () => {
  it("credits on-floor seconds between CLOCK_START and CLOCK_STOP", () => {
    const t0 = 1_000_000
    const r = foldEvents(
      [
        ...lineupBoth(),
        ev({ eventType: "CLOCK_START", clockSeconds: 600, timestampMs: t0 }),
        ev({ eventType: "CLOCK_STOP", clockSeconds: 480, timestampMs: t0 + 120_000 }),
      ],
      ctx
    )
    expect(r.players.h1.secondsPlayed).toBe(120)
    expect(r.players.a5.secondsPlayed).toBe(120)
    expect(r.clockRunning).toBe(false)
    expect(r.clockSecondsAtLastEvent).toBe(480)
  })

  it("a substitution mid-run credits the outgoing player only up to the swap", () => {
    const t0 = 2_000_000
    const r = foldEvents(
      [
        ...lineupBoth(),
        ev({ eventType: "CLOCK_START", clockSeconds: 600, timestampMs: t0 }),
        ev({
          eventType: "SUBSTITUTION",
          teamId: HOME,
          metadata: { inPlayerId: "h6", outPlayerId: "h1" },
          timestampMs: t0 + 60_000,
        }),
        ev({ eventType: "CLOCK_STOP", clockSeconds: 420, timestampMs: t0 + 180_000 }),
      ],
      ctx
    )
    expect(r.players.h1.secondsPlayed).toBe(60)
    expect(r.players.h6.secondsPlayed).toBe(120)
    expect(r.players.h2.secondsPlayed).toBe(180)
  })
})
