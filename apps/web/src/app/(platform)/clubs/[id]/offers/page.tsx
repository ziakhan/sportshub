import { prisma } from "@youthbasketballhub/db"
import { format } from "date-fns"
import Link from "next/link"
import type { ReactNode } from "react"
import { formatCurrency } from "@/lib/countries"
import { StatTile, Button, Badge, toneForStatus, type StatTileTone } from "@/components/ui"
import { OffersFilter } from "./offers-filter"
import { RescindButton } from "./rescind-button"

interface ClubOffer {
  id: string
  status: string
  seasonFee: number
  installments: number
  uniformSize: string | null
  shoeSize: string | null
  tracksuitSize: string | null
  jerseyPref1: number | null
  jerseyPref2: number | null
  jerseyPref3: number | null
  includesUniform: boolean
  includesTracksuit: boolean
  includesShoes: boolean
  includesBall: boolean
  includesBag: boolean
  practiceSessions: number
  createdAt: Date
  team: { id: string; name: string }
  player: {
    id: string
    firstName: string
    lastName: string
    dateOfBirth: Date | null
    gender: string | null
  }
}

async function getClubOffers(tenantId: string): Promise<ClubOffer[]> {
  const raw = await prisma.offer.findMany({
    where: { team: { tenantId } },
    select: {
      id: true,
      status: true,
      seasonFee: true,
      installments: true,
      uniformSize: true,
      shoeSize: true,
      tracksuitSize: true,
      jerseyPref1: true,
      jerseyPref2: true,
      jerseyPref3: true,
      includesUniform: true,
      includesTracksuit: true,
      includesShoes: true,
      includesBall: true,
      includesBag: true,
      practiceSessions: true,
      createdAt: true,
      team: { select: { id: true, name: true } },
      player: {
        select: { id: true, firstName: true, lastName: true, dateOfBirth: true, gender: true },
      },
    },
    orderBy: { createdAt: "desc" },
    // Newest 500 — offers accumulate every season (gap-audit P1 #18)
    take: 500,
  })
  // Convert Decimal to Number for serialization
  return raw.map((o: (typeof raw)[number]) => ({ ...o, seasonFee: Number(o.seasonFee) }))
}

