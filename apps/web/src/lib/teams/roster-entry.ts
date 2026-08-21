/**
 * The single write that puts an accepted player onto a team roster.
 *
 * Two callers, one path: offer acceptance (a team offer) and tryout-pool
 * assignment (a teamless age-group offer that was accepted earlier, the team
 * arriving later). Upsert, so re-running is harmless and a previously released
 * row comes back ACTIVE rather than stranding a stale leftAt.
 *
 * Pass the transaction client — roster formation always belongs to the
 * transaction that caused it.
 */
export interface RosterGear {
  uniformSize?: string | null
  shoeSize?: string | null
  tracksuitSize?: string | null
}

export async function addAcceptedPlayerToTeam(
  tx: any,
  input: { teamId: string; playerId: string } & RosterGear
): Promise<{ id: string }> {
  return tx.teamPlayer.upsert({
    where: { teamId_playerId: { teamId: input.teamId, playerId: input.playerId } },
    create: {
      teamId: input.teamId,
      playerId: input.playerId,
      uniformSize: input.uniformSize || null,
      shoeSize: input.shoeSize || null,
      tracksuitSize: input.tracksuitSize || null,
      status: "ACTIVE",
    },
    update: {
      status: "ACTIVE",
      leftAt: null,
      uniformSize: input.uniformSize || null,
      shoeSize: input.shoeSize || null,
      tracksuitSize: input.tracksuitSize || null,
    },
  })
}
