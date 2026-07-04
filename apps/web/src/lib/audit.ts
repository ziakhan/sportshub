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
  | "ROLE_GRANT"
  | "ROLE_REVOKE"
  | "ROLE_SWITCH"
  | "CLUB_SUSPEND"
  | "CLUB_REACTIVATE"
  | "CLUB_PLAN_CHANGE"
  | "CLUB_OWNERSHIP_TRANSFER"
  | "USER_UPDATE"
  | "USER_STATUS_CHANGE"
  // G2 (owner decision): cross-club recruiting offers are allowed on purpose,
  // but every one leaves a trail.
  | "OFFER_CROSS_CLUB_RECRUIT"

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
