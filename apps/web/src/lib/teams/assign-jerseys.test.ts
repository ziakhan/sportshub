import { describe, expect, it } from "vitest"
import { assignJerseys, type JerseyCandidate } from "./assign-jerseys"

function candidate(playerId: string, jerseyPrefs: (number | null)[]): JerseyCandidate {
  return {
    offerId: `offer-${playerId}`,
    playerId,
    playerName: `Player ${playerId}`,
    jerseyPrefs,
  }
}

function numbersOf(assignments: ReturnType<typeof assignJerseys>) {
  return assignments.map((a) => a.jerseyNumber)
}

describe("assignJerseys", () => {
  it("gives every player their first preference when all are free", () => {
    const result = assignJerseys(
      [candidate("p1", [7]), candidate("p2", [23]), candidate("p3", [11])],
      []
    )
    expect(numbersOf(result)).toEqual([7, 23, 11])
  })

  it("resolves a contested number first-come-first-served, falling to the loser's next preference", () => {
    const result = assignJerseys([candidate("p1", [7, 8]), candidate("p2", [7, 9])], [])
    expect(numbersOf(result)).toEqual([7, 9])
  })

  it("assigns null when every preference is taken", () => {
    const result = assignJerseys(
      [candidate("p1", [7]), candidate("p2", [8]), candidate("p3", [7, 8])],
      []
    )
    expect(numbersOf(result)).toEqual([7, 8, null])
  })

  it("skips null placeholders inside the preference list", () => {
    const result = assignJerseys([candidate("p1", [null, null, 42])], [])
    expect(numbersOf(result)).toEqual([42])
  })

  it("assigns null for an empty or all-null preference list", () => {
    const result = assignJerseys([candidate("p1", []), candidate("p2", [null, null])], [])
    expect(numbersOf(result)).toEqual([null, null])
  })

  it("respects numbers already taken on the roster", () => {
    const result = assignJerseys([candidate("p1", [7, 8]), candidate("p2", [8, 9])], [7, 8])
    expect(numbersOf(result)).toEqual([null, 9])
  })

  it("honors candidate order as priority for the same preference", () => {
    const first = assignJerseys([candidate("p1", [10]), candidate("p2", [10])], [])
    const reversed = assignJerseys([candidate("p2", [10]), candidate("p1", [10])], [])
    expect(first.find((a) => a.playerId === "p1")?.jerseyNumber).toBe(10)
    expect(reversed.find((a) => a.playerId === "p2")?.jerseyNumber).toBe(10)
  })

  it("never assigns the same number twice across the batch", () => {
    const result = assignJerseys(
      [
        candidate("p1", [1, 2, 3]),
        candidate("p2", [1, 2, 3]),
        candidate("p3", [1, 2, 3]),
        candidate("p4", [1, 2, 3]),
      ],
      []
    )
    expect(numbersOf(result)).toEqual([1, 2, 3, null])
  })

  it("passes offer and player identity through to the assignment", () => {
    const result = assignJerseys([candidate("p1", [5])], [])
    expect(result[0]).toEqual({
      offerId: "offer-p1",
      playerId: "p1",
      playerName: "Player p1",
      jerseyNumber: 5,
    })
  })
})
