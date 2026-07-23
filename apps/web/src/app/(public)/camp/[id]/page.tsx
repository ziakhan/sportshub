import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { formatCurrency } from "@/lib/countries"
import { getPublicCamp } from "@/lib/queries/camp"
import { getRegistrationViewer } from "@/lib/registration/viewer"
import { computeCampFee, campHasDiscount } from "@/lib/registration/camp-pricing"
import { JsonLd, programEventJsonLd } from "@/lib/seo/jsonld"
import { trackPublicView } from "@/lib/seo/track"
import { Badge, Card, Button, PanelHeader, AnimatedNumber, SmartBack } from "@/components/ui"
import { brandStyle } from "@/lib/club-page/brand"
import { VenueLink } from "@/components/venues/venue-link"
import { ProgramSignupForm } from "@/components/registration/program-signup-form"

export const dynamic = "force-dynamic"

const CAMP_TYPE_LABELS: Record<string, string> = {
  MARCH_BREAK: "March Break Camp",
  HOLIDAY: "Holiday Camp",
  SUMMER: "Summer Camp",
  WEEKLY: "Weekly Camp",
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  const camp = await getPublicCamp(params.id)
  if (!camp) return { title: "Camp not found" }
  const description = camp.description
    ? String(camp.description).slice(0, 150)
    : `${camp.name} — youth basketball camp by ${camp.tenant.name} on SportsHub.`
  return { title: `${camp.name} — Basketball Camp`, description, alternates: { canonical: `/camp/${params.id}` } }
}

