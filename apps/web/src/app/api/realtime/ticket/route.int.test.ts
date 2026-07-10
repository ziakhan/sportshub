import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { jwtVerify } from "jose"
import {
  buildWorld,
  createUser,
  destroyWorld,
  type BuiltUser,
  type BuiltWorld,
} from "@youthbasketballhub/test-worlds"
import { actAs } from "@/test/integration-harness"
import { verifyAccessToken } from "@/lib/native-auth-tokens"
import { GET } from "./route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

process.env.AUTH_TOKEN_SECRET ||= "int-test-auth-token-secret"

/**
 * L2 — M1 realtime ticket: room grants come from real chat membership, the
 * ticket verifies against AUTH_TOKEN_SECRET (what the sidecar checks), and
 * a ticket can never double as an API bearer token.
 */

let world: BuiltWorld
let coach: BuiltUser
let outsider: BuiltUser
let teamId: string

beforeAll(async () => {
  world = await buildWorld({
    seed: 1132,
    clubs: [{ teams: [{}] }],
  })
  const club = world.clubs[0]
  teamId = club.teams[0].id
  coach = await createUser(world.ctx, {
    localPart: "rt-coach",
    roles: [{ role: "Staff", tenantId: club.tenantId, teamId }],
  })
  outsider = await createUser(world.ctx, { localPart: "rt-outsider" })
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("GET /api/realtime/ticket", () => {
  it("anonymous → 401", async () => {
    actAs(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("grants the user room plus every member team room", async () => {
    actAs(coach.id)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rooms).toContain(`user:${coach.id}`)
    expect(body.rooms).toContain(`team:${teamId}`)

    // The ticket is what the sidecar verifies — same secret, sub + rooms
    const { payload } = await jwtVerify(
      body.ticket,
      new TextEncoder().encode(process.env.AUTH_TOKEN_SECRET)
    )
    expect(payload.sub).toBe(coach.id)
    expect(payload.rooms).toEqual(body.rooms)
  })

  it("a non-member gets no team rooms", async () => {
    actAs(outsider.id)
    const res = await GET()
    const body = await res.json()
    expect(body.rooms).toEqual([`user:${outsider.id}`])
  })

  it("a ticket is NOT an API bearer credential", async () => {
    actAs(coach.id)
    const body = await (await GET()).json()
    expect(await verifyAccessToken(body.ticket)).toBeNull()
  })
})
