import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import type { ReactNode } from "react"
import Link from "next/link"
import { SignupForm } from "./signup-form"
import { formatCurrency } from "@/lib/countries"
import { brandStyle } from "@/lib/club-page/brand"
import { AnimatedNumber, Badge, Button, PanelHeader } from "@/components/ui"

async function getTryout(id: string) {
  const tryout = await prisma.tryout.findUnique({
    where: { id },
    include: {
      tenant: {
        include: {
          branding: true,
        },
      },
      _count: {
        select: {
          signups: {
            where: { status: { not: "CANCELLED" } },
          },
        },
      },
    },
  })

  if (!tryout || !tryout.isPublished) return null
  return { ...tryout, fee: Number(tryout.fee) }
}

async function getUserData(userId: string | null, tryoutId: string) {
  if (!userId) return null

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })

  if (!user) return null

  const [players, existingSignups] = await Promise.all([
    prisma.player.findMany({
      where: { parentId: user.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
      },
      orderBy: { firstName: "asc" },
    }),
    prisma.tryoutSignup.findMany({
      where: {
        tryoutId,
        userId: user.id,
        status: { not: "CANCELLED" },
      },
      select: {
        id: true,
        playerName: true,
        status: true,
      },
    }),
  ])

  return { players, existingSignups }
}

export default async function TryoutDetailPage({ params }: { params: { id: string } }) {
  const tryout = await getTryout(params.id)
  if (!tryout) notFound()

  const session = await getServerSession(authOptions)
  const userId = session?.user?.id ?? null
  const userData = await getUserData(userId, params.id)

  const isPast = new Date(tryout.scheduledAt) < new Date()
  const isFull = tryout.maxParticipants !== null && tryout._count.signups >= tryout.maxParticipants
  const fee = Number(tryout.fee)
  const currency = tryout.tenant.currency || "CAD"
  const spotsLeft = tryout.maxParticipants ? tryout.maxParticipants - tryout._count.signups : null
  const primaryColor = tryout.tenant.branding?.primaryColor || "#4f46e5"

  return (
    <div className="font-barlow" style={brandStyle(primaryColor)}>
      {/* Club header */}
      <div className="border-b border-black/10" style={{ backgroundColor: "var(--brand)" }}>
        <div className="px-4 py-6 md:px-6">
          <Link
            href="/events"
            className="mb-2 inline-block text-sm text-[color:var(--brand-on)] opacity-80 transition hover:opacity-100"
          >
            &larr; Back to Marketplace
          </Link>
          <h2 className="text-[color:var(--brand-on)] font-condensed text-xl font-bold uppercase tracking-wide">
            {tryout.tenant.name}
          </h2>
        </div>
      </div>

      <div className="px-4 py-8 md:px-6">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2">
            <div className="reveal border-ink-100 shadow-soft rounded-[28px] border bg-white p-8">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                {isPast && <Badge tone="neutral">Closed</Badge>}
                {isFull && !isPast && (
                  <Badge tone="danger" dot>
                    Full
                  </Badge>
                )}
                {!isPast && !isFull && (
                  <Badge tone="court" dot>
                    Open
                  </Badge>
                )}
              </div>

              <h1 className="text-ink-900 font-condensed mb-4 text-4xl font-bold leading-tight">
                {tryout.title}
              </h1>

              {tryout.description && (
                <p className="text-ink-700 mb-6 leading-relaxed">{tryout.description}</p>
              )}

              <PanelHeader title="Details" />

              <div className="grid gap-4 sm:grid-cols-2">
                <InfoTile icon={ICONS.calendar} label="Date & Time" delay={0}>
                  {format(new Date(tryout.scheduledAt), "EEEE, MMMM d, yyyy")}
                  <div className="text-ink-600 text-sm">
                    {format(new Date(tryout.scheduledAt), "h:mm a")}
                    {tryout.duration && ` (${tryout.duration} min)`}
                  </div>
                </InfoTile>

                <InfoTile icon={ICONS.pin} label="Location" delay={70}>
                  {tryout.location}
                </InfoTile>

                <InfoTile icon={ICONS.users} label="Age Group & Gender" delay={140}>
                  {tryout.ageGroup}
                  {tryout.gender ? ` • ${tryout.gender}` : ""}
                </InfoTile>

                <InfoTile icon={ICONS.spots} label="Spots" delay={210}>
                  <span className="text-[color:var(--brand-ink)] font-condensed align-baseline text-xl font-bold">
                    <AnimatedNumber value={tryout._count.signups} />
                  </span>{" "}
                  signed up
                  {spotsLeft !== null && (
                    <span className="text-ink-500 text-sm">
                      {" "}
                      ({spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left)
                    </span>
                  )}
                </InfoTile>
              </div>
            </div>
          </div>

          {/* Sidebar — signup */}
          <div>
            <div className="reveal border-ink-100 shadow-soft rounded-[28px] border bg-white p-6 lg:sticky lg:top-6">
              <div className="mb-4 text-center">
                <div className="text-[color:var(--brand-ink)] font-condensed text-4xl font-bold">
                  {fee === 0 ? "FREE" : formatCurrency(fee, currency)}
                </div>
                {fee > 0 && <p className="text-ink-500 mt-1 text-xs">per player</p>}
              </div>

              {isPast ? (
                <div className="bg-ink-50 text-ink-600 rounded-2xl p-4 text-center text-sm">
                  This tryout has already taken place.
                </div>
              ) : isFull ? (
                <div className="rounded-2xl bg-red-50 p-4 text-center text-sm text-red-600">
                  This tryout is full. Check back for future openings.
                </div>
              ) : !userId ? (
                <div className="text-center">
                  <p className="text-ink-700 mb-4 text-sm">
                    Sign in to register your player for this tryout.
                  </p>
                  <Button
                    href={`/sign-in?callbackUrl=/tryouts/${params.id}`}
                    block
                    size="lg"
                    icon={ICONS.signin}
                  >
                    Sign In to Sign Up
                  </Button>
                </div>
              ) : (
                <SignupForm
                  tryoutId={params.id}
                  tryoutFee={fee}
                  currency={currency}
                  tryoutLocation={tryout.location}
                  tryoutDate={format(new Date(tryout.scheduledAt), "MMM d, yyyy 'at' h:mm a")}
                  players={userData?.players || []}
                  existingSignups={userData?.existingSignups || []}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Brand-tinted info card: leading icon chip + label + value, with a staggered reveal. */
function InfoTile({
  icon,
  label,
  delay,
  children,
}: {
  icon: ReactNode
  label: string
  delay: number
  children: ReactNode
}) {
  return (
    <div
      className="reveal border-ink-100 flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-[0_16px_50px_-38px_rgba(15,23,42,0.4)]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[color:var(--brand-ink)]">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-ink-500 text-xs font-semibold uppercase tracking-wide">{label}</div>
        <div className="text-ink-900 mt-0.5">{children}</div>
      </div>
    </div>
  )
}

/** SVG icons (18–20px) for the detail tiles and the sign-in CTA. */
const ICONS: Record<string, ReactNode> = {
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
    </svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
    </svg>
  ),
  spots: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 000-4V8z" strokeLinejoin="round" />
      <path d="M13 6v12" strokeLinecap="round" strokeDasharray="2 3" />
    </svg>
  ),
  signin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
}
