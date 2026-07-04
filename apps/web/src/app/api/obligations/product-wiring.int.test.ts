import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import {
  buildWorld,
  destroyWorld,
  createOffer,
  createParentWithChildren,
  type BuiltWorld,
} from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { POST as recordPayment } from "./[id]/payments/route"
import { PATCH as offerRespond } from "@/app/api/offers/[id]/route"
import { POST as campSignup } from "@/app/api/camps/[id]/signup/route"
import { POST as hlSignup } from "@/app/api/house-leagues/[id]/signup/route"
import { PATCH as submissionPatch } from "@/app/api/seasons/[id]/teams/[teamId]/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — every fee-bearing product mints an obligation (docs/payments-design.md
 * phase 1): offers (A2, installments), camps (A3), house leagues (A4), and
 * team submissions (B1 — the club→league flow, league as merchant).
 */

const DAY = 24 * 60 * 60 * 1000

let world: BuiltWorld
let tenantId: string
let parentId: string
let playerId: string

const obligationFor = (referenceType: string, referenceId: string) =>
  prisma.paymentObligation.findUnique({
    where: { referenceType_referenceId: { referenceType, referenceId } },
  })

beforeAll(async () => {
  world = await buildWorld({
    seed: 1111,
    clubs: [{ teams: [{}] }],
    leagues: [
      {
        seasons: [
          {
            status: "REGISTRATION",
            teamFee: 600,
            divisions: [{ teams: 2, rosterSize: 0, submissionStatus: "PENDING" }],
          },
        ],
      },
    ],
  })
  tenantId = world.clubs[0].tenantId
  const family = await createParentWithChildren(world.ctx, { children: [{ age: 12 }] })
  parentId = family.parent.id
  playerId = family.players[0].id
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("offer acceptance (A2 — the flagship)", () => {
  it("accepting an offer mints the season-fee obligation with the installment note", async () => {
    const offer = await createOffer(world.ctx, {
      teamId: world.clubs[0].teams[0].id,
      playerId,
      status: "PENDING",
      seasonFee: 480,
    })
    await prisma.offer.update({ where: { id: offer.id }, data: { installments: 4 } })

    actAs(parentId)
    const res = await offerRespond(
      jsonRequest(`/api/offers/${offer.id}`, { action: "accept", jerseyPref1: 12 }, "PATCH") as any,
      { params: { id: offer.id } }
    )
    expect(res.status).toBe(200)

    const obligation = await obligationFor("Offer", offer.id)
    expect(obligation).not.toBeNull()
    expect(Number(obligation!.amount)).toBe(480)
    expect(obligation!.payerUserId).toBe(parentId)
    expect(obligation!.payeeTenantId).toBe(tenantId)
    expect(obligation!.description).toContain("4 installments")
  })

  it("declining an offer creates no obligation", async () => {
    const family = await createParentWithChildren(world.ctx, { children: [{ age: 11 }] })
    const offer = await createOffer(world.ctx, {
      teamId: world.clubs[0].teams[0].id,
      playerId: family.players[0].id,
      status: "PENDING",
    })
    actAs(family.parent.id)
    const res = await offerRespond(
      jsonRequest(`/api/offers/${offer.id}`, { action: "decline" }, "PATCH") as any,
      { params: { id: offer.id } }
    )
    expect(res.status).toBe(200)
    expect(await obligationFor("Offer", offer.id)).toBeNull()
  })
})

describe("camp + house-league signups (A3/A4)", () => {
  it("a camp signup owes weeks × weeklyFee", async () => {
    const camp = await prisma.camp.create({
      data: {
        tenantId,
        name: world.ctx.name("Summer Camp"),
        campType: "SUMMER",
        ageGroup: "U12",
        startDate: new Date(Date.now() + 30 * DAY),
        endDate: new Date(Date.now() + 60 * DAY),
        location: "Test Gym",
        numberOfWeeks: 4,
        weeklyFee: 120,
        dailyStartTime: "09:00",
        dailyEndTime: "16:00",
        isPublished: true,
      },
    })
    actAs(parentId)
    const res = await campSignup(
      jsonRequest(`/api/camps/${camp.id}/signup`, { playerId, weeksSelected: 2 }) as any,
      { params: { id: camp.id } }
    )
    expect(res.status).toBe(201)
    const { id } = await res.json()

    const obligation = await obligationFor("CampSignup", id)
    expect(Number(obligation!.amount)).toBe(240)
    expect(obligation!.payeeTenantId).toBe(tenantId)
  })

  it("a house-league signup owes the program fee", async () => {
    const hl = await prisma.houseLeague.create({
      data: {
        tenantId,
        name: world.ctx.name("Saturday League"),
        startDate: new Date(Date.now() + 20 * DAY),
        endDate: new Date(Date.now() + 80 * DAY),
        location: "Test Gym",
        fee: 175,
        ageGroups: "U12",
        daysOfWeek: "Saturday",
        startTime: "10:00",
        endTime: "12:00",
        isPublished: true,
      },
    })
    actAs(parentId)
    const res = await hlSignup(
      jsonRequest(`/api/house-leagues/${hl.id}/signup`, { playerId }) as any,
      { params: { id: hl.id } }
    )
    expect(res.status).toBe(201)
    const { id } = await res.json()

    const obligation = await obligationFor("HouseLeagueSignup", id)
    expect(Number(obligation!.amount)).toBe(175)
  })
})

describe("team submissions (B1 — club→league, league as merchant)", () => {
  it("approving a submission creates the team-fee obligation owed BY the club TO the league", async () => {
    const league = world.leagues[0]
    const season = league.seasons[0]
    const submission = season.divisions[0].submissions[0]

    actAs(league.owner.id)
    const res = await submissionPatch(
      jsonRequest(
        `/api/seasons/${season.id}/teams/${submission.submissionId}`,
        { status: "APPROVED" },
        "PATCH"
      ) as any,
      { params: { id: season.id, teamId: submission.submissionId } }
    )
    expect(res.status).toBe(200)

    const obligation = await obligationFor("TeamSubmission", submission.submissionId)
    expect(obligation).not.toBeNull()
    expect(Number(obligation!.amount)).toBe(600)
    expect(obligation!.payerUserId).toBeNull()
    expect(obligation!.payerTenantId).not.toBeNull() // the feeder club
    expect(obligation!.payeeLeagueId).toBe(league.id)
  })

  it("the league owner records the club's e-transfer; the legacy paymentStatus follows", async () => {
    const league = world.leagues[0]
    const submission = league.seasons[0].divisions[0].submissions[0]
    const obligation = await obligationFor("TeamSubmission", submission.submissionId)

    // a club owner (not the league) cannot record on a league obligation
    actAs(world.clubs[0].owner.id)
    const forbidden = await recordPayment(
      jsonRequest(`/api/obligations/${obligation!.id}/payments`, {
        amount: 600,
        method: "ETRANSFER",
      }) as any,
      { params: { id: obligation!.id } }
    )
    expect(forbidden.status).toBe(403)

    actAs(league.owner.id)
    const res = await recordPayment(
      jsonRequest(`/api/obligations/${obligation!.id}/payments`, {
        amount: 600,
        method: "ETRANSFER",
      }) as any,
      { params: { id: obligation!.id } }
    )
    expect(res.status).toBe(201)

    const after = await prisma.paymentObligation.findUnique({ where: { id: obligation!.id } })
    expect(after!.status).toBe("PAID")
    const row = await prisma.teamSubmission.findUnique({
      where: { id: submission.submissionId },
    })
    expect(row!.paymentStatus).toBe("PAID_MANUAL")
  })

  it("withdrawing an approved-but-unpaid team cancels its fee", async () => {
    const league = world.leagues[0]
    const season = league.seasons[0]
    const submission = season.divisions[0].submissions[1]

    actAs(league.owner.id)
    const approve = await submissionPatch(
      jsonRequest(
        `/api/seasons/${season.id}/teams/${submission.submissionId}`,
        { status: "APPROVED" },
        "PATCH"
      ) as any,
      { params: { id: season.id, teamId: submission.submissionId } }
    )
    expect(approve.status).toBe(200)
    expect((await obligationFor("TeamSubmission", submission.submissionId))!.status).toBe("PENDING")

    const withdraw = await submissionPatch(
      jsonRequest(
        `/api/seasons/${season.id}/teams/${submission.submissionId}`,
        { status: "WITHDRAWN" },
        "PATCH"
      ) as any,
      { params: { id: season.id, teamId: submission.submissionId } }
    )
    expect(withdraw.status).toBe(200)

    const obligation = await obligationFor("TeamSubmission", submission.submissionId)
    expect(obligation!.status).toBe("CANCELLED")
  })
})
