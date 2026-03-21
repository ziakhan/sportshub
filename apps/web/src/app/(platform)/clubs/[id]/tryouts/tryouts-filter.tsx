"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

interface Team {
  id: string
  name: string
}

interface Counts {
  all: number
  published: number
  draft: number
  past: number
  needsOffer: number
}

export function TryoutsFilter({
  clubId,
  teams,
  activeStatus,
  activeTeamId,
  activeSearch,
  counts,
}: {
  clubId: string
  teams: Team[]
  activeStatus?: string
  activeTeamId?: string
  activeSearch?: string
  counts: Counts
}) {
  const router = useRouter()
  const [search, setSearch] = useState(activeSearch || "")

  function buildUrl(status?: string, team?: string, q?: string) {
    const params = new URLSearchParams()
    if (status) params.set("status", status)
    if (team) params.set("team", team)
    if (q) params.set("q", q)
    const qs = params.toString()
    return `/clubs/${clubId}/tryouts${qs ? `?${qs}` : ""}`
  }

  function handleStatusClick(status: string) {
    const newStatus = activeStatus === status ? undefined : status
    router.push(buildUrl(newStatus, activeTeamId, activeSearch))
  }

  function handleTeamChange(teamId: string) {
    router.push(buildUrl(activeStatus, teamId || undefined, activeSearch))
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    router.push(buildUrl(activeStatus, activeTeamId, search || undefined))
  }

  const pills = [
    { key: "all", label: "All", count: counts.all },
    { key: "published", label: "Published", count: counts.published },
    { key: "draft", label: "Draft", count: counts.draft },
    { key: "needs-offer", label: "Needs Offer", count: counts.needsOffer },
    { key: "past", label: "Past", count: counts.past },
  ]

  return (
    <div className="mb-4 space-y-3">
      {/* Status pills */}
      <div className="flex flex-wrap gap-2">
        {pills.map((pill) => {
          const isActive = pill.key === "all" ? !activeStatus : activeStatus === pill.key
          return (
            <button
              key={pill.key}
              onClick={() => handleStatusClick(pill.key === "all" ? "" : pill.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                isActive
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {pill.label} ({pill.count})
            </button>
          )
        })}
      </div>

      {/* Team dropdown + search */}
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
        <select
          value={activeTeamId || ""}
          onChange={(e) => handleTeamChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none sm:w-auto"
        >
          <option value="">All Teams</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>

        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tryouts..."
            className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
          >
            Search
          </button>
        </form>
      </div>
    </div>
  )
}
