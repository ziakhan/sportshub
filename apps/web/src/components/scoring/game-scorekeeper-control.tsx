"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface PoolKeeper {
  userId: string
  name: string
}

/**
 * Game-day scorekeeper assignment, mirroring GameRefereeControl: shows the
 * assigned scorekeeper(s) and expands into a search of available scorekeepers.
 * An assigned scorekeeper can then open the console (canScoreGame).
 */
export function GameScorekeeperControl({
  gameId,
  assigned,
}: {
  gameId: string
  assigned: { userId: string; name: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [pool, setPool] = useState<PoolKeeper[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadPool = async (query = "") => {
    const res = await fetch(
      `/api/games/${gameId}/scorekeeper${query ? `?q=${encodeURIComponent(query)}` : ""}`
    ).catch(() => null)
    if (!res?.ok) return
    const data = await res.json()
    setPool(data.pool)
  }

  const assign = async (userId: string) => {
    setBusy(userId)
    setError(null)
    try {
      const res = await fetch(`/api/games/${gameId}/scorekeeper`, {
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
    await fetch(`/api/games/${gameId}/scorekeeper?userId=${userId}`, { method: "DELETE" })
    router.refresh()
  }

  return (
    <div className="mt-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-ink-400 text-[11px] font-medium uppercase tracking-wide">
          Scorekeeper:
        </span>
        {assigned.length === 0 && (
          <span className="text-ink-400 text-xs font-medium">unassigned</span>
        )}
        {assigned.map((k) => (
          <button
            key={k.userId}
            onClick={() => unassign(k.userId, k.name)}
            className="bg-play-50 text-ink-700 hover:bg-hoop-50 hover:text-hoop-700 group rounded-full px-2 py-0.5 text-xs font-medium"
            title="Click to remove"
          >
            {k.name} <span className="text-ink-300 group-hover:text-hoop-600">✕</span>
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
        <div className="border-ink-100 bg-play-50/50 mt-2 rounded-xl border p-2">
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              loadPool(e.target.value)
            }}
            placeholder="Search scorekeepers…"
            className="border-ink-200 mb-2 w-full rounded-lg border px-2 py-1.5 text-xs"
          />
          {error && <p className="text-hoop-600 mb-1 text-xs">{error}</p>}
          {pool === null ? (
            <p className="text-ink-400 py-2 text-center text-xs">Loading…</p>
          ) : pool.length === 0 ? (
            <p className="text-ink-400 py-2 text-center text-xs">
              No scorekeepers found. Ask an admin to grant the Scorekeeper role.
            </p>
          ) : (
            <div className="max-h-44 space-y-1 overflow-y-auto">
              {pool.map((k) => (
                <div
                  key={k.userId}
                  className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5"
                >
                  <span className="text-ink-900 min-w-0 flex-1 truncate text-xs font-semibold">
                    {k.name}
                  </span>
                  <button
                    onClick={() => assign(k.userId)}
                    disabled={busy === k.userId}
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
