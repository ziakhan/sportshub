import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import { buildWorld, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { POST as CREATE } from "./route"
import { GET as GET_ONE, PATCH as RESPOND } from "./[id]/route"
import { POST as BULK } from "./bulk/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — offer package options + bulk send: one offer carries N packages
 * (Returning vs New player), the family picks at accept and the chosen
 * package fills the snapshot columns; bulk send composes once and fans
 * out, skipping ineligible signups with reasons.
 */

let world: BuiltWorld
let ownerId: string
let teamId: string
let signups: Array<{ signupId: string; parentId: string; playerId: string; playerName: string }>

const TWO_PACKAGES = [
  {
    label: "Returning Player",
    seasonFee: 950,
    installments: 2,
    practiceSessions: 20,
    includesBall: false,
    includesBag: false,
    includesShoes: false,
    includesUniform: false,
    includesTracksuit: false,
  },
  {
    label: "New Player",
    seasonFee: 1250,
    installments: 2,
    practiceSessions: 20,
    includesBall: true,
    includesBag: true,
    includesShoes: false,
    includesUniform: true,
    includesTracksuit: false,
  },
]

const expiresAt = () => new Date(Date.now() + 7 * 86_400_000).toISOString()

const createOffer = (playerId: string, signupId: string) =>
  CREATE(
    jsonRequest("/api/offers", {
      teamId,
      playerId,
      tryoutSignupId: signupId,
      options: TWO_PACKAGES,
      expiresAt: expiresAt(),
    }),
    {} as any
  )

const respond = (offerId: string, body: unknown) =>
  RESPOND(jsonRequest(`/api/offers/${offerId}`, body, "PATCH"), { params: { id: offerId } })

beforeAll(async () => {
  world = await buildWorld({
    seed: 1124,
    clubs: [{ teams: [{}], tryouts: [{ capacity: 20, signups: 6, published: true }] }],
  })
  const club = world.clubs[0]
  ownerId = club.owner.id
  teamId = club.teams[0].id
  signups = club.tryouts[0].signups.map((s) => ({
    signupId: s.signupId,
    parentId: s.parent.id,
    playerId: s.player.id,
    playerName: `${s.player.firstName} ${s.player.lastName}`,
  }))
  // signup[5] is the cancelled case for bulk
  await prisma.tryoutSignup.update({
    where: { id: signups[5].signupId },
    data: { status: "CANCELLED" },
  })
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("offer package options (integration)", () => {
  let offerId: string
  let returningOptionId: string
  let newPlayerOptionId: string

  it("club owner sends a two-package offer; snapshot shows the first package", async () => {
    actAs(ownerId)
    const res = await createOffer(signups[0].playerId, signups[0].signupId)
    expect(res.status).toBe(201)
    offerId = (await res.json()).id

    const row = await (prisma as any).offer.findUnique({
      where: { id: offerId },
      include: { options: { orderBy: { sortOrder: "asc" } } },
    })
    expect(row.options).toHaveLength(2)
    expect(Number(row.seasonFee)).toBe(950) // first package = pending display
    expect(row.includesUniform).toBe(false)
    returningOptionId = row.options[0].id
    newPlayerOptionId = row.options[1].id
  })

  it("the family sees both packages on the offer", async () => {
    actAs(signups[0].parentId)
    const res = await GET_ONE(jsonRequest(`/api/offers/${offerId}`, undefined, "GET"), {
      params: { id: offerId },
    })
    expect(res.status).toBe(200)
    const offer = await res.json()
    expect(offer.options.map((o: any) => o.label)).toEqual(["Returning Player", "New Player"])
    expect(offer.options[1].seasonFee).toBe(1250)
  })

  it("accepting without choosing a package is rejected", async () => {
    actAs(signups[0].parentId)
    const res = await respond(offerId, { action: "accept", jerseyPref1: 7 })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain("package")
  })

  it("accepting the returning package needs no uniform size; snapshot becomes the choice", async () => {
    actAs(signups[0].parentId)
    const res = await respond(offerId, {
      action: "accept",
      optionId: returningOptionId,
      jerseyPref1: 7,
    })
    expect(res.status).toBe(200)

    const row = await (prisma as any).offer.findUnique({ where: { id: offerId } })
    expect(row.status).toBe("ACCEPTED")
    expect(row.chosenOptionId).toBe(returningOptionId)
    expect(Number(row.seasonFee)).toBe(950)
    expect(row.includesUniform).toBe(false)

    const rostered = await prisma.teamPlayer.findFirst({
      where: { teamId, playerId: signups[0].playerId, status: "ACTIVE" },
    })
    expect(rostered).toBeTruthy()
  })

  it("the new-player package enforces its own gear sizes", async () => {
    actAs(ownerId)
    const created = await createOffer(signups[1].playerId, signups[1].signupId)
    const secondOfferId = (await created.json()).id
    const options = await (prisma as any).offerOption.findMany({
      where: { offerId: secondOfferId },
      orderBy: { sortOrder: "asc" },
    })

    actAs(signups[1].parentId)
    // New Player includes a uniform — size required
    const missing = await respond(secondOfferId, {
      action: "accept",
      optionId: options[1].id,
      jerseyPref1: 12,
    })
    expect(missing.status).toBe(400)

    const ok = await respond(secondOfferId, {
      action: "accept",
      optionId: options[1].id,
      uniformSize: "YM",
      jerseyPref1: 12,
    })
    expect(ok.status).toBe(200)
    const row = await (prisma as any).offer.findUnique({ where: { id: secondOfferId } })
    expect(Number(row.seasonFee)).toBe(1250)
    expect(row.includesUniform).toBe(true)
  })

  it("bulk send: compose once, fan out, skip the ineligible with reasons", async () => {
    actAs(ownerId)
    const res = await BULK(
      jsonRequest("/api/offers/bulk", {
        teamId,
        // [0] already accepted (not PENDING, so a new offer IS allowed);
        // [2],[3],[4] fresh; [5] cancelled
        signupIds: [2, 3, 4, 5].map((i) => signups[i].signupId),
        options: TWO_PACKAGES,
        message: "Great tryout — pick the package that fits.",
        expiresAt: expiresAt(),
      }),
      {} as any
    )
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.sent).toBe(3)
    expect(data.skipped).toHaveLength(1)
    expect(data.skipped[0].reason).toContain("cancelled")

    // Each recipient got their own offer carrying both packages
    const bulkOffers = await (prisma as any).offer.findMany({
      where: { playerId: { in: [2, 3, 4].map((i) => signups[i].playerId) } },
      include: { options: true },
    })
    expect(bulkOffers).toHaveLength(3)
    for (const offer of bulkOffers) {
      expect(offer.options).toHaveLength(2)
      expect(offer.message).toContain("Great tryout")
    }
  })

  it("bulk re-send skips players who already have a pending offer", async () => {
    actAs(ownerId)
    const res = await BULK(
      jsonRequest("/api/offers/bulk", {
        teamId,
        signupIds: [signups[2].signupId],
        options: TWO_PACKAGES,
        expiresAt: expiresAt(),
      }),
      {} as any
    )
    const data = await res.json()
    expect(data.sent).toBe(0)
    expect(data.skipped[0].reason).toContain("pending offer")
  })

  it("parents cannot bulk-send offers", async () => {
    actAs(signups[0].parentId)
    const res = await BULK(
      jsonRequest("/api/offers/bulk", {
        teamId,
        signupIds: [signups[3].signupId],
        options: TWO_PACKAGES,
        expiresAt: expiresAt(),
      }),
      {} as any
    )
    expect(res.status).toBe(403)
  })
})
