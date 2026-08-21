import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { buildWorld, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { acceptOffer } from "@/lib/offers/respond-to-offer"
import { POST as poolAction, GET as poolGet } from "./route"
import { POST as createEvent } from "../tryout-events/route"
import { POST as signUp } from "../../../tryouts/[id]/signup/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — the owner's tryout scenario, end to end (world seed 1151).
 *
 * One club, one event, two grades sharing one floor at one time, thirty kids
 * through the door. What it pins down is the ORDER-INDEPENDENCE the owner
 * asked for: a club may pick a kid off the pool board before the family says
 * yes, or after, and either way the roster spot exists exactly once, only when
 * BOTH halves are in (owner rulings 3, 6 and 9, 2026-08-20).
 *
 *   PATH A  assign with no offer            -> pooled to a team, no roster row
 *   PATH B  those same kids then ACCEPT     -> roster row appears at accept
 *   PATH C  accept first, assign afterwards -> roster row appears at assign
 *
 * PATH B is the half that was missing: a teamless accept wrote no roster row
 * and a pool assignment only rostered when an ACCEPTED offer already existed,
 * so "assign first, then offer" rostered nobody at all.
 */

let world: BuiltWorld
let tenantId: string
let ownerId: string
let venueId: string
let eventId: string
let sessionU17: string
let sessionU18: string
let teamU17: { id: string; name: string }
let teamU18: { id: string; name: string }
let templateId: string

const SEASON = "2026-27"
const SEASON_FEE = 800
const UNIFORM = "AL"
const AGE_GROUPS = ["U17", "U18"] as const
type AgeGroup = (typeof AGE_GROUPS)[number]

interface Family {
  parentId: string
  playerId: string
  ageGroup: AgeGroup
  name: string
}
const families: Family[] = []

/** The 15 kids of one grade, in the order they were created. */
const grade = (ageGroup: AgeGroup) => families.filter((f) => f.ageGroup === ageGroup)
/** 0-2 assigned before any offer, 3-9 offered from the pool, 10-14 untouched. */
const PATH_A = [0, 1, 2]
const PATH_C = [3, 4, 5, 6, 7, 8, 9]
const UNTOUCHED = [10, 11, 12, 13, 14]
const pick = (ageGroup: AgeGroup, indexes: number[]) => indexes.map((i) => grade(ageGroup)[i])
const teamFor = (ageGroup: AgeGroup) => (ageGroup === "U17" ? teamU17 : teamU18)

const FIRST_NAMES = [
  "Amari", "Dario", "Kwame", "Elias", "Noah", "Jaylen", "Devon", "Malik",
  "Rowan", "Tobias", "Andre", "Nikolai", "Chidi", "Emeka", "Rafael",
]
const LAST_NAMES = [
  "Boateng", "Ferreira", "Okonkwo", "Petrov", "Nguyen", "Clarke", "Osei",
  "Rahman", "Delgado", "Kowalski", "Mensah", "Bianchi", "Haddad", "Novak",
  "Silva",
]

const slotAt = () => {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  d.setHours(18, 0, 0, 0)
  return d
}

const poolPost = (body: unknown) =>
  poolAction(jsonRequest(`/api/clubs/${tenantId}/tryout-pool`, body), { params: { id: tenantId } })

const readPool = () =>
  poolGet(
    new NextRequest(`http://localhost:3000/api/clubs/${tenantId}/tryout-pool?seasonLabel=${SEASON}`),
    { params: { id: tenantId } }
  )

const memberFor = (members: any[], playerId: string) =>
  members.find((m: any) => m.player.id === playerId)

/**
 * Accept through the REAL domain service, with the shape the route hands it.
 * Same include as PATCH /api/offers/[id] so nothing here is a friendlier
 * object than production sees.
 */
async function acceptPoolOffer(family: Family) {
  const offer = await prisma.offer.findFirstOrThrow({
    where: {
      tenantId,
      teamId: null,
      playerId: family.playerId,
      ageGroup: family.ageGroup,
      status: "PENDING",
    },
    include: {
      player: {
        select: { id: true, parentId: true, userId: true, firstName: true, lastName: true },
      },
      team: {
        select: {
          id: true,
          name: true,
          tenantId: true,
          tenant: { select: { name: true, currency: true } },
        },
      },
      tenant: { select: { name: true, currency: true } },
      options: {
        orderBy: { sortOrder: "asc" },
        include: { installmentTerms: { orderBy: { sequence: "asc" } } },
      },
    },
  })
  const accepted: any = await acceptOffer(offer as any, { uniformSize: UNIFORM })
  return { offerId: offer.id, accepted }
}

const rosterRow = (teamId: string, playerId: string) =>
  prisma.teamPlayer.findUnique({
    where: { teamId_playerId: { teamId, playerId } },
    select: { status: true, uniformSize: true, jerseyNumber: true },
  })

const activeRoster = (teamId: string) =>
  prisma.teamPlayer.count({ where: { teamId, status: "ACTIVE" } })

beforeAll(async () => {
  world = await buildWorld({ seed: 1151, clubs: [{}] })
  const club = world.clubs[0]
  tenantId = club.tenantId
  ownerId = club.owner.id

  // Worlds build clubs as drafts, and every public read gates on publishedAt
  // (same gate as getClubProfile). The public event assertions below are about
  // the event, not the club's review state, so put the club on the shelf.
  await prisma.tenant.update({ where: { id: tenantId }, data: { publishedAt: new Date() } })

  const venue = await prisma.venue.create({
    data: {
      name: world.ctx.name("Lords Fieldhouse"),
      address: "77 Baseline Rd",
      city: "Toronto",
      state: "ON",
      country: "CA",
    },
  })
  venueId = venue.id

  // The club-level program price. Uniform included, so every accept carries a
  // size and the roster row can be checked for it.
  const template = await prisma.offerTemplate.create({
    data: {
      tenantId,
      name: "Rep program",
      seasonFee: SEASON_FEE,
      installments: 1,
      practiceSessions: 3,
      gamesMin: 20,
      gamesMax: 24,
      includesUniform: true,
    },
  })
  templateId = template.id

  // 15 families per grade. U17 is born 2009 or later, U18 born 2008 or later,
  // so a 2008 kid is blocked from the U17 floor and the grades stay honest.
  for (const ageGroup of AGE_GROUPS) {
    const birthYear = ageGroup === "U17" ? 2009 : 2008
    for (let i = 0; i < 15; i++) {
      const first = FIRST_NAMES[i]
      const last = LAST_NAMES[(i + (ageGroup === "U17" ? 0 : 7)) % LAST_NAMES.length]
      const parent = await prisma.user.create({
        data: {
          email: world.ctx.email(`parent-${ageGroup}-${i}`),
          passwordHash: "x",
          firstName: "Parent",
          lastName: last,
          status: "ACTIVE",
          onboardedAt: new Date(),
        },
      })
      const player = await prisma.player.create({
        data: {
          firstName: first,
          lastName: last,
          dateOfBirth: new Date(`${birthYear}-06-15T12:00:00Z`),
          gender: "MALE",
          parentId: parent.id,
          isMinor: false,
          canLogin: true,
        },
      })
      families.push({
        parentId: parent.id,
        playerId: player.id,
        ageGroup,
        name: `${first} ${last}`,
      })
    }
  }
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("club tryouts: one floor, two grades, thirty kids (integration)", () => {
  it("announces one event whose U17 and U18 sessions share the gym and the hour", async () => {
    actAs(ownerId)
    const scheduledAt = slotAt().toISOString()
    const res = await createEvent(
      jsonRequest(`/api/clubs/${tenantId}/tryout-events`, {
        title: "Fall Tryouts",
        seasonLabel: SEASON,
        publish: true,
        sessions: [
          { ageGroup: "U17", scheduledAt, duration: 90, venueId, fee: 0 },
          { ageGroup: "U18", scheduledAt, duration: 90, venueId, fee: 0 },
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
      select: { id: true, ageGroup: true, scheduledAt: true, venueId: true, isPublished: true },
    })
    sessionU17 = sessions[0].id
    sessionU18 = sessions[1].id
    expect(sessions.map((s) => s.ageGroup)).toEqual(["U17", "U18"])
    expect(sessions[0].scheduledAt.getTime()).toBe(sessions[1].scheduledAt.getTime())
    expect(sessions.every((s) => s.venueId === venueId)).toBe(true)
    expect(sessions.every((s) => s.isPublished)).toBe(true)
  })

  it("takes 30 registrations, 15 into each grade", async () => {
    for (const family of families) {
      actAs(family.parentId)
      const sessionId = family.ageGroup === "U17" ? sessionU17 : sessionU18
      const res = await signUp(
        jsonRequest(`/api/tryouts/${sessionId}/signup`, { playerId: family.playerId }),
        { params: { id: sessionId } }
      )
      expect(res.status).toBe(201)
    }
    const counts = await prisma.tryoutSignup.groupBy({
      by: ["tryoutId"],
      where: { tryout: { eventId } },
      _count: { _all: true },
    })
    expect(counts.map((c) => c._count._all).sort()).toEqual([15, 15])
  }, 60_000)

  it("sync-from-event fills both age-group pools", async () => {
    actAs(ownerId)
    const res = await poolPost({ action: "sync-from-event", eventId })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.created).toBe(30)
    expect(body.ageGroups).toEqual(["U17", "U18"])

    const members = await prisma.tryoutPoolMember.groupBy({
      by: ["ageGroup"],
      where: { tenantId, seasonLabel: SEASON },
      _count: { _all: true },
    })
    expect(members.map((m) => [m.ageGroup, m._count._all]).sort()).toEqual([
      ["U17", 15],
      ["U18", 15],
    ])
    expect(await prisma.tryoutPoolMember.count({ where: { tenantId, teamId: null } })).toBe(30)
  })

  it("PATH A — three per grade are assigned to a team with no offer, and nobody is rostered", async () => {
    teamU17 = await prisma.team.create({
      data: { tenantId, name: "U17 Black", ageGroup: "U17", gender: "MALE", season: SEASON },
      select: { id: true, name: true },
    })
    teamU18 = await prisma.team.create({
      data: { tenantId, name: "U18 Black", ageGroup: "U18", gender: "MALE", season: SEASON },
      select: { id: true, name: true },
    })

    actAs(ownerId)
    const pool = await (await readPool()).json()
    for (const ageGroup of AGE_GROUPS) {
      for (const family of pick(ageGroup, PATH_A)) {
        const member = memberFor(pool.members, family.playerId)
        expect(member.offerState).toBe("none")
        const res = await poolPost({
          action: "assign",
          memberId: member.id,
          teamId: teamFor(ageGroup).id,
        })
        expect(res.status).toBe(200)
        const body = await res.json()
        // No accepted offer yet, so the jersey waits: pool placement only.
        expect(body.rosterAdded).toBe(false)
      }
    }

    const assignedIds = AGE_GROUPS.flatMap((g) => pick(g, PATH_A)).map((f) => f.playerId)
    expect(
      await prisma.tryoutPoolMember.count({
        where: { tenantId, playerId: { in: assignedIds }, teamId: { not: null } },
      })
    ).toBe(6)
    expect(await prisma.teamPlayer.count({ where: { playerId: { in: assignedIds } } })).toBe(0)
  })

  it("sends 20 program offers: the 6 already picked, plus 7 more from each pool", async () => {
    actAs(ownerId)
    const pool = await (await readPool()).json()
    const targets = AGE_GROUPS.flatMap((g) => pick(g, [...PATH_A, ...PATH_C]))
    expect(targets).toHaveLength(20)

    const res = await poolPost({
      action: "send-offers",
      memberIds: targets.map((f) => memberFor(pool.members, f.playerId).id),
      templateId,
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.sent).toBe(20)
    // Being assigned is not a reason to skip anyone: money and jersey are
    // separate commitments, and this offer is the money half.
    expect(body.skipped).toEqual([])

    const offers = await prisma.offer.groupBy({
      by: ["ageGroup"],
      where: { tenantId, teamId: null, status: "PENDING" },
      _count: { _all: true },
    })
    expect(offers.map((o) => [o.ageGroup, o._count._all]).sort()).toEqual([
      ["U17", 10],
      ["U18", 10],
    ])
    const untouched = AGE_GROUPS.flatMap((g) => pick(g, UNTOUCHED)).map((f) => f.playerId)
    expect(await prisma.offer.count({ where: { playerId: { in: untouched } } })).toBe(0)
  })

  it("PATH B — an already-assigned family accepts, and the roster spot appears at accept", async () => {
    for (const ageGroup of AGE_GROUPS) {
      const team = teamFor(ageGroup)
      for (const family of pick(ageGroup, PATH_A)) {
        const { offerId, accepted } = await acceptPoolOffer(family)
        expect(accepted.status).toBe("ACCEPTED")

        // The whole point: the club picked them BEFORE the family said yes,
        // so saying yes is what completes the roster spot.
        const row = await rosterRow(team.id, family.playerId)
        expect(row?.status).toBe("ACTIVE")
        expect(row?.uniformSize).toBe(UNIFORM)
        // Jersey at assignment, money at offer: a pool accept asks no number.
        expect(row?.jerseyNumber).toBeNull()
        expect(accepted.joinedTeam?.id).toBe(team.id)

        // The club is told they joined the TEAM, not the pool they left.
        const bell = await prisma.notification.findFirst({
          where: { type: "offer_accepted", referenceId: offerId },
          select: { message: true },
        })
        expect(bell?.message).toContain(team.name)
        expect(bell?.message).not.toContain("—")

        // The money commits exactly once, the same as any other accept.
        const obligation = await prisma.paymentObligation.findFirst({
          where: { referenceType: "Offer", referenceId: offerId },
          select: { amount: true, payeeTenantId: true },
        })
        expect(Number(obligation?.amount)).toBe(SEASON_FEE)
        expect(obligation?.payeeTenantId).toBe(tenantId)
      }
    }

    expect(await activeRoster(teamU17.id)).toBe(3)
    expect(await activeRoster(teamU18.id)).toBe(3)
  }, 60_000)

  it("PATH C — accepting from the pool rosters nobody until someone picks them", async () => {
    for (const ageGroup of AGE_GROUPS) {
      for (const family of pick(ageGroup, PATH_C)) {
        const { accepted } = await acceptPoolOffer(family)
        expect(accepted.status).toBe("ACCEPTED")
        expect(accepted.joinedTeam ?? null).toBeNull()
      }
    }
    const pooled = AGE_GROUPS.flatMap((g) => pick(g, PATH_C)).map((f) => f.playerId)
    expect(await prisma.teamPlayer.count({ where: { playerId: { in: pooled } } })).toBe(0)
    // Accepted but unassigned is a resting state, not a half-finished one.
    expect(
      await prisma.tryoutPoolMember.count({
        where: { tenantId, playerId: { in: pooled }, teamId: null },
      })
    ).toBe(14)

    actAs(ownerId)
    const pool = await (await readPool()).json()
    for (const ageGroup of AGE_GROUPS) {
      const team = teamFor(ageGroup)
      for (const family of pick(ageGroup, PATH_C)) {
        const member = memberFor(pool.members, family.playerId)
        expect(member.offerState).toBe("ACCEPTED")
        const res = await poolPost({ action: "assign", memberId: member.id, teamId: team.id })
        expect(res.status).toBe(200)
        expect((await res.json()).rosterAdded).toBe(true)

        const row = await rosterRow(team.id, family.playerId)
        expect(row?.status).toBe("ACTIVE")
        expect(row?.uniformSize).toBe(UNIFORM)
      }
    }
  }, 60_000)

  it("both teams carry exactly ten players, three picked early and seven picked late", async () => {
    expect(await activeRoster(teamU17.id)).toBe(10)
    expect(await activeRoster(teamU18.id)).toBe(10)
    // The five per grade nobody offered are still sitting in the pool.
    expect(
      await prisma.tryoutPoolMember.count({ where: { tenantId, seasonLabel: SEASON, teamId: null } })
    ).toBe(10)
  })

  it("finalizing each team tells its ten families, and nobody else", async () => {
    actAs(ownerId)
    for (const team of [teamU17, teamU18]) {
      const res = await poolPost({ action: "finalize-team", teamId: team.id })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.players).toBe(10)
      expect(body.familiesNotified).toBe(10)
    }

    for (const ageGroup of AGE_GROUPS) {
      const team = teamFor(ageGroup)
      const onTheTeam = pick(ageGroup, [...PATH_A, ...PATH_C])
      const notices = await prisma.notification.findMany({
        where: {
          type: "team_roster_final",
          userId: { in: onTheTeam.map((f) => f.parentId) },
        },
        select: { userId: true, message: true },
      })
      expect(notices).toHaveLength(10)
      expect(new Set(notices.map((n) => n.userId)).size).toBe(10)
      expect(notices.every((n) => n.message.includes(team.name))).toBe(true)
      expect(notices.every((n) => !n.message.includes("—"))).toBe(true)
    }

    // Still in the pool means still waiting: no team news for them.
    const stillPooled = AGE_GROUPS.flatMap((g) => pick(g, UNTOUCHED)).map((f) => f.parentId)
    expect(
      await prisma.notification.count({
        where: { type: "team_roster_final", userId: { in: stillPooled } },
      })
    ).toBe(0)
  })

  it("the public read shows two cards at one time in one gym, and never a headcount", async () => {
    const { getTryoutEventPublic, listPublishedTryoutEvents } = await import(
      "@/lib/queries/tryout-events"
    )

    const listed = await listPublishedTryoutEvents(tenantId)
    expect(listed).toHaveLength(1)
    expect(listed[0].id).toBe(eventId)

    const event = await getTryoutEventPublic(eventId)
    expect(event?.title).toBe("Fall Tryouts")
    expect(event?.ageGroups).toEqual(["U17", "U18"])
    // Two grades, one floor, one hour: two cards, never one merged card.
    expect(event?.sessions).toHaveLength(2)
    const [u17, u18] = event!.sessions
    expect(u17.ageGroup).toBe("U17")
    expect(u18.ageGroup).toBe("U18")
    expect(u17.scheduledAt.getTime()).toBe(u18.scheduledAt.getTime())
    expect(u17.endsAt?.getTime()).toBe(u18.endsAt?.getTime())
    expect(u17.venue?.id).toBe(venueId)
    expect(u18.venue?.id).toBe(venueId)
    expect(u17.location).toBe(u18.location)

    // showSignupCount is off, so the crowd is absent — not a zero, absent.
    for (const session of event!.sessions) {
      expect(session).not.toHaveProperty("signupCount")
      expect(session).not.toHaveProperty("maxParticipants")
    }
    for (const session of listed[0].sessions) {
      expect(session).not.toHaveProperty("signupCount")
    }
  })
})
