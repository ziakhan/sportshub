"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"

interface Club {
  id: string
  slug: string
  name: string
  city: string | null
  state: string | null
  description: string | null
  status: string
  teamCount: number
  tryoutCount: number
  primaryColor: string
}

export function ClubSearch() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Club[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedClubs, setSelectedClubs] = useState<Club[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Live search with debounce
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setShowDropdown(false)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/clubs/public?q=${encodeURIComponent(query)}&limit=8`)
        const data = await res.json()
        setResults(data.clubs || [])
        setShowDropdown(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelect = (club: Club) => {
    setShowDropdown(false)
    setQuery("")
    // Navigate to club profile
    window.location.href = `/club/${club.slug}`
  }

  const handleSearchAll = () => {
    setShowDropdown(false)
    setSelectedClubs(results)
    setHasSearched(true)
  }

  return (
    <div>
      <div className="relative mx-auto max-w-xl" ref={wrapperRef}>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (results.length > 0) setShowDropdown(true)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearchAll()
            }}
            placeholder="Start typing a club name..."
            className="border-ink-200 text-ink-950 focus:border-play-400 focus:ring-play-500/10 w-full rounded-2xl border bg-white px-4 py-4 pl-12 pr-24 text-[15px] shadow-sm transition focus:outline-none focus:ring-4"
          />
          <svg
            className="text-ink-400 absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {loading && (
            <div className="border-ink-200 border-t-play-600 absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin rounded-full border-2" />
          )}

          <button
            type="button"
            onClick={handleSearchAll}
            className="bg-play-600 hover:bg-play-700 absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition sm:inline-flex"
          >
            Search
          </button>
        </div>

        {/* Autocomplete dropdown */}
        {showDropdown && results.length > 0 && (
          <div className="border-ink-100 shadow-panel absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border bg-white">
            {results.map((club) => (
              <button
                key={club.id}
                onClick={() => handleSelect(club)}
                className="border-ink-100 hover:bg-ink-50 flex w-full items-center justify-between border-b px-4 py-3 text-left transition last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-bold text-white shadow-sm"
                    style={{ backgroundColor: club.primaryColor }}
                  >
                    {club.name[0]}
                  </div>
                  <div>
                    <div className="text-ink-950 font-semibold">{club.name}</div>
                    <div className="text-ink-500 text-xs">
                      {[club.city, club.state].filter(Boolean).join(", ")}
                      {club.teamCount > 0 ? ` \u2022 ${club.teamCount} teams` : ""}
                    </div>
                  </div>
                </div>
              </button>
            ))}
            {results.length >= 8 && (
              <button
                onClick={handleSearchAll}
                className="text-play-600 hover:bg-play-50 w-full px-4 py-3 text-center text-sm font-semibold transition"
              >
                View all results &rarr;
              </button>
            )}
          </div>
        )}

        {showDropdown && query.length >= 2 && results.length === 0 && !loading && (
          <div className="border-ink-100 text-ink-500 shadow-panel absolute z-50 mt-2 w-full rounded-2xl border bg-white p-4 text-center text-sm">
            No clubs found matching &ldquo;{query}&rdquo;
          </div>
        )}
      </div>

      {/* Full results grid (shown after Enter or "View all") */}
      {hasSearched && selectedClubs.length > 0 && (
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {selectedClubs.map((club) => (
            <Link
              key={club.id}
              href={`/club/${club.slug}`}
              className="card-lift border-ink-100 shadow-soft overflow-hidden rounded-3xl border bg-white"
            >
              <div className="h-2" style={{ backgroundColor: club.primaryColor }} />
              <div className="p-5">
                <div className="mb-1">
                  <h3 className="text-ink-950 font-semibold">{club.name}</h3>
                </div>
                <p className="text-ink-500 mb-2 text-sm">
                  {[club.city, club.state].filter(Boolean).join(", ")}
                </p>
                {club.description && (
                  <p className="text-ink-600 mb-2 line-clamp-2 text-xs">{club.description}</p>
                )}
                <div className="text-ink-400 flex gap-3 text-xs">
                  <span>{club.teamCount} teams</span>
                  <span>{club.tryoutCount} tryouts</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
