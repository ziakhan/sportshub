import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import {
  buildWorld,
  createOffer,
  createParentWithChildren,
  destroyWorld,
  type BuiltWorld,
} from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { PUT as RSVP_PUT } from "./route"
import { GET as CALENDAR_GET } from "../teams/[id]/practices/route"
import { GET as SCORING_GET } from "../games/[id]/scoring/route"
import { GET as CRON_GET } from "../cron/rsvp-reminders/route"
import { sendRsvpReminders } from "@/lib/rsvp"
import { rsvpKey } from "@/lib/rsvp-shared"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — RSVP + attendance: families answer Going/Not going/Maybe per player
 * per calendar item (practice/game/team event); staff see the roll-up on
 * the calendar feed; a late "Not going" bells the staff; the scoring
 * bootstrap pre-marks Not-going players absent; the daily cron nudges
 * unanswered families once per item.
 */

let world: BuiltWorld
let tenantId: string
let teamAId: string
let teamBId: string
let coachId: string
let parentId: string // two kids on team A
let kid1: string
let kid2: string
let otherParentId: string // one kid on team B
let kidB: string
let outsiderParentId: string // kid rostered nowhere
let outsiderKid: string

let practiceId: string // team A, ~5 days out (outside the late-flip window)
let cancelledPracticeId: string
let pastPracticeId: string
let gameSoonId: string // A vs B, ~26h out (inside the 48h late-flip window)
let gameFarId: string // A vs B, ~363 days out (isolated reminder window)
let teamEventId: string // team A, ~4 days out

const putRsvp = (body: unknown) => RSVP_PUT(jsonRequest("/api/rsvp", body, "PUT"))

const calendar = (teamId: string) =>
  CALENDAR_GET(jsonRequest(`/api/teams/${teamId}/practices?includeGames=1`, undefined, "GET"), {
    params: { id: teamId },
  })

beforeAll(async () => {
  world = await buildWorld({
    seed: 1125,
    clubs: [{ teams: [{ headCoach: true }, {}] }],
  })
  const club = world.clubs[0]
  tenantId = club.tenantId
  teamAId = club.teams[0].id
  teamBId = club.teams[1].id
  coachId = club.teams[0].headCoach!.id

  const family = await createParentWithChildren(world.ctx, {
    children: [{ age: 11 }, { age: 9 }],
  })
  parentId = family.parent.id
  kid1 = family.players[0].id
  kid2 = family.players[1].id
  await createOffer(world.ctx, { teamId: teamAId, playerId: kid1, status: "ACCEPTED" })
  await createOffer(world.ctx, { teamId: teamAId, playerId: kid2, status: "ACCEPTED" })

  const other = await createParentWithChildren(world.ctx, { children: [{ age: 12 }] })
  otherParentId = other.parent.id
  kidB = other.players[0].id
  await createOffer(world.ctx, { teamId: teamBId, playerId: kidB, status: "ACCEPTED" })

  const outsider = await createParentWithChildren(world.ctx, { children: [{ age: 12 }] })
  outsiderParentId = outsider.parent.id
  outsiderKid = outsider.players[0].id

  const HOUR = 3_600_000
  const practice = await (prisma as any).practice.create({
    data: {
      tenantId,
      teamId: teamAId,
      scheduledAt: new Date(Date.now() + 120 * HOUR),
      duration: 90,
      location: "Main Gym",
    },
  })
  practiceId = practice.id
  cancelledPracticeId = (
    await (prisma as any).practice.create({
      data: {
        tenantId,
        teamId: teamAId,
        scheduledAt: new Date(Date.now() + 121 * HOUR),
        duration: 90,
        status: "CANCELLED",
      },
    })
  ).id
  pastPracticeId = (
    await (prisma as any).practice.create({
      data: {
        tenantId,
        teamId: teamAId,
        scheduledAt: new Date(Date.now() - 24 * HOUR),
        duration: 90,
      },
    })
  ).id
  gameSoonId = (
    await (prisma as any).game.create({
      data: {
        homeTeamId: teamAId,
        awayTeamId: teamBId,
        scheduledAt: new Date(Date.now() + 26 * HOUR),
      },
    })
  ).id
  gameFarId = (
    await (prisma as any).game.create({
      data: {
        homeTeamId: teamAId,
        awayTeamId: teamBId,
        scheduledAt: new Date(Date.now() + (363 * 24 + 12) * HOUR),
      },
    })
  ).id
  teamEventId = (
    await (prisma as any).teamEvent.create({
      data: {
        createdById: coachId,
        title: "Photo day",
        startAt: new Date(Date.now() + 96 * HOUR),
        durationMinutes: 60,
        teams: { create: [{ teamId: teamAId }] },
      },
    })
  ).id
})

