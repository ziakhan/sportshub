"use client"

import { useRouter } from "next/navigation"
import { BrandListbox } from "@/components/ui"

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
      <BrandListbox
        className="w-full sm:w-auto"
        ariaLabel="Team"
        placeholder="All Teams"
        value={activeTeamId || ""}
        onChange={handleTeamChange}
        options={teams.map((team) => ({ value: team.id, label: team.name }))}
      />
    </div>
  )
}
