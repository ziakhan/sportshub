import Link from "next/link"
import { notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"
import { formatCurrency } from "@/lib/countries"
import { JsonLd, programEventJsonLd } from "@/lib/seo/jsonld"
import { trackPublicView } from "@/lib/seo/track"
import { Badge, Card, Button, AnimatedNumber, SmartBack } from "@/components/ui"
import { brandStyle } from "@/lib/club-page/brand"
import { VenueLink } from "@/components/venues/venue-link"
import { formatTrainingSchedule, trainingTypeLabel, trainingSortDate } from "@/lib/training"
import { getRegistrationViewer } from "@/lib/registration/viewer"
import { ACTIVE_SIGNUPS } from "@/lib/registration/capacity"
import { ProgramSignupForm } from "@/components/registration/program-signup-form"

export const dynamic = "force-dynamic"

async function getPublicTrainingSession(id: string) {
  const session = await (prisma as any).trainingSession.findFirst({
    where: { id, isPublished: true },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          currency: true,
          branding: { select: { primaryColor: true } },
        },
      },
      venue: { select: { name: true } },
      _count: { select: { signups: { where: ACTIVE_SIGNUPS } } },
    },
  })
  if (!session) return null
  return { ...session, fee: Number(session.fee) }
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  const session = await getPublicTrainingSession(params.id)
  if (!session) return { title: "Training program not found" }
  const description = session.description
    ? String(session.description).slice(0, 150)
    : `${session.title} — basketball training by ${session.tenant.name} on SportsHub.`
  return {
    title: `${session.title} — ${trainingTypeLabel(session.sessionType)}`,
    description,
    alternates: { canonical: `/training/${params.id}` },
  }
}

