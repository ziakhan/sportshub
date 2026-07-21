import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import {
  buildWorld,
  destroyWorld,
  createClub,
  submitTeamToSeason,
  type BuiltWorld,
} from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { mintWaiverSignRequest } from "@/lib/waivers/tokens"
import { POST as signPOST } from "./sign/route"
import { GET as waiversGET, POST as waiversPOST } from "../leagues/[id]/waivers/route"
import { PATCH as waiverPATCH } from "../leagues/[id]/waivers/[waiverId]/route"
import { PATCH as submissionPATCH } from "../seasons/[id]/teams/[teamId]/route"
import { GET as statusGET, POST as statusPOST } from "../seasons/[id]/waiver-status/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

// Real everything except SMTP: the waiver email is a spy so approval tests
// count sends without a mail server.
vi.mock("@/lib/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email")>()),
  sendWaiverSignEmail: vi.fn(async () => undefined),
}))

import { sendWaiverSignEmail } from "@/lib/email"

/**
 * L2 — waivers + e-signature (waivers-esign, owner spec 2026-07-20):
 * league CRUD authz, approval auto-send (a request per roster player per
 * required waiver, deduped), tokenized public signing with body snapshot,
 * status grid, version-bump re-signing, Rowan's Law annual validity.
 */

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="

let world: BuiltWorld
let leagueId: string
let seasonId: string
let leagueOwnerId: string
let clubOwnerId: string
let submissionId: string
let rosterPlayerIds: string[]
let ackWaiverId: string
let concussionWaiverId: string
let ackBody: string

const createWaiver = (body: unknown) =>
  waiversPOST(jsonRequest(`/api/leagues/${leagueId}/waivers`, body), {
    params: { id: leagueId },
  })

