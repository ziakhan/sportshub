"use client"

import { useRouter } from "next/navigation"

export function SummaryTeamFilter({
  teams,
  clubId,
  activeTeamId,
}: {
  teams: { id: string; name: string }[]
  clubId: string
  activeTeamId?: string
}) {
  const router = useRouter()

  return (
    <select
      value={activeTeamId || ""}
      onChange={(e) => {
        const teamId = e.target.value
        router.push(`/clubs/${clubId}/offers/summary${teamId ? `?team=${teamId}` : ""}`)
      }}
      className="border-ink-200 focus:border-play-500 rounded-xl border px-3 py-1.5 text-sm focus:outline-none"
    >
      <option value="">All Teams</option>
      {teams.map((team) => (
        <option key={team.id} value={team.id}>
          {team.name}
        </option>
      ))}
    </select>
  )
}
