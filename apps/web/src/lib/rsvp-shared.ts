/**
 * RSVP helpers safe for both server and client bundles (no Prisma import).
 * Server-side item resolution and notifications live in lib/rsvp.ts.
 */

export type RsvpStatus = "GOING" | "NOT_GOING" | "MAYBE"
export type RsvpItemType = "PRACTICE" | "GAME" | "TEAM_EVENT"

export const RSVP_STATUSES: readonly RsvpStatus[] = ["GOING", "NOT_GOING", "MAYBE"]

/** Map key for one calendar item — "PRACTICE:<id>" etc. */
export function rsvpKey(itemType: RsvpItemType, itemId: string): string {
  return `${itemType}:${itemId}`
}

export interface RsvpSummary {
  going: number
  notGoing: number
  maybe: number
  noReply: number
}

/** "9 going · 2 out · 3 no reply" numbers for one item's roster. */
export function summarizeRsvps(
  rosterCount: number,
  statuses: Iterable<RsvpStatus>
): RsvpSummary {
  const summary: RsvpSummary = { going: 0, notGoing: 0, maybe: 0, noReply: 0 }
  let responded = 0
  for (const status of statuses) {
    responded++
    if (status === "GOING") summary.going++
    else if (status === "NOT_GOING") summary.notGoing++
    else summary.maybe++
  }
  summary.noReply = Math.max(0, rosterCount - responded)
  return summary
}

export function formatRsvpSummary(s: RsvpSummary): string {
  const parts = [`${s.going} going`]
  if (s.notGoing > 0) parts.push(`${s.notGoing} out`)
  if (s.maybe > 0) parts.push(`${s.maybe} maybe`)
  parts.push(`${s.noReply} no reply`)
  return parts.join(" · ")
}
