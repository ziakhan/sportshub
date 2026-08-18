/**
 * Merge a duplicate club into the one that survives.
 *
 * The census produced ~1,700 clubs from many overlapping sources, and research
 * classified 78 groups (165 clubs) as the same organisation written several
 * ways — "Brantford CYO Hawks" / "Brantford CYO Boys" / "Brantford Hawks".
 * Leaving those split is not cosmetic: an owner claims one row and the twins
 * linger as orphan listings that nobody can correct.
 *
 * Deliberately modelled on lib/family/merge-players.ts, which solves the same
 * problem for duplicate kids: survivor/source rather than a selected set, an
 * explicit table-by-table move ledger, and a SOFT delete so nothing that
 * already points at the absorbed row breaks.
 */

/**
 * Tables whose rows move wholesale to the survivor.
 *
 * `scope` names the columns that, together with tenantId, make a row unique —
 * a row whose scope already exists on the survivor is dropped rather than
 * moved, because moving it would violate the unique constraint.
 */
// Scopes below mirror the real @@unique declarations in prisma/schema.prisma —
// get one wrong and the merge either drops rows it should have moved or blows
// up on a constraint mid-transaction.
const SCOPED_MOVES: Array<{ model: string; scope: string[] }> = [
  { model: "team", scope: ["name", "ageGroup", "season"] }, // @@unique([tenantId, name, ageGroup, season])
  { model: "clubClaim", scope: ["userId"] }, // @@unique([tenantId, userId])
  { model: "userRole", scope: ["userId", "role", "teamId", "leagueId", "gameId"] },
  { model: "follow", scope: ["userId"] }, // @@unique([userId, tenantId])
  { model: "clubSeasonEntry", scope: ["seasonId"] }, // @@unique([seasonId, tenantId])
  { model: "communicationConsent", scope: ["userId", "scope", "leagueId"] },
]

/** Tables with no tenant-scoped unique key — a plain re-point is safe. */
const PLAIN_MOVES = [
  "review", // no tenant-scoped unique constraint
  "tryout",
  "venue",
  "practice",
  "announcement",
  "houseLeague",
  "camp",
  "poll",
  "offerTemplate",
  "staffInvitation",
  "playerInvitation",
  "reviewInvite",
  "trainingSession",
  "trainerAvailability",
  "oneOnOneBooking",
  "tournament",
  "waiverDocument",
  "postTag",
  "payment",
  "messageLog",
  "auditLog",
]

/**
 * Never moved.
 *
 * TenantBranding/TenantFeatures are 1:1 with a tenant and the survivor has its
 * own; PaymentConfig and TrainerProfile likewise. Moving them would collide on
 * the unique tenantId. They are counted for the audit trail and left to be
 * removed with the source row.
 */
const KEPT_ON_SOURCE = [
  "tenantBranding",
  "tenantFeatures",
  "paymentConfig",
  "trainerProfile",
  "publicPageView",
]

/** Fields where a blank on the survivor should be filled from the source. */
const FILLABLE = [
  "description",
  "phoneNumber",
  "contactEmail",
  "address",
  "city",
  "state",
  "zipCode",
  "postalCode",
  "website",
  "region",
  "latitude",
  "longitude",
  "placeId",
  "geoPrecision",
  "geoSource",
] as const

export interface MergeClubsResult {
  moved: Record<string, number>
  kept: Record<string, number>
  filled: string[]
  /** Everything needed to put this merge back, or null when it is too big to record. */
  undo: MergeUndoPlan | null
}

/**
 * The receipt for a merge.
 *
 * Counts alone cannot be reversed: once two clubs with real activity are one,
 * nothing says whose team was whose. So the merge writes down the actual row
 * ids it moved and the exact values it wrote, and undo puts back only those,
 * and only where they are still untouched.
 */
export interface MergeUndoPlan {
  sourceId: string
  targetId: string
  /** model -> ids moved onto the survivor. */
  movedIds: Record<string, string[]>
  /** Fields the merge wrote on the survivor, and what it wrote. */
  filledValues: Record<string, unknown>
  /** What the retired club looked like before it was retired. */
  source: { slug: string; status: string; publishedAt: string | null }
  /** The survivor's provenance string before the merge appended to it. */
  targetDataSources: string | null
}

