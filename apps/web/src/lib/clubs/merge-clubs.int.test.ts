import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import {
  absorbDuplicateClub,
  restoreMergedClub,
  MergeClubsError,
  resolveSurvivor,
} from "./merge-clubs"

/**
 * Merging duplicate clubs. The census produced ~165 clubs across 78 groups that
 * are the same organisation under different spellings; merging them wrongly is
 * far more expensive than leaving them split, because a claim may already point
 * at the row that disappears.
 */

const RUN = "mergeclub"
const made: string[] = []

async function mkClub(suffix: string, extra: Record<string, unknown> = {}) {
  const t = await (prisma as any).tenant.create({
    data: {
      name: `Merge Test ${suffix} ${RUN}`,
      slug: `merge-test-${suffix}-${RUN}`.toLowerCase(),
      status: "UNCLAIMED",
      publishedAt: new Date(),
      ...extra,
    },
  })
  made.push(t.id)
  return t
}

beforeEach(async () => {
  if (made.length) {
    await (prisma as any).team.deleteMany({ where: { tenantId: { in: made } } })
    await (prisma as any).tenant.deleteMany({ where: { id: { in: made } } })
    made.length = 0
  }
})

afterAll(async () => {
  if (made.length) {
    await (prisma as any).team.deleteMany({ where: { tenantId: { in: made } } })
    await (prisma as any).tenant.deleteMany({ where: { id: { in: made } } })
  }
})

