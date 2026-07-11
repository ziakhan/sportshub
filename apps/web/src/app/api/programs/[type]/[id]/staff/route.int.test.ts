import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import { buildWorld, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { DELETE as STAFF_DELETE, GET as STAFF_GET, POST as STAFF_POST } from "./route"
import { PATCH as CAMP_PATCH } from "../../../../camps/[id]/route"
import { POST as CAMPS_CREATE } from "../../../../camps/route"
import { POST as HL_CREATE } from "../../../../house-leagues/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — program staff (docs/roadmap/program-staff-plan.md): club admins
 * assign a LEAD/ASSISTANT to camps & house leagues; assignment grants
 * manage-lite (description/schedule PATCH) but never pricing/publish; and
 * the 2026-07-11 gate fix — coaches (Staff) can no longer CREATE programs.
 */

let world: BuiltWorld
let tenantId: string
let ownerId: string
let coachId: string // Staff role — assignable, but not an admin
let outsiderId: string
let campId: string

const staffUrl = (id: string) => `/api/programs/camp/${id}/staff`
const listStaff = (id = campId) =>
  STAFF_GET(jsonRequest(staffUrl(id), undefined, "GET"), { params: { type: "camp", id } })
const assign = (userId: string, designation?: string, id = campId) =>
  STAFF_POST(jsonRequest(staffUrl(id), { userId, designation }), {
    params: { type: "camp", id },
  })
const remove = (userId: string, id = campId) =>
  STAFF_DELETE(jsonRequest(staffUrl(id), { userId }, "DELETE"), {
    params: { type: "camp", id },
  })
const patchCamp = (body: unknown, id = campId) =>
  CAMP_PATCH(jsonRequest(`/api/camps/${id}`, body, "PATCH"), { params: { id } })

beforeAll(async () => {
  world = await buildWorld({
    seed: 1127,
    clubs: [{ teams: [{ headCoach: true }] }],
  })
  const club = world.clubs[0]
  tenantId = club.tenantId
  ownerId = club.owner.id
  coachId = club.teams[0].headCoach!.id
  const other = await buildOutsider()
  outsiderId = other

  const camp = await (prisma as any).camp.create({
    data: {
      tenantId,
      name: "Summer Shooting Camp",
      campType: "SUMMER",
      ageGroup: "U12",
      startDate: new Date(Date.now() + 30 * 86_400_000),
      endDate: new Date(Date.now() + 37 * 86_400_000),
      dailyStartTime: "09:00",
      dailyEndTime: "15:00",
      location: "Main Gym",
      weeklyFee: 250,
    },
  })
  campId = camp.id
})

async function buildOutsider(): Promise<string> {
  // A parent from another world-context — no roles at this club
  const user = await prisma.user.findFirst({
    where: { email: { startsWith: "parent" }, roles: { none: { tenantId } } },
    select: { id: true },
  })
  if (user) return user.id
  const created = await prisma.user.create({
    data: {
      email: `outsider-1127@w1127.world`,
      firstName: "Out",
      lastName: "Sider",
      passwordHash: "x",
    },
  })
  return created.id
}

afterAll(async () => {
  await (prisma as any).programStaff.deleteMany({ where: { programId: campId } })
  await (prisma as any).camp.deleteMany({ where: { id: campId } })
  await prisma.user.deleteMany({ where: { email: "outsider-1127@w1127.world" } })
  if (world) await destroyWorld(world.ctx)
})

describe("program staff (integration)", () => {
  it("coaches can no longer create camps or house leagues (2026-07-11 gate)", async () => {
    actAs(coachId)
    const campRes = await CAMPS_CREATE(
      jsonRequest("/api/camps", {
        tenantId,
        name: "Rogue Camp",
        campType: "SUMMER",
        ageGroup: "U12",
        startDate: new Date(Date.now() + 10 * 86_400_000).toISOString(),
        endDate: new Date(Date.now() + 17 * 86_400_000).toISOString(),
        dailyStartTime: "09:00",
        dailyEndTime: "15:00",
        location: "Gym",
        weeklyFee: 100,
      })
    )
    expect(campRes.status).toBe(403)

    const hlRes = await HL_CREATE(
      jsonRequest("/api/house-leagues", {
        tenantId,
        name: "Rogue HL",
        ageGroups: "U10,U12",
        startDate: new Date(Date.now() + 10 * 86_400_000).toISOString(),
        endDate: new Date(Date.now() + 80 * 86_400_000).toISOString(),
        daysOfWeek: "Saturday",
        startTime: "10:00",
        endTime: "12:00",
        location: "Gym",
        fee: 150,
      })
    )
    expect(hlRes.status).toBe(403)
  })

  it("club admin assigns a lead; assignee gets a bell; upsert re-designates", async () => {
    actAs(ownerId)
    const res = await assign(coachId, "LEAD")
    expect(res.status).toBe(201)
    expect((await res.json()).assignment.designation).toBe("LEAD")

    const bells = await prisma.notification.count({
      where: { userId: coachId, type: "program_assigned", referenceId: `CAMP:${campId}` },
    })
    expect(bells).toBe(1)

    const redo = await assign(coachId, "ASSISTANT")
    expect(redo.status).toBe(201)
    const list = await (await listStaff()).json()
    expect(list.staff).toHaveLength(1)
    expect(list.staff[0].designation).toBe("ASSISTANT")
    expect(list.canManage).toBe(true)
  })

  it("only club admins assign/remove; only admins+assigned read the list", async () => {
    actAs(coachId) // assigned, but not admin
    expect((await assign(coachId, "LEAD")).status).toBe(403)
    expect((await remove(coachId)).status).toBe(403)
    const read = await listStaff()
    expect(read.status).toBe(200) // assigned staff may read
    expect((await read.json()).canManage).toBe(false)

    actAs(outsiderId)
    expect((await listStaff()).status).toBe(403)
    expect((await assign(outsiderId)).status).toBe(403)
    actAs(null)
    expect((await listStaff()).status).toBe(401)
  })

  it("cannot assign someone who isn't club staff", async () => {
    actAs(ownerId)
    const res = await assign(outsiderId)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain("staff")
  })

  it("assigned staff get manage-lite PATCH: schedule yes, pricing/publish no", async () => {
    actAs(coachId)
    const ok = await patchCamp({ description: "Now with film sessions", dailyEndTime: "16:00" })
    expect(ok.status).toBe(200)

    const priced = await patchCamp({ weeklyFee: 999 })
    expect(priced.status).toBe(403)
    expect((await priced.json()).error).toContain("weeklyFee")
    const published = await patchCamp({ isPublished: true })
    expect(published.status).toBe(403)

    const row = await (prisma as any).camp.findUnique({
      where: { id: campId },
      select: { description: true, dailyEndTime: true, weeklyFee: true, isPublished: true },
    })
    expect(row.description).toBe("Now with film sessions")
    expect(row.dailyEndTime).toBe("16:00")
    expect(Number(row.weeklyFee)).toBe(250)
    expect(row.isPublished).toBe(false)
  })

  it("unassigned staff cannot PATCH at all; admins still edit everything", async () => {
    actAs(ownerId)
    await remove(coachId)

    actAs(coachId)
    expect((await patchCamp({ description: "sneaky" })).status).toBe(403)

    actAs(ownerId)
    const res = await patchCamp({ weeklyFee: 275, isPublished: true })
    expect(res.status).toBe(200)
  })

  it("unknown program type or id 400/404s", async () => {
    actAs(ownerId)
    const bad = await STAFF_GET(
      jsonRequest("/api/programs/banquet/x/staff", undefined, "GET"),
      { params: { type: "banquet", id: "x" } }
    )
    expect(bad.status).toBe(400)
    const missing = await STAFF_GET(
      jsonRequest("/api/programs/camp/nope/staff", undefined, "GET"),
      { params: { type: "camp", id: "nope" } }
    )
    expect(missing.status).toBe(404)
  })
})
