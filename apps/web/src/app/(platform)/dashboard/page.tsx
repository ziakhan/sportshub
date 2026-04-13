import { redirect } from "next/navigation"
import Link from "next/link"
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
  const hasClubRole = roles.includes("ClubOwner") || roles.includes("ClubManager")
  const hasStaffRole = roles.includes("Staff") || roles.includes("TeamManager")
  const hasLeagueRole = roles.includes("LeagueOwner") || roles.includes("LeagueManager")
  const hasRefereeRole = roles.includes("Referee")
  const hasParentRole = roles.includes("Parent")
  const hasPlayerRole = roles.includes("Player")

  return (
    <div className="space-y-8">
      <div className="border-ink-100 shadow-soft rounded-[30px] border bg-white p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="border-play-100 bg-play-50 text-play-600 mb-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
              Dashboard
            </div>
            <h1 className="text-ink-950 text-3xl font-bold sm:text-4xl">
              Welcome back, {dbUser.firstName || "User"}!
            </h1>
            <p className="text-ink-600 mt-2 max-w-2xl">
              Here&apos;s what&apos;s happening across your roles.
            </p>
          </div>
          <Link
            href="/marketplace"
            className="bg-play-600 shadow-play-200 hover:bg-play-700 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New
          </Link>
        </div>
      </div>

      {hasAdminRole && dashboardData.admin && <AdminSection data={dashboardData.admin} />}

      {hasClubRole && dashboardData.clubOwner && <ClubSection data={dashboardData.clubOwner} />}

      {hasStaffRole && dashboardData.staff && <StaffSection data={dashboardData.staff} />}

      {hasLeagueRole && dashboardData.leagueOwner && (
        <LeagueSection data={dashboardData.leagueOwner} />
      )}

      {hasRefereeRole && dashboardData.referee && <RefereeSection data={dashboardData.referee} />}

      {hasPlayerRole && dashboardData.player && <PlayerSection data={dashboardData.player} />}

      {hasParentRole && dashboardData.parent && <ParentSection data={dashboardData.parent} />}
    </div>
  )
}
