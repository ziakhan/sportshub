import { prisma } from "@youthbasketballhub/db"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { getCurrentUser } from "@/lib/auth-helpers"

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

    const roleNames = roles.map((r) => r.role)
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

  const userRoles = dbUser.roles.map((r) => r.role)
  const access = await getClubAccess(params.id, dbUser.id, userRoles)
  if (!access) notFound()

  const { tenant: club, isAdmin } = access

  const tabs = [
    { label: "Overview", href: `/clubs/${params.id}` },
    { label: "Teams", href: `/clubs/${params.id}/teams` },
    { label: "Tryouts", href: `/clubs/${params.id}/tryouts` },
    { label: "Offers", href: `/clubs/${params.id}/offers` },
    ...(isAdmin
      ? [
          { label: "Staff", href: `/clubs/${params.id}/staff` },
          { label: "Settings", href: `/clubs/${params.id}/settings` },
        ]
      : []),
  ]

  return (
    <div>
      <div className="border-b bg-white">
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
          <nav className="-mb-px flex gap-4 overflow-x-auto md:gap-6">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className="border-b-2 border-transparent px-1 pb-3 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <div className="px-4 py-8 md:px-6">{children}</div>
    </div>
  )
}