/**
 * Above this many moved rows the plan is not stored. A merge that large is a
 * data-migration decision rather than a mis-click, and bloating every audit row
 * to cover it would cost more than it saves.
 */
const MAX_UNDO_ROWS = 5000

export class MergeClubsError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message)
  }
}

async function moveScoped(
  tx: any,
  model: string,
  scope: string[],
  sourceId: string,
  targetId: string
): Promise<string[]> {
  const rows = await tx[model].findMany({ where: { tenantId: sourceId } })
  if (!rows.length) return []
  const existing = await tx[model].findMany({ where: { tenantId: targetId } })
  const taken = new Set(existing.map((r: any) => scope.map((k) => String(r[k])).join("\u0000")))

  const moved: string[] = []
  for (const row of rows) {
    const key = scope.map((k) => String(row[k])).join("\u0000")
    if (taken.has(key)) continue // survivor already has this one
    await tx[model].update({ where: { id: row.id }, data: { tenantId: targetId } })
    taken.add(key)
    moved.push(row.id)
  }
  return moved
}

/**
 * Move everything from `sourceId` onto `targetId` and soft-delete the source.
 *
 * Must be called inside a transaction — a half-applied merge leaves rows
 * pointing at a club that is already marked absorbed.
 */
export async function absorbDuplicateClub(
  tx: any,
  { sourceId, targetId }: { sourceId: string; targetId: string }
): Promise<MergeClubsResult> {
  if (sourceId === targetId) {
    throw new MergeClubsError("A club cannot be merged into itself", "SAME_CLUB")
  }

  const [source, target] = await Promise.all([
    tx.tenant.findUnique({ where: { id: sourceId } }),
    tx.tenant.findUnique({ where: { id: targetId } }),
  ])
  if (!source) throw new MergeClubsError("Source club not found", "SOURCE_NOT_FOUND")
  if (!target) throw new MergeClubsError("Target club not found", "TARGET_NOT_FOUND")
  if (source.mergedIntoId) {
    throw new MergeClubsError("Source club has already been merged", "ALREADY_MERGED")
  }
  if (target.mergedIntoId) {
    throw new MergeClubsError(
      "Target club has itself been merged away — merge into its survivor instead",
      "TARGET_MERGED"
    )
  }
  // Two claimed clubs means two real owners. Which one survives is a decision
  // about people, not data, so refuse rather than silently strip someone's club.
  if (source.status === "ACTIVE" && target.status === "ACTIVE") {
    throw new MergeClubsError(
      "Both clubs are claimed — resolve ownership before merging",
      "BOTH_CLAIMED"
    )
  }

  const moved: Record<string, number> = {}
  const movedIds: Record<string, string[]> = {}
  for (const { model, scope } of SCOPED_MOVES) {
    const ids = await moveScoped(tx, model, scope, sourceId, targetId)
    if (ids.length) {
      moved[model] = ids.length
      movedIds[model] = ids
    }
  }
  for (const model of PLAIN_MOVES) {
    // Read the ids before moving: afterwards these rows are indistinguishable
    // from the ones the survivor already had.
    const rows = await tx[model].findMany({
      where: { tenantId: sourceId },
      select: { id: true },
    })
    if (!rows.length) continue
    await tx[model].updateMany({ where: { tenantId: sourceId }, data: { tenantId: targetId } })
    moved[model] = rows.length
    movedIds[model] = rows.map((r: any) => r.id)
  }

  const kept: Record<string, number> = {}
  for (const model of KEPT_ON_SOURCE) {
    const count = await tx[model].count({ where: { tenantId: sourceId } })
    if (count > 0) kept[model] = count
  }

  // Survivorship: the target's own values win; blanks are filled from the
  // source so a merge never loses a contact or a coordinate we already had.
  const fill: Record<string, unknown> = {}
  const filled: string[] = []
  for (const f of FILLABLE) {
    const t = (target as any)[f]
    const s = (source as any)[f]
    if ((t === null || t === undefined || t === "") && s !== null && s !== undefined && s !== "") {
      fill[f] = s
      filled.push(f)
    }
  }
  // Provenance from both sides, so the survivor records where it all came from.
  const sources = new Set(
    [target.dataSources, source.dataSources]
      .filter(Boolean)
      .flatMap((v) => String(v).split(","))
      .map((v) => v.trim())
      .filter(Boolean)
  )
  if (sources.size) fill.dataSources = [...sources].sort().join(",")

  if (Object.keys(fill).length) {
    await tx.tenant.update({ where: { id: targetId }, data: fill })
  }

  // Soft-delete. A hard delete would orphan any claim already made against the
  // source and break links people may have shared. Free the unique columns
  // first — slug and customDomain can only belong to one row.
  await tx.tenant.update({
    where: { id: sourceId },
    data: {
      slug: `merged-${sourceId.slice(0, 8)}-${source.slug}`.slice(0, 60),
      customDomain: null,
      status: "SUSPENDED",
      publishedAt: null,
      mergedIntoId: targetId,
      mergedAt: new Date(),
    },
  })

  const rowCount = Object.values(movedIds).reduce((a, ids) => a + ids.length, 0)
  const undo: MergeUndoPlan | null =
    rowCount > MAX_UNDO_ROWS
      ? null
      : {
          sourceId,
          targetId,
          movedIds,
          filledValues: Object.fromEntries(filled.map((f) => [f, fill[f]])),
          source: {
            slug: source.slug,
            status: source.status,
            publishedAt: source.publishedAt ? source.publishedAt.toISOString() : null,
          },
          targetDataSources: target.dataSources ?? null,
        }

  return { moved, kept, filled, undo }
}

