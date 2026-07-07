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
import { GET as LIST, POST as CREATE } from "./route"
import { POST as ANNOUNCE } from "./announce/route"
import { PATCH as PRACTICE_PATCH } from "./[practiceId]/route"
import { GET as SLOTS_GET, PUT as SLOTS_PUT } from "../practice-slots/route"
import { POST as TOKEN_POST } from "../../../calendar/token/route"
import { GET as FEED_GET } from "../../../calendar/[token]/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — practice scheduling: recurring slots (staff-managed), announce
 * expands to dated occurrences + notifies, move/cancel notifies, and the
 * personal iCal feed carries practices with cancellations marked.
 */

let world: BuiltWorld
let teamId: string
let coachId: string
let familyParentId: string
let outsiderParentId: string

const listPractices = () =>
  LIST(jsonRequest(`/api/teams/${teamId}/practices?includeGames=1`, undefined, "GET"), {
    params: { id: teamId },
  })

const putSlots = (slots: unknown) =>
  SLOTS_PUT(jsonRequest(`/api/teams/${teamId}/practice-slots`, { slots }, "PUT"), {
    params: { id: teamId },
  })

const announce = (weeks = 2) =>
  ANNOUNCE(jsonRequest(`/api/teams/${teamId}/practices/announce`, { weeks }), {
    params: { id: teamId },
  })

const patchPractice = (practiceId: string, body: unknown) =>
  PRACTICE_PATCH(jsonRequest(`/api/teams/${teamId}/practices/${practiceId}`, body, "PATCH"), {
    params: { id: teamId, practiceId },
  })

