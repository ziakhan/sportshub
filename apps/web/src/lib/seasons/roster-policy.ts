/**
 * When may a club touch a league-submitted roster?
 *
 * Unlocked roster (registration phase, or a commissioner just approved a
 * change request) → edit freely. Locked roster → the season's policy rules:
 *   OPEN_UNTIL_DEADLINE — edit directly until rosterChangeDeadline passes,
 *     then fall back to asking;
 *   REQUEST_ONLY        — always ask the commissioner;
 *   CLOSED              — locked means locked.
 */

export interface RosterEditability {
  canEdit: boolean
  canRequest: boolean
  reason: string
}

export function evaluateRosterEdit(opts: {
  isLocked: boolean
  policy: string
  deadline: Date | string | null
  now?: Date
}): RosterEditability {
  const now = opts.now ?? new Date()
  const deadline = opts.deadline ? new Date(opts.deadline) : null

  if (!opts.isLocked) {
    return { canEdit: true, canRequest: false, reason: "Roster is open for changes." }
  }

  if (opts.policy === "OPEN_UNTIL_DEADLINE") {
    if (deadline && now < deadline) {
      return {
        canEdit: true,
        canRequest: false,
        reason: `League allows roster changes until ${deadline.toLocaleDateString()}.`,
      }
    }
    return {
      canEdit: false,
      canRequest: true,
      reason: deadline
        ? "The roster-change deadline has passed — changes need league approval."
        : "Roster is locked — changes need league approval.",
    }
  }

  if (opts.policy === "CLOSED") {
    return {
      canEdit: false,
      canRequest: false,
      reason: "This league does not allow roster changes after lock.",
    }
  }

  // REQUEST_ONLY (default)
  return {
    canEdit: false,
    canRequest: true,
    reason: "Roster is locked — ask the league to approve a change.",
  }
}
