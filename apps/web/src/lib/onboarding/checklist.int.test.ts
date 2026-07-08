import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import {
  buildWorld,
  createClub,
  createLeague,
  createParentWithChildren,
  createReferee,
  createTryout,
  createUser,
  destroyWorld,
  type BuiltWorld,
} from "@youthbasketballhub/test-worlds"
import { getCompletionChecklist, type ChecklistStep } from "./checklist"

/**
 * L2 — the onboarding completion checklist is DATA-DRIVEN: every step's done
 * flag is derived from real records, and there is no tour state to mock. So we
 * build actual worlds (a parent+child, a club with a team+coach, a referee, a
 * bare and a fully-set-up league) and assert the derived percent/steps/hrefs.
 */

const SEED = 1131
let world: BuiltWorld

function step(steps: ChecklistStep[], key: string): ChecklistStep {
  const s = steps.find((x) => x.key === key)
  if (!s) throw new Error(`step ${key} not found in [${steps.map((x) => x.key).join(", ")}]`)
  return s
}

async function checklistFor(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { roles: { include: { tenant: true, team: true, league: true } } },
  })
  return getCompletionChecklist(user as any)
}

beforeAll(async () => {
  // buildWorld gives us a namespaced, self-cleaning ctx; we then use the
  // builders directly for the specific personas each assertion needs.
  world = await buildWorld({ seed: SEED })
}, 120_000)

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("getCompletionChecklist — parent journey", () => {
  it("checks 'add a child' from a real Player and leaves profile/register open", async () => {
    const { parent } = await createParentWithChildren(world.ctx, { children: [{ age: 12 }] })
    const c = await checklistFor(parent.id)

    const keys = c.steps.map((s) => s.key)
    expect(keys).toEqual(["profile", "family-child", "family-register"])

    expect(step(c.steps, "family-child").done).toBe(true) // has a child
    expect(step(c.steps, "profile").done).toBe(false) // builder sets no phone/city
    expect(step(c.steps, "family-register").optional).toBe(true)
    expect(step(c.steps, "family-register").done).toBe(false)

    // Required = profile + add-child; one done → 50%, not complete.
    expect(c.requiredTotal).toBe(2)
    expect(c.requiredDone).toBe(1)
    expect(c.percent).toBe(50)
    expect(c.complete).toBe(false)
    expect(c.applicable).toBe(true)
    expect(c.nextStep?.key).toBe("profile")
  })
})

describe("getCompletionChecklist — club owner journey", () => {
  it("derives brand/team/staff/tryout from records and deep-links to the tenant", async () => {
    const club = await createClub(world.ctx, { teams: [{ headCoach: true }] })
    const c = await checklistFor(club.owner.id)

    const clubKeys = c.steps.filter((s) => s.group === "Your club").map((s) => s.key)
    expect(clubKeys).toEqual([
      "club-brand",
      "club-team",
      "club-staff",
      "club-tryout",
      "club-roster",
      "club-payments",
    ])

    expect(step(c.steps, "club-team").done).toBe(true) // team exists
    expect(step(c.steps, "club-staff").done).toBe(true) // head coach → Staff role
    expect(step(c.steps, "club-brand").done).toBe(false) // default seeded branding
    expect(step(c.steps, "club-tryout").done).toBe(false)

    // Optional steps are excluded from percent — staff being done doesn't count.
    expect(step(c.steps, "club-staff").optional).toBe(true)
    expect(step(c.steps, "club-roster").optional).toBe(true)
    expect(step(c.steps, "club-payments").optional).toBe(true)

    // Required = profile + brand + team + tryout; only team done → 25%.
    expect(c.requiredTotal).toBe(4)
    expect(c.requiredDone).toBe(1)
    expect(c.percent).toBe(25)

    expect(step(c.steps, "club-team").href).toBe(`/clubs/${club.tenantId}/teams/create`)
    expect(step(c.steps, "club-brand").href).toBe(`/clubs/${club.tenantId}/settings`)
  })

  it("reaches 100% once profile, branding, and a tryout all exist", async () => {
    const club = await createClub(world.ctx, { teams: [{ headCoach: false }] })
    await prisma.user.update({
      where: { id: club.owner.id },
      data: { phoneNumber: "4165551234", city: "Toronto" },
    })
    await prisma.tenantBranding.update({
      where: { tenantId: club.tenantId },
      data: { logoUrl: "https://example.test/logo.png" },
    })
    await createTryout(world.ctx, { tenantId: club.tenantId, teamId: club.teams[0].id })

    const c = await checklistFor(club.owner.id)
    expect(c.requiredDone).toBe(c.requiredTotal)
    expect(c.percent).toBe(100)
    expect(c.complete).toBe(true)
  })
})

describe("getCompletionChecklist — referee journey", () => {
  it("checks the profile from RefereeProfile and availability from a real window", async () => {
    const referee = await createReferee(world.ctx)
    const before = await checklistFor(referee.id)
    expect(step(before.steps, "referee-profile").done).toBe(true)
    expect(step(before.steps, "referee-availability").done).toBe(false)
    expect(step(before.steps, "referee-availability").href).toBe("/referee/requests")

    await prisma.refereeAvailability.create({
      data: { userId: referee.id, date: new Date(), startTime: "09:00", endTime: "12:00" },
    })
    const after = await checklistFor(referee.id)
    expect(step(after.steps, "referee-availability").done).toBe(true)
  })
})

describe("getCompletionChecklist — league owner journey", () => {
  it("checks create-league but leaves season/divisions open for a bare league", async () => {
    const league = await createLeague(world.ctx, {})
    const c = await checklistFor(league.owner.id)

    expect(step(c.steps, "league-create").done).toBe(true)
    expect(step(c.steps, "league-season").done).toBe(false)
    expect(step(c.steps, "league-divisions").done).toBe(false)
    expect(step(c.steps, "league-season").href).toBe(`/manage/leagues/${league.id}/seasons`)
  })

  it("checks season + divisions once a season with a division exists", async () => {
    const league = await createLeague(world.ctx, { seasons: [{ divisions: [{ teams: 0 }] }] })
    const c = await checklistFor(league.owner.id)

    expect(step(c.steps, "league-season").done).toBe(true)
    expect(step(c.steps, "league-divisions").done).toBe(true)
    expect(step(c.steps, "league-divisions").href).toContain(
      `/manage/leagues/${league.id}/seasons/`
    )
  })
})

describe("getCompletionChecklist — edge cases", () => {
  it("returns a non-applicable, complete checklist for platform admins", async () => {
    const admin = await createUser(world.ctx, { roles: [{ role: "PlatformAdmin" }] })
    const c = await checklistFor(admin.id)
    expect(c.applicable).toBe(false)
    expect(c.complete).toBe(true)
    expect(c.steps).toHaveLength(0)
  })

  it("shows one profile step across multiple role journeys", async () => {
    const dual = await createUser(world.ctx, {})
    await createClub(world.ctx, { owner: dual, teams: [] })
    await prisma.userRole.create({ data: { userId: dual.id, role: "Parent" } })

    const c = await checklistFor(dual.id)
    expect(c.steps.filter((s) => s.key === "profile")).toHaveLength(1)
    expect(c.steps.some((s) => s.group === "Your club")).toBe(true)
    expect(c.steps.some((s) => s.group === "Your family")).toBe(true)
  })
})
