import { prisma } from "@youthbasketballhub/db"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { getCurrentUser } from "@/lib/auth-helpers"
import { brandStyle } from "@/lib/club-page/brand"
import { coachedTeams } from "@/lib/authz/team-scope"
import { ClubTabs } from "./club-tabs"

async function getClubAccess(clubId: string, userId: string, userRoles: string[]) {
  // PlatformAdmin can access any club
  const isPlatformAdmin = userRoles.includes("PlatformAdmin")

  if (!isPlatformAdmin) {
    // Check if user has ANY role at this tenant (owner, manager, staff, team
    // manager — or Trainer, the solo operator of a TRAINER tenant)
    const roles = await prisma.userRole.findMany({
      where: {
        userId,
        tenantId: clubId,
        role: { in: ["ClubOwner", "ClubManager", "Staff", "TeamManager", "Trainer"] as any },
      },
      select: { role: true },
    })

    if (roles.length === 0) return null

    const roleNames = roles.map((r: { role: string }) => r.role)
    const isAdmin =
      roleNames.includes("ClubOwner") ||
      roleNames.includes("ClubManager") ||
      roleNames.includes("Trainer")

    const tenant = await (prisma as any).tenant.findUnique({
      where: { id: clubId },
      select: { id: true, name: true, slug: true, type: true },
    })

    if (!tenant) return null

    return { tenant, isAdmin }
  }

  // PlatformAdmin gets full admin access
  const tenant = await (prisma as any).tenant.findUnique({
    where: { id: clubId },
    select: { id: true, name: true, slug: true, type: true },
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

  // SECURITY GATE (owner 2026-07-20): a team-only coach must NOT reach any
  // club-wide surface (Overview, all-Teams, Tryouts, Offers, Templates,
  // programs, payments, staff, settings). They may ONLY be inside their own
  // team's pages. Enforced here, the single choke point for /clubs/[id]/*.
  const myTeams = isAdmin ? [] : await coachedTeams(dbUser.id, params.id)
  if (!isAdmin) {
    const pathname = headers().get("x-pathname") || ""
    const allowedTeamPrefixes = myTeams.map(
      (t) => `/clubs/${params.id}/teams/${t.id}`
    )
    // Coaches also manage their OWN team's tryouts. Every page under
    // /clubs/[id]/tryouts is role-scoped internally (list + create dropdown
    // filtered to coached teams; [tryoutId] guarded by its own layout).
    const coachAreaPrefixes = [`/clubs/${params.id}/tryouts`]
    const onAllowed = [...allowedTeamPrefixes, ...coachAreaPrefixes].some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    )
    // Public club page preview stays open; everything else club-wide is off.
    const onPublicPreview = pathname === `/clubs/${params.id}/public`
    if (!onAllowed && !onPublicPreview) {
      if (myTeams.length === 1) {
        redirect(`/clubs/${params.id}/teams/${myTeams[0].id}/dashboard`)
      }
      // 0 (defensive) or multiple teams → the personal multi-team landing
      redirect("/teams")
    }
  }

  const branding = await prisma.tenantBranding.findUnique({
    where: { tenantId: params.id },
    select: { primaryColor: true },
  })
  const primaryColor = branding?.primaryColor || "#4f46e5"

  // Admins get the full club workspace tabs. Coaches get ONLY their team(s) —
  // no club-wide navigation exists for them (owner 2026-07-20). TRAINER
  // tenants are solo program operators: no teams/rosters/staff surfaces.
  const isTrainerTenant = (club as any).type === "TRAINER"
  const tabs = isAdmin
    ? isTrainerTenant
      ? [
          { label: "Overview", href: `/clubs/${params.id}` },
          { label: "Training", href: `/clubs/${params.id}/training` },
          { label: "1-on-1", href: `/clubs/${params.id}/one-on-one` },
          { label: "Camps", href: `/clubs/${params.id}/camps` },
          { label: "Payments", href: `/clubs/${params.id}/payments` },
          { label: "Accounting", href: `/clubs/${params.id}/accounting` },
          { label: "Customize page", href: `/clubs/${params.id}/customize` },
          { label: "Messages", href: `/clubs/${params.id}/messages` },
          { label: "Settings", href: `/clubs/${params.id}/settings` },
        ]
      : [
          { label: "Overview", href: `/clubs/${params.id}` },
          { label: "Teams", href: `/clubs/${params.id}/teams` },
          { label: "Tryouts", href: `/clubs/${params.id}/tryouts` },
          { label: "Offers", href: `/clubs/${params.id}/offers` },
          { label: "Templates", href: `/clubs/${params.id}/offer-templates` },
          { label: "House League", href: `/clubs/${params.id}/house-leagues` },
          { label: "Camps", href: `/clubs/${params.id}/camps` },
          { label: "Tournaments", href: `/clubs/${params.id}/tournaments` },
          { label: "Payments", href: `/clubs/${params.id}/payments` },
          { label: "Accounting", href: `/clubs/${params.id}/accounting` },
          { label: "Staff", href: `/clubs/${params.id}/staff` },
          { label: "Customize page", href: `/clubs/${params.id}/customize` },
          { label: "Messages", href: `/clubs/${params.id}/messages` },
          { label: "Settings", href: `/clubs/${params.id}/settings` },
        ]
    : [
        ...myTeams.map((t) => ({
          label: t.name,
          href: `/clubs/${params.id}/teams/${t.id}/dashboard`,
        })),
        // Coaches manage their own team's tryouts (scoped list + create)
        { label: "Tryouts", href: `/clubs/${params.id}/tryouts` },
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
