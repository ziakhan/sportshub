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
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
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
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
        >
          Search
        </button>
      </form>
    </div>
  )
}
