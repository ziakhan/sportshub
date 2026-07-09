import { prisma } from "@youthbasketballhub/db"
import Link from "next/link"
import { brandStyle } from "@/lib/club-page/brand"
import { StatTile, AnimatedNumber } from "./overview-ui"

interface OverviewTeam {
  id: string
  name: string
  ageGroup: string
  staff: { id: string }[]
  _count: { players: number }
}

interface OverviewTryout {
  id: string
  title: string
  scheduledAt: Date
  isPublished: boolean
  team: { name: string } | null
  signups: { id: string; offers: { status: string }[] }[]
}

async function getClubOverview(clubId: string) {
  const branding = await prisma.tenantBranding.findUnique({
    where: { tenantId: clubId },
    select: { primaryColor: true },
  })
  const teamCount = await prisma.team.count({ where: { tenantId: clubId } })
  const tryoutCount = await prisma.tryout.count({ where: { tenantId: clubId } })
  const staffCount = await prisma.userRole.count({
    where: {
      tenantId: clubId,
      role: { in: ["ClubOwner", "ClubManager", "Staff"] },
    },
  })
  const pendingInvites = await prisma.staffInvitation.count({
    where: { tenantId: clubId, status: "PENDING" },
  })

  const teams: OverviewTeam[] = (await prisma.team.findMany({
    where: { tenantId: clubId },
    select: {
      id: true,
      name: true,
      ageGroup: true,
      staff: {
        where: { designation: "HeadCoach" },
        select: { id: true },
      },
      _count: { select: { players: true } },
    },
  })) as any

  const tryoutsWithSignups: OverviewTryout[] = (await prisma.tryout.findMany({
    where: { tenantId: clubId },
    select: {
      id: true,
      title: true,
      scheduledAt: true,
      isPublished: true,
      team: { select: { name: true } },
      signups: {
        where: { status: { not: "CANCELLED" } },
        select: {
          id: true,
          offers: { select: { status: true }, take: 1 },
        },
      },
    },
    orderBy: { scheduledAt: "desc" },
  })) as any

  const offers: { status: string }[] = (await prisma.offer.findMany({
    where: { team: { tenantId: clubId } },
    select: { status: true },
  })) as any

  const teamsWithoutCoach = teams.filter((t) => t.staff.length === 0)
  const teamsWithNoPlayers = teams.filter((t) => t._count.players === 0)

  const activeTryouts = tryoutsWithSignups.filter(
    (t) => new Date(t.scheduledAt) >= new Date() && t.isPublished
  )
  const draftTryouts = tryoutsWithSignups.filter(
    (t) => new Date(t.scheduledAt) >= new Date() && !t.isPublished
  )

  const tryoutsNeedingOffers = tryoutsWithSignups
    .filter((t) => {
      const needsOffer = t.signups.filter((s) => s.offers.length === 0).length
      return needsOffer > 0
    })
    .map((t) => ({
      id: t.id,
      title: t.title,
      teamName: t.team?.name,
      needsOffer: t.signups.filter((s) => s.offers.length === 0).length,
      total: t.signups.length,
    }))

  const pendingOffers = offers.filter((o) => o.status === "PENDING").length
  const acceptedOffers = offers.filter((o) => o.status === "ACCEPTED").length
  const declinedOffers = offers.filter((o) => o.status === "DECLINED").length
  const expiredOffers = offers.filter((o) => o.status === "EXPIRED").length

  return {
    primaryColor: branding?.primaryColor || "#4f46e5",
    teamCount,
    tryoutCount,
    staffCount,
    pendingInvites,
    teamsWithoutCoach,
    teamsWithNoPlayers,
    activeTryouts: activeTryouts.length,
    draftTryouts: draftTryouts.length,
    tryoutsNeedingOffers,
    pendingOffers,
    acceptedOffers,
    declinedOffers,
    expiredOffers,
    totalOffers: offers.length,
  }
}

