import { describe, expect, it } from "vitest"
import { buildBracket, placeWeekend } from "./playoffs"
import type { SnapWeekend } from "./types"

const weekend: SnapWeekend = {
  id: "w",
  label: "Test finals",
  order: 0,
  roundId: null,
  target: 0,
  days: [0, 1].map((i) => ({
    id: `d${i}`,
    date: new Date(2027, 1, 27 + i).toISOString(),
    dateKey: `2027-1-${27 + i}`,
    dow: 6,
    venues: [
      {
        dayVenueId: `dv${i}`,
        gymId: "gym1",
        openMin: 10 * 60,
        closeMin: 22 * 60,
        courts: Array.from({ length: 9 }, (_, c) => ({ id: `c${c + 1}`, order: c })),
      },
    ],
  })),
  hosting: [],
}

describe("placeWeekend debug", () => {
  it("places a Tier-2-like mix (33 games) on 162 slots", () => {
    const divs = [
      { divisionId: "A", games: buildBracket(12, true).games },
      { divisionId: "B", games: buildBracket(5, true).games },
      { divisionId: "C", games: buildBracket(4, true).games },
      { divisionId: "D", games: buildBracket(3, true).games },
      { divisionId: "E", games: buildBracket(8, true).games },
    ]
    const total = divs.reduce((a, d) => a + d.games.length, 0)
    const { placed, unplaced } = placeWeekend(divs, weekend, 75)
    if (unplaced.length) {
      console.log("UNPLACED:", unplaced.map((u) => `${u.divisionId}:${u.round}:${u.id} tier${u.tier}`))
      console.log("placed count", placed.length, "of", total)
    }
    expect(unplaced).toHaveLength(0)
  })
})
