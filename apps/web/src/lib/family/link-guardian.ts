/**
 * Attaching a guardian to a player, in one place (parent-child linking arc,
 * extracted 2026-08-13).
 *
 * Two doors now open on the same room: accepting a GUARDIAN invitation by
 * email, and redeeming a link code handed over in person. Both mean the same
 * thing in the database, so both call this: `Player.parentId` becomes the
 * guardian AND payer of record, and the guardian holds the Parent role.
 * Existing obligations keep the payer they were created with.
 *
 * Takes the caller's transaction client so a half-linked family is never
 * committed.
 */

/** Roles accrue from actions: becoming someone's guardian makes you a Parent. */
export async function ensureParentRole(tx: any, userId: string): Promise<void> {
  const existing = await tx.userRole.findFirst({
    where: { userId, role: "Parent", tenantId: null, teamId: null },
    select: { id: true },
  })
  if (!existing) {
    await tx.userRole.create({ data: { userId, role: "Parent" } })
  }
}

export async function linkGuardianToPlayer(
  tx: any,
  { playerId, parentUserId }: { playerId: string; parentUserId: string }
): Promise<void> {
  await tx.player.update({ where: { id: playerId }, data: { parentId: parentUserId } })
  await ensureParentRole(tx, parentUserId)
}
