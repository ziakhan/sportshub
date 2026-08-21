import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"
import { coachedTeamIds, isClubAdmin } from "@/lib/authz/team-scope"
import { PoolConsole } from "./pool-console"

export const dynamic = "force-dynamic"

/**
 * Age-group pool console (docs/roadmap/club-tryouts-and-age-pools).
 *
 * Assignment is a free market inside the club, so any club staff may open
 * this. What differs by person is who may fill the pool and send offers
 * (owners and managers) and which teams they can release from, which is
 * settled here and handed to the client so the console can show the right
 * action rather than a button that will fail.
 */
export default async function TryoutPoolPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { seasonLabel?: string; ageGroup?: string }
}) {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")

  const isAdmin = await isClubAdmin(user.id, params.id)
  const myTeamIds = isAdmin ? [] : await coachedTeamIds(user.id, params.id)

  return (
    <PoolConsole
      clubId={params.id}
      isAdmin={isAdmin}
      myTeamIds={myTeamIds}
      initialSeason={searchParams.seasonLabel ?? ""}
      initialAgeGroup={searchParams.ageGroup ?? ""}
    />
  )
}