export default async function ClubOverviewPage({ params }: { params: { id: string } }) {
  const data = await getClubOverview(params.id)

  const hasAttentionItems =
    data.tryoutsNeedingOffers.length > 0 ||
    data.pendingOffers > 0 ||
    data.teamsWithoutCoach.length > 0 ||
    data.draftTryouts > 0 ||
    data.expiredOffers > 0

  const pipe = [
    { n: data.acceptedOffers, seg: "bg-court-500", dot: "bg-court-500", num: "text-court-700", label: "Accepted", status: "accepted" },
    { n: data.pendingOffers, seg: "bg-gold-400", dot: "bg-gold-400", num: "text-gold-600", label: "Pending", status: "pending" },
    { n: data.declinedOffers, seg: "bg-hoop-400", dot: "bg-hoop-400", num: "text-hoop-600", label: "Declined", status: "declined" },
    { n: data.expiredOffers, seg: "bg-ink-300", dot: "bg-ink-300", num: "text-ink-500", label: "Expired", status: "expired" },
  ]

  return (
    <div className="font-barlow" style={brandStyle(data.primaryColor)}>
      {/* Top Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          href={`/clubs/${params.id}/teams`}
          value={data.teamCount}
          label="Teams"
          tone="court"
          icon="teams"
          delay={0}
          sub={data.teamsWithNoPlayers.length > 0 ? `${data.teamsWithNoPlayers.length} without players` : null}
          subTone="play"
        />
        <StatTile
          href={`/clubs/${params.id}/tryouts`}
          value={data.tryoutCount}
          label="Tryouts"
          tone="play"
          icon="tryouts"
          delay={70}
          sub={`${data.activeTryouts} active · ${data.draftTryouts} draft`}
          subTone="ink"
        />
        <StatTile
          href={`/clubs/${params.id}/offers`}
          value={data.totalOffers}
          label="Offers"
          tone="hoop"
          icon="offers"
          delay={140}
          sub={data.pendingOffers > 0 ? `${data.pendingOffers} awaiting` : null}
          subTone="hoop"
        />
        <StatTile
          href={`/clubs/${params.id}/staff`}
          value={data.staffCount}
          label="Staff"
          tone="ink"
          icon="staff"
          delay={210}
          sub={data.pendingInvites > 0 ? `${data.pendingInvites} pending invite${data.pendingInvites !== 1 ? "s" : ""}` : null}
          subTone="hoop"
        />
      </div>

      {/* Needs Attention */}
      {hasAttentionItems && (
        <section
          className="reveal border-ink-100 shadow-soft mb-8 overflow-hidden rounded-[28px] border bg-white"
          style={{ animationDelay: "260ms" }}
        >
          <div className="bg-[var(--brand-soft)] flex items-center gap-2.5 px-6 py-4">
            <span className="h-5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" aria-hidden />
            <span className="font-condensed text-ink-950 text-lg font-bold uppercase leading-none tracking-wide">
              Needs attention
            </span>
          </div>
          <div className="space-y-2 p-4">
            {data.tryoutsNeedingOffers.map((t) => (
              <AttnRow
                key={t.id}
                href={`/clubs/${params.id}/tryouts/${t.id}/signups`}
                dot="bg-hoop-500"
                chip={`${t.needsOffer} of ${t.total} need offers`}
                chipCls="bg-hoop-50 text-hoop-700"
              >
                <span className="text-ink-900 font-medium">{t.title}</span>
                {t.teamName && <span className="text-ink-400 ml-2 text-xs">{t.teamName}</span>}
              </AttnRow>
            ))}
            {data.pendingOffers > 0 && (
              <AttnRow
                href={`/clubs/${params.id}/offers?status=pending`}
                dot="bg-gold-400"
                chip={`${data.pendingOffers} pending`}
                chipCls="bg-gold-50 text-gold-600"
              >
                <span className="text-ink-900">Offers awaiting a family&apos;s reply</span>
              </AttnRow>
            )}
            {data.expiredOffers > 0 && (
              <AttnRow
                href={`/clubs/${params.id}/offers?status=expired`}
                dot="bg-ink-300"
                chip={`${data.expiredOffers} expired`}
                chipCls="bg-ink-100 text-ink-600"
              >
                <span className="text-ink-900">Expired offers that may need re-sending</span>
              </AttnRow>
            )}
            {data.teamsWithoutCoach.map((t) => (
              <AttnRow
                key={t.id}
                href={`/clubs/${params.id}/teams/${t.id}/edit`}
                dot="bg-play-500"
                chip="No head coach"
                chipCls="bg-play-50 text-play-700"
              >
                <span className="text-ink-900 font-medium">{t.name}</span>
                <span className="text-ink-400 ml-2 text-xs">{t.ageGroup}</span>
              </AttnRow>
            ))}
            {data.draftTryouts > 0 && (
              <AttnRow
                href={`/clubs/${params.id}/tryouts?status=draft`}
                dot="bg-ink-300"
                chip={`${data.draftTryouts} draft${data.draftTryouts !== 1 ? "s" : ""}`}
                chipCls="bg-ink-100 text-ink-600"
              >
                <span className="text-ink-900">Unpublished draft tryouts</span>
              </AttnRow>
            )}
          </div>
        </section>
      )}

      {/* Offer Pipeline */}
      {data.totalOffers > 0 && (
        <section
          className="reveal border-ink-100 shadow-soft mb-8 rounded-[28px] border bg-white p-6"
          style={{ animationDelay: "320ms" }}
        >
          <div className="mb-4 flex items-center gap-2.5">
            <span className="h-5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" aria-hidden />
            <span className="font-condensed text-ink-950 text-lg font-bold uppercase leading-none tracking-wide">
              Offer pipeline
            </span>
          </div>
          <div className="grow-x bg-ink-100 mb-5 flex h-2.5 overflow-hidden rounded-full">
            {pipe
              .filter((p) => p.n > 0)
              .map((p) => (
                <div key={p.label} className={p.seg} style={{ flexGrow: p.n, minWidth: 6 }} title={`${p.label}: ${p.n}`} />
              ))}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {pipe.map((p) => (
              <Link
                key={p.label}
                href={`/clubs/${params.id}/offers?status=${p.status}`}
                className="hover:bg-ink-50 group rounded-2xl px-3 py-2 text-center transition-colors"
              >
                <div className={`font-condensed text-3xl font-bold leading-none ${p.num}`}>
                  <AnimatedNumber value={p.n} />
                </div>
                <div className="text-ink-500 mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium">
                  <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} aria-hidden />
                  {p.label}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Quick Actions */}
      <section
        className="reveal border-ink-100 shadow-soft rounded-[28px] border bg-white p-6"
        style={{ animationDelay: "380ms" }}
      >
        <div className="mb-4 flex items-center gap-2.5">
          <span className="h-5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" aria-hidden />
          <span className="font-condensed text-ink-950 text-lg font-bold uppercase leading-none tracking-wide">
            Quick actions
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          <ActionButton href={`/clubs/${params.id}/teams/create`} primary icon="plus">
            Create team
          </ActionButton>
          <ActionButton href={`/clubs/${params.id}/tryouts/create`} primary icon="plus">
            Create tryout
          </ActionButton>
          <ActionButton href={`/clubs/${params.id}/staff`} icon="people">
            Manage staff
          </ActionButton>
          {data.acceptedOffers > 0 && (
            <ActionButton href={`/clubs/${params.id}/offers/summary`} tone="court" icon="list">
              Accepted summary
            </ActionButton>
          )}
          <ActionButton href={`/clubs/${params.id}/public`} icon="eye">
            View public page
          </ActionButton>
          <ActionButton href={`/clubs/${params.id}/settings`} icon="gear">
            Settings
          </ActionButton>
        </div>
      </section>
    </div>
  )
}

/** Elevated row inside "Needs attention": leading severity dot + hover lift + chip. */
function AttnRow({
  href,
  dot,
  chip,
  chipCls,
  children,
}: {
  href: string
  dot: string
  chip: string
  chipCls: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="border-ink-100 flex items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3 text-sm transition-all duration-200 hover:translate-x-0.5 hover:border-[color:var(--brand-line)] hover:shadow-[0_10px_30px_-22px_rgba(15,23,42,0.45)]"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
        <span className="truncate">{children}</span>
      </span>
      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${chipCls}`}>
        {chip}
      </span>
    </Link>
  )
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" strokeLinecap="round" />,
  people: <><circle cx="9" cy="7" r="4" /><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M19 8v6M22 11h-6" strokeLinecap="round" /></>,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9v0" /></>,
}

/** Polished quick-action button — primary uses the club brand color; press + hover motion. */
function ActionButton({
  href,
  children,
  primary,
  tone,
  icon,
}: {
  href: string
  children: React.ReactNode
  primary?: boolean
  tone?: "court"
  icon: keyof typeof ACTION_ICONS
}) {
  const base =
    "brand-focus inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 active:scale-[0.97]"
  const style = primary
    ? "text-[color:var(--brand-on)] shadow-[0_10px_24px_-12px_rgba(15,23,42,0.5)] hover:brightness-95"
    : tone === "court"
      ? "bg-court-600 text-white hover:bg-court-700 shadow-[0_10px_24px_-14px_rgba(22,163,74,0.6)]"
      : "border-ink-200 text-ink-700 border bg-white hover:border-ink-300 hover:bg-ink-50"
  return (
    <Link href={href} className={`${base} ${style}`} style={primary ? { backgroundColor: "var(--brand)" } : undefined}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        {ACTION_ICONS[icon]}
      </svg>
      {children}
    </Link>
  )
}
