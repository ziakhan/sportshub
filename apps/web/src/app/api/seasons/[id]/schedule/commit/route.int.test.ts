import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import { buildWorld, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { POST } from "./route"
import { POST as PUBLISH } from "../publish/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — draft/publish schedule flow (owner 2026-07-31): committing saves a
 * DRAFT and notifies NOBODY — the operator can re-run sessions freely.
 * Publishing stamps the drafts and fans out once: club managers get one
 * club-level bell; team staff + rostered families get a bell (+email)
 * pointing at the team calendar. Nobody is double-belled.
 */

let world: BuiltWorld
let seasonId: string
let leagueOwnerId: string
let clubOwnerId: string
let teamId: string
let parentId: string

beforeAll(async () => {
  world = await buildWorld({
    seed: 1125,
    leagues: [
      {
        seasons: [
          {
            status: "FINALIZED",
            divisions: [{ teams: 2, rosterSize: 3 }],
            venue: { courts: 2 },
            sessions: [{ days: 2 }],
          },
        ],
      },
    ],
  })
  const season = world.leagues[0].seasons[0]
  seasonId = season.id
  leagueOwnerId = world.leagues[0].owner.id
  clubOwnerId = season.feederClub!.owner.id

  const submission = season.divisions[0].submissions[0]
  teamId = submission.teamId
  const player = await prisma.player.findUnique({
    where: { id: submission.playerIds[0] },
    select: { parentId: true },
  })
  parentId = player!.parentId
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

const bells = (userId: string) =>
  prisma.notification.findMany({
    where: { userId, type: "schedule_published" },
    select: { link: true, message: true },
  })

describe("schedule commit → publish — draft layer + fan-out (integration)", () => {
  it("commit saves DRAFTS and notifies nobody", async () => {
    actAs(leagueOwnerId)
    const res = await POST(
      jsonRequest(`/api/seasons/${seasonId}/schedule/commit`, { replaceExisting: true }),
      { params: { id: seasonId } }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.created).toBeGreaterThan(0)
    expect(body.draftCount).toBe(body.created)

    // Every committed game is a draft (publishedAt null)
    const drafts = await (prisma as any).game.count({
      where: { seasonId, publishedAt: null },
    })
    expect(drafts).toBe(body.created)

    // Silence: nobody heard about a draft
    expect(await bells(clubOwnerId)).toHaveLength(0)
    expect(await bells(parentId)).toHaveLength(0)
  })

  it("publish stamps the drafts and fans out once — club + team circle, no double-bell", async () => {
    actAs(leagueOwnerId)
    const res = await PUBLISH(
      jsonRequest(`/api/seasons/${seasonId}/schedule/publish`, {}),
      { params: { id: seasonId } }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.published).toBeGreaterThan(0)

    // No drafts remain
    const drafts = await (prisma as any).game.count({
      where: { seasonId, publishedAt: null },
    })
    expect(drafts).toBe(0)

    // Club-level: feeder club's owner got exactly ONE bell (not one per team)
    const clubBells = await bells(clubOwnerId)
    expect(clubBells).toHaveLength(1)

    // Team-level: a rostered player's parent got the team bell with the
    // calendar link and their game count
    const parentBells = await bells(parentId)
    expect(parentBells).toHaveLength(1)
    expect(parentBells[0].link).toBe(`/teams/${teamId}/calendar`)
    expect(parentBells[0].message).toMatch(/\d+ games scheduled/)

    // The games really exist for that team
    const games = await prisma.game.count({
      where: { seasonId, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
    })
    expect(games).toBeGreaterThan(0)
  })

  it("publishing again with no drafts is a 400", async () => {
    actAs(leagueOwnerId)
    const res = await PUBLISH(
      jsonRequest(`/api/seasons/${seasonId}/schedule/publish`, {}),
      { params: { id: seasonId } }
    )
    expect(res.status).toBe(400)
  })

  it("a pinned (locked) game survives regeneration; new games arrive unlocked", async () => {
    actAs(leagueOwnerId)
    const pinned = await (prisma as any).game.findFirst({
      where: { seasonId, status: "SCHEDULED" },
      select: { id: true },
    })
    await (prisma as any).game.update({ where: { id: pinned.id }, data: { isLocked: true } })
    const res = await POST(
      jsonRequest(`/api/seasons/${seasonId}/schedule/commit`, { replaceExisting: true }),
      { params: { id: seasonId } }
    )
    expect(res.status).toBe(200)
    const still = await (prisma as any).game.findUnique({
      where: { id: pinned.id },
      select: { id: true, isLocked: true },
    })
    expect(still).not.toBeNull()
    expect(still.isLocked).toBe(true)
    const unlocked = await (prisma as any).game.count({
      where: { seasonId, status: "SCHEDULED", isLocked: false },
    })
    expect(unlocked).toBeGreaterThan(0)
  })

  it("non-owner cannot commit or publish", async () => {
    actAs(clubOwnerId)
    const commit = await POST(
      jsonRequest(`/api/seasons/${seasonId}/schedule/commit`, { replaceExisting: true }),
      { params: { id: seasonId } }
    )
    expect(commit.status).toBe(403)
    const publish = await PUBLISH(
      jsonRequest(`/api/seasons/${seasonId}/schedule/publish`, {}),
      { params: { id: seasonId } }
    )
    expect(publish.status).toBe(403)
  })
})
