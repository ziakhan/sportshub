import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"
import { getDashboardData } from "./get-dashboard-data"
import { AdminSection } from "./sections/admin-section"
import { ParentSection } from "./sections/parent-section"
import { ClubSection } from "./sections/club-section"
import { StaffSection } from "./sections/staff-section"
import { RefereeSection } from "./sections/referee-section"
import { LeagueSection } from "./sections/league-section"
import { PlayerSection } from "./sections/player-section"

export default async function DashboardPage() {
  const dbUser = await getCurrentUser()

  if (!dbUser) {
    redirect("/sign-in")
  }

  const roles = dbUser.roles.map((r: any) => r.role as string)
  const dashboardData = await getDashboardData(dbUser)

  const hasAdminRole = roles.includes("PlatformAdmin")
  const hasClubRole =
    roles.includes("ClubOwner") || roles.includes("ClubManager")
  const hasStaffRole = roles.includes("Staff") || roles.includes("TeamManager")
  const hasLeagueRole =
    roles.includes("LeagueOwner") || roles.includes("LeagueManager")
  const hasRefereeRole = roles.includes("Referee")
  const hasParentRole = roles.includes("Parent")
  const hasPlayerRole = roles.includes("Player")

  return (
    <div>
      {/* Welcome header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {dbUser.firstName || "User"}!
        </h1>
        <p className="mt-1 text-gray-600">
          Here&apos;s what&apos;s happening across your roles.
        </p>
      </div>

      {/* Role-specific sections — ordered by "management" roles first */}
      {hasAdminRole && dashboardData.admin && (
        <AdminSection data={dashboardData.admin} />
      )}

      {hasClubRole && dashboardData.clubOwner && (
        <ClubSection data={dashboardData.clubOwner} />
      )}

      {hasStaffRole && dashboardData.staff && (
        <StaffSection data={dashboardData.staff} />
      )}

      {hasLeagueRole && dashboardData.leagueOwner && (
        <LeagueSection data={dashboardData.leagueOwner} />
      )}

      {hasRefereeRole && dashboardData.referee && (
        <RefereeSection data={dashboardData.referee} />
      )}

      {hasPlayerRole && dashboardData.player && (
        <PlayerSection data={dashboardData.player} />
      )}

      {hasParentRole && dashboardData.parent && (
        <ParentSection data={dashboardData.parent} />
      )}
    </div>
  )
}