export default async function PublicTrainingDetailPage({ params }: { params: { id: string } }) {
  const session = await getPublicTrainingSession(params.id)
  if (!session) notFound()

  await trackPublicView({
    path: `/training/${params.id}`,
    entityType: "TRAINING",
    entityId: params.id,
    tenantId: session.tenant.id,
  })

  const authSession = await getServerSession(authOptions).catch(() => null)
  const userId = authSession?.user?.id ?? null
  const viewer = await getRegistrationViewer({
    userId,
    kind: "training",
    programId: params.id,
    tenantId: session.tenant.id,
    ageGroup: session.ageGroup,
    agePolicy: session.agePolicy ?? "PREFERRED",
    gender: session.gender,
  })

  const endReference = session.scheduleType === "RECURRING" ? session.endDate : session.startAt
  const isPast = !!endReference && new Date(endReference) < new Date()
  const isFull = !!session.capacity && session._count.signups >= session.capacity
  const spotsLeft = session.capacity ? session.capacity - session._count.signups : null
  const currency = session.tenant.currency || "CAD"
  const primaryColor = session.tenant.branding?.primaryColor || "#1a73e8"
  const scheduleText = formatTrainingSchedule(session)

  const infoTile = "rounded-2xl border border-[color:var(--brand-line)] bg-[var(--brand-softer)] p-4"
  const infoLabel = "mb-1 font-condensed text-xs font-semibold uppercase tracking-wide text-ink-500"

  return (
    <div className="font-barlow" style={brandStyle(primaryColor)}>
      <JsonLd
        data={programEventJsonLd({
          path: `/training/${params.id}`,
          name: session.title,
          description: session.description,
          startDate: trainingSortDate(session),
          endDate: endReference ? new Date(endReference) : null,
          locationName: session.location ?? "TBA",
          fee: session.fee,
          currency,
          organizerName: session.tenant.name,
          organizerSlug: session.tenant.slug,
        })}
      />
      <div className="border-b border-black/10" style={{ backgroundColor: "var(--brand)" }}>
        <div className="container mx-auto px-4 py-6">
          <SmartBack fallback="/events?type=training" fallbackLabel="Training programs" tone="brand" className="mb-1" />
          <Link href={`/club/${session.tenant.slug}`}>
            <h2 className="font-condensed text-xl font-bold tracking-tight text-[color:var(--brand-on)] transition hover:opacity-90">
              {session.tenant.name}
            </h2>
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="reveal p-8">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-sm font-semibold text-[color:var(--brand-ink)]">
                  {trainingTypeLabel(session.sessionType)}
                </span>
                {isPast && <Badge tone="neutral">Ended</Badge>}
                {!isPast && !isFull && <Badge tone="court">Open</Badge>}
                {isFull && !isPast && <Badge tone="danger">Full</Badge>}
              </div>

              <h1 className="font-condensed text-ink-950 mb-2 text-4xl font-bold tracking-tight">
                {session.title}
              </h1>
              {(session.ageGroup || session.gender) && (
                <p className="text-ink-500 mb-4">
                  {session.ageGroup}
                  {session.gender ? `${session.ageGroup ? " • " : ""}${session.gender}` : ""}
                </p>
              )}

              {session.description && <p className="text-ink-700 mb-6">{session.description}</p>}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className={infoTile}>
                  <div className={infoLabel}>Schedule</div>
                  <div className="text-ink-950">{scheduleText}</div>
                  <div className="text-ink-500 text-sm">{session.durationMinutes} minutes</div>
                </div>
                <div className={infoTile}>
                  <div className={infoLabel}>Location</div>
                  <div className="text-ink-950">
                    <VenueLink
                      venueId={session.venueId}
                      name={session.venue?.name ?? session.location ?? "TBA"}
                    />
                  </div>
                </div>
                <div className={infoTile}>
                  <div className={infoLabel}>Spots</div>
                  <div className="text-ink-950">
                    <span className="font-condensed text-xl font-bold text-[color:var(--brand-ink)]">
                      <AnimatedNumber value={session._count.signups} />
                    </span>{" "}
                    registered
                    {spotsLeft !== null && (
                      <span className="text-ink-500 text-sm"> ({spotsLeft} left)</span>
                    )}
                  </div>
                </div>
                <div className={infoTile}>
                  <div className={infoLabel}>Fee</div>
                  <div className="text-ink-950">
                    {session.fee > 0 ? formatCurrency(session.fee, currency) : "Free"}
                    {session.scheduleType === "RECURRING" && session.fee > 0 && (
                      <span className="text-ink-500 text-sm"> for the full program</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div>
            <Card className="reveal sticky top-4 [animation-delay:120ms]">
              <div className="mb-4 text-center">
                <div className="font-condensed text-4xl font-bold leading-none text-[color:var(--brand-ink)]">
                  {session.fee > 0 ? formatCurrency(session.fee, currency) : "Free"}
                </div>
                {session.scheduleType === "RECURRING" && (
                  <p className="text-ink-500 mt-1 text-xs font-semibold uppercase tracking-wide">
                    full program
                  </p>
                )}
              </div>

              {isPast ? (
                <div className="bg-ink-100 text-ink-600 rounded-2xl p-4 text-center text-sm">
                  This program has ended.
                </div>
              ) : isFull ? (
                <div className="rounded-2xl bg-red-50 p-4 text-center text-sm text-red-600">
                  This program is full.
                </div>
              ) : userId ? (
                <ProgramSignupForm
                  programName={session.title}
                  endpoint={`/api/training-sessions/${session.id}/signup`}
                  currency={currency}
                  kids={viewer.kids}
                  payment={viewer.payment}
                  flatFee={session.fee}
                  returnPath={`/training/${session.id}`}
                />
              ) : (
                <Button
                  href={`/sign-in?callbackUrl=/training/${session.id}`}
                  block
                  size="lg"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path
                        d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  }
                >
                  Sign in to register
                </Button>
              )}

              <div className="mt-4 text-center">
                <Link
                  href={`/club/${session.tenant.slug}`}
                  className="text-sm font-semibold text-[color:var(--brand-ink)] hover:underline"
                >
                  View {session.tenant.name} &rarr;
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
