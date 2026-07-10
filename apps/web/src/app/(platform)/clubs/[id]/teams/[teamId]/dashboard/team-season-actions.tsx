"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui"

/**
 * Season-continuity actions on the team dashboard:
 * - active team → header row: "Start next season" + "Archive team" (confirm)
 * - archived team → neutral banner: read-only notice + Unarchive + Start next season
 */

const ROLLOVER_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path
      d="M4 9a8 8 0 0114-3M4 4v5h5M20 15a8 8 0 01-14 3M20 20v-5h-5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const ARCHIVE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path
      d="M4 7h16M5 7l1 13h12l1-13M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

async function toggleArchive(teamId: string, archived: boolean): Promise<string | null> {
  try {
    const res = await fetch(`/api/teams/${teamId}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return body.error || "Something went wrong — try again."
    }
    return null
  } catch {
    return "Something went wrong — check your connection."
  }
}

export function TeamSeasonActions({
  clubId,
  teamId,
  teamName,
}: {
  clubId: string
  teamId: string
  teamName: string
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function archive() {
    if (busy) return
    setBusy(true)
    setError(null)
    const err = await toggleArchive(teamId, true)
    if (err) {
      setError(err)
      setBusy(false)
      return
    }
    router.push(`/clubs/${clubId}/teams`)
    router.refresh()
  }

  return (
    <>
      <Button
        href={`/clubs/${clubId}/teams/${teamId}/next-season`}
        variant="subtle"
        size="sm"
        icon={ROLLOVER_ICON}
      >
        Start next season
      </Button>
      {/* Destructive-subtle: native button (kit Button has no danger tone and
          cn() doesn't tailwind-merge, so overrides would collide) */}
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="brand-focus inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition-all duration-150 hover:border-red-300 hover:bg-red-50 active:scale-[0.97] [&>svg]:h-3.5 [&>svg]:w-3.5"
      >
        {ARCHIVE_ICON}
        Archive team
      </button>

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Archive ${teamName}`}
        >
          <div className="border-ink-100 shadow-panel w-full max-w-md rounded-2xl border bg-white p-6">
            <h3 className="text-ink-900 mb-2 text-lg font-bold">Archive {teamName}?</h3>
            <p className="text-ink-600 mb-4 text-sm">
              The team disappears from your active lists. Its games, stats and chat stay as
              read-only history, and you can unarchive it any time. To roll into a new season,
              use Start next season instead — it archives the old team for you.
            </p>
            {error && (
              <div className="border-hoop-200 bg-hoop-50 text-hoop-700 mb-4 rounded-xl border p-3 text-sm">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="subtle" size="sm" onClick={() => setConfirming(false)} disabled={busy}>
                Cancel
              </Button>
              <button
                type="button"
                onClick={archive}
                disabled={busy}
                className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-all duration-150 hover:bg-red-700 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50"
              >
                {busy ? "Archiving…" : "Archive team"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function ArchivedTeamBanner({ clubId, teamId }: { clubId: string; teamId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function unarchive() {
    if (busy) return
    setBusy(true)
    setError(null)
    const err = await toggleArchive(teamId, false)
    if (err) {
      setError(err)
      setBusy(false)
      return
    }
    router.refresh()
  }

  return (
    <div className="border-ink-200 bg-ink-50 mb-6 rounded-2xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="bg-ink-400 h-2 w-2 shrink-0 rounded-full" aria-hidden />
          <p className="text-ink-700 text-sm font-semibold">
            Archived — read-only history.{" "}
            <span className="text-ink-500 font-normal">
              Games, stats and chat are preserved; new activity is off.
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="subtle" size="sm" onClick={unarchive} disabled={busy}>
            {busy ? "Unarchiving…" : "Unarchive"}
          </Button>
          <Button
            href={`/clubs/${clubId}/teams/${teamId}/next-season`}
            size="sm"
            icon={ROLLOVER_ICON}
          >
            Start next season
          </Button>
        </div>
      </div>
      {error && (
        <div className="border-hoop-200 bg-hoop-50 text-hoop-700 mt-3 rounded-xl border p-3 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
