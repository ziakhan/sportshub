import { prisma } from "@youthbasketballhub/db"
import { notFound } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"
import type { Metadata } from "next"

async function getClubBySlug(slug: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    include: {
      branding: true,
    },
  })
  if (!tenant || (tenant.status !== "ACTIVE" && tenant.status !== "UNCLAIMED")) {
    return null
  }
  return tenant
}

async function getHouseLeagues(tenantId: string) {
  const raw = await (prisma as any).houseLeague.findMany({
    where: { tenantId, isPublished: true, endDate: { gte: new Date() } },
    select: {
      id: true, name: true, ageGroup: true, gender: true, season: true,
      startDate: true, endDate: true, daysOfWeek: true, startTime: true, endTime: true,
      location: true, fee: true, maxParticipants: true,
      _count: { select: { signups: true } },
    },
    orderBy: { startDate: "asc" },
  })
  return (raw || []).map((l: any) => ({ ...l, fee: Number(l.fee) }))
}

async function getCamps(tenantId: string) {
  const raw = await (prisma as any).camp.findMany({
    where: { tenantId, isPublished: true, endDate: { gte: new Date() } },
    select: {
      id: true, name: true, campType: true, ageGroup: true, gender: true,
      startDate: true, endDate: true, numberOfWeeks: true,
      weeklyFee: true, fullCampFee: true, location: true,
      maxParticipants: true,
      _count: { select: { signups: true } },
    },
    orderBy: { startDate: "asc" },
  })
  return (raw || []).map((c: any) => ({
    ...c,
    weeklyFee: Number(c.weeklyFee),
    fullCampFee: c.fullCampFee ? Number(c.fullCampFee) : null,
  }))
}