beforeAll(async () => {
  world = await buildWorld({
    seed: 1123,
    clubs: [{ teams: [{ headCoach: true }] }],
  })
  const club = world.clubs[0]
  teamId = club.teams[0].id
  coachId = club.teams[0].headCoach!.id

  const family = await createParentWithChildren(world.ctx, { children: [{ age: 11 }] })
  familyParentId = family.parent.id
  await createOffer(world.ctx, { teamId, playerId: family.players[0].id, status: "ACCEPTED" })

  const outsider = await createParentWithChildren(world.ctx, { children: [{ age: 11 }] })
  outsiderParentId = outsider.parent.id
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("practice scheduling (integration)", () => {
  it("announce with no slots is rejected — schedule is TBD", async () => {
    actAs(coachId)
    const res = await announce()
    expect(res.status).toBe(400)
  })

  it("staff set recurring days; families can read but not write", async () => {
    actAs(coachId)
    const res = await putSlots([
      { dayOfWeek: 2, startTime: "18:30", durationMinutes: 90, location: "Main Gym" },
      { dayOfWeek: 4, startTime: "19:00", durationMinutes: 90 },
    ])
    expect(res.status).toBe(200)
    expect((await res.json()).slots).toHaveLength(2)

    actAs(familyParentId)
    const read = await SLOTS_GET(
      jsonRequest(`/api/teams/${teamId}/practice-slots`, undefined, "GET"),
      { params: { id: teamId } }
    )
    expect(read.status).toBe(200)
    const data = await read.json()
    expect(data.slots).toHaveLength(2)
    expect(data.announcedAt).toBeNull()

    expect((await putSlots([])).status).toBe(403)
  })

  it("rejects malformed slots", async () => {
    actAs(coachId)
    expect(
      (await putSlots([{ dayOfWeek: 9, startTime: "18:30", durationMinutes: 90 }])).status
    ).toBe(400)
    expect(
      (await putSlots([{ dayOfWeek: 1, startTime: "25:99", durationMinutes: 90 }])).status
    ).toBe(400)
  })

  it("announce expands slots into dated practices and bells the family", async () => {
    actAs(coachId)
    const res = await announce(2)
    expect(res.status).toBe(200)
    const data = await res.json()
    // 2 slots × 2 weeks = 4 occurrences, minus at most 2 already-passed today
    expect(data.created).toBeGreaterThanOrEqual(3)
    expect(data.created).toBeLessThanOrEqual(4)
    expect(data.announcedAt).toBeTruthy()
    expect(data.notified).toBeGreaterThanOrEqual(1)

    const bells = await prisma.notification.count({
      where: { userId: familyParentId, type: "practice_schedule", referenceId: teamId },
    })
    expect(bells).toBe(1)
  })

  it("re-announcing never duplicates occurrences", async () => {
    actAs(coachId)
    const res = await announce(2)
    const data = await res.json()
    expect(data.created).toBe(0)
    expect(data.skippedExisting).toBeGreaterThanOrEqual(3)
  })

  it("family sees the schedule; outsiders and anonymous don't", async () => {
    actAs(familyParentId)
    const res = await listPractices()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.practices.length).toBeGreaterThanOrEqual(3)
    expect(data.membership.role).toBe("family")

    actAs(outsiderParentId)
    expect((await listPractices()).status).toBe(403)
    actAs(null)
    expect((await listPractices()).status).toBe(401)
  })

  it("moving a practice notifies the team", async () => {
    actAs(familyParentId)
    const before = await (await listPractices()).json()
    const target = before.practices[0]

    actAs(coachId)
    const newTime = new Date(new Date(target.scheduledAt).getTime() + 3600_000).toISOString()
    const res = await patchPractice(target.id, { action: "move", scheduledAt: newTime })
    expect(res.status).toBe(200)
    expect(new Date((await res.json()).practice.scheduledAt).toISOString()).toBe(newTime)

    const bells = await prisma.notification.count({
      where: { userId: familyParentId, type: "practice_change", referenceId: teamId },
    })
    expect(bells).toBe(1)
  })

  it("family cannot move or cancel practices", async () => {
    actAs(familyParentId)
    const feed = await (await listPractices()).json()
    expect((await patchPractice(feed.practices[0].id, { action: "cancel" })).status).toBe(403)
  })

  it("cancel + restore round-trip, each notifying", async () => {
    actAs(coachId)
    const feed = await (await listPractices()).json()
    const target = feed.practices[1]

    expect((await patchPractice(target.id, { action: "cancel" })).status).toBe(200)
    let row = await (prisma as any).practice.findUnique({ where: { id: target.id } })
    expect(row.status).toBe("CANCELLED")

    expect((await patchPractice(target.id, { action: "restore" })).status).toBe(200)
    row = await (prisma as any).practice.findUnique({ where: { id: target.id } })
    expect(row.status).toBe("SCHEDULED")
  })

  it("staff can add a one-off practice", async () => {
    actAs(coachId)
    const res = await CREATE(
      jsonRequest(`/api/teams/${teamId}/practices`, {
        scheduledAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
        durationMinutes: 60,
        location: "Track",
        notes: "Conditioning",
      }),
      { params: { id: teamId } }
    )
    expect(res.status).toBe(201)
    const { practice } = await res.json()
    expect(practice.location).toBe("Track")
  })

  it("personal iCal feed carries practices; cancelled ones are marked", async () => {
    // Cancel one occurrence so the feed has a CANCELLED event
    actAs(coachId)
    const feed = await (await listPractices()).json()
    await patchPractice(feed.practices[2].id, { action: "cancel" })

    actAs(familyParentId)
    const tokenRes = await TOKEN_POST()
    expect(tokenRes.status).toBe(200)
    const { token, path } = await tokenRes.json()
    expect(path).toBe(`/api/calendar/${token}`)

    const icsRes = await FEED_GET(jsonRequest(path, undefined, "GET"), { params: { token } })
    expect(icsRes.status).toBe(200)
    expect(icsRes.headers.get("content-type")).toContain("text/calendar")
    const ics = await icsRes.text()
    expect(ics).toContain("BEGIN:VCALENDAR")
    expect(ics).toContain("SUMMARY:Practice —")
    expect(ics).toContain("STATUS:CANCELLED")
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBeGreaterThanOrEqual(4)
  })

  it("unknown feed tokens 404", async () => {
    const res = await FEED_GET(
      jsonRequest(`/api/calendar/not-a-real-token-000000`, undefined, "GET"),
      { params: { token: "not-a-real-token-000000" } }
    )
    expect(res.status).toBe(404)
  })
})