beforeAll(async () => {
  world = await buildWorld({
    seed: 1134,
    leagues: [
      {
        seasons: [
          {
            status: "REGISTRATION",
            divisions: [{ teams: 1, rosterSize: 0 }],
            sessions: [],
          },
        ],
      },
    ],
  })
  const season = world.leagues[0].seasons[0]
  leagueId = world.leagues[0].id
  seasonId = season.id
  leagueOwnerId = world.leagues[0].owner.id

  const clubB = await createClub(world.ctx, {})
  clubOwnerId = clubB.owner.id
  const submitted = await submitTeamToSeason(world.ctx, {
    seasonId,
    divisionId: season.divisions[0].id,
    tenantId: clubB.tenantId,
    ageGroup: "U12",
    seasonLabel: season.label,
    rosterSize: 3,
    status: "PENDING",
  })
  submissionId = submitted.submissionId

  const rosterPlayers = await (prisma as any).seasonRosterPlayer.findMany({
    where: { roster: { teamSubmissionId: submissionId } },
    select: { playerId: true },
  })
  rosterPlayerIds = rosterPlayers.map((rp: any) => rp.playerId)
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("league waiver management", () => {
  it("league owner creates both Ontario templates", async () => {
    actAs(leagueOwnerId)
    const ackRes = await createWaiver({ templateKey: "ack-indemnity-on" })
    expect(ackRes.status).toBe(200)
    const ack = (await ackRes.json()).waiver
    ackWaiverId = ack.id
    ackBody = ack.body
    expect(ack.type).toBe("ACKNOWLEDGMENT_INDEMNITY")
    expect(ack.annualRenewal).toBe(false)
    // Template is personalized with the league's name
    expect(ack.body).toContain(world.leagues[0].name)

    const conRes = await createWaiver({ templateKey: "concussion-code-on" })
    expect(conRes.status).toBe(200)
    const con = (await conRes.json()).waiver
    concussionWaiverId = con.id
    expect(con.type).toBe("CONCUSSION_CODE")
    expect(con.annualRenewal).toBe(true)
  })

  it("outsiders can neither list nor create", async () => {
    actAs(clubOwnerId)
    const listRes = await waiversGET(
      jsonRequest(`/api/leagues/${leagueId}/waivers`, undefined, "GET"),
      { params: { id: leagueId } }
    )
    expect(listRes.status).toBe(403)
    const postRes = await createWaiver({ templateKey: "ack-indemnity-on" })
    expect(postRes.status).toBe(403)
  })
})

describe("approval auto-send", () => {
  it("approving a submission emails one request per player per required waiver", async () => {
    actAs(leagueOwnerId)
    const res = await submissionPATCH(
      jsonRequest(
        `/api/seasons/${seasonId}/teams/${submissionId}`,
        { status: "APPROVED" },
        "PATCH"
      ),
      { params: { id: seasonId, teamId: submissionId } }
    )
    expect(res.status).toBe(200)

    // 3 roster players × 2 required waivers
    expect(vi.mocked(sendWaiverSignEmail)).toHaveBeenCalledTimes(6)
    const requests = await (prisma as any).waiverSignRequest.findMany({
      where: { seasonId },
    })
    expect(requests).toHaveLength(6)
    expect(new Set(requests.map((r: any) => r.playerId))).toEqual(new Set(rosterPlayerIds))
  })

  it("re-send skips live requests instead of double-emailing", async () => {
    actAs(leagueOwnerId)
    const res = await statusPOST(
      jsonRequest(`/api/seasons/${seasonId}/waiver-status`, { action: "resend" }),
      { params: { id: seasonId } }
    )
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.sent).toBe(0)
    expect(payload.alreadyRequested).toBe(6)
    expect(vi.mocked(sendWaiverSignEmail)).toHaveBeenCalledTimes(6)
  })
})

describe("tokenized signing", () => {
  it("records a signature with version + body snapshot and consumes the token", async () => {
    const { token } = await mintWaiverSignRequest({
      waiverId: ackWaiverId,
      playerId: rosterPlayerIds[0],
      seasonId,
      emailedTo: "parent@example.test",
    })
    actAs(null)
    const res = await signPOST(
      jsonRequest("/api/waivers/sign", {
        token,
        signerName: "Pat Parent",
        signatureData: PNG,
      })
    )
    expect(res.status).toBe(200)

    const signature = await (prisma as any).waiverSignature.findFirst({
      where: { waiverId: ackWaiverId, playerId: rosterPlayerIds[0] },
    })
    expect(signature).not.toBeNull()
    expect(signature.waiverVersion).toBe(1)
    expect(signature.bodySnapshot).toBe(ackBody)
    expect(signature.signerName).toBe("Pat Parent")
    expect(signature.validUntil).toBeNull()

    // Double-submit of the same token: no second signature
    const again = await signPOST(
      jsonRequest("/api/waivers/sign", {
        token,
        signerName: "Pat Parent",
        signatureData: PNG,
      })
    )
    expect(again.status).toBe(200)
    expect((await again.json()).alreadySigned).toBe(true)
    const count = await (prisma as any).waiverSignature.count({
      where: { waiverId: ackWaiverId, playerId: rosterPlayerIds[0] },
    })
    expect(count).toBe(1)
  })

  it("rejects unknown tokens", async () => {
    actAs(null)
    const res = await signPOST(
      jsonRequest("/api/waivers/sign", {
        token: "not-a-real-token-aaaaaaaaaaaaaaaa",
        signerName: "Pat Parent",
        signatureData: PNG,
      })
    )
    expect(res.status).toBe(404)
  })

  it("annual-renewal waivers get a ~12-month validUntil", async () => {
    const { token } = await mintWaiverSignRequest({
      waiverId: concussionWaiverId,
      playerId: rosterPlayerIds[1],
      seasonId,
      emailedTo: "parent@example.test",
    })
    actAs(null)
    const res = await signPOST(
      jsonRequest("/api/waivers/sign", {
        token,
        signerName: "Sam Guardian",
        signatureData: PNG,
      })
    )
    expect(res.status).toBe(200)
    const signature = await (prisma as any).waiverSignature.findFirst({
      where: { waiverId: concussionWaiverId, playerId: rosterPlayerIds[1] },
    })
    const days =
      (new Date(signature.validUntil).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    expect(days).toBeGreaterThan(300)
    expect(days).toBeLessThanOrEqual(366)
  })
})

describe("status grid + versioning", () => {
  it("shows signed and outstanding per player per waiver", async () => {
    actAs(leagueOwnerId)
    const res = await statusGET(
      jsonRequest(`/api/seasons/${seasonId}/waiver-status`, undefined, "GET"),
      { params: { id: seasonId } }
    )
    expect(res.status).toBe(200)
    const payload = await res.json()
    const team = payload.teams.find((t: any) => t.submissionId === submissionId)
    expect(team).toBeDefined()
    const p0 = team.players.find((p: any) => p.playerId === rosterPlayerIds[0])
    expect(p0.waivers.find((w: any) => w.waiverId === ackWaiverId).signed).toBe(true)
    expect(p0.waivers.find((w: any) => w.waiverId === concussionWaiverId).signed).toBe(false)
    expect(p0.complete).toBe(false)
  })

  it("editing the text bumps the version and re-opens signing", async () => {
    actAs(leagueOwnerId)
    const res = await waiverPATCH(
      jsonRequest(
        `/api/leagues/${leagueId}/waivers/${ackWaiverId}`,
        { body: `${ackBody}\n\n8. Updated clause for the new season.` },
        "PATCH"
      ),
      { params: { id: leagueId, waiverId: ackWaiverId } }
    )
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.versionBumped).toBe(true)
    expect(payload.waiver.version).toBe(2)

    const statusRes = await statusGET(
      jsonRequest(`/api/seasons/${seasonId}/waiver-status`, undefined, "GET"),
      { params: { id: seasonId } }
    )
    const statusPayload = await statusRes.json()
    const team = statusPayload.teams.find((t: any) => t.submissionId === submissionId)
    const p0 = team.players.find((p: any) => p.playerId === rosterPlayerIds[0])
    // The v1 signature no longer satisfies v2 — but its snapshot is intact
    expect(p0.waivers.find((w: any) => w.waiverId === ackWaiverId).signed).toBe(false)
    const signature = await (prisma as any).waiverSignature.findFirst({
      where: { waiverId: ackWaiverId, playerId: rosterPlayerIds[0] },
    })
    expect(signature.bodySnapshot).toBe(ackBody)
  })
})