describe("absorbDuplicateClub", () => {
  it("moves teams to the survivor and soft-deletes the source", async () => {
    const target = await mkClub("target")
    const source = await mkClub("source")
    await (prisma as any).team.create({
      data: { tenantId: source.id, name: "U14 Boys", ageGroup: "U14", season: "2026" },
    })

    const res = await prisma.$transaction((tx) =>
      absorbDuplicateClub(tx, { sourceId: source.id, targetId: target.id })
    )
    expect(res.moved.team).toBe(1)

    const movedTeam = await (prisma as any).team.findFirst({ where: { tenantId: target.id } })
    expect(movedTeam?.name).toBe("U14 Boys")
    expect(await (prisma as any).team.count({ where: { tenantId: source.id } })).toBe(0)

    const gone = await (prisma as any).tenant.findUnique({ where: { id: source.id } })
    expect(gone.mergedIntoId).toBe(target.id)
    expect(gone.mergedAt).toBeTruthy()
    expect(gone.publishedAt).toBeNull() // must drop out of public surfaces
    expect(gone.slug).toContain("merged-") // frees the slug for the survivor
  })

  it("drops a colliding row rather than violating the unique constraint", async () => {
    // Both clubs field a "U14 Boys 2026" team. Team is @@unique([tenantId,
    // name, ageGroup, season]) so the source's copy cannot move across.
    const target = await mkClub("target")
    const source = await mkClub("source")
    for (const id of [target.id, source.id]) {
      await (prisma as any).team.create({
        data: { tenantId: id, name: "U16 Girls", ageGroup: "U16", season: "2026" },
      })
    }

    const res = await prisma.$transaction((tx) =>
      absorbDuplicateClub(tx, { sourceId: source.id, targetId: target.id })
    )
    expect(res.moved.team).toBeUndefined() // nothing moved, nothing threw
    expect(await (prisma as any).team.count({ where: { tenantId: target.id } })).toBe(1)
  })

  it("fills the survivor's blanks from the source but never overwrites", async () => {
    const target = await mkClub("target", { city: "Hamilton", contactEmail: null })
    const source = await mkClub("source", {
      city: "Toronto",
      contactEmail: "info@example.com",
      latitude: 43.2557,
      longitude: -79.8711,
    })

    const res = await prisma.$transaction((tx) =>
      absorbDuplicateClub(tx, { sourceId: source.id, targetId: target.id })
    )
    const survivor = await (prisma as any).tenant.findUnique({ where: { id: target.id } })
    expect(survivor.city).toBe("Hamilton") // target's own value wins
    expect(survivor.contactEmail).toBe("info@example.com") // blank filled
    expect(survivor.latitude).toBeCloseTo(43.2557, 3)
    expect(res.filled).toContain("contactEmail")
    expect(res.filled).not.toContain("city")
  })

  it("refuses to merge two claimed clubs", async () => {
    const target = await mkClub("target", { status: "ACTIVE" })
    const source = await mkClub("source", { status: "ACTIVE" })
    await expect(
      prisma.$transaction((tx) =>
        absorbDuplicateClub(tx, { sourceId: source.id, targetId: target.id })
      )
    ).rejects.toThrow(MergeClubsError)
  })

  it("refuses to merge a club into itself", async () => {
    const c = await mkClub("self")
    await expect(
      prisma.$transaction((tx) => absorbDuplicateClub(tx, { sourceId: c.id, targetId: c.id }))
    ).rejects.toThrow(/into itself/)
  })

  it("refuses to merge into a club that was itself merged away", async () => {
    const a = await mkClub("a")
    const b = await mkClub("b")
    const c = await mkClub("c")
    await prisma.$transaction((tx) => absorbDuplicateClub(tx, { sourceId: b.id, targetId: a.id }))
    await expect(
      prisma.$transaction((tx) => absorbDuplicateClub(tx, { sourceId: c.id, targetId: b.id }))
    ).rejects.toThrow(/survivor/)
  })

  it("resolves a merge chain to the surviving club", async () => {
    const a = await mkClub("a")
    const b = await mkClub("b")
    const c = await mkClub("c")
    await prisma.$transaction((tx) => absorbDuplicateClub(tx, { sourceId: c.id, targetId: b.id }))
    await prisma.$transaction((tx) => absorbDuplicateClub(tx, { sourceId: b.id, targetId: a.id }))
    // c -> b -> a
    expect(await resolveSurvivor(prisma, c.id)).toBe(a.id)
    expect(await resolveSurvivor(prisma, a.id)).toBe(a.id)
  })

  it("rolls back completely when the transaction fails", async () => {
    const target = await mkClub("target")
    const source = await mkClub("source")
    await (prisma as any).team.create({
      data: { tenantId: source.id, name: "U12 Boys", ageGroup: "U12", season: "2026" },
    })

    await expect(
      prisma.$transaction(async (tx) => {
        await absorbDuplicateClub(tx, { sourceId: source.id, targetId: target.id })
        throw new Error("simulated failure after the merge")
      })
    ).rejects.toThrow("simulated failure")

    // A half-applied merge would leave the team moved but the source not marked,
    // or vice versa. Neither may happen.
    const still = await (prisma as any).tenant.findUnique({ where: { id: source.id } })
    expect(still.mergedIntoId).toBeNull()
    expect(await (prisma as any).team.count({ where: { tenantId: source.id } })).toBe(1)
    expect(await (prisma as any).team.count({ where: { tenantId: target.id } })).toBe(0)
  })

  it("puts a merge back: rows return, the retired club is live again", async () => {
    const target = await mkClub("undo-target")
    const source = await mkClub("undo-source", { contactEmail: "source@example.com" })
    const team = await (prisma as any).team.create({
      data: { tenantId: source.id, name: "U13 Girls", ageGroup: "U13", season: "2026" },
    })

    const merge = await prisma.$transaction((tx) =>
      absorbDuplicateClub(tx, { sourceId: source.id, targetId: target.id })
    )
    expect(merge.undo).not.toBeNull()
    expect(merge.undo!.movedIds.team).toEqual([team.id])

    const back = await prisma.$transaction((tx) => restoreMergedClub(tx, merge.undo!))
    expect(back.returned.team).toBe(1)

    const [src, tgt] = await Promise.all([
      (prisma as any).tenant.findUnique({ where: { id: source.id } }),
      (prisma as any).tenant.findUnique({ where: { id: target.id } }),
    ])
    expect(src.mergedIntoId).toBeNull()
    expect(src.publishedAt).not.toBeNull()
    expect(src.slug).toBe(`merge-test-undo-source-${RUN}`)
    // The email the merge borrowed goes back to being blank on the survivor.
    expect(tgt.contactEmail).toBeNull()
    expect(await (prisma as any).team.count({ where: { tenantId: source.id } })).toBe(1)
    expect(await (prisma as any).team.count({ where: { tenantId: target.id } })).toBe(0)
  })

  it("leaves alone anything edited since the merge", async () => {
    const target = await mkClub("keep-target")
    const source = await mkClub("keep-source", { contactEmail: "source@example.com" })
    const team = await (prisma as any).team.create({
      data: { tenantId: source.id, name: "U16 Boys", ageGroup: "U16", season: "2026" },
    })
    const merge = await prisma.$transaction((tx) =>
      absorbDuplicateClub(tx, { sourceId: source.id, targetId: target.id })
    )

    // An admin corrects the email, and moves the team somewhere else entirely.
    await (prisma as any).tenant.update({
      where: { id: target.id },
      data: { contactEmail: "corrected@example.com" },
    })
    const elsewhere = await mkClub("keep-elsewhere")
    await (prisma as any).team.update({
      where: { id: team.id },
      data: { tenantId: elsewhere.id },
    })

    const back = await prisma.$transaction((tx) => restoreMergedClub(tx, merge.undo!))
    expect(back.returned.team ?? 0).toBe(0)
    expect(back.skipped).toBe(1)
    const tgt = await (prisma as any).tenant.findUnique({ where: { id: target.id } })
    expect(tgt.contactEmail).toBe("corrected@example.com")
    expect(
      (await (prisma as any).team.findUnique({ where: { id: team.id } })).tenantId
    ).toBe(elsewhere.id)
  })

  it("refuses to undo the same merge twice", async () => {
    const target = await mkClub("twice-target")
    const source = await mkClub("twice-source")
    const merge = await prisma.$transaction((tx) =>
      absorbDuplicateClub(tx, { sourceId: source.id, targetId: target.id })
    )
    await prisma.$transaction((tx) => restoreMergedClub(tx, merge.undo!))
    await expect(
      prisma.$transaction((tx) => restoreMergedClub(tx, merge.undo!))
    ).rejects.toThrow(/already been undone/)
  })
})
