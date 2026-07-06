import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import {
  buildWorld,
  createOffer,
  createParentWithChildren,
  destroyWorld,
  type BuiltWorld,
} from "@youthbasketballhub/test-worlds"
import { getChatMembers, getUnreadChatCounts } from "@/lib/teams/chat-access"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { GET, POST } from "./route"
import { DELETE } from "./[messageId]/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — team ↔ family chat: staff + rostered-player parents are members;
 * everyone else is out. Senders take back their own messages; staff
 * moderate anything.
 */

let world: BuiltWorld
let teamId: string
let ownerId: string
let coachId: string
let familyParentId: string
let outsiderParentId: string

const list = (query = "") =>
  GET(jsonRequest(`/api/teams/${teamId}/messages${query}`, undefined, "GET"), {
    params: { id: teamId },
  })

const send = (body: unknown) =>
  POST(jsonRequest(`/api/teams/${teamId}/messages`, body), { params: { id: teamId } })

const remove = (messageId: string) =>
  DELETE(jsonRequest(`/api/teams/${teamId}/messages/${messageId}`, undefined, "DELETE"), {
    params: { id: teamId, messageId },
  })

beforeAll(async () => {
  world = await buildWorld({
    seed: 1118,
    clubs: [{ teams: [{ headCoach: true }] }],
  })
  const club = world.clubs[0]
  ownerId = club.owner.id
  teamId = club.teams[0].id
  coachId = club.teams[0].headCoach!.id

  // Family member: child rostered via an accepted offer.
  const family = await createParentWithChildren(world.ctx, { children: [{ age: 12 }] })
  familyParentId = family.parent.id
  await createOffer(world.ctx, {
    teamId,
    playerId: family.players[0].id,
    status: "ACCEPTED",
  })

  // Outsider: a parent with no rostered child on this team.
  const outsider = await createParentWithChildren(world.ctx, { children: [{ age: 12 }] })
  outsiderParentId = outsider.parent.id
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("team chat (integration)", () => {
  it("coach posts, family reads — staff badge rides along", async () => {
    actAs(coachId)
    const res = await send({ body: "Practice moved to 6pm Thursday." })
    expect(res.status).toBe(201)
    const { message } = await res.json()
    expect(message.sender.isStaff).toBe(true)

    actAs(familyParentId)
    const feed = await (await list()).json()
    expect(feed.membership.role).toBe("family")
    expect(feed.messages.map((m: any) => m.body)).toContain("Practice moved to 6pm Thursday.")
  })

  it("family parent posts — no staff badge", async () => {
    actAs(familyParentId)
    const res = await send({ body: "Thanks coach, we'll be there!" })
    expect(res.status).toBe(201)
    const { message } = await res.json()
    expect(message.sender.isStaff).toBe(false)
  })

  it("club owner is staff without a team-scoped role", async () => {
    actAs(ownerId)
    const feed = await (await list()).json()
    expect(feed.membership.role).toBe("staff")
  })

  it("a parent with no rostered child is not a member", async () => {
    actAs(outsiderParentId)
    expect((await list()).status).toBe(403)
    expect((await send({ body: "hello?" })).status).toBe(403)
  })

  it("unauthenticated is rejected", async () => {
    actAs(null)
    expect((await list()).status).toBe(401)
  })

  it("rejects empty and over-long messages", async () => {
    actAs(familyParentId)
    expect((await send({ body: "   " })).status).toBe(400)
    expect((await send({ body: "x".repeat(2001) })).status).toBe(400)
  })

  it("?after= polling returns only newer messages", async () => {
    actAs(coachId)
    const before = await (await list()).json()
    const lastAt = before.messages[before.messages.length - 1].createdAt

    await send({ body: "One more thing — bring water bottles." })
    const delta = await (await list(`?after=${encodeURIComponent(lastAt)}`)).json()
    expect(delta.messages.map((m: any) => m.body)).toEqual([
      "One more thing — bring water bottles.",
    ])
  })

  it("senders can take back their own message", async () => {
    actAs(familyParentId)
    const { message } = await (await send({ body: "wrong chat, sorry!" })).json()
    expect((await remove(message.id)).status).toBe(200)

    const feed = await (await list()).json()
    expect(feed.messages.map((m: any) => m.id)).not.toContain(message.id)
  })

  it("family cannot delete someone else's message; staff can moderate it", async () => {
    actAs(coachId)
    const { message } = await (await send({ body: "To be moderated." })).json()

    actAs(familyParentId)
    expect((await remove(message.id)).status).toBe(403)

    actAs(ownerId)
    expect((await remove(message.id)).status).toBe(200)

    actAs(familyParentId)
    const feed = await (await list()).json()
    expect(feed.messages.map((m: any) => m.id)).not.toContain(message.id)
  })

  it("v1.5 — one bell per channel until visited; unread badge counts every message", async () => {
    const unreadBells = () =>
      prisma.notification.count({
        where: { userId: familyParentId, type: "team_chat", referenceId: teamId, isRead: false },
      })

    // Clean slate: visiting the chat clears cursor + bells
    actAs(familyParentId)
    await list()
    expect(await unreadBells()).toBe(0)

    actAs(coachId)
    await send({ body: "Bell one." })
    expect(await unreadBells()).toBe(1)
    await send({ body: "Bell two — must NOT re-bell." })
    expect(await unreadBells()).toBe(1)

    // Badge counts both unread messages even though only one bell rang
    expect((await getUnreadChatCounts(familyParentId, [teamId])).get(teamId)).toBe(2)

    // Visiting clears bell + badge; the next message re-bells
    actAs(familyParentId)
    await list()
    expect(await unreadBells()).toBe(0)
    expect((await getUnreadChatCounts(familyParentId, [teamId])).get(teamId)).toBeUndefined()

    actAs(coachId)
    await send({ body: "Bell three." })
    expect(await unreadBells()).toBe(1)
  })

  it("v1.5 — members list: coaches are chat admins, families carry player names", async () => {
    const members = await getChatMembers(teamId, world.clubs[0].tenantId)

    const coach = members.staff.find((s) => s.userId === coachId)
    expect(coach?.label).toBe("Head Coach")
    expect(members.staff.some((s) => s.userId === ownerId && s.label === "Club")).toBe(true)

    const family = members.families.find((f) => f.userId === familyParentId)
    expect(family?.playerNames).toHaveLength(1)

    expect(members.userIds).toContain(familyParentId)
    expect(members.userIds).not.toContain(outsiderParentId)
  })
})
