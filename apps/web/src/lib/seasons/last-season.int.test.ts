import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import { buildWorld, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { lastSeasonTeamCounts } from "./last-season"

/**
 * "13 last season" (planner step 1, owner 2026-08-02). The contract the hint
 * column rests on:
 *   - only APPROVED submissions count — pending, rejected and withdrawn
 *     teams never took the floor
 *   - counts group by GRADE, so two divisions of one grade read as one row
 *   - no prior season means no hint at all, never a zero
 */

let world: BuiltWorld
// League A: a season that played, then this year's shell.
let priorSeason: string
let currentSeason: string
// League B: this league's very first season.
let firstEverSeason: string
// League C: last season existed but nothing was ever approved.
let emptyPriorCurrent: string

beforeAll(async () => {
  world = await buildWorld({
    seed: 1140,
    leagues: [
      {
        seasons: [
          {
            label: "Last season",
            status: "COMPLETED",
            divisions: [
              // One grade, two divisions — the cluster the operator sees.
              { name: "Grade 7 A", ageGroup: "Grade 7", teams: 3, rosterSize: 1 },
              { name: "Grade 7 B", ageGroup: "Grade 7", teams: 2, rosterSize: 1 },
              // Never approved: applied for, never played.
              {
                name: "Grade 8",
                ageGroup: "Grade 8",
                teams: 4,
                rosterSize: 1,
                submissionStatus: "PENDING",
              },
              { name: "Grade 9 A", ageGroup: "Grade 9", teams: 2, rosterSize: 1 },
              {
                name: "Grade 9 B",
                ageGroup: "Grade 9",
                teams: 1,
                rosterSize: 1,
                submissionStatus: "WITHDRAWN",
              },
            ],
          },
          {
            label: "This season",
            status: "DRAFT",
            divisions: [
              { name: "Grade 7", ageGroup: "Grade 7", teams: 0 },
              { name: "Grade 8", ageGroup: "Grade 8", teams: 0 },
              { name: "Grade 9", ageGroup: "Grade 9", teams: 0 },
              // A grade with no history at all: the row shows no hint.
              { name: "Grade 10", ageGroup: "Grade 10", teams: 0 },
            ],
          },
        ],
      },
      {
        seasons: [
          {
            label: "First season ever",
            status: "DRAFT",
            divisions: [{ name: "Grade 7", ageGroup: "Grade 7", teams: 0 }],
          },
        ],
      },
      {
        seasons: [
          {
            label: "Nobody got approved",
            status: "COMPLETED",
            divisions: [
              {
                name: "Grade 7",
                ageGroup: "Grade 7",
                teams: 2,
                rosterSize: 1,
                submissionStatus: "REJECTED",
              },
            ],
          },
          {
            label: "This season",
            status: "DRAFT",
            divisions: [{ name: "Grade 7", ageGroup: "Grade 7", teams: 0 }],
          },
        ],
      },
    ],
  })

  priorSeason = world.leagues[0].seasons[0].id
  currentSeason = world.leagues[0].seasons[1].id
  firstEverSeason = world.leagues[1].seasons[0].id
  emptyPriorCurrent = world.leagues[2].seasons[1].id

  // "The season before this one" is decided by createdAt. The builder writes
  // them in order already; pinning the older ones a year back makes the
  // ordering explicit instead of depending on insert timing.
  for (const [leagueIndex, seasonIndex] of [
    [0, 0],
    [2, 0],
  ] as const) {
    await prisma.season.update({
      where: { id: world.leagues[leagueIndex].seasons[seasonIndex].id },
      data: { createdAt: new Date(Date.now() - 365 * 24 * 3600_000) },
    })
  }
})

afterAll(async () => {
  await destroyWorld(world.ctx)
})

describe("lastSeasonTeamCounts", () => {
  it("counts only APPROVED submissions, grouped by grade", async () => {
    const counts = await lastSeasonTeamCounts(currentSeason)

    expect(counts).toEqual({
      "Grade 7": 5, // 3 + 2 across two divisions of the same grade
      "Grade 9": 2, // the withdrawn team is not history
    })
  })

  it("leaves a grade out entirely rather than reporting zero", async () => {
    const counts = await lastSeasonTeamCounts(currentSeason)

    // Grade 8 applied but was never approved; Grade 10 is brand new.
    expect(counts).not.toHaveProperty("Grade 8")
    expect(counts).not.toHaveProperty("Grade 10")
  })

  it("reads the season BEFORE this one, never a later one", async () => {
    // Called on last season, this year's shell must not answer for it.
    expect(await lastSeasonTeamCounts(priorSeason)).toBeNull()
  })

  it("returns null for a league's first season", async () => {
    expect(await lastSeasonTeamCounts(firstEverSeason)).toBeNull()
  })

  it("returns an empty record when last season approved nobody", async () => {
    // Not null: there IS history, it just has nothing to show per grade.
    expect(await lastSeasonTeamCounts(emptyPriorCurrent)).toEqual({})
  })

  it("returns null for a season that does not exist", async () => {
    expect(await lastSeasonTeamCounts("00000000-0000-0000-0000-000000000000")).toBeNull()
  })
})
