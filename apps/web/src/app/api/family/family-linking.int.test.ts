import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import { buildWorld, destroyWorld, createUser, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { resetRateLimits } from "@/lib/rate-limit"
import { GET as claimCheck } from "./claim-check/route"
import { GET as addCheck } from "./add-check/route"
import { GET as getLinkCode, POST as createLinkCode } from "./link-code/route"
import { POST as redeemLinkCode } from "./link-code/redeem/route"
import { POST as mergePlayers } from "./merge/route"
import { POST as createInvitation } from "../family-invitations/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — parent-child linking arc, second wave (2026-08-13):
 *  claim-check   the onboarding "did a parent already add you?" bit
 *  auto-claim    a CHILD_CLAIM invitation created with no email typed
 *  link codes    six characters handed over in person, both directions
 *  add-check     the parent-side "this kid is already on here" warning
 * Everything about who ends up as guardian is asserted against the real
 * Player rows, and every rejection path is asserted to give nothing away.
 */

const DAY = 24 * 60 * 60 * 1000
const GENERIC = "That code did not work. Check it and try again."

let world: BuiltWorld
let tag: string

/** Birth years used across the suite (kept off the current year boundary). */
const YEAR_A = 2011
const YEAR_B = 2012

function dobFor(year: number): Date {
  return new Date(`${year}-06-15T12:00:00.000Z`)
}

const claim = (birthYear: unknown) =>
  claimCheck(jsonRequest(`/api/family/claim-check?birthYear=${birthYear}`, undefined, "GET") as any)
const added = (q: string) =>
  addCheck(jsonRequest(`/api/family/add-check?${q}`, undefined, "GET") as any)
const mintCode = (body: unknown = {}) =>
  createLinkCode(jsonRequest("/api/family/link-code", body) as any)
const redeem = (code: unknown) =>
  redeemLinkCode(jsonRequest("/api/family/link-code/redeem", { code }) as any)
const invite = (body: unknown) =>
  createInvitation(jsonRequest("/api/family-invitations", body) as any)
const merge = (sourcePlayerId: string, targetPlayerId: string) =>
  mergePlayers(jsonRequest("/api/family/merge", { sourcePlayerId, targetPlayerId }) as any)

/** A user whose name we control (createUser randomises names). */
async function namedUser(localPart: string, firstName: string, lastName: string) {
  const user = await createUser(world.ctx, { localPart })
  await prisma.user.update({ where: { id: user.id }, data: { firstName, lastName } })
  return { ...user, firstName, lastName }
}

/** A profile a parent built: no login on it, so it is claimable. */
async function parentCreatedPlayer(
  parentId: string,
  firstName: string,
  lastName: string,
  year: number
) {
  return prisma.player.create({
    data: {
      firstName,
      lastName,
      dateOfBirth: dobFor(year),
      gender: "MALE",
      parentId,
      isMinor: false,
      canLogin: true,
    },
  })
}

/** A kid who signed up on their own: own login, still their own guardian. */
async function selfRegisteredPlayer(userId: string, firstName: string, lastName: string, year: number) {
  return prisma.player.create({
    data: {
      firstName,
      lastName,
      dateOfBirth: dobFor(year),
      gender: "MALE",
      parentId: userId,
      userId,
      isMinor: false,
      canLogin: true,
    },
  })
}

beforeAll(async () => {
  world = await buildWorld({ seed: 1149 })
  tag = world.ctx.runId
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

beforeEach(() => {
  resetRateLimits()
})

describe("GET /api/family/claim-check", () => {
  let kidUserId: string
  let strangerUserId: string

  beforeAll(async () => {
    const parent = await createUser(world.ctx, { localPart: "cc-parent" })
    await parentCreatedPlayer(parent.id, "Jamie", `Claimcheck${tag}`, YEAR_A)

    const kid = await namedUser("cc-kid", "Jamie", `Claimcheck${tag}`)
    kidUserId = kid.id
    const stranger = await namedUser("cc-stranger", "Nobody", `Claimcheck${tag}`)
    strangerUserId = stranger.id
  })

  it("finds the profile a parent already built for this name and birth year", async () => {
    actAs(kidUserId)
    const res = await claim(YEAR_A)
    expect(res.status).toBe(200)
    // One bit and nothing else: no name, no email, no id.
    expect(await res.json()).toEqual({ match: true })
  })

  it("says no for the same name in a different birth year", async () => {
    actAs(kidUserId)
    const res = await claim(YEAR_B)
    expect(await res.json()).toEqual({ match: false })
  })

  it("says no for a name nobody added", async () => {
    actAs(strangerUserId)
    const res = await claim(YEAR_A)
    expect(await res.json()).toEqual({ match: false })
  })

  it("400s a birth year that is not a year, 401s when signed out", async () => {
    actAs(kidUserId)
    expect((await claim("nope")).status).toBe(400)
    actAs(null)
    expect((await claim(YEAR_A)).status).toBe(401)
  })

  it("stops at 10 checks an hour for one account", async () => {
    actAs(kidUserId)
    for (let i = 0; i < 10; i++) expect((await claim(YEAR_A)).status).toBe(200)
    const over = await claim(YEAR_A)
    expect(over.status).toBe(429)
  })
})

describe("POST /api/family-invitations — auto-claim with no email", () => {
  it("creates a CHILD_CLAIM to the parent who built the profile", async () => {
    const parent = await createUser(world.ctx, { localPart: "auto-parent" })
    const parentRow = await parentCreatedPlayer(parent.id, "Marcus", `Autoclaim${tag}`, YEAR_A)
    const kid = await namedUser("auto-kid", "Marcus", `Autoclaim${tag}`)
    const kidRow = await selfRegisteredPlayer(kid.id, "Marcus", `Autoclaim${tag}`, YEAR_A)

    actAs(kid.id)
    const res = await invite({
      type: "GUARDIAN",
      playerId: kidRow.id,
      autoClaim: true,
      birthYear: YEAR_A,
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    // Indistinguishable from an ordinary create: success + id, nothing else.
    expect(Object.keys(body).sort()).toEqual(["id", "success"])

    const row = await prisma.familyInvitation.findUnique({ where: { id: body.id } })
    expect(row!.type).toBe("CHILD_CLAIM")
    expect(row!.playerId).toBe(kidRow.id)
    expect(row!.targetPlayerId).toBe(parentRow.id)
    // The address came from the matched parent, never from the kid.
    const parentUser = await prisma.user.findUnique({ where: { id: parent.id } })
    expect(row!.invitedEmail).toBe(parentUser!.email)
    expect(row!.invitedUserId).toBe(parent.id)
  })

  it("409s when no parent built a matching profile", async () => {
    const kid = await namedUser("auto-lonely", "Solo", `Autoclaim${tag}`)
    const kidRow = await selfRegisteredPlayer(kid.id, "Solo", `Autoclaim${tag}`, YEAR_A)

    actAs(kid.id)
    const res = await invite({ type: "GUARDIAN", playerId: kidRow.id, autoClaim: true })
    expect(res.status).toBe(409)
    expect(await prisma.familyInvitation.count({ where: { playerId: kidRow.id } })).toBe(0)
  })

  it("400s when the claimed birth year disagrees with the profile", async () => {
    const kid = await namedUser("auto-yearoff", "Yearoff", `Autoclaim${tag}`)
    const kidRow = await selfRegisteredPlayer(kid.id, "Yearoff", `Autoclaim${tag}`, YEAR_A)

    actAs(kid.id)
    const res = await invite({
      type: "GUARDIAN",
      playerId: kidRow.id,
      autoClaim: true,
      birthYear: YEAR_B,
    })
    expect(res.status).toBe(400)
  })

  it("still requires an email when autoClaim is not asked for", async () => {
    const kid = await namedUser("auto-noemail", "Noemail", `Autoclaim${tag}`)
    const kidRow = await selfRegisteredPlayer(kid.id, "Noemail", `Autoclaim${tag}`, YEAR_A)

    actAs(kid.id)
    const res = await invite({ type: "GUARDIAN", playerId: kidRow.id })
    expect(res.status).toBe(400)
  })
})

describe("POST /api/family/link-code", () => {
  it("a kid with no guardian gets a CHILD_INVITES_PARENT code for their own row", async () => {
    const kid = await namedUser("lc-kid", "Codey", `Linkcode${tag}`)
    const kidRow = await selfRegisteredPlayer(kid.id, "Codey", `Linkcode${tag}`, YEAR_A)

    actAs(kid.id)
    const res = await mintCode()
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.direction).toBe("CHILD_INVITES_PARENT")
    expect(body.playerId).toBe(kidRow.id)
    expect(body.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/)
    const daysOut = (new Date(body.expiresAt).getTime() - Date.now()) / DAY
    expect(daysOut).toBeGreaterThan(6)
    expect(daysOut).toBeLessThan(8)

    // GET hands the same live code back.
    const read = await getLinkCode()
    expect(await read.json()).toMatchObject({
      code: body.code,
      direction: "CHILD_INVITES_PARENT",
      playerId: kidRow.id,
    })
  })

  it("a parent gets a PARENT_INVITES_CHILD code, optionally scoped to one player", async () => {
    const parent = await createUser(world.ctx, { localPart: "lc-parent" })
    const row = await parentCreatedPlayer(parent.id, "Scoped", `Linkcode${tag}`, YEAR_A)

    actAs(parent.id)
    const res = await mintCode({ playerId: row.id })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.direction).toBe("PARENT_INVITES_CHILD")
    expect(body.playerId).toBe(row.id)
  })

  it("403s a playerId that is not the caller's, and voids the previous code on a new one", async () => {
    const parent = await createUser(world.ctx, { localPart: "lc-void" })
    const other = await createUser(world.ctx, { localPart: "lc-other" })
    const theirs = await parentCreatedPlayer(other.id, "Someone", `Linkcode${tag}`, YEAR_A)

    actAs(parent.id)
    expect((await mintCode({ playerId: theirs.id })).status).toBe(403)

    const first = await (await mintCode()).json()
    const second = await (await mintCode()).json()
    expect(second.code).not.toBe(first.code)
    expect(await prisma.familyLinkCode.findUnique({ where: { code: first.code } })).toBeNull()

    const live = await (await getLinkCode()).json()
    expect(live.code).toBe(second.code)
  })

  it("401s when signed out", async () => {
    actAs(null)
    expect((await getLinkCode()).status).toBe(401)
    expect((await mintCode()).status).toBe(401)
  })
})

describe("POST /api/family/link-code/redeem", () => {
  it("a parent redeems the kid's code and becomes guardian on the spot", async () => {
    const kid = await namedUser("rd-kid", "Redeem", `Onecode${tag}`)
    const kidRow = await selfRegisteredPlayer(kid.id, "Redeem", `Onecode${tag}`, YEAR_A)
    const parent = await createUser(world.ctx, { localPart: "rd-parent" })

    actAs(kid.id)
    const { code } = await (await mintCode()).json()

    actAs(parent.id)
    // Typed by hand: lowercase with a space in the middle still lands.
    const res = await redeem(`${code.slice(0, 3).toLowerCase()} ${code.slice(3).toLowerCase()}`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.linked).toBe(true)
    expect(body.playerId).toBe(kidRow.id)
    expect(body.mergeCandidate).toBeUndefined()

    const player = await prisma.player.findUnique({ where: { id: kidRow.id } })
    expect(player!.parentId).toBe(parent.id)
    // The kid keeps their own login.
    expect(player!.userId).toBe(kid.id)

    const role = await prisma.userRole.findFirst({
      where: { userId: parent.id, role: "Parent", tenantId: null, teamId: null },
    })
    expect(role).not.toBeNull()

    // The other party hears about it.
    const bell = await prisma.notification.findFirst({
      where: { userId: kid.id, type: "family_linked" },
    })
    expect(bell).not.toBeNull()
    expect(bell!.message).toContain("Not you?")

    const used = await prisma.familyLinkCode.findUnique({ where: { code } })
    expect(used!.usedAt).not.toBeNull()
    expect(used!.usedByUserId).toBe(parent.id)
  })

  it("a kid redeems the parent's code and gets that parent as guardian", async () => {
    const parent = await createUser(world.ctx, { localPart: "rd2-parent" })
    const kid = await namedUser("rd2-kid", "Reverse", `Onecode${tag}`)
    const kidRow = await selfRegisteredPlayer(kid.id, "Reverse", `Onecode${tag}`, YEAR_A)

    actAs(parent.id)
    const { code } = await (await mintCode()).json()

    actAs(kid.id)
    const res = await redeem(code)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.linked).toBe(true)
    expect(body.mergeCandidate).toBeUndefined()

    const player = await prisma.player.findUnique({ where: { id: kidRow.id } })
    expect(player!.parentId).toBe(parent.id)
  })

  it("offers the duplicate instead of merging it when the parent already has that kid", async () => {
    const parent = await createUser(world.ctx, { localPart: "rd3-parent" })
    const parentRow = await parentCreatedPlayer(parent.id, "Twin", `Onecode${tag}`, YEAR_A)
    const kid = await namedUser("rd3-kid", "Twin", `Onecode${tag}`)
    const kidRow = await selfRegisteredPlayer(kid.id, "Twin", `Onecode${tag}`, YEAR_A)

    actAs(parent.id)
    const { code } = await (await mintCode({ playerId: parentRow.id })).json()

    actAs(kid.id)
    const res = await redeem(code)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.linked).toBe(true)
    expect(body.mergeCandidate).toEqual({ id: parentRow.id, name: `Twin Onecode${tag}` })

    // Linked, never merged: both rows are still standing and untouched.
    const kidAfter = await prisma.player.findUnique({ where: { id: kidRow.id } })
    const parentAfter = await prisma.player.findUnique({ where: { id: parentRow.id } })
    expect(kidAfter!.parentId).toBe(parent.id)
    expect(kidAfter!.absorbedAt).toBeNull()
    expect(kidAfter!.deletedAt).toBeNull()
    expect(parentAfter!.absorbedAt).toBeNull()
    expect(parentAfter!.userId).toBeNull()
  })

  it("gives one generic answer to every bad code", async () => {
    const kid = await namedUser("rd4-kid", "Badcode", `Onecode${tag}`)
    await selfRegisteredPlayer(kid.id, "Badcode", `Onecode${tag}`, YEAR_A)
    const parent = await createUser(world.ctx, { localPart: "rd4-parent" })

    actAs(kid.id)
    const { code } = await (await mintCode()).json()

    const expect400 = async (res: Response) => {
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe(GENERIC)
    }

    // Their own code.
    await expect400(await redeem(code))

    // Nobody's code.
    actAs(parent.id)
    await expect400(await redeem("ZZZZZZ"))

    // Expired.
    await prisma.familyLinkCode.update({
      where: { code },
      data: { expiresAt: new Date(Date.now() - DAY) },
    })
    await expect400(await redeem(code))

    // Spent: refresh it, redeem once, then try again.
    await prisma.familyLinkCode.update({
      where: { code },
      data: { expiresAt: new Date(Date.now() + DAY) },
    })
    expect((await redeem(code)).status).toBe(200)
    await expect400(await redeem(code))
  })

  it("refuses the wrong party with the same generic answer", async () => {
    // A parent's code needs a kid's own login to redeem it, not another adult.
    const parent = await createUser(world.ctx, { localPart: "rd5-parent" })
    const adult = await createUser(world.ctx, { localPart: "rd5-adult" })
    actAs(parent.id)
    const { code } = await (await mintCode()).json()

    actAs(adult.id)
    const res = await redeem(code)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe(GENERIC)

    // A kid's code needs an adult, not another kid.
    const kid = await namedUser("rd5-kid", "Kidcode", `Onecode${tag}`)
    await selfRegisteredPlayer(kid.id, "Kidcode", `Onecode${tag}`, YEAR_A)
    actAs(kid.id)
    const kidCode = (await (await mintCode()).json()).code

    const otherKid = await namedUser("rd5-kid2", "Otherkid", `Onecode${tag}`)
    await selfRegisteredPlayer(otherKid.id, "Otherkid", `Onecode${tag}`, YEAR_A)
    actAs(otherKid.id)
    const res2 = await redeem(kidCode)
    expect(res2.status).toBe(400)
    expect((await res2.json()).error).toBe(GENERIC)
  })

  it("401s when signed out", async () => {
    actAs(null)
    expect((await redeem("ABCDEF")).status).toBe(401)
  })
})

describe("POST /api/family/merge", () => {
  /** A linked family with two rows for the same kid, the state a redeem leaves. */
  async function linkedDuplicate(stem: string) {
    const parent = await createUser(world.ctx, { localPart: `${stem}-parent` })
    const parentRow = await parentCreatedPlayer(parent.id, stem, `Mergeable${tag}`, YEAR_A)
    const kid = await namedUser(`${stem}-kid`, stem, `Mergeable${tag}`)
    const kidRow = await selfRegisteredPlayer(kid.id, stem, `Mergeable${tag}`, YEAR_A)

    actAs(parent.id)
    const { code } = await (await mintCode({ playerId: parentRow.id })).json()
    actAs(kid.id)
    const redeemed = await (await redeem(code)).json()
    return { parent, parentRow, kid, kidRow, redeemed }
  }

  it("the parent applies the merge the redemption offered", async () => {
    const { parent, parentRow, kid, kidRow, redeemed } = await linkedDuplicate("Merge")
    expect(redeemed.mergeCandidate).toEqual({ id: parentRow.id, name: `Merge Mergeable${tag}` })

    actAs(parent.id)
    const res = await merge(kidRow.id, parentRow.id)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ merged: true, survivingPlayerId: parentRow.id })

    // The parent's row survives and the kid signs in to it now.
    const survivor = await prisma.player.findUnique({ where: { id: parentRow.id } })
    expect(survivor!.userId).toBe(kid.id)
    expect(survivor!.canLogin).toBe(true)
    expect(survivor!.deletedAt).toBeNull()

    // The duplicate is stamped and hidden, not deleted.
    const absorbed = await prisma.player.findUnique({ where: { id: kidRow.id } })
    expect(absorbed!.absorbedIntoPlayerId).toBe(parentRow.id)
    expect(absorbed!.absorbedAt).not.toBeNull()
    expect(absorbed!.deletedAt).not.toBeNull()
    expect(absorbed!.userId).toBeNull()
  })

  it("answers the same 200 when the same merge is applied twice", async () => {
    const { parent, parentRow, kid, kidRow } = await linkedDuplicate("Twice")

    actAs(parent.id)
    expect((await merge(kidRow.id, parentRow.id)).status).toBe(200)
    const again = await merge(kidRow.id, parentRow.id)
    expect(again.status).toBe(200)
    expect(await again.json()).toEqual({ merged: true, survivingPlayerId: parentRow.id })

    // Nothing moved a second time.
    const survivor = await prisma.player.findUnique({ where: { id: parentRow.id } })
    expect(survivor!.userId).toBe(kid.id)
    const absorbed = await prisma.player.findUnique({ where: { id: kidRow.id } })
    expect(absorbed!.absorbedIntoPlayerId).toBe(parentRow.id)
  })

  it("403s anyone who does not hold both rows, with one sentence", async () => {
    const { parent, parentRow, kid, kidRow } = await linkedDuplicate("Notyours")
    const stranger = await createUser(world.ctx, { localPart: "notyours-stranger" })

    const expect403 = async (res: Response) => {
      expect(res.status).toBe(403)
      expect((await res.json()).error).toBe("Those profiles are not both yours.")
    }

    actAs(stranger.id)
    await expect403(await merge(kidRow.id, parentRow.id))

    // The kid holds the source but the surviving row is not theirs.
    actAs(kid.id)
    await expect403(await merge(kidRow.id, parentRow.id))

    // A survivor that belongs to somebody else, asked for by its own guardian.
    const outsider = await createUser(world.ctx, { localPart: "notyours-outsider" })
    const outsiderRow = await parentCreatedPlayer(outsider.id, "Notyours", `Mergeable${tag}`, YEAR_A)
    actAs(parent.id)
    await expect403(await merge(kidRow.id, outsiderRow.id))

    // Untouched throughout.
    const stillThere = await prisma.player.findUnique({ where: { id: kidRow.id } })
    expect(stillThere!.absorbedAt).toBeNull()
    expect(outsiderRow.id).toBeTruthy()
  })

  it("409s two children who are not the same person, even for their own parent", async () => {
    const parent = await createUser(world.ctx, { localPart: "diff-parent" })
    const older = await parentCreatedPlayer(parent.id, "Alpha", `Different${tag}`, YEAR_A)
    const younger = await parentCreatedPlayer(parent.id, "Beta", `Different${tag}`, YEAR_B)

    actAs(parent.id)
    const res = await merge(younger.id, older.id)
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/not the same player/i)

    const untouched = await prisma.player.findUnique({ where: { id: younger.id } })
    expect(untouched!.absorbedAt).toBeNull()
    expect(untouched!.deletedAt).toBeNull()
  })

  it("409s a merge into itself and 401s when signed out", async () => {
    const parent = await createUser(world.ctx, { localPart: "self-parent" })
    const row = await parentCreatedPlayer(parent.id, "Selfsame", `Different${tag}`, YEAR_A)

    actAs(parent.id)
    expect((await merge(row.id, row.id)).status).toBe(409)
    actAs(null)
    expect((await merge(row.id, row.id)).status).toBe(401)
  })
})

