/**
 * Absorb a duplicate player row into the survivor (parent-child linking arc
 * 2026-08-12).
 *
 * Two worlds appear whenever a parent adds their kid and the kid also signs
 * up on their own. Once someone confirms the two rows are the same person,
 * the movable history moves to the survivor and the loser is stamped and
 * soft-deleted.
 *
 * MOVED — rows whose whole meaning is "this player is in this thing", each
 * scoped by a unique key we can check first so the move can never trip a
 * duplicate-key error: team rosters, offers, tryout/camp/house-league/
 * training signups, season roster entries, 1-on-1 bookings, RSVPs, game
 * stat lines, followers.
 *
 * KEPT on the absorbed row, on purpose:
 *  - WaiverSignature / WaiverSignRequest — a signature is against the row it
 *    was signed for. Moving one would rewrite a legal record.
 *  - Story / PostTag — published social content carries its own consent and
 *    visibility settings; re-pointing it would republish under new rules.
 *  - PlayoffEligibilityOverride — a commissioner's ruling on a specific
 *    season entry, with a required audit note.
 *  - Game.playerOfTheGameId — an award on a finished game.
 *
 * The absorbed row therefore stays in the database (soft-deleted, hidden from
 * every listing) rather than being deleted: it is the anchor those records
 * still hang from.
 */

/** Tables moved wholesale, keyed by the column that makes a row unique. */
const SCOPED_MOVES: Array<{ model: string; scope: string[] }> = [
  { model: "teamPlayer", scope: ["teamId"] },
  { model: "tryoutSignup", scope: ["tryoutId"] },
  { model: "houseLeagueSignup", scope: ["houseLeagueId"] },
  { model: "campSignup", scope: ["campId"] },
  { model: "seasonRosterPlayer", scope: ["rosterId"] },
  { model: "trainingSessionSignup", scope: ["sessionId"] },
  { model: "eventRsvp", scope: ["itemType", "itemId"] },
  { model: "playerStat", scope: ["gameId"] },
  { model: "follow", scope: ["userId"] },
]

/** Tables with no player-scoped unique key — a plain re-point is safe. */
const PLAIN_MOVES = ["offer", "oneOnOneBooking"]

export interface AbsorbResult {
  moved: Record<string, number>
  /** Row counts left behind on the absorbed record, for the audit trail. */
  kept: Record<string, number>
}

async function moveScoped(
  tx: any,
  model: string,
  scope: string[],
  sourceId: string,
  targetId: string
): Promise<number> {
  const select = Object.fromEntries([["id", true], ...scope.map((s) => [s, true])])
  const sourceRows = await tx[model].findMany({ where: { playerId: sourceId }, select })
  if (sourceRows.length === 0) return 0

  const targetRows = await tx[model].findMany({ where: { playerId: targetId }, select })
  const key = (r: any) => scope.map((s) => String(r[s])).join("|")
  const taken = new Set(targetRows.map(key))

  // The survivor is already in this team/tryout/game: the duplicate's row
  // says nothing new, and keeping it would collide on the unique key.
  const collisions = sourceRows.filter((r: any) => taken.has(key(r))).map((r: any) => r.id)
  if (collisions.length > 0) {
    await tx[model].deleteMany({ where: { id: { in: collisions } } })
  }

  const res = await tx[model].updateMany({
    where: { playerId: sourceId },
    data: { playerId: targetId },
  })
  return res.count
}

/**
 * Move what can move, stamp the rest. Runs inside the caller's transaction so
 * a half-merged family is never committed.
 */
