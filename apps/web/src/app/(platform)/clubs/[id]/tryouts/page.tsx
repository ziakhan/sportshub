import { prisma } from "@youthbasketballhub/db"
import { format } from "date-fns"
import Link from "next/link"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { AnimatedNumber, Badge, Button } from "@/components/ui"
import { getCurrentUser } from "@/lib/auth-helpers"
import { isClubAdmin, coachedTeamIds } from "@/lib/authz/team-scope"
import { PublishButton } from "./publish-button"
import { TryoutsFilter } from "./tryouts-filter"

interface TryoutListItem {
  id: string
  title: string
  scheduledAt: Date
  location: string
  ageGroup: string
  isPublished: boolean
  maxParticipants: number | null
  team: { id: string; name: string } | null
  signups: { id: string; status: string; offers: { status: string }[] }[]
  signupStats: { total: number; withOffer: number; needsOffer: number }
  isPast: boolean
}

async function getTryouts(
  tenantId: string,
  teamScope: string[] | null
): Promise<TryoutListItem[]> {
  const tryouts: any[] = await prisma.tryout.findMany({
    where: teamScope ? { tenantId, teamId: { in: teamScope } } : { tenantId },
    select: {
      id: true,
      title: true,
      scheduledAt: true,
      location: true,
      ageGroup: true,
      isPublished: true,
      maxParticipants: true,
      team: {
        select: { id: true, name: true },
      },
      signups: {
        where: { status: { not: "CANCELLED" } },
        select: {
          id: true,
          status: true,
          offers: { select: { status: true }, take: 1 },
        },
      },
    },
    orderBy: { scheduledAt: "desc" },
  })

  return tryouts.map((t: any) => {
    const total = t.signups.length
    const withOffer = t.signups.filter((s: any) => s.offers.length > 0).length
    const needsOffer = total - withOffer
    const isPast = new Date(t.scheduledAt) < new Date()
    return { ...t, signupStats: { total, withOffer, needsOffer }, isPast }
  })
}

