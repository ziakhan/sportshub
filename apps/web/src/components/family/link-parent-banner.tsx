"use client"

import { useEffect, useState } from "react"
import { InviteGuardianDialog } from "./invite-guardian-dialog"

/**
 * The standing link-your-parent nudge (owner ruling 2026-08-12).
 *
 * Quiet but persistent. One clear button opens one dedicated dialog: no
 * inline form competing with the dashboard, no prefilled email, no permanent
 * dismissal. "Not now" hides it for this session only, so the next visit asks
 * again until a guardian is actually attached.
 */

const DISMISS_KEY = "family-link-parent-nudge-dismissed"

export function LinkParentBanner({
  playerId,
  pendingEmail,
}: {
  playerId: string
  pendingEmail: string | null
}) {
  const [visible, setVisible] = useState(false)
  const [open, setOpen] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return
    } catch {
      // Storage blocked: show it anyway, it just comes back on every load.
    }
    setVisible(true)
  }, [])

  if (!visible) return null

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1")
    } catch {
      // Storage blocked: hiding it for this page is still the right response.
    }
    setVisible(false)
  }

  const waitingOn = sentTo ?? pendingEmail

  return (
    <>
      <div className="border-play-100 bg-play-50/70 rounded-[30px] border p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="text-ink-950 text-lg font-semibold">
              {waitingOn ? "Waiting on your parent or guardian" : "Link a parent or guardian"}
            </h2>
            <p className="text-ink-700 mt-1 text-sm">
              {waitingOn ? (
                <>
                  We sent a request to <strong>{waitingOn}</strong>. Once they accept, they can
                  approve and pay for anything you join.
                </>
              ) : (
                <>
                  A parent or guardian approves payments and permissions for you. Until one is
                  linked you can look around, but you can&apos;t join anything that costs money.
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="bg-play-600 hover:bg-play-700 cursor-pointer whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200"
            >
              {waitingOn ? "Send to a different email" : "Add my parent"}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="text-ink-400 hover:text-ink-700 cursor-pointer rounded-lg px-2 py-1 text-sm font-semibold transition-colors duration-200"
            >
              Not now
            </button>
          </div>
        </div>
      </div>

      {open ? (
        <InviteGuardianDialog
          playerId={playerId}
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
