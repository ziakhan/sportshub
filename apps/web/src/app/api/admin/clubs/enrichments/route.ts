import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@youthbasketballhub/db"
import { withAuth, requirePlatformAdmin, apiError } from "@/lib/api/handler"
import { auditSafe, audit } from "@/lib/audit"

export const dynamic = "force-dynamic"

/**
 * Machine-edit review queue.
 *
 * Owner order 2026-08-20: every value an automated run writes to a club gets
 * flagged for a human, with where it came from, what it replaced, and a way to
 * put the old value back. The pipelines record one TenantEnrichment row per
 * field they touch; this endpoint is the queue that turns those rows into a
 * decision.
 *
 * Sits beside /api/admin/clubs/lifecycle rather than inside it: that route is
 * about what an admin does to a club, this one is about what a script already
 * did to one.
 */

/** Rows returned in one page of the queue. Admin tool, so generous. */
const ROW_LIMIT = 400

/**
 * Fields a revert may write, with the coercion back from the stored string.
 * Anything not listed here cannot be reverted from the console — a pipeline
 * that starts writing a new field has to be added deliberately.
 */
type Coerce = (raw: string | null) => unknown

const asText: Coerce = (raw) => (raw === null || raw === "" ? null : raw)

const asNumber: Coerce = (raw) => {
  if (raw === null || raw === "") return null
  const n = Number(raw)
  if (!Number.isFinite(n)) throw new RevertError(`"${raw}" is not a number`)
  return n
}

const asDate: Coerce = (raw) => {
  if (raw === null || raw === "") return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) throw new RevertError(`"${raw}" is not a date`)
  return d
}

const TENANT_STATUSES = ["ACTIVE", "SUSPENDED", "UNCLAIMED"] as const

const asStatus: Coerce = (raw) => {
  if (!raw || !(TENANT_STATUSES as readonly string[]).includes(raw)) {
    throw new RevertError(
      raw ? `"${raw}" is not a club status` : "There is no previous status to put back"
    )
  }
  return raw
}

/** Required columns: a revert that would blank them is refused instead. */
const asRequiredText: Coerce = (raw) => {
  if (raw === null || raw === "") {
    throw new RevertError("There is no previous value to put back, and this field cannot be empty")
  }
  return raw
}

const REVERTABLE: Record<string, Coerce> = {
  name: asRequiredText,
  shortName: asText,
  description: asText,
  website: asText,
  contactEmail: asText,
  phoneNumber: asText,
  address: asText,
  city: asText,
  state: asText,
  region: asText,
  postalCode: asText,
  zipCode: asText,
  searchAliases: asText,
  dataSources: asText,
  dataNotes: asText,
  placeId: asText,
  geoSource: asText,
  geoPrecision: asText,
  latitude: asNumber,
  longitude: asNumber,
  status: asStatus,
  publishedAt: asDate,
}

class RevertError extends Error {}

/** How the stored strings compare against what the club holds right now. */
function sameValue(current: unknown, recorded: string | null): boolean {
  if (current === null || current === undefined) return recorded === null || recorded === ""
  if (recorded === null || recorded === "") return false
  if (typeof current === "number") return Number(recorded) === current
  if (current instanceof Date) {
    const d = new Date(recorded)
    return !Number.isNaN(d.getTime()) && d.getTime() === current.getTime()
  }
  return String(current) === recorded
}

const CLUB_SELECT = {
  id: true,
  slug: true,
  name: true,
  city: true,
  state: true,
  region: true,
  status: true,
  publishedAt: true,
  mergedIntoId: true,
} as const

/** "(no region)" in the select: the sentinel filters clubs where the value is null. */
const NONE = "__none__"

