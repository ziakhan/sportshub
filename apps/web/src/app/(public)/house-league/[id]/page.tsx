import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { formatCurrency } from "@/lib/countries"
import { getPublicHouseLeague } from "@/lib/queries/house-league"
import { getRegistrationViewer } from "@/lib/registration/viewer"
import { JsonLd, programEventJsonLd } from "@/lib/seo/jsonld"
import { trackPublicView } from "@/lib/seo/track"
import { AnimatedNumber, Badge, Button, Card, PanelHeader } from "@/components/ui"
import { brandStyle } from "@/lib/club-page/brand"
import { VenueLink } from "@/components/venues/venue-link"
import { ProgramSignupForm } from "@/components/registration/program-signup-form"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: { id: string } }) {
  const league = await getPublicHouseLeague(params.id)
  if (!league) return { title: "Program not found" }
  const description = league.description
    ? String(league.description).slice(0, 150)
    : `${league.name} — youth basketball house league by ${league.tenant.name} on SportsHub.`
  return { title: `${league.name} — House League`, description, alternates: { canonical: `/house-league/${params.id}` } }
}

export default async function PublicHouseLeaguePage({ params }: { params: { id: string } }) {
  const league = await getPublicHouseLeague(params.id)
  if (!league) notFound()

  await trackPublicView({
    path: `/house-league/${params.id}`,
    entityType: "HOUSE_LEAGUE",
    entityId: params.id,
    tenantId: league.tenant.id,
  })

  const session = await getServerSession(authOptions).catch(() => null)
  const userId = session?.user?.id ?? null
  const viewer = await getRegistrationViewer({
    userId,
    kind: "house-league",
    programId: params.id,
    tenantId: league.tenant.id,
    ageGroup: league.ageGroups,
    agePolicy: league.agePolicy ?? "PREFERRED",
    gender: league.gender,
  })

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
    <div className="font-barlow" style={brandStyle(primaryColor)}>
      <JsonLd
        data={programEventJsonLd({
          path: `/house-league/${params.id}`,
          name: league.name,
          description: league.description,
          startDate: league.startDate,
          endDate: league.endDate,
          locationName: league.location,
          fee: Number(league.fee),
          currency,
          organizerName: league.tenant.name,
          organizerSlug: league.tenant.slug,
        })}
      />
      {/* Banner */}
      <div className="border-b bg-[var(--brand)]">
        <div className="container mx-auto px-4 py-6">
          <Link
            href="/events"
            className="mb-2 inline-block text-sm text-[color:var(--brand-on)] opacity-80 transition hover:opacity-100"
          >
            &larr; Back
          </Link>
          <Link href={`/club/${league.tenant.slug}`}>
            <h2 className="font-condensed text-lg font-semibold uppercase tracking-wide text-[color:var(--brand-on)] hover:opacity-90">
              {league.tenant.name}
            </h2>
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Main */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="reveal p-8">
              <div className="mb-4 flex items-center gap-3">
                {isPast && <Badge tone="neutral">Ended</Badge>}
                {!isPast && !isFull && <Badge tone="court">Open</Badge>}
                {isFull && !isPast && <Badge tone="danger">Full</Badge>}
                {league.season && <Badge tone="hoop">{league.season}</Badge>}
              </div>

              <h1 className="font-condensed text-3xl font-bold text-ink-950 mb-2">{league.name}</h1>
              <p className="text-ink-500 mb-4">
                {league.ageGroups.split(",").join(", ")}{league.gender ? ` • ${league.gender}` : ""}
              </p>

              {league.description && (
                <p className="text-ink-700 mb-6">{league.description}</p>
              )}

              {/* Schedule */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-[var(--brand-softer)] p-4">
                  <div className="text-sm font-medium text-ink-500 mb-1">Dates</div>
                  <div className="text-ink-950">
                    {format(new Date(league.startDate), "MMM d")} - {format(new Date(league.endDate), "MMM d, yyyy")}
                  </div>
                </div>
                <div className="rounded-2xl bg-[var(--brand-softer)] p-4">
                  <div className="text-sm font-medium text-ink-500 mb-1">Weekly Schedule</div>
                  <div className="text-ink-950">
                    {days.join(", ")} {league.startTime} - {league.endTime}
                  </div>
                </div>
                <div className="rounded-2xl bg-[var(--brand-softer)] p-4">
                  <div className="text-sm font-medium text-ink-500 mb-1">Location</div>
                  <div className="text-ink-950">
                    <VenueLink venueId={league.venueId} name={league.venue?.name ?? league.location} />
                  </div>
                </div>
                <div className="rounded-2xl bg-[var(--brand-softer)] p-4">
                  <div className="text-sm font-medium text-ink-500 mb-1">Spots</div>
                  <div className="text-ink-950">
                    <AnimatedNumber value={league._count.signups} /> registered
                    {spotsLeft !== null && <span className="text-sm text-ink-500"> ({spotsLeft} left)</span>}
                  </div>
                </div>
              </div>
            </Card>

            {/* Details / What's Included */}
            {(league.details || included.length > 0) && (
              <Card className="reveal p-8 [animation-delay:120ms]">
                <PanelHeader title="What's Included" />

                {included.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {included.map((item: any) => (
                      <span key={item as string} className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-sm font-medium text-[color:var(--brand-ink)]">
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
            <Card className="reveal sticky top-4 [animation-delay:80ms]">
              <div className="mb-4 text-center">
                <div className="font-condensed text-3xl font-bold text-[color:var(--brand-ink)]">
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
              ) : userId ? (
                <ProgramSignupForm
                  programName={league.name}
                  endpoint={`/api/house-leagues/${league.id}/signup`}
                  currency={currency}
                  kids={viewer.kids}
                  payment={viewer.payment}
                  flatFee={Number(league.fee)}
                  returnPath={`/house-league/${league.id}`}
                />
              ) : (
                <Button
                  href={`/sign-in?callbackUrl=/house-league/${league.id}`}
                  block
                  size="lg"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  }
                >
                  Sign in to register
                </Button>
              )}

              <div className="mt-4 text-center">
                <Link href={`/club/${league.tenant.slug}`} className="text-sm font-medium text-[color:var(--brand-ink)] hover:underline">
                  View {league.tenant.name} &rarr;
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
