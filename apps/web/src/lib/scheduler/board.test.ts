import { describe, expect, it } from "vitest"
import {
  UNASSIGNED_COLUMN,
  UNASSIGNED_GROUP,
  abbrevTeamName,
  boardDays,
  boardTone,
  boardVenues,
  boardWeekends,
  buildBoardColumns,
  buildBoardRows,
  columnKeyOf,
  dayKeyOf,
  defaultBoardDayKey,
  repeatOrdinals,
  unitAbbrev,
  weekendKeyOf,
  type BoardGame,
} from "./board"

// TZ is pinned to America/Toronto by vitest.config.ts, so these local-time
// expectations are the same on every machine and in CI.
let seq = 0
const game = (over: Partial<BoardGame> & { scheduledAt: string }): BoardGame => ({
  id: `g${++seq}`,
  homeTeamId: "home",
  awayTeamId: "away",
  homeTeamName: "Home",
  awayTeamName: "Away",
  venueId: "six",
  venueName: "Six Park East",
  courtId: "c1",
  courtName: "Court 1",
  ...over,
})

describe("dayKeyOf / weekendKeyOf", () => {
  it("buckets by LOCAL calendar date, not UTC", () => {
    // 7pm Sunday in Toronto is Monday 00:00 UTC — the operator is on Sunday.
    expect(dayKeyOf("2026-10-25T23:00:00.000Z")).toBe("2026-10-25")
    expect(dayKeyOf("2026-10-24T13:00:00.000Z")).toBe("2026-10-24")
  })

  it("keeps Saturday and Sunday of one weekend on the same key", () => {
    const sat = weekendKeyOf("2026-10-24T14:00:00.000Z")
    const sun = weekendKeyOf("2026-10-25T14:00:00.000Z")
    const fri = weekendKeyOf("2026-10-23T22:00:00.000Z")
    expect(sun).toBe(sat)
    expect(fri).toBe(sat)
    expect(sat).toBe("2026-10-19") // that week's Monday
    expect(weekendKeyOf("2026-10-31T14:00:00.000Z")).toBe("2026-10-26")
  })
})

describe("boardDays / boardWeekends", () => {
  const games = [
    game({ scheduledAt: "2026-10-24T14:00:00.000Z" }),
    game({ scheduledAt: "2026-10-24T16:00:00.000Z" }),
    game({ scheduledAt: "2026-10-25T15:00:00.000Z" }),
    game({ scheduledAt: "2026-10-31T15:00:00.000Z" }),
  ]

  it("lists only days that have games, oldest first, with counts", () => {
    expect(boardDays(games).map((d) => [d.key, d.games])).toEqual([
      ["2026-10-24", 2],
      ["2026-10-25", 1],
      ["2026-10-31", 1],
    ])
  })

  it("groups the day chips into weekends the platform's own spelling", () => {
    const weekends = boardWeekends(boardDays(games))
    expect(weekends.map((w) => w.label)).toEqual(["Oct 24–25", "Oct 31"])
    expect(weekends[0].days).toHaveLength(2)
  })

  it("opens on the first upcoming day, else the first day", () => {
    const days = boardDays(games)
    expect(defaultBoardDayKey(days, new Date(2026, 9, 25))).toBe("2026-10-25")
    expect(defaultBoardDayKey(days, new Date(2026, 7, 2))).toBe("2026-10-24")
    expect(defaultBoardDayKey(days, new Date(2027, 0, 1))).toBe("2026-10-24")
    expect(defaultBoardDayKey([], new Date())).toBeNull()
  })
})

describe("buildBoardColumns", () => {
  it("groups courts under their gym and sorts courts numerically", () => {
    const groups = buildBoardColumns([
      game({ scheduledAt: "2026-10-24T14:00:00.000Z", courtId: "c10", courtName: "Court 10" }),
      game({ scheduledAt: "2026-10-24T14:00:00.000Z", courtId: "c2", courtName: "Court 2" }),
      game({
        scheduledAt: "2026-10-24T14:00:00.000Z",
        venueId: "haber",
        venueName: "Haber Recreation Centre",
        courtId: "h1",
        courtName: "Court A",
      }),
    ])
    expect(groups.map((g) => g.venueName)).toEqual(["Haber Recreation Centre", "Six Park East"])
    expect(groups[1].columns.map((c) => c.courtName)).toEqual(["Court 2", "Court 10"])
    expect(groups[1].games).toBe(2)
  })

  it("adds the Unassigned column at the far right, and ONLY when it is needed", () => {
    const assigned = [game({ scheduledAt: "2026-10-24T14:00:00.000Z" })]
    expect(buildBoardColumns(assigned).some((g) => g.key === UNASSIGNED_GROUP)).toBe(false)

    const groups = buildBoardColumns([
      ...assigned,
      game({ scheduledAt: "2026-10-24T15:00:00.000Z", courtId: null, courtName: null }),
    ])
    expect(groups[groups.length - 1].key).toBe(UNASSIGNED_GROUP)
    expect(groups[groups.length - 1].columns[0].key).toBe(UNASSIGNED_COLUMN)
    expect(columnKeyOf(game({ scheduledAt: "2026-10-24T15:00:00.000Z", courtId: null }))).toBe(
      UNASSIGNED_COLUMN
    )
  })

  it("narrows to one gym's courts when the games are filtered to it", () => {
    const all = [
      game({ scheduledAt: "2026-10-24T14:00:00.000Z", courtId: "c1", courtName: "Court 1" }),
      game({
        scheduledAt: "2026-10-24T14:00:00.000Z",
        venueId: "haber",
        venueName: "Haber Recreation Centre",
        courtId: "h1",
        courtName: "Court A",
      }),
      game({
        scheduledAt: "2026-10-24T16:00:00.000Z",
        venueId: "haber",
        venueName: "Haber Recreation Centre",
        courtId: "h2",
        courtName: "Court B",
      }),
    ]
    expect(buildBoardColumns(all).flatMap((g) => g.columns)).toHaveLength(3)
    const haberOnly = all.filter((g) => g.venueId === "haber")
    const groups = buildBoardColumns(haberOnly)
    expect(groups).toHaveLength(1)
    expect(groups[0].columns.map((c) => c.courtName)).toEqual(["Court A", "Court B"])
    expect(boardVenues(all).map((v) => [v.venueName, v.games])).toEqual([
      ["Haber Recreation Centre", 2],
      ["Six Park East", 1],
    ])
  })
})

