"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface RemovePlayerButtonProps {
  playerId: string
  playerName: string
  /** "icon" = compact trash button (list cards); "button" = labelled destructive button (danger zone) */
  variant?: "icon" | "button"
  /** Called after a successful removal (e.g. drop the player from local state) */
  onRemoved?: () => void
  /** Navigate here after a successful removal */
  redirectTo?: string
}

export default function RemovePlayerButton({
  playerId,
  playerName,
  variant = "icon",
  onRemoved,
  redirectTo,
}: RemovePlayerButtonProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Rostered child: removal becomes a release REQUEST the club approves
  // (owner 2026-07-18 — installment commitments make unilateral exits wrong)
  const [rosterTeam, setRosterTeam] = useState<{ id: string; name: string } | null>(null)
  const [releaseReason, setReleaseReason] = useState("")
  const [releaseSent, setReleaseSent] = useState(false)

  const openDialog = () => {
    setError(null)
    setRosterTeam(null)
    setReleaseReason("")
    setReleaseSent(false)
    setIsOpen(true)
  }

  const requestRelease = async () => {
    if (!rosterTeam) return
    setIsRemoving(true)
    setError(null)
    try {
      const res = await fetch("/api/withdrawal-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "PLAYER_FROM_TEAM",
          playerId,
          teamId: rosterTeam.id,
          reason: releaseReason,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || "Failed to send the release request")
        return
      }
      setReleaseSent(true)
    } catch {
      setError("Failed to send the release request")
    } finally {
      setIsRemoving(false)
    }
  }

  const handleRemove = async () => {
    setIsRemoving(true)
    setError(null)
    try {
      const res = await fetch(`/api/players/${playerId}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        if (data?.code === "ACTIVE_ROSTER" && data.teamId) {
          setRosterTeam({ id: data.teamId, name: data.teamName ?? "their team" })
          setError(null)
          return
        }
        setError(data?.error || "Failed to remove player")
        return
      }
      setIsOpen(false)
      onRemoved?.()
      if (redirectTo) {
        router.push(redirectTo)
      }
      router.refresh()
    } catch {
      setError("Failed to remove player")
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={openDialog}
          className="text-ink-400 hover:bg-hoop-50 hover:text-hoop-600 rounded-lg p-1.5 transition"
          aria-label={`Remove ${playerName}`}
          title={`Remove ${playerName}`}
        >
          <IconTrash className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={openDialog}
          className="border-hoop-200 text-hoop-700 hover:bg-hoop-50 inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold transition"
        >
          <IconTrash className="h-4 w-4" />
          Remove this player
        </button>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-player-title"
          onClick={() => !isRemoving && setIsOpen(false)}
        >
          <div
            className="border-ink-100 w-full max-w-md rounded-2xl border bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="remove-player-title" className="font-display text-ink-950 text-lg font-semibold">
              {rosterTeam ? `Request release from ${rosterTeam.name}?` : `Remove ${playerName}?`}
            </h3>
            {releaseSent ? (
              <p className="text-court-700 mt-2 text-sm font-medium">
                Release request sent — {rosterTeam?.name} will review it and you&apos;ll be
                notified of their decision.
              </p>
            ) : rosterTeam ? (
              <>
                <p className="text-ink-600 mt-2 text-sm">
                  {playerName} is on {rosterTeam.name}&apos;s active roster, so leaving needs the
                  club&apos;s sign-off. Tell them why and they&apos;ll review it.
                </p>
                <textarea
                  value={releaseReason}
                  onChange={(e) => setReleaseReason(e.target.value)}
                  placeholder="Why is your child leaving the team? (required)"
                  rows={2}
                  className="border-ink-200 mt-3 w-full rounded-xl border px-3 py-2 text-sm"
                />
              </>
            ) : (
              <p className="text-ink-600 mt-2 text-sm">
                Pending offers are declined and upcoming tryout signups cancelled. This can&apos;t
                be undone here.
              </p>
            )}

            {error && (
              <div className="border-hoop-200 bg-hoop-50 text-hoop-700 mt-3 rounded-xl border p-3 text-sm font-medium">
                {error}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isRemoving}
                className="border-ink-200 text-ink-700 hover:bg-ink-50 rounded-xl border bg-white px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {releaseSent ? "Close" : "Cancel"}
              </button>
              {!releaseSent && (
                <button
                  type="button"
                  onClick={rosterTeam ? requestRelease : handleRemove}
                  disabled={isRemoving || (!!rosterTeam && releaseReason.trim().length < 3)}
                  className="bg-hoop-600 hover:bg-hoop-700 disabled:bg-ink-400 rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed"
                >
                  {isRemoving
                    ? "Working..."
                    : rosterTeam
                      ? "Send release request"
                      : "Remove player"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}
