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
      <div className="mx-auto max-w-xl relative" ref={wrapperRef}>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { if (results.length > 0) setShowDropdown(true) }}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearchAll() }}
            placeholder="Start typing a club name..."
            className="w-full rounded-lg border border-gray-300 px-4 py-3 pl-10 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <svg
            className="absolute left-3 top-3.5 h-5 w-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {loading && (
            <div className="absolute right-3 top-3.5 h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
          )}
        </div>

        {/* Autocomplete dropdown */}
        {showDropdown && results.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
            {results.map((club) => (
              <button
                key={club.id}
                onClick={() => handleSelect(club)}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: club.primaryColor }}
                  >
                    {club.name[0]}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{club.name}</div>
                    <div className="text-xs text-gray-500">
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
                className="w-full px-4 py-2 text-center text-sm text-blue-600 hover:bg-blue-50 rounded-b-lg"
              >
                View all results &rarr;
              </button>
            )}
          </div>
        )}

        {showDropdown && query.length >= 2 && results.length === 0 && !loading && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white p-4 shadow-lg text-center text-sm text-gray-500">
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
              className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm transition hover:shadow-md"
            >
              <div className="h-2" style={{ backgroundColor: club.primaryColor }} />
              <div className="p-5">
                <div className="mb-1">
                  <h3 className="font-semibold text-gray-900">{club.name}</h3>
                </div>
                <p className="text-sm text-gray-500 mb-2">
                  {[club.city, club.state].filter(Boolean).join(", ")}
                </p>
                {club.description && (
                  <p className="text-xs text-gray-600 line-clamp-2 mb-2">{club.description}</p>
                )}
                <div className="flex gap-3 text-xs text-gray-400">
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