/**
 * Put a merge back.
 *
 * Deliberately conservative: a row only returns if it is still sitting on the
 * survivor, and a field is only cleared if it still holds exactly what the
 * merge wrote. Anything edited since is left alone, so an undo can never
 * quietly discard someone's later work.
 */
export async function restoreMergedClub(
  tx: any,
  plan: MergeUndoPlan
): Promise<{ returned: Record<string, number>; skipped: number; cleared: string[] }> {
  const [source, target] = await Promise.all([
    tx.tenant.findUnique({ where: { id: plan.sourceId } }),
    tx.tenant.findUnique({ where: { id: plan.targetId } }),
  ])
  if (!source) throw new MergeClubsError("Retired club not found", "SOURCE_NOT_FOUND")
  if (!target) throw new MergeClubsError("Surviving club not found", "TARGET_NOT_FOUND")
  if (source.mergedIntoId !== plan.targetId) {
    throw new MergeClubsError(
      "This merge has already been undone, or the club has since been merged elsewhere",
      "NOT_MERGED_HERE"
    )
  }

  const returned: Record<string, number> = {}
  let skipped = 0
  for (const [model, ids] of Object.entries(plan.movedIds)) {
    if (!ids.length || !tx[model]) continue
    const res = await tx[model].updateMany({
      where: { id: { in: ids }, tenantId: plan.targetId },
      data: { tenantId: plan.sourceId },
    })
    if (res.count > 0) returned[model] = res.count
    skipped += ids.length - res.count
  }

  const revert: Record<string, unknown> = {}
  const cleared: string[] = []
  for (const [field, written] of Object.entries(plan.filledValues)) {
    if ((target as any)[field] === written) {
      revert[field] = null
      cleared.push(field)
    }
  }
  if (target.dataSources !== plan.targetDataSources) {
    revert.dataSources = plan.targetDataSources
  }
  if (Object.keys(revert).length) {
    await tx.tenant.update({ where: { id: plan.targetId }, data: revert })
  }

  await tx.tenant.update({
    where: { id: plan.sourceId },
    data: {
      slug: plan.source.slug,
      status: plan.source.status,
      publishedAt: plan.source.publishedAt ? new Date(plan.source.publishedAt) : null,
      mergedIntoId: null,
      mergedAt: null,
    },
  })

  return { returned, skipped, cleared }
}

/** Follow a merge chain to the club that actually survives. */
export async function resolveSurvivor(db: any, tenantId: string): Promise<string> {
  let id = tenantId
  for (let hops = 0; hops < 10; hops++) {
    const t = await db.tenant.findUnique({
      where: { id },
      select: { mergedIntoId: true },
    })
    if (!t?.mergedIntoId) return id
    id = t.mergedIntoId
  }
  return id // cycle guard: stop rather than loop forever
}