export const GET = withAuth<NextRequest>(async (request, _ctx, session) => {
  requirePlatformAdmin(session)

  const sp = request.nextUrl.searchParams
  const includeReviewed = sp.get("all") === "1"
  const province = (sp.get("province") ?? "").trim()
  const region = (sp.get("region") ?? "").trim()
  const city = (sp.get("city") ?? "").trim()

  // Region-by-region review (owner 2026-08-20): the same place filters as the
  // clubs page, applied server side so the view stays true past the row cap.
  const tenantFilter =
    province || region || city
      ? {
          tenant: {
            ...(province ? { state: { equals: province, mode: "insensitive" as const } } : {}),
            ...(region
              ? region === NONE
                ? { region: null }
                : { region: { equals: region, mode: "insensitive" as const } }
              : {}),
            ...(city ? { city: { equals: city, mode: "insensitive" as const } } : {}),
          },
        }
      : {}

  const [pendingRows, pendingClubGroups] = await Promise.all([
    prisma.tenantEnrichment.count({ where: { reviewedAt: null } }),
    prisma.tenantEnrichment.groupBy({
      by: ["tenantId"],
      where: { reviewedAt: null },
      _count: { tenantId: true },
    }),
  ])

  // The tab badge only needs the two numbers, and the console asks for them on
  // every visit — don't ship 400 rows to draw a count.
  if (sp.get("counts") === "1") {
    return NextResponse.json({ pendingRows, pendingClubs: pendingClubGroups.length })
  }

  const rows = await prisma.tenantEnrichment.findMany({
    where: { ...(includeReviewed ? {} : { reviewedAt: null }), ...tenantFilter },
    // Field breaks the tie so a pair written in the same run (latitude and
    // longitude) always lands the same way up.
    orderBy: [{ appliedAt: "desc" }, { field: "asc" }],
    take: ROW_LIMIT,
    include: { tenant: { select: CLUB_SELECT } },
  })

  // Filter options with club counts, each list counted under the OTHER two
  // active filters so the numbers always match what picking it would show.
  const optTenants = await prisma.tenant.findMany({
    where: { enrichments: { some: includeReviewed ? {} : { reviewedAt: null } } },
    select: { state: true, region: true, city: true },
  })
  const eq = (a: string | null, b: string) =>
    b === NONE ? a == null : (a ?? "").toLowerCase() === b.toLowerCase()
  const tally = (
    pick: (t: { state: string | null; region: string | null; city: string | null }) => string | null,
    applies: (t: { state: string | null; region: string | null; city: string | null }) => boolean,
    includeNone = false
  ) => {
    const counts = new Map<string, number>()
    let none = 0
    for (const t of optTenants) {
      if (!applies(t)) continue
      const v = pick(t)
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
      else none++
    }
    const list = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, count }))
    if (includeNone && none > 0) list.push({ value: NONE, count: none })
    return list
  }
  const provinces = tally(
    (t) => t.state,
    (t) => (!region || eq(t.region, region)) && (!city || eq(t.city, city))
  )
  const regions = tally(
    (t) => t.region,
    (t) => (!province || eq(t.state, province)) && (!city || eq(t.city, city)),
    true
  )
  const cities = tally(
    (t) => t.city,
    (t) => (!province || eq(t.state, province)) && (!region || eq(t.region, region))
  )

  // Who signed each reviewed row off, in the names an admin recognises.
  const reviewerIds = [...new Set(rows.map((r) => r.reviewedById).filter(Boolean))] as string[]
  const reviewers = reviewerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: reviewerIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
      })
    : []
  const reviewerName = new Map(
    reviewers.map((u) => [
      u.id,
      [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.email,
    ])
  )

  // Grouped per club, clubs ordered by whoever has the oldest waiting edit —
  // the queue drains from the back, not from whatever alphabetises first.
  const byClub = new Map<
    string,
    {
      club: (typeof rows)[number]["tenant"]
      pending: number
      oldestPending: string | null
      rows: unknown[]
    }
  >()

  for (const r of rows) {
    let entry = byClub.get(r.tenantId)
    if (!entry) {
      entry = { club: r.tenant, pending: 0, oldestPending: null, rows: [] }
      byClub.set(r.tenantId, entry)
    }
    if (!r.reviewedAt) {
      entry.pending += 1
      const at = r.appliedAt.toISOString()
      if (!entry.oldestPending || at < entry.oldestPending) entry.oldestPending = at
    }
    entry.rows.push({
      id: r.id,
      field: r.field,
      fromValue: r.fromValue,
      toValue: r.toValue,
      source: r.source,
      sourceUrl: r.sourceUrl,
      confidence: r.confidence,
      appliedAt: r.appliedAt,
      appliedBy: r.appliedBy,
      reviewedAt: r.reviewedAt,
      reviewedBy: r.reviewedById ? (reviewerName.get(r.reviewedById) ?? "an admin") : null,
      reverted: r.reverted,
      revertable: r.field in REVERTABLE,
    })
  }

  const clubs = [...byClub.values()].sort((a, b) => {
    if (a.pending !== b.pending && (a.pending === 0 || b.pending === 0)) {
      return a.pending === 0 ? 1 : -1
    }
    return (a.oldestPending ?? "9") < (b.oldestPending ?? "9") ? -1 : 1
  })

  return NextResponse.json({
    clubs,
    pendingRows,
    pendingClubs: pendingClubGroups.length,
    shownRows: rows.length,
    truncated: rows.length === ROW_LIMIT,
    includeReviewed,
    provinces,
    regions,
    cities,
  })
})

