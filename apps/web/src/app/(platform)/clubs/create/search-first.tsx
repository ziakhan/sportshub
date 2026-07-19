"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui"

/**
 * Search-before-create (owner 2026-07-18): ~1,000 clubs already exist as
 * UNCLAIMED census records. Never create-first — a duplicate club orphans
 * the census entry and its league links. The create form unlocks only after
 * the operator has looked.
 */
export function SearchFirst({ onProceed }: { onProceed: () => void }) {
  const [q, setQ] = useState("")
  const [results, setResults] = useState<any[] | null>(null)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null)
      return
    }
    const handle = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/clubs/search?q=${encodeURIComponent(q.trim())}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data.clubs ?? [])
        }
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(handle)
  }, [q])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-ink-900 text-lg font-semibold">Is your club already listed?</h2>
        <p className="text-ink-600 mt-1 text-sm">
          We&apos;ve mapped over a thousand Canadian clubs. If yours is here, claim it — you keep
          its league connections and public page instead of starting from zero.
        </p>
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by club name or city…"
        autoFocus
        className="border-ink-200 w-full rounded-xl border px-4 py-3 text-sm"
      />
      {searching && <p className="text-ink-400 text-xs">Searching…</p>}
      {results && results.length > 0 && (
        <ul className="space-y-2">
          {results.slice(0, 8).map((club) => (
            <li
              key={club.id}
              className="border-ink-100 flex items-center justify-between gap-3 rounded-xl border p-3"
            >
              <div className="min-w-0">
                <p className="text-ink-900 truncate text-sm font-semibold">{club.name}</p>
                <p className="text-ink-500 text-xs">
                  {[club.city, club.state].filter(Boolean).join(", ")}
                </p>
              </div>
              <Link
                href={`/claim/${club.id}`}
                className="bg-play-600 hover:bg-play-700 shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors"
              >
                This is my club
              </Link>
            </li>
          ))}
        </ul>
      )}
      {results && results.length === 0 && (
        <p className="text-ink-500 text-sm">No matches for “{q.trim()}”.</p>
      )}
      <div className="border-ink-100 border-t pt-4">
        <Button
          variant="subtle"
          onClick={onProceed}
          disabled={q.trim().length < 2 && results === null}
        >
          My club isn&apos;t listed — create a new one
        </Button>
        {q.trim().length < 2 && results === null && (
          <p className="text-ink-400 mt-1 text-xs">Search first — it takes ten seconds.</p>
        )}
      </div>
    </div>
  )
}