async function getClubData(tenantId: string) {
  const [teams, tryouts, staffCount] = await Promise.all([
    prisma.team.findMany({
      where: { tenantId },
      select: { id: true, name: true, ageGroup: true, gender: true, season: true },
      orderBy: { name: "asc" },
    }),
    prisma.tryout.findMany({
      where: {
        tenantId,
        isPublished: true,
        isPublic: true,
        scheduledAt: { gte: new Date() },
      },
      select: {
        id: true,
        title: true,
        ageGroup: true,
        gender: true,
        location: true,
        scheduledAt: true,
        fee: true,
        maxParticipants: true,
        _count: { select: { signups: true } },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.userRole.count({
      where: { tenantId, role: { in: ["ClubOwner", "ClubManager", "Staff"] } },
    }),
  ])

  return {
    teams,
    tryouts: tryouts.map((t: any) => ({ ...t, fee: Number(t.fee) })),
    staffCount,
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.slug },
    select: { name: true, description: true, city: true, state: true },
  })
  if (!tenant) return { title: "Club Not Found" }
  return {
    title: `${tenant.name} - Youth Basketball Club`,
    description: tenant.description || `${tenant.name} youth basketball club in ${tenant.city || ""}, ${tenant.state || ""}`,
  }
}

export default async function ClubProfilePage({
  params,
}: {
  params: { slug: string }
}) {
  const club = await getClubBySlug(params.slug)
  if (!club) notFound()

  const [clubData, houseLeagues, camps] = await Promise.all([
    getClubData(club.id),
    getHouseLeagues(club.id),
    getCamps(club.id),
  ])
  const { teams, tryouts, staffCount } = clubData

  return (
    <>
      {/* Club Banner */}
      <div
        className="py-12"
        style={{ backgroundColor: club.branding?.primaryColor || "#1a73e8" }}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white md:text-4xl">{club.name}</h1>
              <p className="text-white/80 mt-1">
                {[club.city, club.state, club.country].filter(Boolean).join(", ")}
              </p>
            </div>
            {club.status === "UNCLAIMED" && (
              <Link
                href={`/clubs/find?q=${encodeURIComponent(club.name)}`}
                className="rounded-md bg-white px-4 py-2 text-sm font-semibold shadow hover:bg-gray-50"
                style={{ color: club.branding?.primaryColor || "#1a73e8" }}
              >
                Claim This Club
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* About */}
            {club.description && (
              <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">About</h2>
                <p className="text-gray-700 whitespace-pre-line">{club.description}</p>
              </div>
            )}

            {/* Teams */}
            <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Teams ({teams.length})
              </h2>
              {teams.length === 0 ? (
                <p className="text-gray-500 text-sm">No teams listed yet.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {teams.map((team: any) => (
                    <div key={team.id} className="rounded-md border border-gray-100 bg-gray-50 p-4">
                      <h3 className="font-medium text-gray-900">{team.name}</h3>
                      <p className="text-sm text-gray-500">
                        {team.ageGroup}
                        {team.gender ? ` \u2022 ${team.gender}` : ""}
                        {team.season ? ` \u2022 ${team.season}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tryouts */}
            {tryouts.length > 0 && (
              <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Upcoming Tryouts
                </h2>
                <div className="space-y-3">
                  {tryouts.map((tryout: any) => (
                    <Link
                      key={tryout.id}
                      href={`/tryout/${tryout.id}`}
                      className="block rounded-md border border-gray-200 p-4 hover:border-orange-300 hover:shadow-sm transition"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">{tryout.title}</h3>
                          <p className="text-sm text-gray-500">
                            {format(new Date(tryout.scheduledAt), "MMM d, yyyy 'at' h:mm a")}
                            {" \u2022 "}{tryout.location}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {tryout.ageGroup}
                            {tryout.gender ? ` \u2022 ${tryout.gender}` : ""}
                            {" \u2022 "}{tryout._count.signups}
                            {tryout.maxParticipants ? `/${tryout.maxParticipants}` : ""} signed up
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-orange-600">
                            {tryout.fee === 0 ? "FREE" : formatCurrency(tryout.fee, club.currency)}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* House Leagues / Programs */}
            {houseLeagues.length > 0 && (
              <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Programs
                </h2>
                <div className="space-y-3">
                  {houseLeagues.map((league: any) => (
                    <Link
                      key={league.id}
                      href={`/house-league/${league.id}`}
                      className="block rounded-md border border-gray-200 p-4 hover:border-orange-300 hover:shadow-sm transition"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">{league.name}</h3>
                          <p className="text-sm text-gray-500">
                            {league.ageGroup}{league.gender ? ` \u2022 ${league.gender}` : ""}
                            {league.season ? ` \u2022 ${league.season}` : ""}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {league.daysOfWeek} {league.startTime}-{league.endTime}
                            {" \u2022 "}{league.location}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-orange-600">
                            {league.fee === 0 ? "FREE" : formatCurrency(league.fee, club.currency)}
                          </div>
                          <div className="text-xs text-gray-400">
                            {league._count.signups}{league.maxParticipants ? `/${league.maxParticipants}` : ""} registered
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Camps */}
            {camps.length > 0 && (
              <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Camps</h2>
                <div className="space-y-3">
                  {camps.map((camp: any) => (
                    <Link
                      key={camp.id}
                      href={`/camp/${camp.id}`}
                      className="block rounded-md border border-gray-200 p-4 hover:border-orange-300 hover:shadow-sm transition"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-gray-900">{camp.name}</h3>
                            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                              {camp.campType === "MARCH_BREAK" ? "March Break" : camp.campType === "HOLIDAY" ? "Holiday" : camp.campType === "SUMMER" ? "Summer" : "Weekly"}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">
                            {camp.ageGroup}{camp.gender ? ` \u2022 ${camp.gender}` : ""}
                            {" \u2022 "}{camp.numberOfWeeks} week{camp.numberOfWeeks !== 1 ? "s" : ""}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">{camp.location}</p>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-orange-600">
                            {formatCurrency(camp.weeklyFee, club.currency)}/wk
                          </div>
                          {camp.fullCampFee && camp.numberOfWeeks > 1 && (
                            <div className="text-xs text-green-600">
                              {formatCurrency(camp.fullCampFee, club.currency)} all
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews placeholder - hidden for now */}
            {false && (
              <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Reviews</h2>
                <p className="text-gray-500 text-sm">No reviews yet.</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Club Info Card */}
            <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Club Info</h3>
              <div className="space-y-3 text-sm">
                {club.address && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase">Address</div>
                    <div className="text-gray-700">{club.address}</div>
                    <div className="text-gray-700">
                      {[club.city, club.state, club.zipCode].filter(Boolean).join(", ")}
                    </div>
                  </div>
                )}
                {club.phoneNumber && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase">Phone</div>
                    <div className="text-gray-700">{club.phoneNumber}</div>
                  </div>
                )}
                {club.contactEmail && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase">Email</div>
                    <div className="text-gray-700">{club.contactEmail}</div>
                  </div>
                )}
                {club.website && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase">Website</div>
                    <a
                      href={club.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-600 hover:underline"
                    >
                      {club.website.replace(/^https?:\/\//, "")}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">At a Glance</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-orange-600">{teams.length}</div>
                  <div className="text-xs text-gray-500">Teams</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{tryouts.length}</div>
                  <div className="text-xs text-gray-500">Tryouts</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">{staffCount}</div>
                  <div className="text-xs text-gray-500">Staff</div>
                </div>
              </div>
            </div>

            {/* CTA */}
            {club.status === "UNCLAIMED" ? (
              <div className="rounded-lg border-2 border-dashed border-yellow-300 bg-yellow-50 p-6 text-center">
                <h3 className="font-semibold text-gray-900 mb-2">Is this your club?</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Claim ownership to manage teams, tryouts, and more.
                </p>
                <Link
                  href={`/clubs/find?q=${encodeURIComponent(club.name)}`}
                  className="inline-block rounded-md bg-orange-500 px-6 py-2 text-sm font-semibold text-white hover:bg-orange-600"
                >
                  Claim This Club
                </Link>
              </div>
            ) : tryouts.length > 0 ? (
              <div className="rounded-lg bg-orange-50 p-6 text-center border border-orange-200">
                <h3 className="font-semibold text-gray-900 mb-2">Interested?</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Browse upcoming tryouts and sign up your player.
                </p>
                <Link
                  href="/marketplace"
                  className="inline-block rounded-md bg-orange-500 px-6 py-2 text-sm font-semibold text-white hover:bg-orange-600"
                >
                  Browse Tryouts
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  )
}
