"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { StatTile } from "@/components/ui"
import { panelClass } from "./types"

/**
 * League command summary (owner 2026-07-29: "league management is
 * complicated — like the club owner dashboard, quick items that need
 * attention"). Counts what's waiting on the commissioner and jumps
 * straight to the right tab/page.
 */
export function NeedsAttention({
  leagueId,
  seasonId,
  league,
  onGoToTab,
}: {
  leagueId: string
  seasonId: string
  league: any
  onGoToTab: (tab: string) => void
}) {
  const [rosterRequests, setRosterRequests] = useState(0)
  const [withdrawals, setWithdrawals] = useState(0)
  const [waiversOutstanding, setWaiversOutstanding] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [rr, wd, ws] = await Promise.all([
        fetch(`/api/seasons/${seasonId}/roster-requests?status=PENDING`).catch(() => null),
        fetch("/api/withdrawal-requests").catch(() => null),
        fetch(`/api/seasons/${seasonId}/waiver-status`).catch(() => null),
      ])
      if (!alive) return
      if (rr?.ok) {
        const data = await rr.json()
        setRosterRequests((data.requests ?? []).length)
      }
      if (wd?.ok) {
        const data = await wd.json()
        setWithdrawals(
          (data.toDecide ?? []).filter(
            (r: any) => r.type === "CLUB_FROM_LEAGUE" && r.submission?.season?.id === seasonId
          ).length
        )
      }
      if (ws?.ok) {
        const data = await ws.json()
        setWaiversOutstanding(data.totals?.outstanding ?? null)
      }
    })()
    return () => {
      alive = false
    }
  }, [seasonId])

  const subs: any[] = league?.teams ?? []
  const isPaid = (t: any) => ["PAID_MANUAL", "PAID_STRIPE", "WAIVED"].includes(t.paymentStatus)
  const clubCount = new Set(subs.map((t: any) => t.team?.tenant?.id).filter(Boolean)).size
  const approved = subs.filter((t) => t.status === "APPROVED")
  const pendingApps = subs.filter((t) => t.status === "PENDING").length
  const unpaidApproved = approved.filter((t) => !isPaid(t)).length

  const items: Array<{ label: string; action: () => void; actionLabel: string }> = []
  if (pendingApps > 0)
    items.push({
      label: `${pendingApps} team application${pendingApps === 1 ? "" : "s"} waiting for review`,
      action: () => onGoToTab("teams"),
      actionLabel: "Review",
    })
  if (unpaidApproved > 0)
    items.push({
      label: `${unpaidApproved} approved team${unpaidApproved === 1 ? "" : "s"} with entry fee owing`,
      action: () => onGoToTab("clubs"),
      actionLabel: "See clubs",
    })
  if (rosterRequests > 0)
    items.push({
      label: `${rosterRequests} roster change request${rosterRequests === 1 ? "" : "s"} pending`,
      action: () => onGoToTab("teams"),
      actionLabel: "Decide",
    })
  if (withdrawals > 0)
    items.push({
      label: `${withdrawals} withdrawal request${withdrawals === 1 ? "" : "s"} pending`,
      action: () => onGoToTab("teams"),
      actionLabel: "Decide",
    })

  return (
    <div className={`reveal ${panelClass} mb-6`}>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Clubs entered" value={clubCount} tone="brand" />
        <StatTile
          label="Teams approved"
          value={approved.length}
          tone="court"
          sub={subs.length ? `of ${subs.length}` : null}
        />
        <StatTile label="Applications pending" value={pendingApps} tone="gold" delay={70} />
        <StatTile
          label="Waivers outstanding"
          value={waiversOutstanding ?? 0}
          tone="hoop"
          delay={140}
        />
      </div>
      {items.length === 0 && (waiversOutstanding ?? 0) === 0 ? (
        <p className="text-court-700 text-sm font-medium">
          ✓ Nothing needs your attention right now.
        </p>
      ) : (
        <div className="grid gap-1.5">
          {items.map((it) => (
            <div
              key={it.label}
              className="bg-gold-50 border-gold-100 flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
            >
              <span className="text-ink-800 text-sm">{it.label}</span>
              <button
                onClick={it.action}
                className="text-play-600 hover:text-play-700 shrink-0 text-xs font-semibold"
              >
                {it.actionLabel} &rarr;
              </button>
            </div>
          ))}
          {(waiversOutstanding ?? 0) > 0 && (
            <div className="bg-gold-50 border-gold-100 flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <span className="text-ink-800 text-sm">
                {waiversOutstanding} waiver signature{waiversOutstanding === 1 ? "" : "s"} outstanding
              </span>
              <Link
                href={`/manage/leagues/${leagueId}/seasons/${seasonId}/waivers`}
                className="text-play-600 hover:text-play-700 shrink-0 text-xs font-semibold"
              >
                Signing grid &rarr;
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