async function getClubTeams(
  tenantId: string,
  teamScope: string[] | null
): Promise<{ id: string; name: string }[]> {
  return (await prisma.team.findMany({
    where: teamScope ? { tenantId, id: { in: teamScope } } : { tenantId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })) as any
}

export default async function ClubTryoutsPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { status?: string; team?: string; q?: string }
}) {
  // Security fix 2026-07-20: a coach sees ONLY their own team's tryouts;
  // club admins see all. teamScope=null means "all" (admin).
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")
  const admin = await isClubAdmin(user.id, params.id)
  const teamScope = admin ? null : await coachedTeamIds(user.id, params.id)
  if (teamScope && teamScope.length === 0) redirect("/teams")

  const [tryouts, teams] = await Promise.all([
    getTryouts(params.id, teamScope),
    getClubTeams(params.id, teamScope),
  ])

  const statusFilter = searchParams.status
  const teamFilter = searchParams.team
  const searchQuery = searchParams.q?.toLowerCase()

  // Compute counts for filter pills
  const pastCount = tryouts.filter((t) => t.isPast).length
  const publishedCount = tryouts.filter((t) => !t.isPast && t.isPublished).length
  const draftCount = tryouts.filter((t) => !t.isPast && !t.isPublished).length
  const needsOfferCount = tryouts.filter((t) => t.signupStats.needsOffer > 0).length

  // Apply filters
  const filtered = tryouts.filter((t) => {
    if (statusFilter === "published" && (t.isPast || !t.isPublished)) return false
    if (statusFilter === "draft" && (t.isPast || t.isPublished)) return false
    if (statusFilter === "past" && !t.isPast) return false
    if (statusFilter === "needs-offer" && t.signupStats.needsOffer === 0) return false
    if (teamFilter && t.team?.id !== teamFilter) return false
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery)) return false
    return true
  })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="font-condensed text-ink-950 text-2xl font-bold uppercase tracking-wide">
          Tryouts
        </h2>
        <Button href={`/clubs/${params.id}/tryouts/create`} icon={ICONS.plus}>
          Create Tryout
        </Button>
      </div>

      {tryouts.length === 0 ? (
        <div className="reveal border-ink-300 shadow-soft rounded-3xl border border-dashed bg-white p-12 text-center">
          <h3 className="font-condensed text-ink-950 mb-2 text-xl font-bold uppercase tracking-wide">
            No tryouts yet
          </h3>
          <p className="text-ink-600 mb-6">
            Create a tryout and publish it to the marketplace so parents can sign up.
          </p>
          <Button href={`/clubs/${params.id}/tryouts/create`} icon={ICONS.plus}>
            Create Your First Tryout
          </Button>
        </div>
      ) : (
        <>
          {/* Filters */}
          <TryoutsFilter
            clubId={params.id}
            teams={teams}
            activeStatus={statusFilter}
            activeTeamId={teamFilter}
            activeSearch={searchParams.q}
            counts={{
              all: tryouts.length,
              published: publishedCount,
              draft: draftCount,
              past: pastCount,
              needsOffer: needsOfferCount,
            }}
          />

          {filtered.length === 0 ? (
            <div className="reveal border-ink-300 shadow-soft rounded-3xl border border-dashed bg-white p-8 text-center">
              <p className="text-ink-600 mb-3">No tryouts match the current filters.</p>
              <Button href={`/clubs/${params.id}/tryouts`} variant="subtle" size="sm">
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((tryout, i) => (
                <div
                  key={tryout.id}
                  className="reveal border-ink-100 shadow-soft rounded-3xl border bg-white p-4 transition duration-200 hover:border-[color:var(--brand-line)] sm:p-6"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  {/* Title + badges */}
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="text-ink-900 text-base font-semibold sm:text-lg">
                      {tryout.title}
                    </h3>
                    {tryout.isPast ? (
                      <Badge tone="neutral">Past</Badge>
                    ) : !tryout.isPublished ? (
                      <Badge tone="hoop">Draft</Badge>
                    ) : tryout.maxParticipants != null &&
                      tryout.signups.filter((s) => s.status !== "CANCELLED").length >=
                        tryout.maxParticipants ? (
                      <Badge tone="gold" dot>Full</Badge>
                    ) : (
                      <Badge tone="court">Published</Badge>
                    )}
                    {tryout.team && (
                      <Link
                        href={`/clubs/${params.id}/teams/${tryout.team.id}/dashboard`}
                        className="rounded-full bg-[var(--brand-soft)] px-2.5 py-0.5 text-xs font-semibold text-[color:var(--brand-ink)] transition hover:brightness-95"
                      >
                        {tryout.team.name}
                      </Link>
                    )}
                  </div>

                  {/* Details — wraps on mobile */}
                  <div className="text-ink-500 mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <span>{format(new Date(tryout.scheduledAt), "MMM d, yyyy 'at' h:mm a")}</span>
                    <span>{tryout.location}</span>
                    <span>{tryout.ageGroup}</span>
                  </div>

                  {/* Stats + actions — stacks on mobile */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-condensed text-2xl font-bold leading-none text-[color:var(--brand-ink)]">
                        <AnimatedNumber value={tryout.signupStats.total} />
                        {tryout.maxParticipants ? ` / ${tryout.maxParticipants}` : ""}
                      </span>
                      <span className="text-ink-500 text-xs">signups</span>
                      {tryout.signupStats.needsOffer > 0 && (
                        <span className="text-hoop-600 ml-1 text-xs font-semibold">
                          ({tryout.signupStats.needsOffer} need
                          {tryout.signupStats.needsOffer === 1 ? "s" : ""} offer)
                        </span>
                      )}
                    </div>
                    <div className="ml-auto flex flex-wrap gap-2">
                      <Button
                        href={`/clubs/${params.id}/tryouts/${tryout.id}/signups`}
                        variant="secondary"
                        size="sm"
                        icon={ICONS.users}
                      >
                        Signups
                      </Button>
                      <Button
                        href={`/clubs/${params.id}/tryouts/${tryout.id}/edit`}
                        variant="subtle"
                        size="sm"
                        icon={ICONS.pencil}
                      >
                        Edit
                      </Button>
                      <Button
                        href={`/tryout/${tryout.id}`}
                        variant="subtle"
                        size="sm"
                        icon={ICONS.eye}
                      >
                        Public listing
                      </Button>
                      {!tryout.isPast && (
                        <PublishButton tryoutId={tryout.id} isPublished={tryout.isPublished} />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** Leading SVG icons for the kit Buttons (the Button component sizes them). */
const ICONS: Record<string, ReactNode> = {
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
    </svg>
  ),
  pencil: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  eye: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
}
