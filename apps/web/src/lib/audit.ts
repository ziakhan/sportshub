import { prisma } from "@youthbasketballhub/db"

/**
 * Audit trail service — the single write path to AuditLog.
 *
 * The model existed since Sprint 1 but had ZERO write sites; impersonation,
 * claim approvals, and admin edits left no trail. Wire every security-
 * sensitive mutation through here.
 *
 * Pass `db` = the transaction client when the action itself is transactional,
 * so the audit row commits/rolls back atomically with the action.
 */

export type AuditAction =
  | "IMPERSONATE_START"
  | "IMPERSONATE_STOP"
  | "CLAIM_APPROVE"
  | "CLAIM_REJECT"
  | "CLAIM_VERIFY_CODE"
  // v2 (owner 2026-07-18): anonymous claim binds to a User at token redemption
  | "CLAIM_COMPLETE"
  | "ROLE_GRANT"
  | "ROLE_REVOKE"
  | "ROLE_SWITCH"
  | "CLUB_SUSPEND"
  | "CLUB_REACTIVATE"
  | "CLUB_PLAN_CHANGE"
  | "CLUB_OWNERSHIP_TRANSFER"
  | "CLUB_FEATURE"
  // Club lifecycle tool (2026-08-15): the census import made ~1,700 clubs
  // editable by admins, so every hand-edit, publish and merge is recorded.
  | "CLUB_EDIT"
  | "CLUB_PUBLISH"
  | "CLUB_UNPUBLISH"
  | "CLUB_MERGE"
  | "CLUB_MERGE_UNDO"
  // Machine-edit review (owner 2026-08-20): a pipeline writing to a club is
  // flagged for a human, and keeping or putting back that value is recorded.
  | "CLUB_ENRICHMENT_APPROVE"
  | "CLUB_ENRICHMENT_REVERT"
  | "CLUB_UNFEATURE"
  // Manual roster + game operations — the escape hatches leave a trail
  | "ROSTER_PLAYER_ADD"
  | "ROSTER_PLAYER_RELEASE"
  | "ROSTER_JERSEY_CHANGE"
  | "ROSTER_VERSION_EDIT"
  | "LEAGUE_ROSTER_EDIT"
  // Club-side finalize/unfinalize (owner ruling 2026-08-11, QA T-017)
  | "ROSTER_FINALIZED"
  | "ROSTER_UNFINALIZED"
  | "PLAYOFF_ELIGIBILITY_OVERRIDE"
  | "SEASON_CLONED"
  | "REFEREE_ASSIGN"
  | "REFEREE_UNASSIGN"
  | "SCOREKEEPER_ASSIGN"
  | "SCOREKEEPER_UNASSIGN"
  | "GAME_MANUAL_CREATE"
  | "USER_UPDATE"
  | "USER_STATUS_CHANGE"
  // G2 (owner decision): cross-club recruiting offers are allowed on purpose,
  // but every one leaves a trail.
  | "OFFER_CROSS_CLUB_RECRUIT"
  // Tryout pool (owner rulings 2026-08-20). Assignment is a free market with
  // no authority policy, so the trail is what tells a club who moved whom.
  | "TRYOUT_POOL_SYNC"
  | "TRYOUT_POOL_ADD"
  | "TRYOUT_POOL_OFFERS_SENT"
  | "TRYOUT_POOL_ASSIGN"
  | "TRYOUT_POOL_UNASSIGN"
  | "TRYOUT_POOL_RELEASE_REQUEST"
  | "TRYOUT_POOL_RELEASE_RESOLVE"
  | "TRYOUT_TEAM_FINALIZED"
  // Live streaming (docs/roadmap/live-streaming-plan.md, phase 1). Placement
  // is the one human touch in the whole system and it points a camera at
  // children, so every move is on the record: who put which rig on which
  // court, who took a rig off somebody else's live game, and every manual
  // per-game override of the automatic mapping.
  | "STREAM_CHANNEL_CREATE"
  | "STREAM_CHANNEL_UPDATE"
  | "STREAM_CHANNEL_PLACE"
  // The other half of a placement: one floor holds one camera, so placing a
  // rig un-places whoever was standing there. A rig that quietly stopped
  // covering its games needs a name against it.
  | "STREAM_CHANNEL_DISPLACE"
  | "STREAM_TAKEOVER"
  | "STREAM_MANUAL_MAP"
  // Money routes (security audit M1, 2026-08-21): every refund, waive, offline
  // cash record and payment-config change leaves who/when/what/amount.
  | "PAYMENT_REFUND"
  | "OBLIGATION_WAIVE"
  | "OFFLINE_PAYMENT_RECORD"
  | "PAYMENT_CONFIG_CHANGE"

interface AuditEntry {
  /** The REAL actor (for impersonation events: the admin, not the target). */
  actorId: string
  /** The actor's role in the context of this action. */
  actorRole: string
  action: AuditAction
  resource: string
  resourceId: string
  tenantId?: string | null
  changes?: Record<string, unknown>
  metadata?: Record<string, unknown>
  /** Source request, for IP/user-agent capture. */
  request?: Request
}

function clientInfo(request?: Request): { ipAddress: string; userAgent: string } {
  if (!request) return { ipAddress: "unknown", userAgent: "unknown" }
  const forwarded = request.headers.get("x-forwarded-for")
  return {
    ipAddress: forwarded?.split(",")[0]?.trim() || "unknown",
    userAgent: request.headers.get("user-agent") || "unknown",
  }
}

type DbClient =
  | Pick<typeof prisma, "auditLog">
  | { auditLog: { create: (args: any) => Promise<unknown> } }

export async function audit(db: DbClient, entry: AuditEntry): Promise<void> {
  const { ipAddress, userAgent } = clientInfo(entry.request)
  await (db as any).auditLog.create({
    data: {
      userId: entry.actorId,
      userRole: entry.actorRole,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      tenantId: entry.tenantId ?? null,
      ipAddress,
      userAgent,
      changes: entry.changes ?? undefined,
      metadata: entry.metadata ?? undefined,
    },
  })
}

/**
 * Non-transactional convenience that never throws — for call sites where the
 * primary action must not fail because audit persistence hiccuped.
 */
export async function auditSafe(entry: AuditEntry): Promise<void> {
  try {
    await audit(prisma, entry)
  } catch (error) {
    console.error("Audit write failed:", entry.action, entry.resourceId, error)
  }
}
