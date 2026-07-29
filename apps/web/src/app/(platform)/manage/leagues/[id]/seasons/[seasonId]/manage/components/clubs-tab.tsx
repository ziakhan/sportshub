"use client"

import Link from "next/link"
import { Badge, PanelHeader, toneForStatus } from "@/components/ui"
import { panelClass } from "./types"

/**
 * Clubs view (owner 2026-07-29): the Teams tab groups by team — this groups
 * by CLUB, so the league sees who has entered, each club's teams underneath
 * with status/payment, and drills into the league-side club page. Becomes
 * the Entries view when ClubSeasonEntry ships (league-operator-orgs.md).
 */
export function ClubsTab({
  seasonId,
  leagueId,
  league,
}: {
  seasonId: string
  leagueId: string
  league: any
}) {
  const subs: any[] = league.teams || []
  const byClub = new Map<string, { tenant: any; teams: any[] }>()
  for (const t of subs) {
    const tenant = t.team?.tenant
    if (!tenant) continue
    const entry = byClub.get(tenant.id) ?? { tenant, teams: [] }
    entry.teams.push(t)
    byClub.set(tenant.id, entry)
  }
  const clubs = [...byClub.values()].sort((a, b) => a.tenant.name.localeCompare(b.tenant.name))
  const isPaid = (t: any) => ["PAID_MANUAL", "PAID_STRIPE", "WAIVED"].includes(t.paymentStatus)

  return (
    <div className={`reveal ${panelClass}`}>
      <PanelHeader
        title={`Clubs (${clubs.length})`}
        action={
          <span className="text-ink-400 text-xs">
            {subs.length} team{subs.length === 1 ? "" : "s"} across all clubs
          </span>
        }
      />
      {clubs.length === 0 ? (
        <p className="text-ink-500 text-sm">No clubs have registered teams yet.</p>
      ) : (
        clubs.map(({ tenant, teams }) => {
          const approved = teams.filter((t) => t.status === "APPROVED").length
          const pending = teams.filter((t) => t.status === "PENDING").length
          const rejected = teams.filter((t) => t.status === "REJECTED").length
          const paidCount = teams.filter(isPaid).length
          return (
            <div
              key={tenant.id}
              className="border-court-100 hover:border-court-200 mb-3 rounded-xl border p-3 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/manage/leagues/${leagueId}/seasons/${seasonId}/clubs/${tenant.id}`}
                    className="text-ink-900 hover:text-play-600 font-semibold transition-colors"
                  >
                    {tenant.name}
                  </Link>
                  <span className="text-ink-500 ml-2 text-xs">
                    {teams.length} team{teams.length === 1 ? "" : "s"}
                    {approved > 0 ? ` · ${approved} approved` : ""}
                    {pending > 0 ? ` · ${pending} pending` : ""}
                    {rejected > 0 ? ` · ${rejected} rejected` : ""}
                    {` · ${paidCount}/${teams.length} paid`}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {pending > 0 && <Badge tone="warning">{pending} to review</Badge>}
                  <Link
                    href={`/manage/leagues/${leagueId}/seasons/${seasonId}/clubs/${tenant.id}`}
                    className="text-play-600 hover:text-play-700 whitespace-nowrap text-xs font-semibold"
                  >
                    Club view &rarr;
                  </Link>
                </div>
              </div>
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                {teams.map((t) => (
                  <Link
                    key={t.id}
                    href={`/manage/leagues/${leagueId}/seasons/${seasonId}/teams/${t.id}`}
                    className="bg-court-50 hover:bg-court-100 flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors"
                  >
                    <span className="text-ink-800 min-w-0 truncate font-medium">
                      {t.team.name}
                      {t.division && (
                        <span className="text-ink-400 ml-1.5 text-xs">{t.division.name}</span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <Badge tone={toneForStatus(t.status)}>{t.status.toLowerCase()}</Badge>
                      <Badge tone={isPaid(t) ? "success" : "warning"}>
                        {isPaid(t) ? "paid" : "unpaid"}
                      </Badge>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
