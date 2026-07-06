import { prisma } from "@youthbasketballhub/db"
import { notFound } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"
import { Card, EntityHeader } from "@/components/ui"
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
      id: true, name: true, ageGroups: true, gender: true, season: true,
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
      <div className="container mx-auto px-4 pt-8">
        <EntityHeader
          name={club.name}
          subtitle={[club.city, club.state, club.country].filter(Boolean).join(", ")}
          primaryColor={club.branding?.primaryColor || "#1a73e8"}
          action={
            club.status === "UNCLAIMED" ? (
              <Link
                href={`/clubs/find?q=${encodeURIComponent(club.name)}`}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold shadow-soft hover:bg-ink-50"
                style={{ color: club.branding?.primaryColor || "#1a73e8" }}
              >
                Claim This Club
              </Link>
            ) : undefined
          }
        />
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* About */}
            {club.description && (
              <Card>
                <h2 className="text-lg font-bold text-ink-950 mb-3">About</h2>
                <p className="text-ink-700 whitespace-pre-line">{club.description}</p>
              </Card>
            )}

            {/* Teams */}
            <Card>
              <h2 className="text-lg font-bold text-ink-950 mb-4">
                Teams ({teams.length})
              </h2>
              {teams.length === 0 ? (
                <p className="text-ink-500 text-sm">No teams listed yet.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {teams.map((team: any) => (
                    <Link
                      key={team.id}
                      href={`/team/${team.id}`}
                      className="hover:border-play-200 group rounded-2xl border border-ink-100 bg-ink-50 p-4 transition hover:bg-white"
                    >
                      <h3 className="group-hover:text-play-600 font-medium text-ink-950 transition-colors">
                        {team.name}
                      </h3>
                      <p className="text-sm text-ink-500">
                        {team.ageGroup}
                        {team.gender ? ` • ${team.gender}` : ""}
                        {team.season ? ` • ${team.season}` : ""}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            {/* Tryouts */}
            {tryouts.length > 0 && (
              <Card>
                <h2 className="text-lg font-bold text-ink-950 mb-4">
                  Upcoming Tryouts
                </h2>
                <div className="space-y-3">
                  {tryouts.map((tryout: any) => (
                    <Link
                      key={tryout.id}
                      href={`/tryout/${tryout.id}`}
                      className="block rounded-2xl border border-ink-100 p-4 hover:border-hoop-300 hover:shadow-soft transition"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium text-ink-950">{tryout.title}</h3>
                          <p className="text-sm text-ink-500">
                            {format(new Date(tryout.scheduledAt), "MMM d, yyyy 'at' h:mm a")}
                            {" • "}{tryout.location}
                          </p>
                          <p className="text-xs text-ink-400 mt-1">
                            {tryout.ageGroup}
                            {tryout.gender ? ` • ${tryout.gender}` : ""}
                            {" • "}{tryout._count.signups}
                            {tryout.maxParticipants ? `/${tryout.maxParticipants}` : ""} signed up
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-hoop-600">
                            {tryout.fee === 0 ? "FREE" : formatCurrency(tryout.fee, club.currency)}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>
            )}

            {/* House Leagues / Programs */}
            {houseLeagues.length > 0 && (
              <Card>
                <h2 className="text-lg font-bold text-ink-950 mb-4">
                  Programs
                </h2>
                <div className="space-y-3">
                  {houseLeagues.map((league: any) => (
                    <Link
                      key={league.id}
                      href={`/house-league/${league.id}`}
                      className="block rounded-2xl border border-ink-100 p-4 hover:border-hoop-300 hover:shadow-soft transition"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium text-ink-950">{league.name}</h3>
                          <p className="text-sm text-ink-500">
                            {league.ageGroups}{league.gender ? ` • ${league.gender}` : ""}
                            {league.season ? ` • ${league.season}` : ""}
                          </p>
                          <p className="text-xs text-ink-400 mt-1">
                            {league.daysOfWeek} {league.startTime}-{league.endTime}
                            {" • "}{league.location}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-hoop-600">
                            {league.fee === 0 ? "FREE" : formatCurrency(league.fee, club.currency)}
                          </div>
                          <div className="text-xs text-ink-400">
                            {league._count.signups}{league.maxParticipants ? `/${league.maxParticipants}` : ""} registered
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>
            )}

            {/* Camps */}
            {camps.length > 0 && (
              <Card>
                <h2 className="text-lg font-bold text-ink-950 mb-4">Camps</h2>
                <div className="space-y-3">
                  {camps.map((camp: any) => (
                    <Link
                      key={camp.id}
                      href={`/camp/${camp.id}`}
                      className="block rounded-2xl border border-ink-100 p-4 hover:border-hoop-300 hover:shadow-soft transition"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-ink-950">{camp.name}</h3>
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                              {camp.campType === "MARCH_BREAK" ? "March Break" : camp.campType === "HOLIDAY" ? "Holiday" : camp.campType === "SUMMER" ? "Summer" : "Weekly"}
                            </span>
                          </div>
                          <p className="text-sm text-ink-500">
                            {camp.ageGroup}{camp.gender ? ` • ${camp.gender}` : ""}
                            {" • "}{camp.numberOfWeeks} week{camp.numberOfWeeks !== 1 ? "s" : ""}
                          </p>
                          <p className="text-xs text-ink-400 mt-1">{camp.location}</p>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-hoop-600">
                            {formatCurrency(camp.weeklyFee, club.currency)}/wk
                          </div>
                          {camp.fullCampFee && camp.numberOfWeeks > 1 && (
                            <div className="text-xs text-court-600">
                              {formatCurrency(camp.fullCampFee, club.currency)} all
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>
            )}

            {/* Reviews placeholder - hidden for now */}
            {false && (
              <Card>
                <h2 className="text-lg font-bold text-ink-950 mb-4">Reviews</h2>
                <p className="text-ink-500 text-sm">No reviews yet.</p>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Club Info Card */}
            <Card>
              <h3 className="font-bold text-ink-950 mb-4">Club Info</h3>
              <div className="space-y-3 text-sm">
                {club.address && (
                  <div>
                    <div className="text-xs font-medium text-ink-500 uppercase">Address</div>
                    <div className="text-ink-700">{club.address}</div>
                    <div className="text-ink-700">
                      {[club.city, club.state, club.zipCode].filter(Boolean).join(", ")}
                    </div>
                  </div>
                )}
                {club.phoneNumber && (
                  <div>
                    <div className="text-xs font-medium text-ink-500 uppercase">Phone</div>
                    <div className="text-ink-700">{club.phoneNumber}</div>
                  </div>
                )}
                {club.contactEmail && (
                  <div>
                    <div className="text-xs font-medium text-ink-500 uppercase">Email</div>
                    <div className="text-ink-700">{club.contactEmail}</div>
                  </div>
                )}
                {club.website && (
                  <div>
                    <div className="text-xs font-medium text-ink-500 uppercase">Website</div>
                    <a
                      href={club.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-hoop-600 hover:underline"
                    >
                      {club.website.replace(/^https?:\/\//, "")}
                    </a>
                  </div>
                )}
              </div>
            </Card>

            {/* Quick Stats */}
            <Card>
              <h3 className="font-bold text-ink-950 mb-4">At a Glance</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-hoop-600">{teams.length}</div>
                  <div className="text-xs text-ink-500">Teams</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-court-600">{tryouts.length}</div>
                  <div className="text-xs text-ink-500">Tryouts</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-play-600">{staffCount}</div>
                  <div className="text-xs text-ink-500">Staff</div>
                </div>
              </div>
            </Card>

            {/* CTA */}
            {club.status === "UNCLAIMED" ? (
              <div className="rounded-[28px] border-2 border-dashed border-gold-400 bg-gold-50 p-6 text-center">
                <h3 className="font-bold text-ink-950 mb-2">Is this your club?</h3>
                <p className="text-sm text-ink-600 mb-4">
                  Claim ownership to manage teams, tryouts, and more.
                </p>
                <Link
                  href={`/clubs/find?q=${encodeURIComponent(club.name)}`}
                  className="inline-block rounded-xl bg-play-600 px-6 py-2 text-sm font-semibold text-white hover:bg-play-700"
                >
                  Claim This Club
                </Link>
              </div>
            ) : tryouts.length > 0 ? (
              <div className="rounded-[28px] bg-hoop-50 p-6 text-center border border-hoop-100">
                <h3 className="font-bold text-ink-950 mb-2">Interested?</h3>
                <p className="text-sm text-ink-600 mb-4">
                  Browse upcoming tryouts and sign up your player.
                </p>
                <Link
                  href="/marketplace"
                  className="inline-block rounded-xl bg-play-600 px-6 py-2 text-sm font-semibold text-white hover:bg-play-700"
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
