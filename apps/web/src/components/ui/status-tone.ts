import type { BadgeTone } from "./badge"

/**
 * Canonical status → badge-tone map for the whole platform, so a PENDING
 * offer, a PENDING claim, and a PENDING signup all read the same color.
 * Statuses are uppercase enum values as stored in the DB. When two domains
 * share a status word they share a tone by design — if a domain genuinely
 * needs a different tone, pass an explicit `tone` at the call site rather
 * than forking this map.
 */
const STATUS_TONES: Record<string, BadgeTone> = {
  // Draft / awaiting action
  DRAFT: "neutral",
  PENDING: "gold",
  INVITED: "gold",
  REQUESTED: "gold",
  IN_REVIEW: "gold",
  EMAIL_SENT: "gold",
  EMAIL_VERIFIED: "play",

  // Open / positive / active
  ACTIVE: "court",
  ACCEPTED: "court",
  APPROVED: "court",
  CONFIRMED: "court",
  PAID: "court",
  PUBLISHED: "court",
  OPEN: "court",
  REGISTRATION: "court",
  CHECKED_IN: "court",

  // In progress
  IN_PROGRESS: "play",
  SCHEDULED: "play",
  SCHEDULING: "play",
  PARTIALLY_PAID: "play",
  SUBMITTED: "play",

  // Live
  LIVE: "live",

  // Negative / closed
  DECLINED: "hoop",
  REJECTED: "hoop",
  DEFAULTED: "hoop",
  SUSPENDED: "hoop",
  OVERDUE: "hoop",

  // Terminal / inert
  EXPIRED: "neutral",
  RESCINDED: "neutral",
  REVOKED: "neutral",
  CANCELLED: "neutral",
  WITHDRAWN: "neutral",
  WAIVED: "neutral",
  REFUNDED: "neutral",
  ARCHIVED: "neutral",
  COMPLETED: "neutral",
  FINALIZED: "neutral",
  LOCKED: "neutral",
  CLOSED: "neutral",
  UNCLAIMED: "neutral",
}

export function toneForStatus(status: string): BadgeTone {
  return STATUS_TONES[status.toUpperCase()] ?? "neutral"
}
