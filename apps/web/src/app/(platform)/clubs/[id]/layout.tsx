import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"

async function getClubAccess(clubId: string, userId: string) {
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

export default async function ClubLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/sign-in")

  const access = await getClubAccess(params.id, session.user.id)
  if (!access) notFound()

  const { tenant: club, isAdmin } = access

  const tabs = [
    { label: "Overview", href: `/clubs/${params.id}` },
    { label: "Teams", href: `/clubs/${params.id}/teams` },
    { label: "Tryouts", href: `/clubs/${params.id}/tryouts` },
    ...(isAdmin
      ? [
          { label: "Staff", href: `/clubs/${params.id}/staff` },
          { label: "Settings", href: `/clubs/${params.id}/settings` },
        ]
      : []),
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="container mx-auto px-4">
          <div className="py-4">
            <Link
              href="/dashboard"
              className="mb-2 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
            >
              &larr; Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">{club.name}</h1>
            <p className="text-sm text-gray-500">
              {club.slug}.youthbasketballhub.com
            </p>
          </div>
          <nav className="-mb-px flex gap-6">
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
      <div className="container mx-auto px-4 py-8">{children}</div>
    </div>
  )
}
