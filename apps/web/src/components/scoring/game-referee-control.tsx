"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface PoolReferee {
  userId: string
  name: string
  certification: string | null
  gamesRefereed: number
  hasPin: boolean
  busy: boolean
}

/**
 * Game-day referee assignment, right where scoring starts: shows the
 * assigned crew, expands into a search of available referees. Refs often
 * aren't known until tip-off — this is the escape hatch.
 */
export function GameRefereeControl({
  gameId,
  assigned,
}: {
  gameId: string
  assigned: { userId: string; name: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [pool, setPool] = useState<PoolReferee[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // QA-004b: viewers without scoring authz (e.g. the assigned referee) used
  // to see the control, hit 403, and stare at "Loading…" forever. A 403 now
  // hides the whole control; other failures show a real error (QA-004a).
  const [forbidden, setForbidden] = useState(false)

  const loadPool = async (query = "") => {
    setError(null)
    const res = await fetch(
      `/api/games/${gameId}/referee${query ? `?q=${encodeURIComponent(query)}` : ""}`
    ).catch(() => null)
    if (!res) {
      setError("Couldn't reach the server — check your connection and try again.")
      setPool([])
      return
    }
    if (res.status === 403 || res.status === 401) {
      setForbidden(true)
      return
    }
    if (!res.ok) {
      setError("Couldn't load the referee list. Try again in a moment.")
      setPool([])
      return
    }
    const data = await res.json()
    setPool(data.pool)
  }

  const assign = async (userId: string) => {
    setBusy(userId)
    setError(null)
    try {
      const res = await fetch(`/api/games/${gameId}/referee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Couldn't assign")
      }
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't assign")
    } finally {
      setBusy(null)
    }
  }

  const unassign = async (userId: string, name: string) => {
    if (!window.confirm(`Remove ${name} from this game?`)) return
    await fetch(`/api/games/${gameId}/referee?userId=${userId}`, { method: "DELETE" })
    router.refresh()
  }

  if (forbidden) {
    // Read-only view for viewers who can't assign: names, no controls.
    return assigned.length > 0 ? (
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className="text-ink-400 text-[11px] font-medium uppercase tracking-wide">Refs:</span>
        {assigned.map((r) => (
          <span key={r.userId} className="bg-court-50 text-ink-700 rounded-full px-2 py-0.5 text-xs font-medium">
            {r.name}
          </span>
        ))}
      </div>
    ) : null
  }

  return (
    <div className="mt-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-ink-400 text-[11px] font-medium uppercase tracking-wide">Refs:</span>
        {assigned.length === 0 && (
          <span className="text-hoop-600 text-xs font-medium">none assigned</span>
        )}
        {assigned.map((r) => (
          <button
            key={r.userId}
            onClick={() => unassign(r.userId, r.name)}
            className="bg-court-50 text-ink-700 hover:bg-hoop-50 hover:text-hoop-700 group rounded-full px-2 py-0.5 text-xs font-medium"
            title="Click to remove"
          >
            {r.name} <span className="text-ink-300 group-hover:text-hoop-600">✕</span>
          </button>
        ))}
        <button
          onClick={() => {
            setOpen((v) => !v)
            if (!open && pool === null) loadPool()
          }}
          className="text-play-600 text-xs font-semibold hover:underline"
        >
          {open ? "close" : "+ assign"}
        </button>
      </div>

      {open && (
        <div className="border-ink-100 bg-court-50/60 mt-2 rounded-xl border p-2">
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              loadPool(e.target.value)
            }}
            placeholder="Search referees…"
            className="border-ink-200 mb-2 w-full rounded-lg border px-2 py-1.5 text-xs"
          />
          {error && <p className="text-hoop-600 mb-1 text-xs">{error}</p>}
          {pool === null ? (
            <p className="text-ink-400 py-2 text-center text-xs">Loading…</p>
          ) : pool.length === 0 ? (
            <p className="text-ink-400 py-2 text-center text-xs">No referees found.</p>
          ) : (
            <div className="max-h-44 space-y-1 overflow-y-auto">
              {pool
                .filter((r) => !assigned.some((a) => a.userId === r.userId))
                .map((r) => (
                  <div
                    key={r.userId}
                    className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="text-ink-900 block truncate text-xs font-semibold">
                        {r.name}
                        {r.busy && (
                          <span className="bg-hoop-100 text-hoop-700 ml-1.5 rounded-full px-1.5 py-px text-[10px] font-bold">
                            busy this slot
                          </span>
                        )}
                      </span>
                      <span className="text-ink-400 block text-[11px]">
                        {r.certification ?? "Uncertified"} · {r.gamesRefereed} games
                        {r.hasPin ? " · PIN set" : " · no sign-off PIN"}
                      </span>
                    </span>
                    <button
                      onClick={() => assign(r.userId)}
                      disabled={busy === r.userId || r.busy}
                      className="bg-play-600 hover:bg-play-700 shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      Assign
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