export async function absorbDuplicatePlayer(
  tx: any,
  { sourceId, targetId }: { sourceId: string; targetId: string }
): Promise<AbsorbResult> {
  if (sourceId === targetId) return { moved: {}, kept: {} }

  const moved: Record<string, number> = {}
  for (const { model, scope } of SCOPED_MOVES) {
    const count = await moveScoped(tx, model, scope, sourceId, targetId)
    if (count > 0) moved[model] = count
  }
  for (const model of PLAIN_MOVES) {
    const res = await tx[model].updateMany({
      where: { playerId: sourceId },
      data: { playerId: targetId },
    })
    if (res.count > 0) moved[model] = res.count
  }

  const kept: Record<string, number> = {}
  for (const model of [
    "waiverSignature",
    "waiverSignRequest",
    "story",
    "postTag",
    "playoffEligibilityOverride",
  ]) {
    const count = await tx[model].count({ where: { playerId: sourceId } })
    if (count > 0) kept[model] = count
  }

  const source = await tx.player.findUnique({
    where: { id: sourceId },
    select: { handle: true },
  })
  const target = await tx.player.findUnique({
    where: { id: targetId },
    select: { handle: true },
  })

  // Free the unique columns before the survivor takes them: one login and one
  // handle can only ever point at a single row.
  await tx.player.update({
    where: { id: sourceId },
    data: {
      userId: null,
      handle: null,
      deletedAt: new Date(),
      absorbedIntoPlayerId: targetId,
      absorbedAt: new Date(),
    },
  })

  // The kid picked that handle and shared it — it follows them to the row
  // that survives, unless the survivor already has one.
  if (source?.handle && !target?.handle) {
    await tx.player.update({ where: { id: targetId }, data: { handle: source.handle } })
  }

  // Any other pending invite on the absorbed row is about a link that just
  // happened a different way.
  await tx.familyInvitation.updateMany({
    where: { playerId: sourceId, status: "PENDING" },
    data: { status: "EXPIRED", respondedAt: new Date() },
  })

  return { moved, kept }
}

/**
 * The guard that has always stood in front of an absorb, lifted out of the
 * invitation accept route (2026-08-13) so the apply-merge endpoint cannot
 * drift from it.
 *
 * Three questions, asked inside the transaction so a row that changed hands
 * a moment ago cannot slip through:
 *  - is the surviving row still there?
 *  - does it belong to the person asking?
 *  - is somebody else already signing in to it?
 *
 * `loginUserId` moves the kid's login onto the survivor. Null leaves the
 * survivor's login alone, which is what merging two parent-managed rows
 * wants.
 */
export async function absorbIntoGuardianRow(
  tx: any,
  {
    actorUserId,
    source,
    targetId,
    loginUserId,
  }: {
    actorUserId: string
    source: { id: string; userId: string | null }
    targetId: string
    loginUserId: string | null
  }
): Promise<AbsorbResult> {
  const target = await tx.player.findUnique({
    where: { id: targetId },
    select: { id: true, parentId: true, userId: true, deletedAt: true },
  })
  if (!target || target.deletedAt) throw new Error("CLAIM_TARGET_GONE")
  if (target.parentId !== actorUserId) throw new Error("CLAIM_TARGET_NOT_YOURS")
  if (target.userId && target.userId !== source.userId) throw new Error("CLAIM_TARGET_TAKEN")

  const absorbed = await absorbDuplicatePlayer(tx, { sourceId: source.id, targetId: target.id })
  if (loginUserId) {
    await tx.player.update({
      where: { id: target.id },
      data: { userId: loginUserId, canLogin: true },
    })
  }
  return absorbed
}

/**
 * Same person? Name and birth year, nothing cleverer. Names are compared
 * case- and space-insensitively; the birth year is the platform's single
 * age key everywhere else, so a day-off date of birth still matches.
 */
export function looksLikeSamePlayer(
  a: { firstName: string; lastName: string; dateOfBirth: Date },
  b: { firstName: string; lastName: string; dateOfBirth: Date }
): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ")
  return (
    norm(a.firstName) === norm(b.firstName) &&
    norm(a.lastName) === norm(b.lastName) &&
    new Date(a.dateOfBirth).getFullYear() === new Date(b.dateOfBirth).getFullYear()
  )
}
