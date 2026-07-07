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
import { GET, POST } from "./route"
import { DELETE, PATCH } from "./[pollId]/route"
import { POST as VOTE } from "./[pollId]/vote/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — team polls & surveys: chat-membership rules (staff create/manage,
 * staff + rostered families vote), single vs multi choice, re-vote
 * replacement, staff-only voter names, close/reopen/delete.
 */

let world: BuiltWorld
let teamId: string
let coachId: string
let familyParentId: string
let secondParentId: string
let outsiderParentId: string

const list = () =>
  GET(jsonRequest(`/api/teams/${teamId}/polls`, undefined, "GET"), { params: { id: teamId } })

const create = (body: unknown) =>
  POST(jsonRequest(`/api/teams/${teamId}/polls`, body), { params: { id: teamId } })

const vote = (pollId: string, body: unknown) =>
  VOTE(jsonRequest(`/api/teams/${teamId}/polls/${pollId}/vote`, body), {
    params: { id: teamId, pollId },
  })

const manage = (pollId: string, action: "close" | "reopen") =>
  PATCH(jsonRequest(`/api/teams/${teamId}/polls/${pollId}`, { action }, "PATCH"), {
    params: { id: teamId, pollId },
  })

const remove = (pollId: string) =>
  DELETE(jsonRequest(`/api/teams/${teamId}/polls/${pollId}`, undefined, "DELETE"), {
    params: { id: teamId, pollId },
  })

const tournamentPoll = {
  title: "Summer tournament plans",
  description: "Pick what works for your family.",
  questions: [
    {
      prompt: "Should we enter the Waterloo Classic?",
      options: ["Yes", "No", "Only if carpooling works out"],
    },
    {
      prompt: "Which August weekends can you travel?",
      allowMultiple: true,
      options: ["Aug 8-9", "Aug 15-16", "Aug 22-23"],
    },
  ],
}