const approveSchema = z.object({
  action: z.literal("approve"),
  ids: z.array(z.string().min(1)).min(1).max(500),
})

const revertSchema = z.object({
  action: z.literal("revert"),
  id: z.string().min(1),
})

export const POST = withAuth<NextRequest>(async (request, _ctx, session) => {
  requirePlatformAdmin(session)
  const parsed = z
    .discriminatedUnion("action", [approveSchema, revertSchema])
    .parse(await request.json())

  if (parsed.action === "approve") {
    const targets = await prisma.tenantEnrichment.findMany({
      where: { id: { in: parsed.ids }, reviewedAt: null },
      select: { id: true, tenantId: true, field: true },
    })
    if (targets.length === 0) {
      return apiError(409, "Those edits have already been looked at", "ALREADY_REVIEWED")
    }
    const res = await prisma.tenantEnrichment.updateMany({
      where: { id: { in: targets.map((t) => t.id) } },
      data: { reviewedAt: new Date(), reviewedById: session.realUserId },
    })
    const tenantIds = [...new Set(targets.map((t) => t.tenantId))]
    await auditSafe({
      actorId: session.realUserId,
      actorRole: "PlatformAdmin",
      action: "CLUB_ENRICHMENT_APPROVE",
      resource: "TenantEnrichment",
      resourceId: targets.length === 1 ? targets[0].id : "bulk",
      tenantId: tenantIds.length === 1 ? tenantIds[0] : null,
      metadata: {
        count: res.count,
        ids: targets.slice(0, 50).map((t) => t.id),
        fields: targets.slice(0, 50).map((t) => t.field),
        tenantIds: tenantIds.slice(0, 50),
      },
      request,
    })
    return NextResponse.json({ success: true, count: res.count })
  }

  const row = await prisma.tenantEnrichment.findUnique({ where: { id: parsed.id } })
  if (!row) return apiError(404, "That edit is not on file", "NOT_FOUND")
  if (row.reverted) return apiError(409, "That edit has already been put back", "ALREADY_REVERTED")

  const coerce = REVERTABLE[row.field]
  if (!coerce) {
    return apiError(
      400,
      `${row.field} is not a field this tool can put back. Change it by hand in Club review.`,
      "FIELD_NOT_REVERTABLE"
    )
  }

  // If the club no longer holds what the pipeline wrote, something else has
  // moved on since — a later run, or a person. Putting the old value back would
  // quietly undo that, so refuse and say why.
  const club = await prisma.tenant.findUnique({ where: { id: row.tenantId } })
  if (!club) return apiError(404, "That club is not on file", "NOT_FOUND")
  if (!sameValue((club as any)[row.field], row.toValue)) {
    return apiError(
      409,
      `The ${row.field} on ${club.name} has changed since this edit ran, so there is nothing to put back. Check it by hand in Club review.`,
      "VALUE_MOVED_ON"
    )
  }

  let value: unknown
  try {
    value = coerce(row.fromValue)
  } catch (e) {
    if (e instanceof RevertError) return apiError(400, e.message, "BAD_OLD_VALUE")
    throw e
  }

  const data: Record<string, unknown> = { [row.field]: value }
  // A restored coordinate is a human's decision, so mark it the way a hand
  // edit is marked and the next geocode run leaves it alone.
  if (row.field === "latitude" || row.field === "longitude") data.geoSource = "manual"

  await prisma.$transaction(async (tx) => {
    await tx.tenant.update({ where: { id: row.tenantId }, data })
    await tx.tenantEnrichment.update({
      where: { id: row.id },
      data: { reverted: true, reviewedAt: new Date(), reviewedById: session.realUserId },
    })
    // Audited inside the transaction so the record cannot survive a rollback.
    await audit(tx, {
      actorId: session.realUserId,
      actorRole: "PlatformAdmin",
      action: "CLUB_ENRICHMENT_REVERT",
      resource: "TenantEnrichment",
      resourceId: row.id,
      tenantId: row.tenantId,
      changes: { [row.field]: { from: row.toValue, to: row.fromValue } },
      metadata: {
        source: row.source,
        sourceUrl: row.sourceUrl,
        appliedBy: row.appliedBy,
        appliedAt: row.appliedAt,
      },
      request,
    })
  })

  return NextResponse.json({
    success: true,
    field: row.field,
    value: row.fromValue,
    club: { id: club.id, name: club.name },
  })
})
