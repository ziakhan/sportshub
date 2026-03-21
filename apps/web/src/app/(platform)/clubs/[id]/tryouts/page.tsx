import { prisma } from "@youthbasketballhub/db"
import { format } from "date-fns"
import Link from "next/link"
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

async function getTryouts(tenantId: string): Promise<TryoutListItem[]> {
  const tryouts: any[] = await prisma.tryout.findMany({
    where: { tenantId },
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

async function getClubTeams(tenantId: string): Promise<{ id: string; name: string }[]> {
  return await prisma.team.findMany({
    where: { tenantId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  }) as any
}

export default async function ClubTryoutsPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { status?: string; team?: string; q?: string }
}) {
  const [tryouts, teams] = await Promise.all([
    getTryouts(params.id),
    getClubTeams(params.id),
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
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Tryouts</h2>
        <Link
          href={`/clubs/${params.id}/tryouts/create`}
          className="rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
        >
          Create Tryout
        </Link>
      </div>

      {tryouts.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No tryouts yet
          </h3>
          <p className="text-gray-600 mb-6">
            Create a tryout and publish it to the marketplace so parents can
            sign up.
          </p>
          <Link
            href={`/clubs/${params.id}/tryouts/create`}
            className="inline-block rounded-md bg-orange-500 px-6 py-2 text-white font-semibold hover:bg-orange-600"
          >
            Create Your First Tryout
          </Link>
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
            counts={{ all: tryouts.length, published: publishedCount, draft: draftCount, past: pastCount, needsOffer: needsOfferCount }}
          />

          {filtered.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-8 text-center">
              <p className="text-gray-600 mb-3">No tryouts match the current filters.</p>
              <Link href={`/clubs/${params.id}/tryouts`} className="text-sm text-orange-600 hover:underline">
                Clear filters
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((tryout) => (
                <div
                  key={tryout.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6"
                >
                  {/* Title + badges */}
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-gray-900 sm:text-lg">
                      {tryout.title}
                    </h3>
                    {tryout.isPast ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        Past
                      </span>
                    ) : tryout.isPublished ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Published
                      </span>
                    ) : (
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                        Draft
                      </span>
                    )}
                    {tryout.team && (
                      <Link
                        href={`/clubs/${params.id}/teams/${tryout.team.id}/dashboard`}
                        className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 hover:bg-orange-200"
                      >
                        {tryout.team.name}
                      </Link>
                    )}
                  </div>

                  {/* Details — wraps on mobile */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mb-3">
                    <span>
                      {format(new Date(tryout.scheduledAt), "MMM d, yyyy 'at' h:mm a")}
                    </span>
                    <span>{tryout.location}</span>
                    <span>{tryout.ageGroup}</span>
                  </div>

                  {/* Stats + actions — stacks on mobile */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div>
                      <span className="text-lg font-bold text-orange-600">
                        {tryout.signupStats.total}
                        {tryout.maxParticipants
                          ? ` / ${tryout.maxParticipants}`
                          : ""}
                      </span>
                      <span className="ml-1 text-xs text-gray-500">signups</span>
                      {tryout.signupStats.needsOffer > 0 && (
                        <span className="ml-2 text-xs font-medium text-orange-600">
                          ({tryout.signupStats.needsOffer} need{tryout.signupStats.needsOffer === 1 ? "s" : ""} offer)
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 ml-auto">
                      <Link
                        href={`/clubs/${params.id}/tryouts/${tryout.id}/signups`}
                        className="rounded-md border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100"
                      >
                        Signups
                      </Link>
                      <Link
                        href={`/clubs/${params.id}/tryouts/${tryout.id}/edit`}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        Edit
                      </Link>
                      {!tryout.isPast && (
                        <PublishButton
                          tryoutId={tryout.id}
                          isPublished={tryout.isPublished}
                        />
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
