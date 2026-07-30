import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import { buildWorld, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { GET as seasonGET } from "./route"
import { PATCH as approvePATCH } from "./teams/[teamId]/route"
import { loadSchedulerInput } from "@/lib/scheduler/load"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — Phase A org season defaults: a season with NULL policy fields
 * inherits the Organization's rulebook everywhere it matters — the season
 * read (with provenance), the approval-time fee obligation, and the
 * scheduler input. Season overrides win.
 */

let world: BuiltWorld
let ownerId: string
let seasonId: string
let submissionId: string
let startDate: Date
let orgId: string

const ORG_DEFAULTS = {
  teamFee: 1000,
  depositPct: 25,
  balanceDueDaysBeforeStart: 21,
  gamesGuaranteed: 6,
  gameSlotMinutes: 75,
  tiebreakerOrder: ["WINS"],
  allowGuestPlayers: false,
}

beforeAll(async () => {
  world = await buildWorld({
    seed: 1137,
    leagues: [{ seasons: [{ status: "REGISTRATION", divisions: [{ teams: 1 }] }] }],
  })
  const league = world.leagues[0]
  ownerId = league.owner.id
  const season = league.seasons[0]
  seasonId = season.id
  submissionId = season.divisions[0].submissions[0].submissionId

  // Upsert: the org lives OUTSIDE the world builder, so a crashed prior run
  // may have left the row behind (slug is unique). afterAll deletes it.
  const org = await (prisma as any).organization.upsert({
    where: { slug: "test-rulebook-org-1137" },
    create: {
      name: "Test Rulebook Org",
      slug: "test-rulebook-org-1137",
      seasonDefaults: ORG_DEFAULTS,
    },
    update: { seasonDefaults: ORG_DEFAULTS },
  })
  orgId = org.id
  await (prisma as any).league.update({
    where: { id: league.id },
    data: { organizationId: org.id },
  })
  // The builder writes explicit values everywhere — clear them so the season
  // genuinely inherits, and give it a start date for balance-due math.
  startDate = new Date(Date.now() + 30 * 86400_000)
  await (prisma as any).season.update({
    where: { id: seasonId },
    data: {
      teamFee: null,
      gamesGuaranteed: null,
      gameSlotMinutes: null,
      gameLengthMinutes: null,
      depositPct: null,
      balanceDueDaysBeforeStart: null,
      allowGuestPlayers: null,
      tiebreakerOrder: [],
      startDate,
    },
  })
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
  if (orgId) await (prisma as any).organization.delete({ where: { id: orgId } }).catch(() => {})
})

describe("org season defaults (integration)", () => {
  it("season GET resolves org values with provenance; season override wins", async () => {
    actAs(ownerId)
    let res = await seasonGET(jsonRequest(`/api/seasons/${seasonId}`, undefined, "GET"), {
      params: { id: seasonId },
    })
    expect(res.status).toBe(200)
    let body = await res.json()
    expect(body.gamesGuaranteed).toBe(6)
    expect(body.teamFee).toBe(1000)
    expect(body.gameSlotMinutes).toBe(75)
    expect(body.allowGuestPlayers).toBe(false)
    expect(body.tiebreakerOrder).toEqual(["WINS"])
    expect(body.configSources.gamesGuaranteed).toBe("org")
    expect(body.configSources.gameLengthMinutes).toBe("system")

    // Override one field at the season → that field flips to "season"
    await (prisma as any).season.update({
      where: { id: seasonId },
      data: { depositPct: 40 },
    })
    res = await seasonGET(jsonRequest(`/api/seasons/${seasonId}`, undefined, "GET"), {
      params: { id: seasonId },
    })
    body = await res.json()
    expect(body.depositPct).toBe(40)
    expect(body.configSources.depositPct).toBe("season")
    expect(body.configSources.teamFee).toBe("org")
    await (prisma as any).season.update({
      where: { id: seasonId },
      data: { depositPct: null },
    })
  })

  it("approval creates the fee obligation from the org rulebook", async () => {
    await prisma.teamSubmission.update({
      where: { id: submissionId },
      data: { status: "PENDING" },
    })
    actAs(ownerId)
    const res = await approvePATCH(
      jsonRequest(`/api/seasons/${seasonId}/teams/${submissionId}`, { status: "APPROVED" }, "PATCH"),
      { params: { id: seasonId, teamId: submissionId } }
    )
    expect(res.status).toBe(200)

    const obligation = await (prisma as any).paymentObligation.findFirst({
      where: { referenceType: "TeamSubmission", referenceId: submissionId },
    })
    expect(obligation).toBeTruthy()
    expect(Number(obligation.amount)).toBe(1000)
    // dueDate = startDate − 21 days (org balanceDueDaysBeforeStart)
    const expectedDue = new Date(startDate.getTime() - 21 * 86400_000)
    expect(Math.abs(new Date(obligation.dueDate).getTime() - expectedDue.getTime())).toBeLessThan(
      1000
    )
    expect(obligation.description).toContain("25% deposit")
  })

  it("the scheduler runs on effective config", async () => {
    const { input, errors } = await loadSchedulerInput(seasonId)
    expect(errors).toEqual([])
    expect(input).toBeTruthy()
    expect(input!.gamesGuaranteed).toBe(6)
    expect(input!.gameSlotMinutes).toBe(75)
  })
})
