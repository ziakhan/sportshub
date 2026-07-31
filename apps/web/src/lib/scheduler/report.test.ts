import { describe, expect, it } from "vitest"
import { computeFairnessReport } from "./report"

const names = new Map([
  ["A", "Team A"],
  ["B", "Team B"],
  ["C", "Team C"],
])

describe("computeFairnessReport", () => {
  it("counts back-to-backs, big gaps, split venues, early games and court share", () => {
    const games = [
      // Day 1: A plays 9:00 and 10:30 back-to-back at two different gyms
      { id: "1", homeTeamId: "A", awayTeamId: "B", scheduledAt: "2026-10-10T09:00:00", venueId: "v1", venueName: "Gym 1", courtId: "c1", courtName: "Court 1" },
      { id: "2", homeTeamId: "A", awayTeamId: "C", scheduledAt: "2026-10-10T10:30:00", venueId: "v2", venueName: "Gym 2", courtId: "c2", courtName: "Court 2" },
      // Day 2: B plays 9:00 and 18:00 — a big gap, same gym
      { id: "3", homeTeamId: "B", awayTeamId: "C", scheduledAt: "2026-10-11T09:00:00", venueId: "v1", venueName: "Gym 1", courtId: "c1", courtName: "Court 1" },
      { id: "4", homeTeamId: "B", awayTeamId: "A", scheduledAt: "2026-10-11T18:00:00", venueId: "v1", venueName: "Gym 1", courtId: "c1", courtName: "Court 1" },
      // Cancelled games are ignored
      { id: "5", homeTeamId: "A", awayTeamId: "B", scheduledAt: "2026-10-12T09:00:00", venueId: "v1", courtId: "c1", status: "CANCELLED" },
    ]
    const r = computeFairnessReport(games, names, 90)
    expect(r.totals.games).toBe(4)
    const A = r.teams.find((t) => t.teamId === "A")!
    const B = r.teams.find((t) => t.teamId === "B")!
    expect(A.backToBacks).toBe(1)
    expect(A.splitVenueDays).toBe(1)
    expect(B.backToBacks).toBe(0)
    expect(B.bigGapDays).toBe(1)
    expect(B.splitVenueDays).toBe(0)
    expect(B.topCourtName).toBe("Court 1")
    expect(B.topCourtShare).toBe(1)
    expect(A.earlyGames).toBe(1)
    expect(B.earlyGames).toBe(2)
    expect(r.totals.backToBackTeamDays).toBe(1)
    expect(r.totals.bigGapTeamDays).toBe(1)
    expect(r.totals.splitVenueTeamDays).toBe(1)
    expect(r.totals.maxTopCourtShare).toBe(1)
  })
})
