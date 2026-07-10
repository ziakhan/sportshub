"use client"

import Link from "next/link"

import { useState } from "react"
import { panelClass } from "./types"
import { RosterRequestsPanel } from "./roster-requests-panel"

export function TeamsTab({
  seasonId,
  league,
  refresh,
}: {
  seasonId: string
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

  const withdrawTeam = async (leagueTeamId: string) => {
    if (
      !window.confirm(
        "Withdraws the team from the season — future games are cancelled and opponents notified."
      )
    )
      return
    await updateTeamStatus(leagueTeamId, "WITHDRAWN")
  }

  const updateTeamPayment = async (
    leagueTeamId: string,
    paymentStatus: "UNPAID" | "PAID_MANUAL" | "WAIVED"
  ) => {
    const res = await fetch(`/api/seasons/${seasonId}/teams/${leagueTeamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentStatus }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      window.alert(data.error || "Couldn't update the payment status")
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
      {/* Roster policy + change-request queue */}
      <RosterRequestsPanel
        seasonId={seasonId}
        policy={league.rosterChangePolicy ?? "REQUEST_ONLY"}
        deadline={league.rosterChangeDeadline ?? null}
        teams={league.teams || []}
        refresh={refresh}
      />

      {/* Registered Teams */}
      <div className={panelClass}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-ink-900 font-semibold">Registered Teams</h3>
          <div className="flex flex-col items-end gap-1">
            <div className="flex flex-wrap items-center gap-1">
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
                      : "bg-ink-50 text-ink-500 hover:bg-court-100"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1">
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
                      : "bg-ink-50 text-ink-500 hover:bg-court-100"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
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
            return (
              <div
                key={t.id}
                className="border-court-100 bg-court-50 mb-2 flex items-center justify-between rounded-xl border px-3 py-2"
              >
                <div>
                  {(t.team as any)?.id ? (
                    <Link
                      href={`/team/${(t.team as any).id}`}
                      className="text-ink-900 hover:text-play-600 font-medium transition-colors"
                    >
                      {t.team.name}
                    </Link>
                  ) : (
                    <span className="text-ink-900 font-medium">{t.team.name}</span>
                  )}
                  <span className="text-ink-500 ml-2 text-xs">{t.team.tenant?.name}</span>
                  {t.division && (
                    <span className="text-play-700 ml-2 text-xs">{t.division.name}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      t.status === "APPROVED"
                        ? "bg-court-100 text-court-700"
                        : t.status === "WITHDRAWN"
                          ? "bg-ink-100 text-ink-600"
                          : "bg-hoop-100 text-hoop-700"
                    }`}
                  >
                    {t.status.toLowerCase()}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      paid
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {paymentLabel[t.paymentStatus ?? "UNPAID"] ?? "unpaid"}
                  </span>
                  {t.status === "PENDING" && (
                    <>
                      <button
                        onClick={() => updateTeamStatus(t.id, "APPROVED")}
                        className="bg-court-600 hover:bg-court-700 rounded-lg px-2 py-1 text-xs font-semibold text-white"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => updateTeamStatus(t.id, "REJECTED")}
                        className="border-hoop-300 text-hoop-700 hover:bg-hoop-50 rounded-lg border px-2 py-1 text-xs font-semibold"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {(t.status === "PENDING" || t.status === "APPROVED") && (
                    <button
                      onClick={() => withdrawTeam(t.id)}
                      className="text-hoop-700 hover:bg-hoop-50 rounded-lg px-2 py-1 text-xs font-semibold"
                    >
                      Withdraw
                    </button>
                  )}
                  {!paid ? (
                    <>
                      <button
                        onClick={() => updateTeamPayment(t.id, "PAID_MANUAL")}
                        className="border-green-300 text-green-700 hover:bg-green-50 rounded-lg border px-2 py-1 text-[11px] font-semibold"
                      >
                        Mark paid
                      </button>
                      <button
                        onClick={() => updateTeamPayment(t.id, "WAIVED")}
                        className="border-ink-200 text-ink-600 hover:bg-ink-50 rounded-lg border px-2 py-1 text-[11px] font-semibold"
                      >
                        Waive
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => updateTeamPayment(t.id, "UNPAID")}
                      className="border-ink-200 text-ink-500 hover:bg-ink-50 rounded-lg border px-2 py-1 text-[11px] font-semibold"
                    >
                      Mark unpaid
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
