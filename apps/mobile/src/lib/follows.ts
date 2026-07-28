import { apiJson } from "@/lib/api"

/**
 * Follow/unfollow a club, team, league or player — native twin of the web
 * follow-button.tsx, hitting the SAME /api/follows routes (parity law: one
 * data source per surface, no hand-rolled mobile endpoint). Club/team/league
 * follows are always instant (ACTIVE); player follows can come back PENDING
 * when the player is PRIVATE (social-feed-plan P3) — the parent/13+ player
 * approves from the web player-edit page for now, native has no approval UI
 * yet, so native screens that follow players should treat PENDING as
 * "Requested" and not offer a decision surface.
 */

export interface FollowTarget {
  tenantId?: string
  teamId?: string
  leagueId?: string
  playerId?: string
}

export type FollowState = "NONE" | "PENDING" | "ACTIVE"

export interface FollowStatusResult {
  following: boolean
  status: FollowState
}

function targetQuery(target: FollowTarget): string {
  const params = new URLSearchParams()
  if (target.tenantId) params.set("tenantId", target.tenantId)
  if (target.teamId) params.set("teamId", target.teamId)
  if (target.leagueId) params.set("leagueId", target.leagueId)
  if (target.playerId) params.set("playerId", target.playerId)
  return params.toString()
}

/** GET /api/follows/status — the viewer's follow state for one target. Signed-in only. */
export async function fetchFollowStatus(target: FollowTarget): Promise<FollowStatusResult> {
  return apiJson<FollowStatusResult>(`/api/follows/status?${targetQuery(target)}`)
}

/** POST /api/follows — follow (idempotent); returns PENDING for a private player. */
export async function followTarget(
  target: FollowTarget
): Promise<{ following: boolean; status: FollowState }> {
  return apiJson(`/api/follows`, {
    method: "POST",
    body: JSON.stringify(target),
  })
}

/** DELETE /api/follows — unfollow, or cancel a pending player-follow request. */
export async function unfollowTarget(target: FollowTarget): Promise<{ following: boolean }> {
  return apiJson(`/api/follows`, {
    method: "DELETE",
    body: JSON.stringify(target),
  })
}
