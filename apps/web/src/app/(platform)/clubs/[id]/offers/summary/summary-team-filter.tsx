"use client"

import { useRouter } from "next/navigation"
import { BrandListbox } from "@/components/ui"

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
    <BrandListbox
      className="w-full sm:w-auto"
      ariaLabel="Team"
      placeholder="All Teams"
      value={activeTeamId || ""}
      onChange={(teamId) =>
        router.push(`/clubs/${clubId}/offers/summary${teamId ? `?team=${teamId}` : ""}`)
      }
      options={teams.map((team) => ({ value: team.id, label: team.name }))}
    />
  )
}
