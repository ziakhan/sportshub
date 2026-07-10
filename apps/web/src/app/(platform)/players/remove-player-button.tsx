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

  const openDialog = () => {
    setError(null)
    setIsOpen(true)
  }

  const handleRemove = async () => {
    setIsRemoving(true)
    setError(null)
    try {
      const res = await fetch(`/api/players/${playerId}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        // 409 = active roster; surface the API's message verbatim.
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
              Remove {playerName}?
            </h3>
            <p className="text-ink-600 mt-2 text-sm">
              Pending offers are declined and upcoming tryout signups cancelled. This can&apos;t be
              undone here.
            </p>

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
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={isRemoving}
                className="bg-hoop-600 hover:bg-hoop-700 disabled:bg-ink-400 rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed"
              >
                {isRemoving ? "Removing..." : "Remove player"}
              </button>
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
