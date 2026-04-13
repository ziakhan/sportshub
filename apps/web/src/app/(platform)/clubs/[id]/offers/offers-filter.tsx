"use client"

import { useRouter } from "next/navigation"

interface Team {
  id: string
  name: string
}

export function OffersFilter({
  teams,
  clubId,
  activeTeamId,
  activeStatus,
}: {
  teams: Team[]
  clubId: string
  activeTeamId?: string
  activeStatus?: string
}) {
  const router = useRouter()

  function handleTeamChange(teamId: string) {
    const params = new URLSearchParams()
    if (activeStatus) params.set("status", activeStatus)
    if (teamId) params.set("team", teamId)
    const qs = params.toString()
    router.push(`/clubs/${clubId}/offers${qs ? `?${qs}` : ""}`)
  }

  return (
    <div className="mb-4">
      <select
        value={activeTeamId || ""}
        onChange={(e) => handleTeamChange(e.target.value)}
        className="rounded-xl border border-ink-200 px-3 py-1.5 text-sm focus:border-play-500 focus:outline-none"
      >
        <option value="">All Teams</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
    </div>
  )
}
