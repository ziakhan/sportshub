import { notFound } from "next/navigation"
import Link from "next/link"
import type { Metadata } from "next"
import { format } from "date-fns"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { CourtBackdropLayer, SmartBack } from "@/components/ui"
import { brandStyle, chosenBrandColor, NEUTRAL_BRAND } from "@/lib/club-page/brand"
import { JsonLd, programEventJsonLd } from "@/lib/seo/jsonld"
import { trackPublicView } from "@/lib/seo/track"
import { getTryoutEventPublic } from "@/lib/queries/tryout-events"
import { TryoutSessionGrid, sessionLabel } from "@/components/tryouts/tryout-session-cards"

/**
 * Public club tryout EVENT page (docs/roadmap/club-tryouts-and-age-pools,
 * rulings 10 and 11).
 *
 * The event is the umbrella a real club announces on Instagram: "Fall tryouts,
 * U11 Monday 6pm, U13 Monday 7:30, U15 Wednesday". This page is that post,
 * rendered in the club's own branded world — one card per session, grouped
 * under the event title, every card carrying its own age group, start, end,
 * place and fee. Nothing is merged and no capacity appears anywhere.
 *
 * Data comes only from getTryoutEventPublic(), the one shared module the
 * club page and the Instagram poster also read.
 */

export async function generateMetadata({
  params,
}: {
  params: { eventId: string }
}): Promise<Metadata> {
  const event = await getTryoutEventPublic(params.eventId)
  if (!event) return { title: "Tryout event not found" }
  const when = event.startsAt ? format(new Date(event.startsAt), "MMMM d, yyyy") : null
  const ages = event.ageGroups.join(", ")
  return {
    title: `${event.title} at ${event.club.name}${when ? ` (${when})` : ""}`,
    description:
      event.description?.replace(/\s+/g, " ").slice(0, 155) ||
      `${event.club.name} tryouts for ${ages}${when ? `, starting ${when}` : ""}. Session times, gyms and registration.`,
    alternates: { canonical: `/tryout-event/${params.eventId}` },
    openGraph: {
      title: `${event.title} at ${event.club.name}`,
      images: [`/api/tryout-events/${params.eventId}/card`],
    },
  }
}

