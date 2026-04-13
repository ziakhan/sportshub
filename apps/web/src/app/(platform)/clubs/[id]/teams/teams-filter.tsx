"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

export function TeamsFilter({
  clubId,
  ageGroups,
  activeAge,
  activeSearch,
}: {
  clubId: string
  ageGroups: string[]
  activeAge?: string
  activeSearch?: string
}) {
  const router = useRouter()
  const [search, setSearch] = useState(activeSearch || "")

  function buildUrl(age?: string, q?: string) {
    const params = new URLSearchParams()
    if (age) params.set("age", age)
    if (q) params.set("q", q)
    const qs = params.toString()
    return `/clubs/${clubId}/teams${qs ? `?${qs}` : ""}`
  }

  function handleAgeChange(age: string) {
    router.push(buildUrl(age || undefined, activeSearch))
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    router.push(buildUrl(activeAge, search || undefined))
  }

  return (
    <div className="mb-4 flex gap-3">
      <select
        value={activeAge || ""}
        onChange={(e) => handleAgeChange(e.target.value)}
        className="border-ink-200 focus:border-play-500 rounded-xl border px-3 py-1.5 text-sm focus:outline-none"
      >
        <option value="">All Age Groups</option>
        {ageGroups.map((ag) => (
          <option key={ag} value={ag}>
            {ag}
          </option>
        ))}
      </select>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search teams..."
          className="border-ink-200 focus:border-play-500 rounded-xl border px-3 py-1.5 text-sm focus:outline-none"
        />
        <button
          type="submit"
          className="bg-court-100 text-ink-700 hover:bg-court-200 rounded-xl px-3 py-1.5 text-sm"
        >
          Search
        </button>
      </form>
    </div>
  )
}
