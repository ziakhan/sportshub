"use client"

import { useState } from "react"
import { InviteGuardianDialog } from "./invite-guardian-dialog"

/**
 * Client half of the money gate (owner ruling 2026-08-12).
 *
 * Payable API routes answer a 13-17 self-owned account with one of two
 * shapes instead of a payment form:
 *  - 202 { routedToParent } — the ask went to their guardian.
 *  - 409 { needsGuardian, playerId } — nobody is there to approve it yet.
 * Every payable surface reads them the same way, so the kid gets the same
 * calm sentence whether they were on an offer, a tryout, or the payments
 * page.
 */

export interface MinorGateOutcome {
  kind: "routed" | "needsGuardian"
  message: string
  playerId: string | null
}

/** Returns the gate outcome, or null when this response is ordinary. */
export function readMinorGate(res: Response, body: any): MinorGateOutcome | null {
  if (res.status === 202 && body?.routedToParent) {
    return { kind: "routed", message: body.message || "Sent to your parent to approve and pay.", playerId: null }
  }
  if (res.status === 409 && body?.needsGuardian) {
    return {
      kind: "needsGuardian",
      message:
        body.error || "Your parent or guardian needs to approve and pay this. Add them to continue.",
      playerId: body.playerId ?? null,
    }
  }
  return null
}

export function MinorGateNotice({ outcome }: { outcome: MinorGateOutcome }) {
  const [open, setOpen] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  if (outcome.kind === "routed") {
    return (
      <div className="border-court-200 bg-court-50/60 text-court-700 rounded-xl border p-4 text-sm font-semibold">
        {outcome.message}
      </div>
    )
  }

  return (
    <>
      <div className="border-play-100 bg-play-50/70 rounded-xl border p-4">
        <p className="text-ink-800 text-sm font-semibold">{outcome.message}</p>
        {sentTo ? (
          <p className="text-ink-600 mt-2 text-sm">
            Sent to {sentTo}. Once they accept, come back and finish this.
          </p>
        ) : outcome.playerId ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="bg-play-600 hover:bg-play-700 mt-3 cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors duration-200"
          >
            Add my parent
          </button>
        ) : null}
      </div>

      {open && outcome.playerId ? (
        <InviteGuardianDialog
          playerId={outcome.playerId}
          onClose={() => setOpen(false)}
          onSent={(email) => {
            setSentTo(email)
            setOpen(false)
          }}
        />
      ) : null}
    </>
  )
}