export default async function PublicCampDetailPage({ params }: { params: { id: string } }) {
  const camp = await getPublicCamp(params.id)
  if (!camp) notFound()

  await trackPublicView({
    path: `/camp/${params.id}`,
    entityType: "CAMP",
    entityId: params.id,
    tenantId: camp.tenant.id,
  })

  const session = await getServerSession(authOptions).catch(() => null)
  const userId = session?.user?.id ?? null
  const viewer = await getRegistrationViewer({
    userId,
    kind: "camp",
    programId: params.id,
    tenantId: camp.tenant.id,
    ageGroup: camp.ageGroup,
    agePolicy: camp.agePolicy ?? "PREFERRED",
    gender: camp.gender,
  })

  const isPast = new Date(camp.endDate) < new Date()
  const isFull = camp.maxParticipants && camp._count.signups >= camp.maxParticipants
  const spotsLeft = camp.maxParticipants ? camp.maxParticipants - camp._count.signups : null
  const currency = camp.tenant.currency || "CAD"
  const primaryColor = camp.tenant.branding?.primaryColor || "#1a73e8"
  const weeks = camp.numberOfWeeks
  const hasDiscount = campHasDiscount(camp)
  const savingsPercent = computeCampFee(camp, weeks).savingsPercent

  const included = [
    camp.includesLunch && "Lunch",
    camp.includesSnacks && "Snacks",
    camp.includesJersey && "Jersey/T-Shirt",
    camp.includesBall && "Basketball",
  ].filter(Boolean)

  const infoTile = "rounded-2xl border border-[color:var(--brand-line)] bg-[var(--brand-softer)] p-4"
  const infoLabel = "mb-1 font-condensed text-xs font-semibold uppercase tracking-wide text-ink-500"

  return (
    <div className="font-barlow" style={brandStyle(primaryColor)}>
      <JsonLd
        data={programEventJsonLd({
          path: `/camp/${params.id}`,
          name: camp.name,
          description: camp.description,
          startDate: camp.startDate,
          endDate: camp.endDate,
          locationName: camp.location,
          fee: Number(camp.weeklyFee),
          currency,
          organizerName: camp.tenant.name,
          organizerSlug: camp.tenant.slug,
        })}
      />
      <div className="border-b border-black/10" style={{ backgroundColor: "var(--brand)" }}>
        <div className="container mx-auto px-4 py-6">
          <SmartBack fallback="/events?type=camps" fallbackLabel="Events" tone="brand" className="mb-1" />
          <Link href={`/club/${camp.tenant.slug}`}>
            <h2 className="font-condensed text-xl font-bold tracking-tight text-[color:var(--brand-on)] transition hover:opacity-90">{camp.tenant.name}</h2>
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card className="reveal p-8">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-sm font-semibold text-[color:var(--brand-ink)]">
                  {CAMP_TYPE_LABELS[camp.campType] || camp.campType}
                </span>
                {isPast && <Badge tone="neutral">Ended</Badge>}
                {!isPast && !isFull && <Badge tone="court">Open</Badge>}
                {isFull && !isPast && <Badge tone="danger">Full</Badge>}
              </div>

              <h1 className="font-condensed text-4xl font-bold tracking-tight text-ink-950 mb-2">{camp.name}</h1>
              <p className="text-ink-500 mb-4">{camp.ageGroup}{camp.gender ? ` • ${camp.gender}` : ""}</p>

              {camp.description && <p className="text-ink-700 mb-6">{camp.description}</p>}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className={infoTile}>
                  <div className={infoLabel}>Dates</div>
                  <div className="text-ink-950">
                    {format(new Date(camp.startDate), "MMM d")} - {format(new Date(camp.endDate), "MMM d, yyyy")}
                  </div>
                  <div className="text-sm text-ink-500">{weeks} week{weeks !== 1 ? "s" : ""}</div>
                </div>
                <div className={infoTile}>
                  <div className={infoLabel}>Daily Schedule</div>
                  <div className="text-ink-950">{camp.dailyStartTime} - {camp.dailyEndTime}</div>
                </div>
                <div className={infoTile}>
                  <div className={infoLabel}>Location</div>
                  <div className="text-ink-950">
                    <VenueLink venueId={camp.venueId} name={camp.venue?.name ?? camp.location} />
                  </div>
                </div>
                <div className={infoTile}>
                  <div className={infoLabel}>Spots</div>
                  <div className="text-ink-950">
                    <span className="font-condensed text-xl font-bold text-[color:var(--brand-ink)]"><AnimatedNumber value={camp._count.signups} /></span> registered
                    {spotsLeft !== null && <span className="text-sm text-ink-500"> ({spotsLeft} left)</span>}
                  </div>
                </div>
              </div>
            </Card>

            {(camp.details || included.length > 0) && (
              <Card className="reveal p-8 [animation-delay:80ms]">
                <PanelHeader title="What's Included" />
                {included.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {included.map((item: any) => (
                      <span key={item as string} className="inline-flex items-center gap-1.5 rounded-full bg-court-50 px-3 py-1 text-sm font-semibold text-court-700">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        {item}
                      </span>
                    ))}
                  </div>
                )}
                {camp.details && <div className="text-ink-700 whitespace-pre-line">{camp.details}</div>}
              </Card>
            )}
          </div>

          <div>
            <Card className="reveal sticky top-4 [animation-delay:120ms]">
              <div className="mb-4 text-center">
                <div className="font-condensed text-4xl font-bold leading-none text-[color:var(--brand-ink)]">
                  {formatCurrency(camp.weeklyFee, currency)}
                </div>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink-500">per week</p>

                {hasDiscount && (
                  <div className="mt-3 rounded-2xl bg-court-50 p-3">
                    <div className="font-condensed text-2xl font-bold text-court-700">
                      {formatCurrency(camp.fullCampFee, currency)}
                    </div>
                    <p className="text-xs font-medium text-court-600">
                      All {weeks} weeks — save {savingsPercent}%
                    </p>
                  </div>
                )}
              </div>

              {isPast ? (
                <div className="rounded-2xl bg-ink-100 p-4 text-center text-sm text-ink-600">This camp has ended.</div>
              ) : isFull ? (
                <div className="rounded-2xl bg-red-50 p-4 text-center text-sm text-red-600">This camp is full.</div>
              ) : userId ? (
                <ProgramSignupForm
                  programName={camp.name}
                  endpoint={`/api/camps/${camp.id}/signup`}
                  currency={currency}
                  kids={viewer.kids}
                  payment={viewer.payment}
                  camp={{
                    numberOfWeeks: camp.numberOfWeeks,
                    weeklyFee: camp.weeklyFee,
                    fullCampFee: camp.fullCampFee,
                    startDate: new Date(camp.startDate).toISOString(),
                  }}
                  returnPath={`/camp/${camp.id}`}
                />
              ) : (
                <Button
                  href={`/sign-in?callbackUrl=/camp/${camp.id}`}
                  block
                  size="lg"
                  icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                >
                  Sign in to register
                </Button>
              )}

              <div className="mt-4 text-center">
                <Link href={`/club/${camp.tenant.slug}`} className="text-sm font-semibold text-[color:var(--brand-ink)] hover:underline">
                  View {camp.tenant.name} &rarr;
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
