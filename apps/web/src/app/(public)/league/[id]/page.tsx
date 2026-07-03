import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"
import { getPublicSeason } from "@/lib/queries/season"
import { Badge, Card } from "@/components/ui"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: { id: string } }) {
  const season = await getPublicSeason(params.id)
  if (!season) return { title: "Season not found — SportsHub" }
  const name = season.league?.name || "League Season"
  const description = season.league?.description
    ? String(season.league.description).slice(0, 150)
    : `${name} — youth basketball league season on SportsHub.`
  return { title: `${name} — SportsHub`, description }
}

export default async function PublicSeasonPage({ params }: { params: { id: string } }) {
  const season = await getPublicSeason(params.id)
  if (!season) notFound()

  const leagueName = season.league?.name
  const leagueDescription = season.league?.description
  const isOpen = season.status === "REGISTRATION"
  const deadlinePassed =
    season.registrationDeadline && new Date(season.registrationDeadline) < new Date()
  const registeredTeams =
    season.teamSubmissions?.filter((t: any) => t.status === "APPROVED") || []
  const approvedCount = registeredTeams.length

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/events" className="text-sm text-hoop-600 hover:underline">
          &larr; Back to Events
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-8">
            <div className="flex items-center gap-3 mb-3">
              {isOpen && <Badge tone="court">Open for Registration</Badge>}
              {season.status === "IN_PROGRESS" && <Badge tone="play">In Progress</Badge>}
              {season.label && <Badge tone="hoop">{season.label}</Badge>}
            </div>

            <h1 className="text-3xl font-bold text-ink-950 mb-2">{leagueName}</h1>
            {leagueDescription && <p className="text-ink-700 mb-4">{leagueDescription}</p>}

            <div className="grid gap-4 sm:grid-cols-2">
              {season.startDate && (
                <div className="rounded-2xl bg-ink-50 p-4">
                  <div className="text-sm font-medium text-ink-500 mb-1">Season</div>
                  <div className="text-ink-950">
                    {format(new Date(season.startDate), "MMM d")} -{" "}
                    {season.endDate ? format(new Date(season.endDate), "MMM d, yyyy") : "TBD"}
                  </div>
                </div>
              )}
              {season.gamesGuaranteed && (
                <div className="rounded-2xl bg-ink-50 p-4">
                  <div className="text-sm font-medium text-ink-500 mb-1">Games Guaranteed</div>
                  <div className="text-ink-950">
                    {season.gamesGuaranteed} regular season games
                  </div>
                </div>
              )}
              {season.registrationDeadline && (
                <div className="rounded-2xl bg-ink-50 p-4">
                  <div className="text-sm font-medium text-ink-500 mb-1">
                    Registration Deadline
                  </div>
                  <div className={`${deadlinePassed ? "text-red-600" : "text-ink-950"}`}>
                    {format(new Date(season.registrationDeadline), "MMM d, yyyy")}
                    {deadlinePassed && " (Closed)"}
                  </div>
                </div>
              )}
              {season.playoffFormat && (
                <div className="rounded-2xl bg-ink-50 p-4">
                  <div className="text-sm font-medium text-ink-500 mb-1">Playoffs</div>
                  <div className="text-ink-950">
                    {season.playoffFormat.replace(/_/g, " ")}
                    {season.playoffTeams ? ` (Top ${season.playoffTeams})` : ""}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {season.divisions?.length > 0 && (
            <Card className="p-8">
              <h2 className="text-lg font-bold text-ink-950 mb-4">Divisions</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {season.divisions.map((d: any) => (
                  <div key={d.id} className="rounded-2xl border border-ink-100 bg-ink-50 p-4">
                    <h3 className="font-medium text-ink-950">{d.name}</h3>
                    <p className="text-sm text-ink-500">
                      {d.ageGroup}
                      {d.gender ? ` • ${d.gender}` : ""}
                      {d.tier > 1 ? ` • Tier ${d.tier}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {registeredTeams.length > 0 && (
            <Card className="p-8">
              <h2 className="text-lg font-bold text-ink-950 mb-4">
                Registered Teams ({approvedCount})
              </h2>
              <div className="space-y-2">
                {registeredTeams.map((t: any) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-xl bg-ink-50 px-4 py-3"
                  >
                    <div>
                      <span className="font-medium text-ink-950">{t.team.name}</span>
                      {t.team.tenant && (
                        <Link
                          href={`/club/${t.team.tenant.slug}`}
                          className="ml-2 text-xs text-hoop-600 hover:underline"
                        >
                          {t.team.tenant.name}
                        </Link>
                      )}
                    </div>
                    {t.division && (
                      <span className="text-xs text-ink-500">{t.division.name}</span>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div>
          <Card className="sticky top-4">
            {season.teamFee && (
              <div className="mb-4 text-center">
                <div className="text-3xl font-bold text-hoop-600">
                  {formatCurrency(season.teamFee)}
                </div>
                <p className="text-xs text-ink-500">per team</p>
              </div>
            )}

            {isOpen && !deadlinePassed ? (
              <Link
                href={`/browse-leagues/${params.id}`}
                className="block w-full rounded-xl bg-play-600 px-4 py-3 text-center font-semibold text-white hover:bg-play-700"
              >
                Register Your Team
              </Link>
            ) : (
              <div className="rounded-2xl bg-ink-100 p-4 text-center text-sm text-ink-600">
                {deadlinePassed ? "Registration is closed." : "Registration is not open yet."}
              </div>
            )}

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-500">Teams Registered</span>
                <span className="font-medium">{season._count?.teamSubmissions || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Divisions</span>
                <span className="font-medium">{season.divisions?.length || 0}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