describe("GET /api/family/add-check", () => {
  it("warns the parent when that kid already signed up on their own", async () => {
    const kid = await namedUser("ac-kid", "Already", `Addcheck${tag}`)
    await selfRegisteredPlayer(kid.id, "Already", `Addcheck${tag}`, YEAR_A)
    const parent = await createUser(world.ctx, { localPart: "ac-parent" })

    actAs(parent.id)
    const res = await added(`firstName=Already&lastName=Addcheck${tag}&birthYear=${YEAR_A}`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ selfRegisteredMatch: true })
  })

  it("says no for a profile that has no login of its own", async () => {
    const other = await createUser(world.ctx, { localPart: "ac-other" })
    await parentCreatedPlayer(other.id, "Managed", `Addcheck${tag}`, YEAR_A)
    const parent = await createUser(world.ctx, { localPart: "ac-parent2" })

    actAs(parent.id)
    const res = await added(`firstName=Managed&lastName=Addcheck${tag}&birthYear=${YEAR_A}`)
    expect(await res.json()).toEqual({ selfRegisteredMatch: false })
  })

  it("400s a missing field and 401s when signed out", async () => {
    const parent = await createUser(world.ctx, { localPart: "ac-parent3" })
    actAs(parent.id)
    expect((await added(`firstName=Only&birthYear=${YEAR_A}`)).status).toBe(400)
    actAs(null)
    expect((await added(`firstName=A&lastName=B&birthYear=${YEAR_A}`)).status).toBe(401)
  })
})