afterAll(async () => {
  const itemIds = [
    practiceId,
    cancelledPracticeId,
    pastPracticeId,
    gameSoonId,
    gameFarId,
    teamEventId,
  ].filter(Boolean)
  await (prisma as any).eventRsvp.deleteMany({ where: { itemId: { in: itemIds } } })
  await (prisma as any).teamEvent.deleteMany({ where: { id: teamEventId ?? "" } })
  await (prisma as any).game.deleteMany({
    where: { id: { in: [gameSoonId, gameFarId].filter(Boolean) } },
  })
  await (prisma as any).practice.deleteMany({
    where: { id: { in: [practiceId, cancelledPracticeId, pastPracticeId].filter(Boolean) } },
  })
  if (world) await destroyWorld(world.ctx)
})

describe("RSVP (integration)", () => {
  it("parent answers Going for their kid; changing the answer upserts", async () => {
    actAs(parentId)
    const res = await putRsvp({
      playerId: kid1,
      itemType: "PRACTICE",
      itemId: practiceId,
      status: "GOING",
    })
    expect(res.status).toBe(200)
    expect((await res.json()).rsvp.status).toBe("GOING")

    const change = await putRsvp({
      playerId: kid1,
      itemType: "PRACTICE",
      itemId: practiceId,
      status: "MAYBE",
      note: "waiting on a ride",
    })
    expect(change.status).toBe(200)

    const rows = await (prisma as any).eventRsvp.findMany({
      where: { playerId: kid1, itemType: "PRACTICE", itemId: practiceId },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe("MAYBE")
    expect(rows[0].note).toBe("waiting on a ride")
    expect(rows[0].respondedById).toBe(parentId)
  })

  it("team events accept RSVPs from linked-team families", async () => {
    actAs(parentId)
    const res = await putRsvp({
      playerId: kid2,
      itemType: "TEAM_EVENT",
      itemId: teamEventId,
      status: "GOING",
    })
    expect(res.status).toBe(200)
  })

  it("only the player's own parent may answer", async () => {
    actAs(outsiderParentId)
    const res = await putRsvp({
      playerId: kid1,
      itemType: "PRACTICE",
      itemId: practiceId,
      status: "GOING",
    })
    expect(res.status).toBe(403)

    // Staff aren't parents — the roll-up is read-only for them
    actAs(coachId)
    const staffRes = await putRsvp({
      playerId: kid1,
      itemType: "PRACTICE",
      itemId: practiceId,
      status: "GOING",
    })
    expect(staffRes.status).toBe(403)
  })

  it("player must be on an active roster of the item's team", async () => {
    actAs(outsiderParentId)
    const res = await putRsvp({
      playerId: outsiderKid,
      itemType: "PRACTICE",
      itemId: practiceId,
      status: "GOING",
    })
    expect(res.status).toBe(403)

    // kidB is rostered on team B — a team A practice is not theirs
    actAs(otherParentId)
    const crossTeam = await putRsvp({
      playerId: kidB,
      itemType: "PRACTICE",
      itemId: practiceId,
      status: "GOING",
    })
    expect(crossTeam.status).toBe(403)

    // ...but a game against team A is
    const game = await putRsvp({
      playerId: kidB,
      itemType: "GAME",
      itemId: gameSoonId,
      status: "GOING",
    })
    expect(game.status).toBe(200)
  })

  it("rejects unknown, cancelled, and already-started items", async () => {
    actAs(parentId)
    expect(
      (
        await putRsvp({
          playerId: kid1,
          itemType: "PRACTICE",
          itemId: "no-such-item",
          status: "GOING",
        })
      ).status
    ).toBe(404)
    expect(
      (
        await putRsvp({
          playerId: kid1,
          itemType: "PRACTICE",
          itemId: cancelledPracticeId,
          status: "GOING",
        })
      ).status
    ).toBe(400)
    expect(
      (
        await putRsvp({
          playerId: kid1,
          itemType: "PRACTICE",
          itemId: pastPracticeId,
          status: "GOING",
        })
      ).status
    ).toBe(400)
    actAs(null)
    expect(
      (
        await putRsvp({
          playerId: kid1,
          itemType: "PRACTICE",
          itemId: practiceId,
          status: "GOING",
        })
      ).status
    ).toBe(401)
  })

  it("a late Not-going flip bells the team staff", async () => {
    actAs(parentId)
    const res = await putRsvp({
      playerId: kid1,
      itemType: "GAME",
      itemId: gameSoonId,
      status: "NOT_GOING",
      note: "fever",
    })
    expect(res.status).toBe(200)

    const bells = await prisma.notification.findMany({
      where: { userId: coachId, type: "rsvp_change" },
    })
    expect(bells).toHaveLength(1)
    expect(bells[0].referenceId).toBe(rsvpKey("GAME", gameSoonId))
    expect(bells[0].message).toContain("fever")

    // Re-sending NOT_GOING doesn't bell again
    await putRsvp({
      playerId: kid1,
      itemType: "GAME",
      itemId: gameSoonId,
      status: "NOT_GOING",
    })
    expect(
      await prisma.notification.count({ where: { userId: coachId, type: "rsvp_change" } })
    ).toBe(1)
  })

  it("no staff bell when the item is far out", async () => {
    actAs(parentId)
    await putRsvp({
      playerId: kid2,
      itemType: "PRACTICE",
      itemId: practiceId,
      status: "NOT_GOING",
    })
    expect(
      await prisma.notification.count({
        where: { userId: coachId, type: "rsvp_change", referenceId: { contains: practiceId } },
      })
    ).toBe(0)
  })

  it("family calendar feed carries their own kids + answers", async () => {
    actAs(parentId)
    const res = await calendar(teamAId)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.rsvp.players.map((p: any) => p.id).sort()).toEqual([kid1, kid2].sort())
    const practiceAnswers = data.rsvp.byItem[rsvpKey("PRACTICE", practiceId)]
    expect(practiceAnswers[kid1].status).toBe("MAYBE")
    expect(practiceAnswers[kid2].status).toBe("NOT_GOING")
  })

  it("staff calendar feed carries the full roster for the roll-up", async () => {
    actAs(coachId)
    const res = await calendar(teamAId)
    const data = await res.json()
    expect(data.rsvp.players).toHaveLength(2) // team A roster = the two kids
    const gameAnswers = data.rsvp.byItem[rsvpKey("GAME", gameSoonId)] ?? {}
    expect(gameAnswers[kid1]?.status).toBe("NOT_GOING")
    // kidB answered too but is team B — filtered out of team A's view
    expect(gameAnswers[kidB]).toBeUndefined()
  })

  it("scoring bootstrap pre-marks Not-going players absent", async () => {
    actAs(coachId)
    const res = await SCORING_GET(
      jsonRequest(`/api/games/${gameSoonId}/scoring`, undefined, "GET"),
      { params: { id: gameSoonId } }
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.rsvpAbsent.home).toEqual([kid1])
    expect(data.rsvpAbsent.away).toEqual([]) // kidB said Going
  })

  it("reminder sweep nudges only unanswered families, once per item", async () => {
    // The far game sits alone in a +363d window — demo/seed data can't pollute
    const sweepNow = new Date(Date.now() + 363 * 24 * 3_600_000 - 3_600_000)
    const first = await sendRsvpReminders(sweepNow)
    // ≥: the sweep is global, so unrelated far-future rows could ride along
    expect(first.reminded).toBeGreaterThanOrEqual(2)

    const key = rsvpKey("GAME", gameFarId)
    const mine = await prisma.notification.findMany({
      where: { type: "rsvp_reminder", referenceId: key },
    })
    expect(mine.map((n: any) => n.userId).sort()).toEqual([otherParentId, parentId].sort())
    expect(mine[0].message).toContain("Answer for")

    // Second sweep is a no-op (notification row is the dedupe)
    expect((await sendRsvpReminders(sweepNow)).reminded).toBe(0)

    // Once a family answers, later sweeps still skip them (answered ≠ reminded)
    actAs(otherParentId)
    await putRsvp({ playerId: kidB, itemType: "GAME", itemId: gameFarId, status: "GOING" })
    expect((await sendRsvpReminders(sweepNow)).reminded).toBe(0)
  })

  it("cron route fails closed without CRON_SECRET", async () => {
    const prev = process.env.CRON_SECRET
    delete process.env.CRON_SECRET
    const res = await CRON_GET(jsonRequest("/api/cron/rsvp-reminders", undefined, "GET"))
    expect(res.status).toBe(401)
    if (prev !== undefined) process.env.CRON_SECRET = prev
  })
})
