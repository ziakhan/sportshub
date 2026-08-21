import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { buildWorld, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { POST as poolAction, GET as poolGet } from "./route"
import { POST as createEvent } from "../tryout-events/route"
import { PATCH as patchEvent } from "../tryout-events/[eventId]/route"
import { POST as signUp } from "../../../tryouts/[id]/signup/route"
import { PATCH as respondToOffer } from "../../../offers/[id]/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — club tryout events and the age-group pool
 * (docs/roadmap/club-tryouts-and-age-pools, owner rulings 2026-08-20).
 *
 * The whole arc in one world: one event with a U11 and a U13 session sharing
 * a gym and a start time (the combined-session case), families register per
 * session, the pool fills from the event, teamless offers go out, a family
 * accepts one and gets NO roster spot, a coach assigns them and the roster
 * spot appears, another team asks for a release and gets it, and finalizing a
 * team tells the families.
 */

let world: BuiltWorld
let tenantId: string
let ownerId: string
let venueId: string
let eventId: string
let sessionU11: string
let sessionU13: string
let teamU11: { id: string; name: string }
let teamU13: { id: string; name: string }
let templateId: string
const seasonLabel = "2026-27"

/** parent + player pairs, one per age group. */
const families: Array<{ parentId: string; playerId: string; ageGroup: string; name: string }> = []

const nextYear = () => {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  d.setHours(18, 0, 0, 0)
  return d
}

const poolPost = (body: unknown) =>
  poolAction(jsonRequest(`/api/clubs/${tenantId}/tryout-pool`, body), { params: { id: tenantId } })

// The GET reads request.nextUrl.searchParams, so it needs a real NextRequest.
const readPool = () =>
  poolGet(
    new NextRequest(`http://localhost:3000/api/clubs/${tenantId}/tryout-pool?seasonLabel=${seasonLabel}`),
    { params: { id: tenantId } }
  )

const memberFor = (members: any[], playerId: string) =>
  members.find((m: any) => m.player.id === playerId)

beforeAll(async () => {
  world = await buildWorld({
    seed: 1150,
    clubs: [{ teams: [{ ageGroup: "U11" }, { ageGroup: "U13" }] }],
  })
  const club = world.clubs[0]
  tenantId = club.tenantId
  ownerId = club.owner.id
  teamU11 = { id: club.teams[0].id, name: club.teams[0].name }
  teamU13 = { id: club.teams[1].id, name: club.teams[1].name }

  const venue = await prisma.venue.create({
    data: {
      name: world.ctx.name("Central Gym"),
      address: "1 Court St",
      city: "Toronto",
      state: "ON",
      country: "CA",
    },
  })
  venueId = venue.id

  // One club-level offer template — the age-group program's price.
  const template = await prisma.offerTemplate.create({
    data: {
      tenantId,
      name: "Rep program",
      seasonFee: 500,
      installments: 1,
      practiceSessions: 2,
      gamesMin: 18,
      gamesMax: 22,
    },
  })
  templateId = template.id

  // Two families: a 10-year-old for U11, a 12-year-old for U13.
  for (const [age, ageGroup] of [
    [10, "U11"],
    [12, "U13"],
  ] as const) {
    const parent = await prisma.user.create({
      data: {
        email: world.ctx.email(`pool-parent-${ageGroup}`),
        passwordHash: "x",
        firstName: "Pool",
        lastName: `Parent ${ageGroup}`,
        status: "ACTIVE",
        onboardedAt: new Date(),
      },
    })
    const dob = new Date()
    dob.setFullYear(dob.getFullYear() - age)
    dob.setDate(dob.getDate() - 30)
    const player = await prisma.player.create({
      data: {
        firstName: "Kid",
        lastName: ageGroup,
        dateOfBirth: dob,
        gender: "MALE",
        parentId: parent.id,
        isMinor: true,
        parentalConsentGiven: true,
        consentGivenAt: new Date(),
      },
    })
    families.push({
      parentId: parent.id,
      playerId: player.id,
      ageGroup,
      name: `Kid ${ageGroup}`,
    })
  }
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("club tryout events + age-group pool (integration)", () => {
  it("creates one event whose U11 and U13 sessions share a gym and a start time", async () => {
    actAs(ownerId)
    const scheduledAt = nextYear().toISOString()
    const res = await createEvent(
      jsonRequest(`/api/clubs/${tenantId}/tryout-events`, {
        title: "Fall tryouts",
        seasonLabel,
        sessions: [
          { ageGroup: "U11", scheduledAt, duration: 90, venueId, fee: 0, maxParticipants: 40 },
          { ageGroup: "U13", scheduledAt, duration: 90, venueId, fee: 0, maxParticipants: 40 },
        ],
      }),
      { params: { id: tenantId } }
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    eventId = body.id
    expect(body.sessions).toBe(2)

    const sessions = await prisma.tryout.findMany({
      where: { eventId },
      orderBy: { ageGroup: "asc" },
      select: { id: true, ageGroup: true, title: true, scheduledAt: true, venueId: true, isPublished: true },
    })
    sessionU11 = sessions[0].id
    sessionU13 = sessions[1].id
    expect(sessions.map((s) => s.ageGroup)).toEqual(["U11", "U13"])
    // Combined gym: same slot, same room, two rows.
    expect(sessions[0].scheduledAt.getTime()).toBe(sessions[1].scheduledAt.getTime())
    expect(sessions[0].venueId).toBe(venueId)
    expect(sessions[1].venueId).toBe(venueId)
    expect(sessions[0].title).toContain("U11")
    expect(sessions.every((s) => !s.isPublished)).toBe(true)
  })

  it("publishing the event puts every session on the shelf", async () => {
    actAs(ownerId)
    const res = await patchEvent(
      jsonRequest(`/api/clubs/${tenantId}/tryout-events/${eventId}`, { isPublished: true }, "PATCH"),
      { params: { id: tenantId, eventId } }
    )
    expect(res.status).toBe(200)
    const live = await prisma.tryout.count({ where: { eventId, isPublished: true } })
    expect(live).toBe(2)
  })

  it("refuses to delete a session families are registered for", async () => {
    // Register both kids first — each into the session for their age group.
    for (const family of families) {
      actAs(family.parentId)
      const sessionId = family.ageGroup === "U11" ? sessionU11 : sessionU13
      const res = await signUp(
        jsonRequest(`/api/tryouts/${sessionId}/signup`, { playerId: family.playerId }),
        { params: { id: sessionId } }
      )
      expect(res.status).toBe(201)
    }

    actAs(ownerId)
    const res = await patchEvent(
      jsonRequest(
        `/api/clubs/${tenantId}/tryout-events/${eventId}`,
        { removeSessionIds: [sessionU11] },
        "PATCH"
      ),
      { params: { id: tenantId, eventId } }
    )
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe("SESSION_HAS_SIGNUPS")
    expect(await prisma.tryout.count({ where: { id: sessionU11 } })).toBe(1)
  })

  it("sync-from-event puts every signup in its age group's pool, and re-running is a no-op", async () => {
    actAs(ownerId)
    const first = await poolPost({ action: "sync-from-event", eventId })
    expect(first.status).toBe(200)
    expect((await first.json()).created).toBe(2)

    const again = await poolPost({ action: "sync-from-event", eventId })
    const againBody = await again.json()
    expect(againBody.created).toBe(0)
    expect(againBody.skipped).toBe(2)

    const members = await prisma.tryoutPoolMember.findMany({
      where: { tenantId, seasonLabel },
      select: { ageGroup: true, playerId: true, teamId: true },
    })
    expect(members).toHaveLength(2)
    expect(members.every((m) => m.teamId === null)).toBe(true)
    expect(members.map((m) => m.ageGroup).sort()).toEqual(["U11", "U13"])
  })

  it("sends teamless age-group offers from a club template", async () => {
    actAs(ownerId)
    const pool = await (await readPool()).json()
    const memberIds = pool.members.map((m: any) => m.id)

    const res = await poolPost({ action: "send-offers", memberIds, templateId })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.sent).toBe(2)
    expect(body.skipped).toEqual([])

    const offers = await prisma.offer.findMany({
      where: { tenantId, teamId: null },
      select: { id: true, ageGroup: true, teamId: true, seasonFee: true, playerId: true },
    })
    expect(offers).toHaveLength(2)
    expect(offers.every((o) => o.teamId === null)).toBe(true)
    expect(offers.map((o) => o.ageGroup).sort()).toEqual(["U11", "U13"])
    expect(Number(offers[0].seasonFee)).toBe(500)

    // Re-sending skips anyone who already holds a live offer.
    const repeat = await poolPost({ action: "send-offers", memberIds, templateId })
    const repeatBody = await repeat.json()
    expect(repeatBody.sent).toBe(0)
    expect(repeatBody.skipped).toHaveLength(2)
  })

  it("accepting a teamless offer commits the money and rosters nobody", async () => {
    const family = families[0]
    const offer = await prisma.offer.findFirstOrThrow({
      where: { tenantId, teamId: null, playerId: family.playerId },
      select: { id: true },
    })

    actAs(family.parentId)
    const res = await respondToOffer(
      jsonRequest(`/api/offers/${offer.id}`, { action: "accept" }, "PATCH"),
      { params: { id: offer.id } }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("ACCEPTED")
    expect(body.message).toContain("U11 program")
    expect(body.message).not.toContain("—")

    // The whole point: no team, so no roster row.
    expect(await prisma.teamPlayer.count({ where: { playerId: family.playerId } })).toBe(0)
    // The money still commits.
    const obligation = await prisma.paymentObligation.findFirst({
      where: { referenceType: "Offer", referenceId: offer.id },
      select: { amount: true, payeeTenantId: true },
    })
    expect(Number(obligation?.amount)).toBe(500)
    expect(obligation?.payeeTenantId).toBe(tenantId)
  })

  it("assigning an accepted member to a team creates the roster spot", async () => {
    actAs(ownerId)
    const pool = await (await readPool()).json()
    const member = memberFor(pool.members, families[0].playerId)
    expect(member.offerState).toBe("ACCEPTED")
    expect(member.assignedTeam).toBeNull()

    const res = await poolPost({ action: "assign", memberId: member.id, teamId: teamU11.id })
    expect(res.status).toBe(200)
    expect((await res.json()).rosterAdded).toBe(true)

    const rosterRow = await prisma.teamPlayer.findUnique({
      where: { teamId_playerId: { teamId: teamU11.id, playerId: families[0].playerId } },
      select: { status: true },
    })
    expect(rosterRow?.status).toBe("ACTIVE")

    // First write wins: a second grab is refused, not silently re-pointed.
    const clash = await poolPost({ action: "assign", memberId: member.id, teamId: teamU13.id })
    expect(clash.status).toBe(409)
    expect((await clash.json()).code).toBe("ALREADY_ASSIGNED")
  })

  it("a release request accepted by the holding team puts the player back in the pool", async () => {
    actAs(ownerId)
    let pool = await (await readPool()).json()
    const member = memberFor(pool.members, families[0].playerId)

    const asked = await poolPost({
      action: "request-release",
      poolMemberId: member.id,
      kind: "RELEASE_TO_POOL",
      message: "We are going with a smaller roster.",
    })
    expect(asked.status).toBe(201)
    const requestId = (await asked.json()).request.id

    pool = await (await readPool()).json()
    expect(memberFor(pool.members, families[0].playerId).releaseRequests).toHaveLength(1)

    const resolved = await poolPost({ action: "resolve-release", requestId, resolution: "accept" })
    expect(resolved.status).toBe(200)
    const resolvedBody = await resolved.json()
    expect(resolvedBody.status).toBe("ACCEPTED")
    expect(resolvedBody.rosterReleased).toBe(true)

    const back = await prisma.tryoutPoolMember.findUniqueOrThrow({
      where: { id: member.id },
      select: { teamId: true, assignedAt: true },
    })
    expect(back.teamId).toBeNull()
    expect(back.assignedAt).toBeNull()

    const rosterRow = await prisma.teamPlayer.findUnique({
      where: { teamId_playerId: { teamId: teamU11.id, playerId: families[0].playerId } },
      select: { status: true, leftAt: true },
    })
    expect(rosterRow?.status).toBe("INACTIVE")
    expect(rosterRow?.leftAt).not.toBeNull()

    const request = await prisma.teamReleaseRequest.findUniqueOrThrow({
      where: { id: requestId },
      select: { status: true, resolvedById: true, resolvedAt: true },
    })
    expect(request.status).toBe("ACCEPTED")
    expect(request.resolvedById).toBe(ownerId)
    expect(request.resolvedAt).not.toBeNull()
  })

  it("assignment works without any offer, and finalizing the team tells the families", async () => {
    actAs(ownerId)
    const pool = await (await readPool()).json()
    const member = memberFor(pool.members, families[1].playerId)
    // Still only offered, never accepted — assignment is orthogonal.
    expect(member.offerState).toBe("PENDING")

    const assigned = await poolPost({ action: "assign", memberId: member.id, teamId: teamU13.id })
    expect(assigned.status).toBe(200)
    // No accepted offer, so no roster row yet: the jersey follows the money.
    expect((await assigned.json()).rosterAdded).toBe(false)

    const res = await poolPost({ action: "finalize-team", teamId: teamU13.id })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.players).toBe(1)
    expect(body.familiesNotified).toBe(1)

    const notice = await prisma.notification.findFirst({
      where: { userId: families[1].parentId, type: "team_roster_final" },
      select: { message: true },
    })
    expect(notice?.message).toContain(teamU13.name)
    expect(notice?.message).not.toContain("—")
  })

  it("the public read hides capacity and hides the crowd until the club opts in", async () => {
    const { getTryoutEventPublic } = await import("@/lib/queries/tryout-events")
    let event = await getTryoutEventPublic(eventId)
    expect(event?.sessions).toHaveLength(2)
    expect(event?.ageGroups).toEqual(["U11", "U13"])
    expect(event?.sessions[0]).not.toHaveProperty("maxParticipants")
    expect(event?.sessions[0]).not.toHaveProperty("signupCount")

    actAs(ownerId)
    const res = await patchEvent(
      jsonRequest(`/api/clubs/${tenantId}/tryout-events/${eventId}`, { showSignupCount: true }, "PATCH"),
      { params: { id: tenantId, eventId } }
    )
    expect(res.status).toBe(200)

    event = await getTryoutEventPublic(eventId)
    expect(event?.sessions[0].signupCount).toBe(1)
    expect(event?.sessions[0]).not.toHaveProperty("maxParticipants")
  })
})
