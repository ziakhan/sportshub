import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@youthbasketballhub/db"
import { withAuth, requirePlatformAdmin, apiError } from "@/lib/api/handler"
import { auditSafe, audit } from "@/lib/audit"
import {
  absorbDuplicateClub,
  restoreMergedClub,
  MergeClubsError,
  type MergeUndoPlan,
} from "@/lib/clubs/merge-clubs"

export const dynamic = "force-dynamic"

/**
 * Club lifecycle admin API.
 *
 * The census import put ~1,700 clubs in the database, most of them never seen
 * by a human. This endpoint is how they get reviewed: found by data-quality
 * problem, corrected, published, and de-duplicated.
 *
 * Kept separate from /api/admin/clubs (suspend/plan/feature/transfer) because
 * that route is about running a live club, while this one is about getting a
 * census record fit to show.
 */

const PAGE_SIZE = 25

/** The data-quality buckets the review queue is organised around. */
const ISSUE_FILTERS = {
  all: {},
  unpublished: { publishedAt: null },
  "no-contact": { contactEmail: null, phoneNumber: null },
  "no-email": { OR: [{ contactEmail: null }, { contactEmail: "" }] },
  "no-phone": { OR: [{ phoneNumber: null }, { phoneNumber: "" }] },
  "no-location": { latitude: null },
  "no-city": { OR: [{ city: null }, { city: "" }] },
  "no-website": { website: null },
  merged: { mergedIntoId: { not: null } },
} as const

/** SQL twin of lib/clubs/completeness.ts — the same nine slots, so the score
 *  a filter selects by is the score the list displays. Change them together. */
const SCORE_SQL = `(
  (CASE WHEN website IS NOT NULL AND website <> '' THEN 1 ELSE 0 END) +
  (CASE WHEN "contactEmail" IS NOT NULL AND "contactEmail" <> '' THEN 1 ELSE 0 END) +
  (CASE WHEN "phoneNumber" IS NOT NULL AND "phoneNumber" <> '' THEN 1 ELSE 0 END) +
  (CASE WHEN city IS NOT NULL AND city <> '' THEN 1 ELSE 0 END) +
  (CASE WHEN state IS NOT NULL AND state <> '' THEN 1 ELSE 0 END) +
  (CASE WHEN region IS NOT NULL AND region <> '' THEN 1 ELSE 0 END) +
  (CASE WHEN address IS NOT NULL AND address <> '' THEN 1 ELSE 0 END) +
  (CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN description IS NOT NULL AND description <> '' THEN 1 ELSE 0 END)
)`

const SCORE_BUCKETS: Record<string, { min: number; max: number }> = {
  full: { min: 9, max: 9 },
  high: { min: 7, max: 8 },
  mid: { min: 4, max: 6 },
  low: { min: 0, max: 3 },
}

type IssueKey = keyof typeof ISSUE_FILTERS

/** Tables the merge moves, in the words an admin thinks in. */
const MERGE_PREVIEW_TABLES: Array<{ model: string; label: string }> = [
  { model: "team", label: "team" },
  { model: "payment", label: "payment" },
  { model: "review", label: "review" },
  { model: "camp", label: "camp" },
  { model: "tryout", label: "tryout" },
  { model: "practice", label: "practice" },
  { model: "announcement", label: "announcement" },
  { model: "venue", label: "venue" },
  { model: "userRole", label: "staff member" },
  { model: "follow", label: "follower" },
  { model: "clubClaim", label: "ownership claim" },
]

