import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"
import { getPublicTournament } from "@/lib/queries/tournament"
import { Card } from "@/components/ui"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: { id: string } }) {
  const tournament = await getPublicTournament(params.id)
  if (!tournament) return { title: "Tournament not found — SportsHub" }
  const description = tournament.description
    ? String(tournament.description).slice(0, 150)
    : `${tournament.name} — youth basketball tournament${tournament.city ? ` in ${tournament.city}` : ""} on SportsHub.`
  return { title: `${tournament.name} — SportsHub`, description }
}

export default async function PublicTournamentPage({ params }: { params: { id: string } }) {
  const tournament = await getPublicTournament(params.id)
  if (!tournament) notFound()

  const isOpen = tournament.status === "REGISTRATION"
  const deadlinePassed =
    tournament.registrationDeadline && new Date(tournament.registrationDeadline) < new Date()
  const canRegister = isOpen && !deadlinePassed
  const approvedTeams = (tournament.teams || []).filter((t: any) => t.status === "APPROVED")

  return (
    <>
      {/* Banner */}
      <div className="bg-navy-900 border-b border-navy-700">
        <div className="container mx-auto px-4 py-6">
          <Link href="/events" className="mb-2 inline-block text-sm text-white/70 hover:text-white">
            &larr; Back to Events
          </Link>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">{tournament.name}</h2>
            {canRegister && (
              <span className="rounded-full bg-court-500/20 px-3 py-0.5 text-xs font-medium text-court-400">
                Open for Registration
              </span>
            )}
          </div>
          <p className="text-sm text-white/70">
            {tournament.city}{tournament.state ? `, ${tournament.state}` : ""}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-8">
              <h1 className="text-3xl font-bold text-ink-950 mb-2">{tournament.name}</h1>
              <p className="text-ink-500 mb-4">
                {tournament.city}{tournament.state ? `, ${tournament.state}` : ""}
              </p>

              {tournament.description && (
                <p className="text-ink-700 mb-6">{tournament.description}</p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {tournament.startDate && (
                  <div className="rounded-2xl bg-ink-50 p-4">
                    <div className="text-sm font-medium text-ink-500 mb-1">Dates</div>
                    <div className="text-ink-950">
                      {format(new Date(tournament.startDate), "MMM d")} -{" "}
                      {tournament.endDate ? format(new Date(tournament.endDate), "MMM d, yyyy") : "TBD"}
                    </div>
                  </div>
                )}
                {tournament.gamesGuaranteed && (
                  <div className="rounded-2xl bg-ink-50 p-4">
                    <div className="text-sm font-medium text-ink-500 mb-1">Games Guaranteed</div>
                    <div className="text-ink-950">{tournament.gamesGuaranteed} games</div>
                  </div>
                )}
                {tournament.registrationDeadline && (
                  <div className="rounded-2xl bg-ink-50 p-4">
                    <div className="text-sm font-medium text-ink-500 mb-1">Registration Deadline</div>
                    <div className={`${deadlinePassed ? "text-red-600" : "text-ink-950"}`}>
                      {format(new Date(tournament.registrationDeadline), "MMM d, yyyy")}
                    </div>
                  </div>
                )}
                <div className="rounded-2xl bg-ink-50 p-4">
                  <div className="text-sm font-medium text-ink-500 mb-1">Game Format</div>
                  <div className="text-ink-950">
                    {tournament.gameLengthMinutes || 40}min ({tournament.gamePeriods === "QUARTERS" ? "4 quarters" : "2 halves"})
                  </div>
                </div>
              </div>
            </Card>

            {/* Divisions */}
            {tournament.divisions?.length > 0 && (
              <Card className="p-8">
                <h2 className="text-lg font-bold text-ink-950 mb-4">Divisions</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {tournament.divisions.map((d: any) => (
                    <div key={d.id} className="rounded-2xl border border-ink-100 bg-ink-50 p-3">
                      <span className="font-medium text-ink-950">{d.name}</span>
                      <span className="ml-2 text-xs text-ink-500">
                        {d.ageGroup}{d.gender ? ` • ${d.gender}` : ""}
                      </span>
                      {d.maxTeams && (
                        <span className="ml-2 text-xs text-ink-400">(max {d.maxTeams})</span>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Registered Teams */}
            {approvedTeams.length > 0 && (
              <Card className="p-8">
                <h2 className="text-lg font-bold text-ink-950 mb-4">
                  Registered Teams ({approvedTeams.length})
                </h2>
                {approvedTeams.map((t: any) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2 mb-1"
                  >
                    <div>
                      <span className="font-medium text-ink-950">{t.team?.name || "Unknown"}</span>
                      <span className="ml-2 text-xs text-ink-500">{t.team?.tenant?.name}</span>
                    </div>
                    {t.division && (
                      <span className="text-xs text-hoop-600">{t.division.name}</span>
                    )}
                  </div>
                ))}
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div>
            <Card className="sticky top-4">
              <div className="mb-4 text-center">
                <div className="text-3xl font-bold text-hoop-600">
                  {tournament.teamFee != null
                    ? formatCurrency(Number(tournament.teamFee), tournament.currency || "CAD")
                    : "TBD"}
                </div>
                <p className="text-xs text-ink-500 mt-1">per team</p>
              </div>

              {canRegister ? (
                <Link
                  href={`/sign-in?callbackUrl=/browse-tournaments/${tournament.id}`}
                  className="block w-full rounded-xl bg-play-600 px-4 py-3 text-center font-semibold text-white hover:bg-play-700"
                >
                  Register Your Team
                </Link>
              ) : (
                <div className="rounded-2xl bg-ink-100 p-4 text-center text-sm text-ink-600">
                  {deadlinePassed ? "Registration deadline has passed." : "Registration is not open yet."}
                </div>
              )}

              {tournament.playoffFormat && (
                <div className="mt-4 pt-4 border-t border-ink-100 text-center">
                  <div className="text-xs text-ink-500">Playoffs</div>
                  <div className="text-sm font-medium text-ink-950">
                    {tournament.playoffFormat.replace(/_/g, " ")}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
