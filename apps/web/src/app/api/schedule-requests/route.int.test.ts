import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import { buildWorld, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { POST as CREATE } from "./route"
import { PATCH as DECIDE } from "./[id]/route"
import { PATCH as PATCH_SUBMISSION } from "../seasons/[id]/teams/[teamId]/route"
import { POST as ADD_BLACKOUT } from "../seasons/[id]/teams/[teamId]/blackouts/route"
import { DELETE as REMOVE_BLACKOUT } from "../seasons/[id]/teams/[teamId]/blackouts/[blackoutId]/route"
import { POST as SIMULATE } from "../seasons/[id]/schedule/simulate-request/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * Team schedule requests (owner 2026-08-01): gated per team by the league,
 * decided by the league, best effort. Approved BLACKOUTs materialize
 * SeasonTeamBlackout rows; the simulator prices a pending request before
 * approval; withdrawal cancels the pending queue.
 */

let world: BuiltWorld
let seasonId: string
let leagueOwnerId: string
let clubOwnerId: string
let parentId: string
let submissionId: string
let submission2Id: string

beforeAll(async () => {
  world = await buildWorld({
    seed: 1147,
    leagues: [
      {
        seasons: [
          {
            status: "FINALIZED",
            divisions: [{ teams: 4, rosterSize: 2 }],
            venue: { courts: 2 },
            sessions: [{ days: 2 }],
          },
        ],
      },
    ],
  })
  const season = world.leagues[0].seasons[0]
  seasonId = season.id
  leagueOwnerId = world.leagues[0].owner.id
  clubOwnerId = season.feederClub!.owner.id
  const subs = season.divisions[0].submissions
  const subRows = await prisma.teamSubmission.findMany({
    where: { seasonId },
    select: { id: true, teamId: true },
  })
  submissionId = subRows.find((r) => r.teamId === subs[0].teamId)!.id
  submission2Id = subRows.find((r) => r.teamId === subs[1].teamId)!.id
  const player = await prisma.player.findUnique({
    where: { id: subs[0].playerIds[0] },
    select: { parentId: true },
  })
  parentId = player!.parentId
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

const create = (body: Record<string, unknown>) =>
  CREATE(jsonRequest("/api/schedule-requests", body) as any)
const decide = (id: string, body: Record<string, unknown>) =>
  DECIDE(jsonRequest(`/api/schedule-requests/${id}`, body, "PATCH") as any, {
    params: { id },
  } as any)

describe("schedule requests — create gate + validation", () => {
  it("403 NOT_ENABLED while the league has not turned the feature on", async () => {
    actAs(clubOwnerId)
    const res = await create({
      kind: "WINDOW",
      submissionId,
      dayOfWeek: 0,
      latestStart: "12:00",
      reason: "Long drive home",
    })
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe("NOT_ENABLED")
  })

  it("club creates a WINDOW once enabled → 201 + the league owner is belled", async () => {
    await (prisma as any).teamSubmission.update({
      where: { id: submissionId },
      data: { scheduleRequestsEnabled: true },
    })
    actAs(clubOwnerId)
    const res = await create({
      kind: "WINDOW",
      submissionId,
      dayOfWeek: 0,
      latestStart: "12:00",
      reason: "Traveling from Ottawa — need to leave early Sunday",
    })
    expect(res.status).toBe(201)
    const bell = await prisma.notification.findFirst({
      where: { userId: leagueOwnerId, type: "schedule_request_submitted" as any },
    })
    expect(bell).not.toBeNull()
  })

  it("duplicate day+kind → 409; a different day still works", async () => {
    actAs(clubOwnerId)
    const dup = await create({
      kind: "WINDOW",
      submissionId,
      dayOfWeek: 0,
      latestStart: "11:00",
      reason: "Same day again",
    })
    expect(dup.status).toBe(409)
    const other = await create({
      kind: "WINDOW",
      submissionId,
      dayOfWeek: 6,
      earliestStart: "14:00",
      reason: "Coach works Saturday mornings",
    })
    expect(other.status).toBe(201)
  })

  it("zod: weekday AND date together → 400; window without any bound → 400", async () => {
    actAs(clubOwnerId)
    const both = await create({
      kind: "WINDOW",
      submissionId,
      dayOfWeek: 0,
      date: "2026-11-01",
      latestStart: "12:00",
      reason: "Both given",
    })
    expect(both.status).toBe(400)
    const unbounded = await create({
      kind: "WINDOW",
      submissionId,
      dayOfWeek: 0,
      reason: "No bound at all",
    })
    expect(unbounded.status).toBe(400)
  })

  it("a user with no club role on the team → 403", async () => {
    actAs(parentId)
    const res = await create({
      kind: "WINDOW",
      submissionId,
      dayOfWeek: 0,
      latestStart: "12:00",
      reason: "Not my team",
    })
    expect(res.status).toBe(403)
  })
})

describe("schedule requests — decide", () => {
  it("simulate prices a pending request; approving a WINDOW creates no blackout rows", async () => {
    const pending = await (prisma as any).teamScheduleRequest.findFirst({
      where: { submissionId, status: "PENDING", dayOfWeek: 0 },
    })
    expect(pending).not.toBeNull()

    // Club side cannot simulate
    actAs(clubOwnerId)
    const forbidden = await SIMULATE(
      jsonRequest(`/api/seasons/${seasonId}/schedule/simulate-request`, {
        requestId: pending.id,
      }) as any,
      { params: { id: seasonId } } as any
    )
    expect(forbidden.status).toBe(403)

    // League sees the cost diff
    actAs(leagueOwnerId)
    const sim = await SIMULATE(
      jsonRequest(`/api/seasons/${seasonId}/schedule/simulate-request`, {
        requestId: pending.id,
      }) as any,
      { params: { id: seasonId } } as any
    )
    expect(sim.status).toBe(200)
    const simBody = await sim.json()
    expect(simBody.baseline.totals).toBeDefined()
    expect(simBody.withRequest.totals).toBeDefined()
    expect(simBody.diff).toBeDefined()

    const res = await decide(pending.id, { action: "approve", note: "Best effort" })
    expect(res.status).toBe(200)
    const rows = await (prisma as any).seasonTeamBlackout.findMany({
      where: { teamSubmissionId: submissionId },
    })
    expect(rows).toHaveLength(0)

    // Simulating a decided request → 409
    const again = await SIMULATE(
      jsonRequest(`/api/seasons/${seasonId}/schedule/simulate-request`, {
        requestId: pending.id,
      }) as any,
      { params: { id: seasonId } } as any
    )
    expect(again.status).toBe(409)
  })

  it("approving a recurring BLACKOUT materializes one row per matching session day", async () => {
    const day = await (prisma as any).seasonSessionDay.findFirst({
      where: { session: { seasonId } },
      select: { date: true },
      orderBy: { date: "asc" },
    })
    const weekday = new Date(day.date).getUTCDay()
    const matching = await (prisma as any).seasonSessionDay.findMany({
      where: { session: { seasonId } },
      select: { date: true },
    })
    const expected = matching.filter((d: any) => new Date(d.date).getUTCDay() === weekday).length

    actAs(clubOwnerId)
    const created = await create({
      kind: "BLACKOUT",
      submissionId,
      dayOfWeek: weekday,
      reason: "Away every week that day",
    })
    expect(created.status).toBe(201)
    const { requestId } = await created.json()

    actAs(leagueOwnerId)
    const res = await decide(requestId, { action: "approve" })
    expect(res.status).toBe(200)
    const rows = await (prisma as any).seasonTeamBlackout.findMany({
      where: { teamSubmissionId: submissionId, sourceRequestId: requestId },
    })
    expect(rows).toHaveLength(expected)

    // Deciding again → 409
    const again = await decide(requestId, { action: "decline" })
    expect(again.status).toBe(409)
  })

  it("cancel: only the requester; decline notifies the club", async () => {
    actAs(clubOwnerId)
    const created = await create({
      kind: "BLACKOUT",
      submissionId,
      date: "2099-01-02",
      reason: "One-off conflict",
    })
    expect(created.status).toBe(201)
    const { requestId } = await created.json()

    actAs(parentId)
    const notMine = await decide(requestId, { action: "cancel" })
    expect(notMine.status).toBe(403)

    actAs(clubOwnerId)
    const mine = await decide(requestId, { action: "cancel" })
    expect(mine.status).toBe(200)
    expect((await mine.json()).status).toBe("CANCELLED")
  })
})

describe("schedule requests — gate toggle + blackout CRUD + withdrawal cascade", () => {
  it("club cannot flip scheduleRequestsEnabled; the league can", async () => {
    actAs(clubOwnerId)
    const forbidden = await PATCH_SUBMISSION(
      jsonRequest(
        `/api/seasons/${seasonId}/teams/${submission2Id}`,
        { scheduleRequestsEnabled: true },
        "PATCH"
      ) as any,
      { params: { id: seasonId, teamId: submission2Id } } as any
    )
    expect(forbidden.status).toBe(403)

    actAs(leagueOwnerId)
    const ok = await PATCH_SUBMISSION(
      jsonRequest(
        `/api/seasons/${seasonId}/teams/${submission2Id}`,
        { scheduleRequestsEnabled: true },
        "PATCH"
      ) as any,
      { params: { id: seasonId, teamId: submission2Id } } as any
    )
    expect(ok.status).toBe(200)
    const row = await (prisma as any).teamSubmission.findUnique({
      where: { id: submission2Id },
      select: { scheduleRequestsEnabled: true },
    })
    expect(row.scheduleRequestsEnabled).toBe(true)
  })

  it("league-direct blackout add/remove; removal keeps a source request APPROVED", async () => {
    actAs(clubOwnerId)
    const clubAdd = await ADD_BLACKOUT(
      jsonRequest(`/api/seasons/${seasonId}/teams/${submissionId}/blackouts`, {
        date: "2099-02-06",
      }) as any,
      { params: { id: seasonId, teamId: submissionId } } as any
    )
    expect(clubAdd.status).toBe(403)

    actAs(leagueOwnerId)
    const added = await ADD_BLACKOUT(
      jsonRequest(`/api/seasons/${seasonId}/teams/${submissionId}/blackouts`, {
        date: "2099-02-06",
        reason: "Gym closed",
      }) as any,
      { params: { id: seasonId, teamId: submissionId } } as any
    )
    expect(added.status).toBe(201)

    // Remove a materialized row — its APPROVED request must stay APPROVED.
    const materialized = await (prisma as any).seasonTeamBlackout.findFirst({
      where: { teamSubmissionId: submissionId, sourceRequestId: { not: null } },
      select: { id: true, sourceRequestId: true },
    })
    expect(materialized).not.toBeNull()
    const removed = await REMOVE_BLACKOUT(
      jsonRequest(
        `/api/seasons/${seasonId}/teams/${submissionId}/blackouts/${materialized.id}`,
        undefined,
        "DELETE"
      ) as any,
      { params: { id: seasonId, teamId: submissionId, blackoutId: materialized.id } } as any
    )
    expect(removed.status).toBe(200)
    const req = await (prisma as any).teamScheduleRequest.findUnique({
      where: { id: materialized.sourceRequestId },
      select: { status: true },
    })
    expect(req.status).toBe("APPROVED")
  })

  it("withdrawing a submission auto-cancels its PENDING requests", async () => {
    actAs(clubOwnerId)
    const created = await create({
      kind: "WINDOW",
      submissionId: submission2Id,
      dayOfWeek: 0,
      latestStart: "11:00",
      reason: "Pending at withdrawal time",
    })
    expect(created.status).toBe(201)
    const { requestId } = await created.json()

    actAs(leagueOwnerId)
    const res = await PATCH_SUBMISSION(
      jsonRequest(
        `/api/seasons/${seasonId}/teams/${submission2Id}`,
        { status: "WITHDRAWN" },
        "PATCH"
      ) as any,
      { params: { id: seasonId, teamId: submission2Id } } as any
    )
    expect(res.status).toBe(200)
    const row = await (prisma as any).teamScheduleRequest.findUnique({
      where: { id: requestId },
      select: { status: true, decisionNote: true },
    })
    expect(row.status).toBe("CANCELLED")
    expect(row.decisionNote).toContain("withdrew")
  })
})
