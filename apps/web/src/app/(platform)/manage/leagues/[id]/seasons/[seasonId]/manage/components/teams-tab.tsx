"use client"

import Link from "next/link"

import { useState } from "react"
import { Badge, Button, PanelHeader, toneForStatus } from "@/components/ui"
import { panelClass } from "./types"
import { RosterRequestsPanel } from "./roster-requests-panel"
import { WithdrawalRequestsPanel } from "@/components/withdrawal-requests-panel"

export function TeamsTab({
  seasonId,
  leagueId,
  league,
  refresh,
}: {
  seasonId: string
  leagueId: string
  league: any
  refresh: () => void
}) {
  const [teamStatusFilter, setTeamStatusFilter] = useState<
    "ALL" | "PENDING" | "APPROVED" | "REJECTED"
  >("ALL")
  const [teamPaymentFilter, setTeamPaymentFilter] = useState<"ALL" | "UNPAID" | "PAID">("ALL")

  const updateTeamStatus = async (
    leagueTeamId: string,
    status: "APPROVED" | "REJECTED" | "WITHDRAWN"
  ) => {
    const res = await fetch(`/api/seasons/${seasonId}/teams/${leagueTeamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      // Previously silent: a 403/500 looked like success (gap-audit P1 #20)
      const data = await res.json().catch(() => ({}))
      window.alert(data.error || "Couldn't update the team's status")
      return
    }
    refresh()
  }

  const allTeams = league.teams || []
  const isPaid = (t: any) => ["PAID_MANUAL", "PAID_STRIPE", "WAIVED"].includes(t.paymentStatus)
  const filteredTeams = allTeams.filter((t: any) => {
    if (teamStatusFilter !== "ALL" && t.status !== teamStatusFilter) return false
    if (teamPaymentFilter === "UNPAID" && isPaid(t)) return false
    if (teamPaymentFilter === "PAID" && !isPaid(t)) return false
    return true
  })
  const unpaidCount = allTeams.filter((t: any) => !isPaid(t)).length
  const paidCount = allTeams.length - unpaidCount

  return (
    <div className="grid gap-6">
      {/* Clubs asking out of the season — the league signs off */}
      <WithdrawalRequestsPanel seasonId={seasonId} onDecided={refresh} />

      {/* Roster policy + change-request queue */}
      <RosterRequestsPanel
        seasonId={seasonId}
        policy={league.rosterChangePolicy ?? "REQUEST_ONLY"}
        deadline={league.rosterChangeDeadline ?? null}
        teams={league.teams || []}
        refresh={refresh}
      />

      {/* Registered Teams */}
      <div className={`reveal ${panelClass}`} style={{ animationDelay: "80ms" }}>
        <PanelHeader
          title="Registered teams"
          action={
            <span className="flex flex-col items-end gap-1">
              <span className="flex flex-wrap items-center justify-end gap-1">
                {[
                  { key: "ALL", label: `All (${allTeams.length})` },
                  {
                    key: "PENDING",
                    label: `Pending (${allTeams.filter((t: any) => t.status === "PENDING").length})`,
                  },
                  {
                    key: "APPROVED",
                    label: `Approved (${allTeams.filter((t: any) => t.status === "APPROVED").length})`,
                  },
                  {
                    key: "REJECTED",
                    label: `Rejected (${allTeams.filter((t: any) => t.status === "REJECTED").length})`,
                  },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setTeamStatusFilter(opt.key as any)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                      teamStatusFilter === opt.key
                        ? "bg-play-100 text-play-700"
                        : "bg-ink-50 text-ink-500 hover:bg-ink-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </span>
              <span className="flex flex-wrap items-center justify-end gap-1">
                {[
                  { key: "ALL", label: `Any payment` },
                  { key: "UNPAID", label: `Unpaid (${unpaidCount})` },
                  { key: "PAID", label: `Paid (${paidCount})` },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setTeamPaymentFilter(opt.key as any)}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition ${
                      teamPaymentFilter === opt.key
                        ? "bg-hoop-100 text-hoop-700"
                        : "bg-ink-50 text-ink-500 hover:bg-ink-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </span>
            </span>
          }
        />
        {!league.teams || league.teams.length === 0 ? (
          <p className="text-ink-500 text-sm">No teams registered yet.</p>
        ) : filteredTeams.length === 0 ? (
          <p className="text-ink-500 text-sm">No teams match the selected status.</p>
        ) : (
          filteredTeams.map((t: any) => {
            const paid = isPaid(t)
            const paymentLabel: Record<string, string> = {
              UNPAID: "unpaid",
              PAID_MANUAL: "paid",
              PAID_STRIPE: "paid (stripe)",
              WAIVED: "waived",
            }
            // One-row layout (owner 2026-07-29: actions were wrapping to a
            // second line). The row keeps only triage — badges + Approve/
            // Reject for pending teams; withdraw + payment actions live on
            // the team detail page behind "Details".
            return (
              <div
                key={t.id}
                className="border-court-100 bg-court-50 hover:border-court-200 mb-2 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition-colors"
              >
                <div className="min-w-0 flex-1 truncate">
                  <Link
                    href={`/manage/leagues/${leagueId}/seasons/${seasonId}/teams/${t.id}`}
                    className="text-ink-900 hover:text-play-600 font-medium transition-colors"
                  >
                    {t.team.name}
                  </Link>
                  <span className="text-ink-500 ml-2 text-xs">{t.team.tenant?.name}</span>
                  {t.division && (
                    <span className="text-play-700 ml-2 hidden text-xs sm:inline">{t.division.name}</span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={toneForStatus(t.status)}>{t.status.toLowerCase()}</Badge>
                  <Badge tone={paid ? "success" : "warning"}>
                    {paymentLabel[t.paymentStatus ?? "UNPAID"] ?? "unpaid"}
                  </Badge>
                  {t.status === "PENDING" && (
                    <>
                      <Button size="sm" tone="court" onClick={() => updateTeamStatus(t.id, "APPROVED")}>
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        tone="hoop"
                        onClick={() => updateTeamStatus(t.id, "REJECTED")}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  <Link
                    href={`/manage/leagues/${leagueId}/seasons/${seasonId}/teams/${t.id}`}
                    className="text-play-600 hover:text-play-700 whitespace-nowrap text-xs font-semibold"
                  >
                    Details &rarr;
                  </Link>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
