import { prisma } from "@youthbasketballhub/db"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { getCurrentUser } from "@/lib/auth-helpers"
import { ClubTabs } from "./club-tabs"

async function getClubAccess(clubId: string, userId: string, userRoles: string[]) {
  // PlatformAdmin can access any club
  const isPlatformAdmin = userRoles.includes("PlatformAdmin")

  if (!isPlatformAdmin) {
    // Check if user has ANY role at this club (owner, manager, staff, team manager)
    const roles = await prisma.userRole.findMany({
      where: {
        userId,
        tenantId: clubId,
        role: { in: ["ClubOwner", "ClubManager", "Staff", "TeamManager"] },
      },
      select: { role: true },
    })

    if (roles.length === 0) return null

    const roleNames = roles.map((r: { role: string }) => r.role)
    const isAdmin = roleNames.includes("ClubOwner") || roleNames.includes("ClubManager")

    const tenant = await prisma.tenant.findUnique({
      where: { id: clubId },
      select: { id: true, name: true, slug: true },
    })

    if (!tenant) return null

    return { tenant, isAdmin }
  }

  // PlatformAdmin gets full admin access
  const tenant = await prisma.tenant.findUnique({
    where: { id: clubId },
    select: { id: true, name: true, slug: true },
  })

  if (!tenant) return null

  return { tenant, isAdmin: true }
}

export default async function ClubLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { id: string }
}) {
  const dbUser = await getCurrentUser()
  if (!dbUser) redirect("/sign-in")

  const userRoles = dbUser.roles.map((r: { role: string }) => r.role)
  const access = await getClubAccess(params.id, dbUser.id, userRoles)
  if (!access) notFound()

  const { tenant: club, isAdmin } = access

  const tabs = [
    { label: "Overview", href: `/clubs/${params.id}` },
    { label: "Teams", href: `/clubs/${params.id}/teams` },
    { label: "Tryouts", href: `/clubs/${params.id}/tryouts` },
    { label: "Offers", href: `/clubs/${params.id}/offers` },
    { label: "Templates", href: `/clubs/${params.id}/offer-templates` },
    { label: "House League", href: `/clubs/${params.id}/house-leagues` },
    { label: "Camps", href: `/clubs/${params.id}/camps` },
    { label: "Tournaments", href: `/clubs/${params.id}/tournaments` },
    ...(isAdmin
      ? [
          { label: "Staff", href: `/clubs/${params.id}/staff` },
          { label: "Settings", href: `/clubs/${params.id}/settings` },
        ]
      : []),
  ]

  return (
    <div>
      <div className="border-b border-gray-200 bg-white">
        <div className="px-4 md:px-6">
          <div className="py-4">
            <Link
              href="/dashboard"
              className="mb-2 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
            >
              &larr; Back to Dashboard
            </Link>
            <h1 className="text-xl font-bold text-gray-900 md:text-2xl">{club.name}</h1>
            <p className="text-sm text-gray-500">
              {club.slug}.youthbasketballhub.com
            </p>
          </div>
          <ClubTabs tabs={tabs} />
        </div>
      </div>
      <div className="px-4 py-8 md:px-6">{children}</div>
    </div>
  )
}
