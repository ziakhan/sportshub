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
  return (await prisma.team.findMany({
    where: { tenantId },
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
  const [tryouts, teams] = await Promise.all([getTryouts(params.id), getClubTeams(params.id)])

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
        <h2 className="text-ink-900 text-xl font-bold">Tryouts</h2>
        <Link
          href={`/clubs/${params.id}/tryouts/create`}
          className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white"
        >
          Create Tryout
        </Link>
      </div>

      {tryouts.length === 0 ? (
        <div className="border-ink-300 shadow-soft rounded-2xl border border-dashed bg-white p-12 text-center">
          <h3 className="text-ink-900 mb-2 text-lg font-semibold">No tryouts yet</h3>
          <p className="text-ink-600 mb-6">
            Create a tryout and publish it to the marketplace so parents can sign up.
          </p>
          <Link
            href={`/clubs/${params.id}/tryouts/create`}
            className="bg-play-600 hover:bg-play-700 inline-block rounded-xl px-6 py-2 font-semibold text-white"
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
            counts={{
              all: tryouts.length,
              published: publishedCount,
              draft: draftCount,
              past: pastCount,
              needsOffer: needsOfferCount,
            }}
          />

          {filtered.length === 0 ? (
            <div className="border-ink-300 shadow-soft rounded-2xl border border-dashed bg-white p-8 text-center">
              <p className="text-ink-600 mb-3">No tryouts match the current filters.</p>
              <Link
                href={`/clubs/${params.id}/tryouts`}
                className="text-play-700 text-sm hover:underline"
              >
                Clear filters
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((tryout) => (
                <div
                  key={tryout.id}
                  className="border-ink-100 shadow-soft rounded-2xl border bg-white p-4 sm:p-6"
                >
                  {/* Title + badges */}
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="text-ink-900 text-base font-semibold sm:text-lg">
                      {tryout.title}
                    </h3>
                    {tryout.isPast ? (
                      <span className="bg-court-100 text-ink-600 rounded-full px-2 py-0.5 text-xs font-medium">
                        Past
                      </span>
                    ) : tryout.isPublished ? (
                      <span className="bg-court-100 text-court-700 rounded-full px-2 py-0.5 text-xs font-medium">
                        Published
                      </span>
                    ) : (
                      <span className="bg-hoop-100 text-hoop-700 rounded-full px-2 py-0.5 text-xs font-medium">
                        Draft
                      </span>
                    )}
                    {tryout.team && (
                      <Link
                        href={`/clubs/${params.id}/teams/${tryout.team.id}/dashboard`}
                        className="bg-play-100 text-play-700 hover:bg-play-200 rounded-full px-2 py-0.5 text-xs font-medium"
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
                    <div>
                      <span className="text-play-700 text-lg font-bold">
                        {tryout.signupStats.total}
                        {tryout.maxParticipants ? ` / ${tryout.maxParticipants}` : ""}
                      </span>
                      <span className="text-ink-500 ml-1 text-xs">signups</span>
                      {tryout.signupStats.needsOffer > 0 && (
                        <span className="text-play-700 ml-2 text-xs font-medium">
                          ({tryout.signupStats.needsOffer} need
                          {tryout.signupStats.needsOffer === 1 ? "s" : ""} offer)
                        </span>
                      )}
                    </div>
                    <div className="ml-auto flex flex-wrap gap-2">
                      <Link
                        href={`/clubs/${params.id}/tryouts/${tryout.id}/signups`}
                        className="border-play-300 bg-play-50 text-play-700 hover:bg-play-100 rounded-xl border px-3 py-1.5 text-xs font-semibold"
                      >
                        Signups
                      </Link>
                      <Link
                        href={`/clubs/${params.id}/tryouts/${tryout.id}/edit`}
                        className="border-ink-200 text-ink-700 hover:bg-court-50 rounded-xl border px-3 py-1.5 text-xs font-semibold"
                      >
                        Edit
                      </Link>
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