describe("buildBoardRows", () => {
  it("rows by tip-off time, ignoring games outside the visible columns", () => {
    const games = [
      game({ scheduledAt: "2026-10-24T18:00:00.000Z", courtId: "c2", courtName: "Court 2" }),
      game({ scheduledAt: "2026-10-24T14:00:00.000Z" }),
      game({ scheduledAt: "2026-10-24T14:00:00.000Z", courtId: "c2", courtName: "Court 2" }),
    ]
    const rows = buildBoardRows(games, ["court:c1", "court:c2"])
    expect(rows.map((r) => r.minute)).toEqual([10 * 60, 14 * 60])
    expect(Object.keys(rows[0].cells).sort()).toEqual(["court:c1", "court:c2"])
    expect(buildBoardRows(games, ["court:c1"]).map((r) => r.minute)).toEqual([10 * 60])
  })

  it("stacks a double-booked court instead of hiding one of the games", () => {
    const rows = buildBoardRows(
      [
        game({ scheduledAt: "2026-10-24T14:00:00.000Z", id: "a" }),
        game({ scheduledAt: "2026-10-24T14:00:00.000Z", id: "b" }),
      ],
      ["court:c1"]
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].cells["court:c1"]).toHaveLength(2)
  })
})

describe("repeatOrdinals", () => {
  it("numbers a team's games when it plays more than once that day", () => {
    const first = game({ scheduledAt: "2026-10-24T14:00:00.000Z", homeTeamId: "lords", id: "one" })
    const second = game({ scheduledAt: "2026-10-24T18:00:00.000Z", awayTeamId: "lords", id: "two" })
    const other = game({
      scheduledAt: "2026-10-24T20:00:00.000Z",
      homeTeamId: "mba",
      awayTeamId: "rwi",
      id: "three",
    })
    const marks = repeatOrdinals([second, first, other])
    expect(marks.get("one:lords")).toBe(1)
    expect(marks.get("two:lords")).toBe(2)
    expect(marks.has("three:mba")).toBe(false)
  })
})

describe("abbrevTeamName", () => {
  it("leaves short names alone and shortens long ones on a word boundary", () => {
    expect(abbrevTeamName("Toronto Lords")).toBe("Toronto Lords")
    expect(abbrevTeamName("PDM Basketball")).toBe("PDM Basketball")
    expect(abbrevTeamName("Kings Court Basketball")).toBe("Kings Court")
    expect(abbrevTeamName("Dragons de Gatineau (PRIME)")).toBe("Dragons de…")
    expect(abbrevTeamName("Northumberlandshire")).toBe("Northumberlands…")
    expect(abbrevTeamName("").length).toBe(0)
  })
})

describe("unitAbbrev", () => {
  it("writes a division the way the season calendar does, tier kept", () => {
    expect(unitAbbrev("Grade 9 Boys · PRIME")).toBe("Gr9 PRIME")
    expect(unitAbbrev("Grade 7 Boys")).toBe("Gr7")
    expect(unitAbbrev("Junior Girls")).toBe("JrG")
    expect(unitAbbrev(null)).toBeNull()
  })
})

describe("boardTone", () => {
  it("is stable per grade and neutral when there is no division", () => {
    expect(boardTone("Gr9")).toBe(boardTone("Gr9"))
    expect(boardTone(null)).toBe("ink")
    expect(boardTone(undefined)).toBe("ink")
    expect(boardTone("")).toBe("ink")
  })

  it("gives every tier of one grade the SAME color", () => {
    expect(boardTone("Gr9 PRIME")).toBe(boardTone("Gr9"))
    expect(boardTone("Gr9 ARETE")).toBe(boardTone("Gr9 DMV CHILL"))
  })

  it("spreads a season's grades across the palette, neighbours never sharing", () => {
    const grades = ["Gr7", "Gr8", "Gr9", "Gr10", "Gr11", "Gr12", "JrG"]
    const tones = grades.map(boardTone)
    expect(new Set(tones).size).toBeGreaterThanOrEqual(5)
    expect(tones).not.toContain("ink")
    for (let i = 1; i < grades.length - 1; i++) expect(tones[i]).not.toBe(tones[i - 1])
  })
})
