import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import { buildWorld, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { getSeasonStandings } from "@/lib/queries/standings"
import { advancePlayoffs, deletePlayoffs, generatePlayoffs } from "./generate"

/**
 * Playoff lifecycle (owner 2026-07-18): guided generation seeds round 1 from
 * standings; later rounds materialize as winners emerge (home/away columns
 * are required, so "winner of SF1" can't exist as a row).
 */

let world: BuiltWorld
let seasonId: string
let divisionId: string
let sessionId: string

const finishGame = async (id: string, homeScore: number, awayScore: number) => {
  await (prisma as any).game.update({
    where: { id },
    data: { status: "COMPLETED", homeScore, awayScore },
  })
}

const bracketGames = () =>
  (prisma as any).game.findMany({
    where: { sessionId },
    orderBy: [{ playoffRound: "asc" }, { playoffSlot: "asc" }],
  })

beforeAll(async () => {
  world = await buildWorld({
    seed: 1131,
    leagues: [
      {
        seasons: [
          {
            status: "IN_PROGRESS",
            divisions: [{ teams: 4, rosterSize: 1, submissionStatus: "APPROVED" }],
          },
        ],
      },
    ],
  })
  const season = world.leagues[0].seasons[0]
  seasonId = season.id
  divisionId = season.divisions[0].id
})

afterAll(async () => {
  if (sessionId) {
    await (prisma as any).game.deleteMany({ where: { sessionId } })
    await (prisma as any).seasonSession.deleteMany({ where: { id: sessionId } })
  }
  await destroyWorld(world.ctx)
})

describe("playoff generation and advancement", () => {
  it("generates a PLAYOFF session with round-1 games seeded from standings", async () => {
    const result = await generatePlayoffs({
      seasonId,
      divisionId,
      qualifying: 4,
      format: "SINGLE_ELIM_THIRD",
      startDate: "2026-08-01",
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    sessionId = result.sessionId
    expect(result.gamesCreated).toBe(2) // two semifinals now; final + bronze later

    const session = await (prisma as any).seasonSession.findUnique({
      where: { id: sessionId },
      select: { phase: true, playoffPlan: true, label: true },
    })
    expect(session.phase).toBe("PLAYOFF")
    expect((session.playoffPlan as any).seeds).toHaveLength(4)

    const games = await bracketGames()
    expect(games).toHaveLength(2)
    const standings = await getSeasonStandings(seasonId)
    const rank = standings!.divisions.find((d) => d.divisionId === divisionId)!.rows
    // SF1 = #1 hosting #4, SF2 = #2 hosting #3
    expect(games[0].homeTeamId).toBe(rank[0].teamId)
    expect(games[0].awayTeamId).toBe(rank[3].teamId)
    expect(games[1].homeTeamId).toBe(rank[1].teamId)
    expect(games[1].awayTeamId).toBe(rank[2].teamId)
    expect(games.every((g: any) => g.phase === "PLAYOFF" && g.playoffRound === 1)).toBe(true)
  })

  it("refuses a second bracket for the same division", async () => {
    const dup = await generatePlayoffs({
      seasonId,
      divisionId,
      qualifying: 4,
      format: "SINGLE_ELIM",
      startDate: "2026-08-01",
    })
    expect(dup.ok).toBe(false)
    if (!dup.ok) expect(dup.code).toBe("ALREADY_EXISTS")
  })

  it("does not advance until every feeder game has a winner", async () => {
    const [sf1] = await bracketGames()
    await finishGame(sf1.id, 60, 50)
    const advanced = await advancePlayoffs(sf1.id)
    expect(advanced.created).toBe(0) // final and bronze both need SF2 too
    expect(await bracketGames()).toHaveLength(2)
  })

  it("creates the final and 3rd-place game once both semis are done", async () => {
    const [sf1, sf2] = await bracketGames()
    await finishGame(sf2.id, 40, 55) // away team wins
    const advanced = await advancePlayoffs(sf2.id)
    expect(advanced.created).toBe(2)

    const games = await bracketGames()
    expect(games).toHaveLength(4)
    const final = games.find((g: any) => g.playoffRound === 2 && g.playoffSlot === 0)
    const bronze = games.find((g: any) => g.playoffRound === 2 && g.playoffSlot === 1)
    expect(final.homeTeamId).toBe(sf1.homeTeamId) // SF1 winner (home won 60-50)
    expect(final.awayTeamId).toBe(sf2.awayTeamId) // SF2 winner (away won 55-40)
    expect(bronze.homeTeamId).toBe(sf1.awayTeamId) // SF1 loser
    expect(bronze.awayTeamId).toBe(sf2.homeTeamId) // SF2 loser
    // next round scheduled a week after the semis
    expect(new Date(final.scheduledAt).getTime()).toBeGreaterThan(
      new Date(sf1.scheduledAt).getTime()
    )
  })

  it("re-running advancement is idempotent", async () => {
    const [sf1] = await bracketGames()
    const again = await advancePlayoffs(sf1.id)
    expect(again.created).toBe(0)
    expect(await bracketGames()).toHaveLength(4)
  })

  it("refuses to delete a bracket with played games", async () => {
    const del = await deletePlayoffs(sessionId)
    expect(del.ok).toBe(false)
    if (!del.ok) expect(del.code).toBe("HAS_RESULTS")
  })
})
