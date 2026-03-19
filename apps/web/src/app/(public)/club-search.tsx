"use client"

import { useState } from "react"
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
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleSearch = async () => {
    if (query.length < 2) return
    setLoading(true)
    setSearched(true)
    try {
      const res = await fetch(`/api/clubs/public?q=${encodeURIComponent(query)}&limit=12`)
      const data = await res.json()
      setClubs(data.clubs || [])
    } catch {
      setClubs([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mx-auto max-w-xl flex gap-2 mb-8">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search by club name or city..."
          className="flex-1 rounded-lg border border-gray-300 px-4 py-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          onClick={handleSearch}
          disabled={loading || query.length < 2}
          className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "..." : "Search"}
        </button>
      </div>

      {searched && clubs.length === 0 && !loading && (
        <p className="text-center text-gray-500">No clubs found matching &ldquo;{query}&rdquo;</p>
      )}

      {clubs.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clubs.map((club) => (
            <Link
              key={club.id}
              href={`/club/${club.slug}`}
              className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm transition hover:shadow-md"
            >
              <div className="h-2" style={{ backgroundColor: club.primaryColor }} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="font-semibold text-gray-900">{club.name}</h3>
                  {club.status === "UNCLAIMED" && (
                    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                      Unclaimed
                    </span>
                  )}
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
