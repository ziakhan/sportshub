import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"
import { getPublicCamp } from "@/lib/queries/camp"
import { Badge, Card } from "@/components/ui"

export const dynamic = "force-dynamic"

const CAMP_TYPE_LABELS: Record<string, string> = {
  MARCH_BREAK: "March Break Camp",
  HOLIDAY: "Holiday Camp",
  SUMMER: "Summer Camp",
  WEEKLY: "Weekly Camp",
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  const camp = await getPublicCamp(params.id)
  if (!camp) return { title: "Camp not found — SportsHub" }
  const description = camp.description
    ? String(camp.description).slice(0, 150)
    : `${camp.name} — youth basketball camp by ${camp.tenant.name} on SportsHub.`
  return { title: `${camp.name} — SportsHub`, description }
}

export default async function PublicCampDetailPage({ params }: { params: { id: string } }) {
  const camp = await getPublicCamp(params.id)
  if (!camp) notFound()

  const isPast = new Date(camp.endDate) < new Date()
  const isFull = camp.maxParticipants && camp._count.signups >= camp.maxParticipants
  const spotsLeft = camp.maxParticipants ? camp.maxParticipants - camp._count.signups : null
  const currency = camp.tenant.currency || "CAD"
  const primaryColor = camp.tenant.branding?.primaryColor || "#1a73e8"
  const weeks = camp.numberOfWeeks
  const hasDiscount = camp.fullCampFee && weeks > 1 && camp.fullCampFee < camp.weeklyFee * weeks
  const savingsPercent = hasDiscount ? Math.round((1 - camp.fullCampFee / (camp.weeklyFee * weeks)) * 100) : 0

  const included = [
    camp.includesLunch && "Lunch",
    camp.includesSnacks && "Snacks",
    camp.includesJersey && "Jersey/T-Shirt",
    camp.includesBall && "Basketball",
  ].filter(Boolean)

  return (
    <>
      <div className="border-b" style={{ backgroundColor: primaryColor }}>
        <div className="container mx-auto px-4 py-6">
          <Link href="/events" className="mb-2 inline-block text-sm text-white/80 hover:text-white">&larr; Back to Events</Link>
          <Link href={`/club/${camp.tenant.slug}`}>
            <h2 className="text-lg font-semibold text-white hover:text-white/90">{camp.tenant.name}</h2>
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-8">
              <div className="mb-4 flex items-center gap-3">
                <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-medium text-violet-700">
                  {CAMP_TYPE_LABELS[camp.campType] || camp.campType}
                </span>
                {isPast && <Badge tone="neutral">Ended</Badge>}
                {!isPast && !isFull && <Badge tone="court">Open</Badge>}
                {isFull && !isPast && <Badge tone="danger">Full</Badge>}
              </div>

              <h1 className="text-3xl font-bold text-ink-950 mb-2">{camp.name}</h1>
              <p className="text-ink-500 mb-4">{camp.ageGroup}{camp.gender ? ` • ${camp.gender}` : ""}</p>

              {camp.description && <p className="text-ink-700 mb-6">{camp.description}</p>}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-ink-50 p-4">
                  <div className="text-sm font-medium text-ink-500 mb-1">Dates</div>
                  <div className="text-ink-950">
                    {format(new Date(camp.startDate), "MMM d")} - {format(new Date(camp.endDate), "MMM d, yyyy")}
                  </div>
                  <div className="text-sm text-ink-500">{weeks} week{weeks !== 1 ? "s" : ""}</div>
                </div>
                <div className="rounded-2xl bg-ink-50 p-4">
                  <div className="text-sm font-medium text-ink-500 mb-1">Daily Schedule</div>
                  <div className="text-ink-950">{camp.dailyStartTime} - {camp.dailyEndTime}</div>
                </div>
                <div className="rounded-2xl bg-ink-50 p-4">
                  <div className="text-sm font-medium text-ink-500 mb-1">Location</div>
                  <div className="text-ink-950">{camp.location}</div>
                </div>
                <div className="rounded-2xl bg-ink-50 p-4">
                  <div className="text-sm font-medium text-ink-500 mb-1">Spots</div>
                  <div className="text-ink-950">
                    {camp._count.signups} registered
                    {spotsLeft !== null && <span className="text-sm text-ink-500"> ({spotsLeft} left)</span>}
                  </div>
                </div>
              </div>
            </Card>

            {(camp.details || included.length > 0) && (
              <Card className="p-8">
                <h2 className="text-lg font-bold text-ink-950 mb-4">What&apos;s Included</h2>
                {included.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {included.map((item: any) => (
                      <span key={item as string} className="rounded-full bg-court-50 px-3 py-1 text-sm font-medium text-court-700">{item}</span>
                    ))}
                  </div>
                )}
                {camp.details && <div className="text-ink-700 whitespace-pre-line">{camp.details}</div>}
              </Card>
            )}
          </div>

          <div>
            <Card className="sticky top-4">
              <div className="mb-4 text-center">
                <div className="text-3xl font-bold text-hoop-600">
                  {formatCurrency(camp.weeklyFee, currency)}
                </div>
                <p className="text-xs text-ink-500">per week</p>

                {hasDiscount && (
                  <div className="mt-2 rounded-2xl bg-court-50 p-3">
                    <div className="text-lg font-bold text-court-700">
                      {formatCurrency(camp.fullCampFee, currency)}
                    </div>
                    <p className="text-xs text-court-600">
                      All {weeks} weeks — save {savingsPercent}%
                    </p>
                  </div>
                )}
              </div>

              {isPast ? (
                <div className="rounded-2xl bg-ink-100 p-4 text-center text-sm text-ink-600">This camp has ended.</div>
              ) : isFull ? (
                <div className="rounded-2xl bg-red-50 p-4 text-center text-sm text-red-600">This camp is full.</div>
              ) : (
                <Link href="/sign-in?callbackUrl=/dashboard"
                  className="block w-full rounded-xl bg-play-600 px-4 py-3 text-center font-semibold text-white hover:bg-play-700">
                  Sign Up
                </Link>
              )}

              <div className="mt-4 text-center">
                <Link href={`/club/${camp.tenant.slug}`} className="text-sm text-hoop-600 hover:underline">
                  View {camp.tenant.name} &rarr;
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