async function getClubTeams(tenantId: string): Promise<{ id: string; name: string }[]> {
  return await prisma.team.findMany({
    where: { tenantId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
}

async function getTenantCurrency(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { currency: true },
  })
  return tenant?.currency || "CAD"
}

export default async function ClubOffersPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { status?: string; team?: string }
}) {
  const [offers, teams, currency] = await Promise.all([
    getClubOffers(params.id),
    getClubTeams(params.id),
    getTenantCurrency(params.id),
  ])

  const pendingCount = offers.filter((o) => o.status === "PENDING").length
  const acceptedCount = offers.filter((o) => o.status === "ACCEPTED").length
  const declinedCount = offers.filter((o) => o.status === "DECLINED").length
  const expiredCount = offers.filter((o) => o.status === "EXPIRED").length
  const rescindedCount = offers.filter((o) => o.status === "RESCINDED").length

  // Apply filters
  const statusFilter = searchParams.status?.toUpperCase()
  const teamFilter = searchParams.team
  const validStatuses = ["PENDING", "ACCEPTED", "DECLINED", "EXPIRED", "RESCINDED"]

  const filteredOffers = offers.filter((o) => {
    if (statusFilter && validStatuses.includes(statusFilter) && o.status !== statusFilter)
      return false
    if (teamFilter && o.team.id !== teamFilter) return false
    return true
  })

  const activeFilterTeam = teams.find((t) => t.id === teamFilter)

  // Clickable status stat-tiles — each toggles its own status filter.
  const statCards: {
    key: string
    label: string
    count: number
    tone: StatTileTone
    param: string
    icon: ReactNode
  }[] = [
    { key: "PENDING", label: "Pending", count: pendingCount, tone: "gold", param: "pending", icon: TILE_ICONS.pending },
    { key: "ACCEPTED", label: "Accepted", count: acceptedCount, tone: "court", param: "accepted", icon: TILE_ICONS.accepted },
    { key: "DECLINED", label: "Declined", count: declinedCount, tone: "hoop", param: "declined", icon: TILE_ICONS.declined },
    { key: "EXPIRED", label: "Expired", count: expiredCount, tone: "ink", param: "expired", icon: TILE_ICONS.expired },
    // Only surfaces once a rescind has actually happened — keeps the common
    // 4-tile layout until the fifth state exists in the data.
    ...(rescindedCount > 0
      ? [{ key: "RESCINDED", label: "Rescinded", count: rescindedCount, tone: "ink" as StatTileTone, param: "rescinded", icon: TILE_ICONS.expired }]
      : []),
  ]

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-condensed text-ink-950 text-2xl font-bold uppercase tracking-wide">
            Offers
          </h2>
          <p className="text-ink-500 mt-1 text-sm">Manage offers sent to players from tryouts</p>
        </div>
        {acceptedCount > 0 && (
          <Button
            href={`/clubs/${params.id}/offers/summary${teamFilter ? `?team=${teamFilter}` : ""}`}
            tone="court"
            icon={ACTION_ICONS.list}
          >
            Order Sheet
          </Button>
        )}
      </div>

      {/* Stats — clickable to filter */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCards.map((card, i) => (
          <StatTile
            key={card.key}
            value={card.count}
            label={card.label}
            tone={card.tone}
            icon={card.icon}
            delay={i * 70}
            href={
              statusFilter === card.key
                ? `/clubs/${params.id}/offers`
                : `/clubs/${params.id}/offers?status=${card.param}${teamFilter ? `&team=${teamFilter}` : ""}`
            }
            className={
              statusFilter === card.key ? "ring-2 ring-[color:var(--brand)]" : undefined
            }
          />
        ))}
      </div>

      {/* Team filter */}
      <OffersFilter
        teams={teams}
        clubId={params.id}
        activeTeamId={teamFilter}
        activeStatus={statusFilter?.toLowerCase()}
      />

      {/* Active filter indicator */}
      {(statusFilter || teamFilter) && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-ink-500 text-sm">Filtered by:</span>
          {statusFilter && (
            <Badge tone={toneForStatus(statusFilter)}>
              {statusFilter.toLowerCase()}
            </Badge>
          )}
          {activeFilterTeam && (
            <span className="rounded-full bg-[var(--brand-soft)] px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-ink)]">
              {activeFilterTeam.name}
            </span>
          )}
          <Link
            href={`/clubs/${params.id}/offers`}
            className="text-xs font-semibold text-[color:var(--brand-ink)] hover:underline"
          >
            Clear all
          </Link>
        </div>
      )}

      {filteredOffers.length === 0 ? (
        <div className="reveal border-ink-200 shadow-soft rounded-[28px] border border-dashed bg-white p-12 text-center">
          {offers.length === 0 ? (
            <>
              <h3 className="font-condensed text-ink-900 mb-2 text-xl font-bold uppercase tracking-wide">
                No offers yet
              </h3>
              <p className="text-ink-600 mb-5">
                Go to a tryout&apos;s signups page to make offers to players.
              </p>
              <div className="flex justify-center">
                <Button href={`/clubs/${params.id}/tryouts`} icon={ACTION_ICONS.clipboard}>
                  View Tryouts
                </Button>
              </div>
            </>
          ) : (
            <>
              <h3 className="font-condensed text-ink-900 mb-2 text-xl font-bold uppercase tracking-wide">
                No matching offers
              </h3>
              <p className="text-ink-600 mb-4">No offers match the current filters.</p>
              <Link
                href={`/clubs/${params.id}/offers`}
                className="text-sm font-semibold text-[color:var(--brand-ink)] hover:underline"
              >
                Clear filters
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Group by team */}
          {teams.map((team, teamIdx) => {
            const teamOffers = filteredOffers.filter((o) => o.team.id === team.id)
            if (teamOffers.length === 0) return null

            const teamAccepted = teamOffers.filter((o) => o.status === "ACCEPTED").length

            return (
              <div
                key={team.id}
                className="reveal border-ink-100 shadow-soft overflow-hidden rounded-[28px] border bg-white"
                style={{ animationDelay: `${teamIdx * 70}ms` }}
              >
                <div className="border-ink-100 flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-8 w-1.5 shrink-0 rounded-full bg-[var(--brand)]"
                      aria-hidden
                    />
                    <div>
                      <h3 className="font-condensed text-ink-950 text-lg font-bold uppercase leading-none tracking-wide">
                        {team.name}
                      </h3>
                      <p className="text-ink-500 mt-1 text-xs">
                        {teamOffers.length} offer{teamOffers.length !== 1 ? "s" : ""} &middot;{" "}
                        {teamAccepted} accepted
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      href={`/clubs/${params.id}/teams/${team.id}/dashboard`}
                      variant="subtle"
                      size="sm"
                    >
                      Team Dashboard
                    </Button>
                    {teamAccepted > 0 && (
                      <Button
                        href={`/clubs/${params.id}/teams/${team.id}/roster`}
                        tone="court"
                        size="sm"
                      >
                        View Roster
                      </Button>
                    )}
                  </div>
                </div>

                <div className="divide-ink-100 divide-y">
                  {teamOffers.map((offer) => (
                    <div
                      key={offer.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-6 py-3"
                    >
                      <div>
                        <span className="text-ink-900 font-medium">
                          {offer.player.firstName} {offer.player.lastName}
                        </span>
                        <span className="text-ink-500 ml-2 text-xs">
                          {formatCurrency(Number(offer.seasonFee), currency)}
                          {offer.installments > 1 ? ` (${offer.installments} installments)` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {offer.status === "ACCEPTED" && offer.uniformSize && (
                          <span className="text-ink-500 text-xs">
                            Size: {offer.uniformSize}
                            {offer.jerseyPref1 !== null ? ` | Pref: #${offer.jerseyPref1}` : ""}
                            {offer.jerseyPref2 !== null ? `, #${offer.jerseyPref2}` : ""}
                            {offer.jerseyPref3 !== null ? `, #${offer.jerseyPref3}` : ""}
                          </span>
                        )}
                        <Badge tone={toneForStatus(offer.status)}>
                          {offer.status.toLowerCase()}
                        </Badge>
                        {offer.status === "PENDING" && (
                          <RescindButton
                            offerId={offer.id}
                            playerName={`${offer.player.firstName} ${offer.player.lastName}`}
                          />
                        )}
                        <span className="text-ink-400 text-xs">
                          {format(new Date(offer.createdAt), "MMM d")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Stat-tile icons (20×20 — the tile sizes them via h-5 w-5). */
const TILE_ICONS: Record<string, ReactNode> = {
  pending: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  accepted: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  declined: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" strokeLinecap="round" />
    </svg>
  ),
  expired: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6l12.8 12.8" strokeLinecap="round" />
    </svg>
  ),
}

/** Button icons (the Button kit sizes them per `size`). */
const ACTION_ICONS: Record<string, ReactNode> = {
  list: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
    </svg>
  ),
  clipboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path
        d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"
        strokeLinejoin="round"
      />
    </svg>
  ),
}
