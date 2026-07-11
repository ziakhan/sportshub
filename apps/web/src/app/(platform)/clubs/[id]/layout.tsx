import { prisma } from "@youthbasketballhub/db"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { getCurrentUser } from "@/lib/auth-helpers"
import { brandStyle } from "@/lib/club-page/brand"
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

  const branding = await prisma.tenantBranding.findUnique({
    where: { tenantId: params.id },
    select: { primaryColor: true },
  })
  const primaryColor = branding?.primaryColor || "#4f46e5"

  // Coaches (Staff/TeamManager) get the team-day-to-day tabs only; program
  // creation (camps/HL/tournaments) and club administration are admin turf
  // (owner rule 2026-07-11 — a coach must not see program-creation surfaces)
  const tabs = [
    { label: "Overview", href: `/clubs/${params.id}` },
    { label: "Teams", href: `/clubs/${params.id}/teams` },
    { label: "Tryouts", href: `/clubs/${params.id}/tryouts` },
    { label: "Offers", href: `/clubs/${params.id}/offers` },
    { label: "Templates", href: `/clubs/${params.id}/offer-templates` },
    ...(isAdmin
      ? [
          { label: "House League", href: `/clubs/${params.id}/house-leagues` },
          { label: "Camps", href: `/clubs/${params.id}/camps` },
          { label: "Tournaments", href: `/clubs/${params.id}/tournaments` },
          { label: "Payments", href: `/clubs/${params.id}/payments` },
          { label: "Staff", href: `/clubs/${params.id}/staff` },
          { label: "Customize page", href: `/clubs/${params.id}/customize` },
          { label: "Messages", href: `/clubs/${params.id}/messages` },
          { label: "Settings", href: `/clubs/${params.id}/settings` },
        ]
      : []),
  ]

  return (
    <div className="font-barlow" style={brandStyle(primaryColor)}>
      <div className="border-ink-200 border-b bg-white">
        <div className="px-4 md:px-6">
          <div className="flex items-start gap-3 py-4">
            <span
              className="mt-1 h-10 w-1.5 shrink-0 rounded-full bg-[var(--brand)]"
              aria-hidden
            />
            <div>
              <Link
                href="/dashboard"
                className="text-ink-500 hover:text-ink-700 mb-1.5 inline-flex items-center text-sm"
              >
                &larr; Back to Dashboard
              </Link>
              <h1 className="font-condensed text-ink-950 text-2xl font-bold uppercase tracking-wide md:text-3xl">
                {club.name}
              </h1>
              <p className="text-ink-500 text-sm">{club.slug}.youthbasketballhub.com</p>
            </div>
          </div>
          <ClubTabs tabs={tabs} />
        </div>
      </div>
      <div className="px-4 py-8 md:px-6">{children}</div>
    </div>
  )
}