beforeAll(async () => {
  world = await buildWorld({
    seed: 1122,
    clubs: [{ teams: [{ headCoach: true }] }],
  })
  const club = world.clubs[0]
  teamId = club.teams[0].id
  coachId = club.teams[0].headCoach!.id

  const family = await createParentWithChildren(world.ctx, { children: [{ age: 12 }] })
  familyParentId = family.parent.id
  await createOffer(world.ctx, { teamId, playerId: family.players[0].id, status: "ACCEPTED" })

  const second = await createParentWithChildren(world.ctx, { children: [{ age: 11 }] })
  secondParentId = second.parent.id
  await createOffer(world.ctx, { teamId, playerId: second.players[0].id, status: "ACCEPTED" })

  const outsider = await createParentWithChildren(world.ctx, { children: [{ age: 12 }] })
  outsiderParentId = outsider.parent.id
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("team polls (integration)", () => {
  let pollId: string
  let singleQ: any
  let multiQ: any

  it("coach creates a two-question survey; members get one bell each", async () => {
    actAs(coachId)
    const res = await create(tournamentPoll)
    expect(res.status).toBe(201)
    const { poll } = await res.json()
    pollId = poll.id
    expect(poll.status).toBe("OPEN")
    expect(poll.questions).toHaveLength(2)
    ;[singleQ, multiQ] = poll.questions
    expect(singleQ.allowMultiple).toBe(false)
    expect(multiQ.allowMultiple).toBe(true)

    const bells = await prisma.notification.findMany({
      where: { type: "team_poll", referenceId: pollId },
      select: { userId: true },
    })
    const belled = bells.map((b: { userId: string }) => b.userId)
    expect(belled).toContain(familyParentId)
    expect(belled).toContain(secondParentId)
    expect(belled).not.toContain(coachId)
    expect(belled).not.toContain(outsiderParentId)
  })

  it("family members cannot create polls", async () => {
    actAs(familyParentId)
    expect((await create(tournamentPoll)).status).toBe(403)
  })

  it("outsiders and anonymous users are locked out", async () => {
    actAs(outsiderParentId)
    expect((await list()).status).toBe(403)
    expect(
      (await vote(pollId, { answers: [{ questionId: singleQ.id, optionIds: [singleQ.options[0].id] }] }))
        .status
    ).toBe(403)
    actAs(null)
    expect((await list()).status).toBe(401)
  })

  it("rejects malformed polls", async () => {
    actAs(coachId)
    expect((await create({ title: "", questions: [] })).status).toBe(400)
    expect(
      (await create({ title: "One option", questions: [{ prompt: "?", options: ["only"] }] }))
        .status
    ).toBe(400)
  })

  it("family votes: single-choice takes one, multi-choice takes many", async () => {
    actAs(familyParentId)
    const res = await vote(pollId, {
      answers: [
        { questionId: singleQ.id, optionIds: [singleQ.options[0].id] },
        { questionId: multiQ.id, optionIds: [multiQ.options[0].id, multiQ.options[2].id] },
      ],
    })
    expect(res.status).toBe(200)
    const { poll } = await res.json()
    const q1 = poll.questions.find((q: any) => q.id === singleQ.id)
    expect(q1.options[0].count).toBe(1)
    expect(q1.options[0].mine).toBe(true)
    const q2 = poll.questions.find((q: any) => q.id === multiQ.id)
    expect(q2.options.filter((o: any) => o.mine)).toHaveLength(2)
    expect(poll.totalVoters).toBe(1)
  })

  it("two options on a single-choice question is rejected", async () => {
    actAs(secondParentId)
    const res = await vote(pollId, {
      answers: [
        { questionId: singleQ.id, optionIds: [singleQ.options[0].id, singleQ.options[1].id] },
      ],
    })
    expect(res.status).toBe(400)
  })

  it("options from another question are rejected", async () => {
    actAs(secondParentId)
    const res = await vote(pollId, {
      answers: [{ questionId: singleQ.id, optionIds: [multiQ.options[0].id] }],
    })
    expect(res.status).toBe(400)
  })

  it("re-voting replaces the previous choice", async () => {
    actAs(familyParentId)
    const res = await vote(pollId, {
      answers: [{ questionId: singleQ.id, optionIds: [singleQ.options[1].id] }],
    })
    const { poll } = await res.json()
    const q1 = poll.questions.find((q: any) => q.id === singleQ.id)
    expect(q1.options[0].count).toBe(0)
    expect(q1.options[1].count).toBe(1)
    expect(q1.options[1].mine).toBe(true)
    expect(q1.voterCount).toBe(1)
  })

  it("staff see voter names; families see only counts", async () => {
    actAs(coachId)
    const staffView = await (await list()).json()
    const staffQ1 = staffView.polls[0].questions.find((q: any) => q.id === singleQ.id)
    expect(staffQ1.options[1].voters).toHaveLength(1)

    actAs(secondParentId)
    const familyView = await (await list()).json()
    expect(familyView.membership.role).toBe("family")
    const famQ1 = familyView.polls[0].questions.find((q: any) => q.id === singleQ.id)
    expect(famQ1.options[1].count).toBe(1)
    expect(famQ1.options[1].voters).toBeUndefined()
  })

  it("family cannot close a poll; staff can — closed polls reject votes", async () => {
    actAs(familyParentId)
    expect((await manage(pollId, "close")).status).toBe(403)

    actAs(coachId)
    expect((await manage(pollId, "close")).status).toBe(200)

    actAs(secondParentId)
    const res = await vote(pollId, {
      answers: [{ questionId: singleQ.id, optionIds: [singleQ.options[0].id] }],
    })
    expect(res.status).toBe(400)

    actAs(coachId)
    expect((await manage(pollId, "reopen")).status).toBe(200)
    actAs(secondParentId)
    expect(
      (await vote(pollId, { answers: [{ questionId: singleQ.id, optionIds: [singleQ.options[0].id] }] }))
        .status
    ).toBe(200)
  })

  it("deleting a poll cascades its votes", async () => {
    actAs(coachId)
    expect((await remove(pollId)).status).toBe(200)
    const votesLeft = await (prisma as any).pollVote.count({
      where: { question: { pollId } },
    })
    expect(votesLeft).toBe(0)
    const feed = await (await list()).json()
    expect(feed.polls.map((p: any) => p.id)).not.toContain(pollId)
  })
})
