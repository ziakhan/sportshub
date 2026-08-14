"use client"

import { useState } from "react"
import { BrandCheckbox } from "@/components/ui"
import { CodeInput, MergeOffer, useRedeemCode } from "./link-code"

/**
 * The one dialog that links a parent or guardian (parent-child linking arc
 * 2026-08-12, code path added 2026-08-13). Opened from the dashboard nudge and
 * from every payable action a 13-17 self-owned account runs into, so the ask
 * reads the same everywhere and there is only one form to keep honest.
 *
 * Two ways in, one outcome: email them a link, or type the six characters
 * their parent is holding. The code links on the spot, because handing it over
 * in person IS the consent.
 */
export function InviteGuardianDialog({
  playerId,
  onClose,
  onSent,
  onLinked,
}: {
  playerId: string
  onClose: () => void
  onSent: (email: string) => void
  /** Called once a code has linked the accounts. Defaults to a reload. */
  onLinked?: () => void
}) {
  const [mode, setMode] = useState<"email" | "code">("email")
  const [email, setEmail] = useState("")
  const [alreadyAdded, setAlreadyAdded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const redeemer = useRedeemCode()

  function finishLinked() {
    if (onLinked) onLinked()
    else window.location.reload()
  }

  async function send() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/family-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "GUARDIAN",
          playerId,
          email: email.trim(),
          preferClaim: alreadyAdded,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "We couldn't send that")
      onSent(email.trim())
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't send that")
    } finally {
      setBusy(false)
    }
  }

  const linked = redeemer.result

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Link a parent or guardian"
    >
      <div className="border-ink-100 w-full max-w-md rounded-3xl border bg-white p-6 shadow-[0_22px_70px_-42px_rgba(15,23,42,0.45)]">
        {linked ? (
          <div className="space-y-5">
            <h3 className="text-ink-950 text-lg font-semibold">
              Linked. Your parent can see your account now.
            </h3>
            {linked.mergeCandidate ? (
              <MergeOffer
                sourcePlayerId={linked.playerId || playerId}
                candidate={linked.mergeCandidate}
                onDone={finishLinked}
              />
            ) : (
              <button
                type="button"
                onClick={finishLinked}
                className="bg-play-600 hover:bg-play-700 min-h-[44px] w-full cursor-pointer rounded-xl px-4 py-2.5 font-semibold text-white transition-colors duration-200"
              >
                Done
              </button>
            )}
          </div>
        ) : (
          <>
            <h3 className="text-ink-950 text-lg font-semibold">
              {mode === "email" ? "Invite your parent or guardian" : "Enter your parent's code"}
            </h3>
            <p className="text-ink-600 mt-1 text-sm leading-6">
              {mode === "email"
                ? "We email them a link. They approve payments and permissions, and you keep your own login."
                : "Six characters from their account. We link you the moment you enter it."}
            </p>

            {mode === "email" ? (
              <>
                <label
                  className="text-ink-800 mt-4 block text-sm font-medium"
                  htmlFor="guardian-invite-email"
                >
                  Their email
                </label>
                <input
                  id="guardian-invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="parent@example.com"
                  className="border-ink-200 focus:border-play-500 focus:ring-play-500/20 mt-1 block min-h-[44px] w-full rounded-xl border px-3 py-2.5 text-sm shadow-sm transition duration-200 focus:outline-none focus:ring-2"
                />

                <div className="mt-3">
                  <BrandCheckbox
                    checked={alreadyAdded}
                    onChange={setAlreadyAdded}
                    label="A parent already added me to SportsHub"
                    subLabel="They get a request to link this login to the profile they already made."
                  />
                </div>
              </>
            ) : (
              <div className="mt-4">
                <CodeInput
                  value={redeemer.code}
                  onChange={redeemer.setCode}
                  label="Their code"
                  disabled={redeemer.busy}
                  autoFocus
                />
              </div>
            )}

            {(error || redeemer.error) && (
              <p className="mt-3 text-sm text-red-600">{error || redeemer.error}</p>
            )}

            <button
              type="button"
              onClick={() => {
                setError(null)
                setMode(mode === "email" ? "code" : "email")
              }}
              className="text-play-700 hover:text-play-800 decoration-play-300 mt-4 cursor-pointer rounded text-sm font-semibold underline underline-offset-2 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-play-500 focus-visible:ring-offset-2"
            >
              {mode === "email" ? "Enter a code instead" : "Use an email instead"}
            </button>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="border-ink-200 text-ink-700 hover:bg-court-50 min-h-[44px] cursor-pointer rounded-xl border px-4 py-2.5 font-semibold transition-colors duration-200"
              >
                Cancel
              </button>
              {mode === "email" ? (
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={busy || !email.includes("@")}
                  className="bg-play-600 hover:bg-play-700 disabled:bg-ink-300 min-h-[44px] flex-1 cursor-pointer rounded-xl px-4 py-2.5 font-semibold text-white transition-colors duration-200 disabled:cursor-not-allowed"
                >
                  {busy ? "Sending..." : "Send the invite"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void redeemer.redeem()}
                  disabled={redeemer.busy || redeemer.code.length < 4}
                  className="bg-play-600 hover:bg-play-700 disabled:bg-ink-300 min-h-[44px] flex-1 cursor-pointer rounded-xl px-4 py-2.5 font-semibold text-white transition-colors duration-200 disabled:cursor-not-allowed"
                >
                  {redeemer.busy ? "Linking..." : "Link my parent"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
