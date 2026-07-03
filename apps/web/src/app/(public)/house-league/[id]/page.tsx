import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"
import { getPublicHouseLeague } from "@/lib/queries/house-league"
import { Badge, Card } from "@/components/ui"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: { id: string } }) {
  const league = await getPublicHouseLeague(params.id)
  if (!league) return { title: "Program not found — SportsHub" }
  const description = league.description
    ? String(league.description).slice(0, 150)
    : `${league.name} — youth basketball house league by ${league.tenant.name} on SportsHub.`
  return { title: `${league.name} — SportsHub`, description }
}

export default async function PublicHouseLeaguePage({ params }: { params: { id: string } }) {
  const league = await getPublicHouseLeague(params.id)
  if (!league) notFound()

  const isPast = new Date(league.endDate) < new Date()
  const isFull = league.maxParticipants !== null && league._count.signups >= league.maxParticipants
  const spotsLeft = league.maxParticipants ? league.maxParticipants - league._count.signups : null
  const currency = league.tenant.currency || "CAD"
  const primaryColor = league.tenant.branding?.primaryColor || "#1a73e8"

  const included = [
    league.includesUniform && "Uniform (Shirt + Shorts)",
    league.includesJersey && "Jersey",
    league.includesBall && "Basketball",
    league.includesMedal && "Medal/Trophy",
  ].filter(Boolean)

  const days = league.daysOfWeek.split(",").map((d: string) => d.trim())

  return (
    <>
      {/* Banner */}
      <div className="border-b" style={{ backgroundColor: primaryColor }}>
        <div className="container mx-auto px-4 py-6">
          <Link href="/marketplace" className="mb-2 inline-block text-sm text-white/80 hover:text-white">
            &larr; Back
          </Link>
          <Link href={`/club/${league.tenant.slug}`}>
            <h2 className="text-lg font-semibold text-white hover:text-white/90">{league.tenant.name}</h2>
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-8">
              <div className="mb-4 flex items-center gap-3">
                {isPast && <Badge tone="neutral">Ended</Badge>}
                {!isPast && !isFull && <Badge tone="court">Open</Badge>}
                {isFull && !isPast && <Badge tone="danger">Full</Badge>}
                {league.season && <Badge tone="hoop">{league.season}</Badge>}
              </div>

              <h1 className="text-3xl font-bold text-ink-950 mb-2">{league.name}</h1>
              <p className="text-ink-500 mb-4">
                {league.ageGroups.split(",").join(", ")}{league.gender ? ` • ${league.gender}` : ""}
              </p>

              {league.description && (
                <p className="text-ink-700 mb-6">{league.description}</p>
              )}

              {/* Schedule */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-ink-50 p-4">
                  <div className="text-sm font-medium text-ink-500 mb-1">Dates</div>
                  <div className="text-ink-950">
                    {format(new Date(league.startDate), "MMM d")} - {format(new Date(league.endDate), "MMM d, yyyy")}
                  </div>
                </div>
                <div className="rounded-2xl bg-ink-50 p-4">
                  <div className="text-sm font-medium text-ink-500 mb-1">Weekly Schedule</div>
                  <div className="text-ink-950">
                    {days.join(", ")} {league.startTime} - {league.endTime}
                  </div>
                </div>
                <div className="rounded-2xl bg-ink-50 p-4">
                  <div className="text-sm font-medium text-ink-500 mb-1">Location</div>
                  <div className="text-ink-950">{league.location}</div>
                </div>
                <div className="rounded-2xl bg-ink-50 p-4">
                  <div className="text-sm font-medium text-ink-500 mb-1">Spots</div>
                  <div className="text-ink-950">
                    {league._count.signups} registered
                    {spotsLeft !== null && <span className="text-sm text-ink-500"> ({spotsLeft} left)</span>}
                  </div>
                </div>
              </div>
            </Card>

            {/* Details / What's Included */}
            {(league.details || included.length > 0) && (
              <Card className="p-8">
                <h2 className="text-lg font-bold text-ink-950 mb-4">What&apos;s Included</h2>

                {included.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {included.map((item: any) => (
                      <span key={item as string} className="rounded-full bg-court-50 px-3 py-1 text-sm font-medium text-court-700">
                        {item}
                      </span>
                    ))}
                  </div>
                )}

                {league.details && (
                  <div className="text-ink-700 whitespace-pre-line">{league.details}</div>
                )}
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div>
            <Card className="sticky top-4">
              <div className="mb-4 text-center">
                <div className="text-3xl font-bold text-hoop-600">
                  {league.fee === 0 ? "FREE" : formatCurrency(league.fee, currency)}
                </div>
                <p className="text-xs text-ink-500 mt-1">per player</p>
              </div>

              {isPast ? (
                <div className="rounded-2xl bg-ink-100 p-4 text-center text-sm text-ink-600">
                  This program has ended.
                </div>
              ) : isFull ? (
                <div className="rounded-2xl bg-red-50 p-4 text-center text-sm text-red-600">
                  This program is full.
                </div>
              ) : (
                <Link
                  href={`/sign-in?callbackUrl=/dashboard`}
                  className="block w-full rounded-xl bg-play-600 px-4 py-3 text-center font-semibold text-white hover:bg-play-700"
                >
                  Sign Up
                </Link>
              )}

              <div className="mt-4 text-center">
                <Link href={`/club/${league.tenant.slug}`} className="text-sm text-hoop-600 hover:underline">
                  View {league.tenant.name} &rarr;
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