export default async function PublicTryoutEventPage({
  params,
}: {
  params: { eventId: string }
}) {
  const event = await getTryoutEventPublic(params.eventId)
  if (!event) notFound()

  const session = await getServerSession(authOptions).catch(() => null)
  const signedIn = !!(session?.user as any)?.id
  const club = event.club

  await trackPublicView({
    path: `/tryout-event/${params.eventId}`,
    entityType: "TRYOUT",
    entityId: params.eventId,
    tenantId: club.id,
  })

  // Neutral by default, brand by choice (owner 2026-08-14): an unclaimed
  // listing or an importer-stamped hex stays navy, exactly as on /club/[slug].
  const primary = chosenBrandColor({
    status: club.status,
    primaryColor: club.branding?.primaryColor,
  })
  const accent = primary ?? NEUTRAL_BRAND
  const currency = club.currency || "CAD"

  const now = Date.now()
  const upcoming = event.sessions.filter((s) => new Date(s.scheduledAt).getTime() >= now)
  const past = event.sessions.filter((s) => new Date(s.scheduledAt).getTime() < now)
  const place = [club.city, club.state].filter(Boolean).join(", ")

  const heroFacts: Array<{ value: string; label: string }> = [
    {
      value: String(event.sessionCount),
      label: event.sessionCount === 1 ? "Session" : "Sessions",
    },
    {
      value: String(event.ageGroups.length),
      label: event.ageGroups.length === 1 ? "Age group" : "Age groups",
    },
    {
      value: event.startsAt ? format(new Date(event.startsAt), "MMM d") : "TBD",
      label: "First session",
    },
  ]

  return (
    <div className="font-barlow" style={brandStyle(accent)}>
      {event.sessions.map((s) => (
        <JsonLd
          key={`ld-${s.id}`}
          data={programEventJsonLd({
            path: `/tryout/${s.id}`,
            name: `${event.title} (${sessionLabel(s)})`,
            description: event.description,
            startDate: new Date(s.scheduledAt),
            endDate: s.endsAt ? new Date(s.endsAt) : null,
            locationName: s.venue?.name ?? s.location,
            city: club.city,
            state: club.state,
            fee: s.fee,
            currency,
            organizerName: club.name,
            organizerSlug: club.slug,
          })}
        />
      ))}

      {/* HERO — court system v2 daylight band, the same identity strip the
          club's own page wears, so the event reads as part of that world. */}
      <header className="relative">
        <div className="relative isolate overflow-hidden">
          <CourtBackdropLayer variant="daylight" intensity="band" />
          <div className="container relative z-10 mx-auto px-4 pb-9 pt-6 sm:pt-8">
            <SmartBack
              fallback={`/club/${club.slug}`}
              fallbackLabel={club.name}
              className="-ml-1 mb-3"
            />

            <Link
              href={`/club/${club.slug}`}
              className="brand-focus group inline-flex cursor-pointer items-center gap-3"
            >
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl text-lg font-black shadow-md ${
                  club.branding?.logoUrl || primary ? "text-white" : "bg-ink-100 text-ink-700"
                }`}
                style={{
                  backgroundColor: club.branding?.logoUrl ? "#ffffff" : primary ?? undefined,
                }}
              >
                {club.branding?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={club.branding.logoUrl}
                    alt={`${club.name} logo`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  club.name.slice(0, 1).toUpperCase()
                )}
              </span>
              <span className="min-w-0">
                <span className="text-ink-900 group-hover:text-[color:var(--brand-ink)] block text-base font-bold transition-colors duration-200">
                  {club.name}
                </span>
                {place && <span className="text-ink-500 block text-sm">{place}</span>}
              </span>
            </Link>

            <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--brand-ink)]">
              {event.seasonLabel} tryouts
            </p>
            <h1 className="font-display text-ink-950 mt-1.5 text-[32px] font-black leading-[1.04] tracking-[-0.02em] sm:text-[46px]">
              {event.title}
            </h1>
            {event.description && (
              <p className="text-ink-700 mt-3 max-w-2xl whitespace-pre-line text-base leading-relaxed">
                {event.description}
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              {event.ageGroups.map((age) => (
                <span
                  key={age}
                  className="font-condensed rounded-full border border-[color:var(--brand-line)] bg-white/90 px-3 py-1 text-sm font-bold uppercase tracking-wide text-[color:var(--brand-ink)]"
                >
                  {age}
                </span>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="#sessions"
                className="brand-focus min-h-[44px] cursor-pointer rounded-xl bg-[var(--brand)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--brand-on)] shadow-sm transition-opacity duration-200 hover:opacity-90"
              >
                See the sessions
              </a>
              <Link
                href={`/club/${club.slug}`}
                className="brand-focus border-ink-200 text-ink-800 hover:bg-ink-50 inline-flex min-h-[44px] cursor-pointer items-center rounded-xl border bg-white px-5 text-sm font-semibold shadow-sm transition-colors duration-200"
              >
                Club page
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-[#e7dbc4] bg-[#e7dbc4]">
              {heroFacts.map((f) => (
                <div key={f.label} className="bg-white/85 px-4 py-3 backdrop-blur">
                  <div className="font-display text-ink-950 text-2xl font-black leading-none sm:text-3xl">
                    {f.value}
                  </div>
                  <div className="text-ink-500 mt-1 text-[11px] font-semibold uppercase tracking-wide">
                    {f.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 z-10 h-1"
            style={{ backgroundColor: accent }}
          />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 sm:py-10">
        <section id="sessions" className="scroll-mt-6">
          <div className="mb-5">
            <h2 className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="h-7 w-1.5 shrink-0 rounded-full bg-[var(--brand)]"
              />
              <span className="font-condensed text-ink-950 text-[26px] font-bold uppercase leading-none tracking-wide">
                Sessions
                <span className="text-ink-300 ml-2">{upcoming.length}</span>
              </span>
            </h2>
            <p className="text-ink-600 mt-2.5 max-w-2xl text-base leading-relaxed">
              Register for the session that matches your player&apos;s age group. Each session
              has its own time and gym.
            </p>
          </div>

          {upcoming.length > 0 ? (
            <TryoutSessionGrid sessions={upcoming} currency={currency} signedIn={signedIn} />
          ) : (
            <div className="border-ink-100 shadow-soft rounded-[28px] border bg-white p-6">
              <p className="text-ink-600 text-base">
                Every session in this event has already taken place. Follow{" "}
                <Link
                  href={`/club/${club.slug}`}
                  className="cursor-pointer font-semibold text-[color:var(--brand-ink)] hover:underline"
                >
                  {club.name}
                </Link>{" "}
                to hear when the next one opens.
              </p>
            </div>
          )}
        </section>

        {past.length > 0 && upcoming.length > 0 && (
          <section className="mt-10">
            <h2 className="text-ink-500 mb-4 flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.14em]">
              <span aria-hidden="true" className="bg-ink-300 h-3 w-1 shrink-0 rounded-full" />
              Already held
            </h2>
            <TryoutSessionGrid sessions={past} currency={currency} signedIn={signedIn} />
          </section>
        )}

        <div className="border-ink-100 shadow-soft mt-10 rounded-[28px] border bg-[var(--brand-softer)] p-6 sm:p-7">
          <p className="text-ink-700 text-base leading-relaxed">
            Questions about {event.title}? The {club.name} page has the club&apos;s contact
            details, teams and everything else it runs.
          </p>
          <Link
            href={`/club/${club.slug}`}
            className="brand-focus mt-4 inline-flex min-h-[44px] cursor-pointer items-center rounded-xl bg-[var(--brand)] px-5 text-sm font-bold uppercase tracking-wide text-[color:var(--brand-on)] shadow-sm transition-opacity duration-200 hover:opacity-90"
          >
            Visit {club.name}
          </Link>
        </div>
      </main>
    </div>
  )
}