export const GET = withAuth<NextRequest>(async (request, _ctx, session) => {
  requirePlatformAdmin(session)

  const sp = request.nextUrl.searchParams

  // A merge moves records irreversibly, so the console asks what would happen
  // before it asks the admin to confirm. Counting here rather than in the
  // browser keeps the numbers honest — they come from the same tables the merge
  // itself walks.
  if (sp.get("preview") === "merge") {
    const sourceId = sp.get("sourceId") ?? ""
    const targetId = sp.get("targetId") ?? ""
    if (!sourceId || !targetId) return apiError(400, "Both clubs are required", "BAD_PREVIEW")
    const [source, target] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: sourceId } }),
      prisma.tenant.findUnique({ where: { id: targetId } }),
    ])
    if (!source || !target) return apiError(404, "Club not found", "NOT_FOUND")
    const counted = await Promise.all(
      MERGE_PREVIEW_TABLES.map(async ({ model, label }) => {
        const delegate = (prisma as any)[model]
        if (!delegate?.count) return { label, count: 0 }
        return { label, count: await delegate.count({ where: { tenantId: sourceId } }) }
      })
    )
    return NextResponse.json({
      source: { id: source.id, name: source.name, city: source.city, status: source.status },
      target: { id: target.id, name: target.name, city: target.city, status: target.status },
      moves: counted.filter((c) => c.count > 0),
      // The most common mistake is merging the wrong way round: everything the
      // club actually has gets folded into an empty shell that merely looks
      // like a tidier name. Say so plainly rather than leaving it to be noticed.
      backwards:
        counted.some((c) => c.count > 0) &&
        (await prisma.team.count({ where: { tenantId: targetId } })) === 0 &&
        (await prisma.team.count({ where: { tenantId: sourceId } })) > 0,
      bothClaimed: source.status === "ACTIVE" && target.status === "ACTIVE",
    })
  }

  const q = (sp.get("q") ?? "").trim()
  const province = (sp.get("province") ?? "").trim()
  const region = (sp.get("region") ?? "").trim()
  const issue = (sp.get("issue") ?? "all") as IssueKey
  const page = Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1)

  if (!(issue in ISSUE_FILTERS)) {
    return apiError(400, `Unknown issue filter: ${issue}`, "BAD_FILTER")
  }

  // The quick-view dialog asks for exactly one club by id; every list filter
  // steps aside so the club is found even when merged or filtered out.
  const id = (sp.get("id") ?? "").trim()

  // Completion-bucket filter (owner 2026-08-20): resolved to an id list via
  // the SQL score, then joined into the normal where so it stacks with
  // province, region, issue and search filters.
  const scoreBucket = (sp.get("score") ?? "").trim()
  let scoreIds: string[] | null = null
  {
    const b = SCORE_BUCKETS[scoreBucket]
    if (b) {
      const params: string[] = []
      let scoreWhere = `"mergedIntoId" IS NULL`
      const provinceParam = (sp.get("province") ?? "").trim()
      const regionParam = (sp.get("region") ?? "").trim()
      if (provinceParam) {
        params.push(provinceParam)
        scoreWhere += ` AND state ILIKE $${params.length}`
      }
      if (regionParam) {
        params.push(regionParam)
        scoreWhere += ` AND region ILIKE $${params.length}`
      }
      const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM "Tenant" WHERE ${scoreWhere} AND ${SCORE_SQL} BETWEEN ${b.min} AND ${b.max}`,
        ...params
      )
      scoreIds = rows.map((r) => r.id)
    }
  }

  const where: any = id
    ? { id }
    : {
        ...(scoreIds ? { id: { in: scoreIds } } : {}),
        // Merged-away rows are hidden unless explicitly asked for — otherwise every
        // list would carry the duplicates an admin has already resolved.
        ...(issue === "merged" ? {} : { mergedIntoId: null }),
        ...ISSUE_FILTERS[issue],
        ...(province ? { state: province } : {}),
        ...(region ? { region } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { city: { contains: q, mode: "insensitive" } },
                { slug: { contains: q, mode: "insensitive" } },
                { contactEmail: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      }

  const [clubs, total, counts, provinces, regions] = await Promise.all([
    prisma.tenant.findMany({
      where,
      select: {
        id: true, slug: true, name: true, city: true, state: true, region: true,
        status: true, publishedAt: true, contactEmail: true, phoneNumber: true,
        website: true, latitude: true, longitude: true, geoPrecision: true,
        dataSources: true, dataNotes: true, mergedIntoId: true, isDemo: true,
        reviewedAt: true, createdAt: true,
        // The quick-view dialog shows the whole record, not just list columns.
        shortName: true, description: true, address: true, postalCode: true,
        geoSource: true, searchAliases: true,
        _count: { select: { teams: true, clubClaims: true } },
      },
      orderBy: [{ name: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.tenant.count({ where }),
    // Counts for the queue tabs, each over the same non-issue filters so the
    // numbers agree with what clicking the tab actually shows.
    (async () => {
      const base = {
        mergedIntoId: null,
        ...(province ? { state: province } : {}),
        ...(region ? { region } : {}),
      }
      const entries = await Promise.all(
        (Object.keys(ISSUE_FILTERS) as IssueKey[]).map(async (k) => [
          k,
          await prisma.tenant.count({
            where: (k === "merged"
              ? { mergedIntoId: { not: null } }
              : { ...base, ...ISSUE_FILTERS[k] }) as any,
          }),
        ])
      )
      return Object.fromEntries(entries) as Record<IssueKey, number>
    })(),
    prisma.tenant.groupBy({
      by: ["state"],
      where: { mergedIntoId: null, state: { not: null } },
      _count: { state: true },
      orderBy: { _count: { state: "desc" } },
    }),
    prisma.tenant.groupBy({
      by: ["region"],
      where: { mergedIntoId: null, region: { not: null } },
      _count: { region: true },
      orderBy: { _count: { region: "desc" } },
      take: 40,
    }),
  ])

  // Completion analytics: how many clubs sit in each score bucket, under the
  // same base filters the issue counts use, so the numbers line up.
  const scoreParams: string[] = []
  let scoreCountWhere = `"mergedIntoId" IS NULL`
  if (province) {
    scoreParams.push(province)
    scoreCountWhere += ` AND state ILIKE $${scoreParams.length}`
  }
  if (region) {
    scoreParams.push(region)
    scoreCountWhere += ` AND region ILIKE $${scoreParams.length}`
  }
  const scoreRows = await prisma.$queryRawUnsafe<{ score: number; n: number }[]>(
    `SELECT ${SCORE_SQL} AS score, count(*)::int AS n FROM "Tenant" WHERE ${scoreCountWhere} GROUP BY 1`,
    ...scoreParams
  )
  const scores: Record<string, number> = { full: 0, high: 0, mid: 0, low: 0 }
  for (const r of scoreRows) {
    for (const [k, b] of Object.entries(SCORE_BUCKETS)) {
      if (r.score >= b.min && r.score <= b.max) scores[k] += r.n
    }
  }

  return NextResponse.json({
    clubs,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    counts,
    scores,
    provinces: provinces.map((p) => ({ code: p.state, count: p._count.state })),
    regions: regions.map((r) => ({ region: r.region, count: r._count.region })),
  })
})

const editSchema = z.object({
  action: z.literal("edit"),
  id: z.string().min(1),
  fields: z.object({
    name: z.string().trim().min(1).max(200).optional(),
    city: z.string().trim().max(120).optional(),
    state: z.string().trim().max(4).optional(),
    region: z.string().trim().max(120).optional(),
    contactEmail: z.string().trim().email().or(z.literal("")).optional(),
    phoneNumber: z.string().trim().max(40).optional(),
    website: z.string().trim().url().or(z.literal("")).optional(),
    address: z.string().trim().max(300).optional(),
    description: z.string().trim().max(2000).optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
  }),
})

const publishSchema = z.object({
  action: z.enum(["publish", "unpublish"]),
  ids: z.array(z.string().min(1)).min(1).max(500),
})

const undoMergeSchema = z.object({
  action: z.literal("undo-merge"),
  /** The club that was retired. Its most recent merge is the one undone. */
  sourceId: z.string(),
})

const mergeSchema = z.object({
  action: z.literal("merge"),
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
})

export const PATCH = withAuth<NextRequest>(async (request, _ctx, session) => {
  requirePlatformAdmin(session)
  const body = await request.json()
  const parsed = z.discriminatedUnion("action", [editSchema, publishSchema, mergeSchema, undoMergeSchema])
    .parse(body)

  if (parsed.action === "edit") {
    const before = await prisma.tenant.findUnique({ where: { id: parsed.id } })
    if (!before) return apiError(404, "Club not found", "NOT_FOUND")

    // "" means "clear this field"; an absent key means "leave it alone".
    const data: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(parsed.fields)) {
      if (v === undefined) continue
      data[k] = v === "" ? null : v
    }
    if (Object.keys(data).length === 0) return apiError(400, "No fields to update", "NO_CHANGES")

    data.reviewedAt = new Date()
    data.reviewedById = session.realUserId
    // A hand-corrected coordinate is better than a geocoded one — say so, so a
    // future re-geocode does not quietly overwrite it.
    if ("latitude" in data || "longitude" in data) data.geoSource = "manual"

    const after = await prisma.tenant.update({ where: { id: parsed.id }, data })
    await auditSafe({
      actorId: session.realUserId,
      actorRole: "PlatformAdmin",
      action: "CLUB_EDIT",
      resource: "Tenant",
      resourceId: parsed.id,
      tenantId: parsed.id,
      changes: Object.fromEntries(
        Object.keys(data).map((k) => [k, { from: (before as any)[k], to: (after as any)[k] }])
      ),
      request,
    })
    return NextResponse.json({ success: true, club: after })
  }

  if (parsed.action === "publish" || parsed.action === "unpublish") {
    const publishing = parsed.action === "publish"
    const res = await prisma.tenant.updateMany({
      where: { id: { in: parsed.ids }, mergedIntoId: null },
      data: {
        publishedAt: publishing ? new Date() : null,
        reviewedAt: new Date(),
        reviewedById: session.realUserId,
      },
    })
    await auditSafe({
      actorId: session.realUserId,
      actorRole: "PlatformAdmin",
      action: publishing ? "CLUB_PUBLISH" : "CLUB_UNPUBLISH",
      resource: "Tenant",
      resourceId: parsed.ids.length === 1 ? parsed.ids[0] : "bulk",
      metadata: { count: res.count, ids: parsed.ids.slice(0, 50) },
      request,
    })
    return NextResponse.json({ success: true, count: res.count })
  }

  if (parsed.action === "undo-merge") {
    // The plan lives on the merge's own audit row, so an undo can only ever put
    // back what that merge actually did.
    const entry = await prisma.auditLog.findFirst({
      where: {
        action: "CLUB_MERGE",
        metadata: { path: ["sourceId"], equals: parsed.sourceId },
      },
      orderBy: { createdAt: "desc" },
    })
    const plan = (entry?.metadata as any)?.undo as MergeUndoPlan | null | undefined
    if (!entry) return apiError(404, "No merge on record for that club", "NO_MERGE")
    if (!plan) {
      return apiError(
        409,
        "That merge was made before undo was recorded, so it has to be reversed by hand",
        "NO_UNDO_PLAN"
      )
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const r = await restoreMergedClub(tx, plan)
        await audit(tx, {
          actorId: session.realUserId,
          actorRole: "PlatformAdmin",
          action: "CLUB_MERGE_UNDO",
          resource: "Tenant",
          resourceId: plan.targetId,
          tenantId: plan.targetId,
          metadata: { sourceId: plan.sourceId, ...r },
          request,
        })
        return r
      })
      return NextResponse.json({ success: true, ...result })
    } catch (e) {
      if (e instanceof MergeClubsError) return apiError(400, e.message, e.code)
      throw e
    }
  }

  if (parsed.action !== "merge") return apiError(400, "Unknown action", "BAD_ACTION")

  try {
    const result = await prisma.$transaction(async (tx) => {
      const r = await absorbDuplicateClub(tx, {
        sourceId: parsed.sourceId,
        targetId: parsed.targetId,
      })
      // Audit inside the transaction so the record cannot survive a rollback.
      await audit(tx, {
        actorId: session.realUserId,
        actorRole: "PlatformAdmin",
        action: "CLUB_MERGE",
        resource: "Tenant",
        resourceId: parsed.targetId,
        tenantId: parsed.targetId,
        metadata: { sourceId: parsed.sourceId, ...r },
        request,
      })
      return r
    })
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    if (e instanceof MergeClubsError) return apiError(400, e.message, e.code)
    throw e
  }
})
