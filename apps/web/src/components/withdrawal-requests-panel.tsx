"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Badge, Button, PanelHeader } from "@/components/ui"

/**
 * Pending withdrawal requests awaiting THIS viewer's decision (owner
 * 2026-07-18: self-withdrawal needs the other party's sign-off). Rendered on
 * the league season Teams tab (club-from-league) and the club roster page
 * (player-from-team). Renders nothing when the queue is empty.
 */

interface Props {
  /** show club-from-league requests for this season */
  seasonId?: string
  /** show player-release requests for this team */
  teamId?: string
  /** re-fetch page data after a decision executes */
  onDecided?: () => void
}

export function WithdrawalRequestsPanel({ seasonId, teamId, onDecided }: Props) {
  const router = useRouter()
  const [requests, setRequests] = useState<any[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/withdrawal-requests")
      if (!res.ok) return
      const data = await res.json()
      const relevant = (data.toDecide ?? []).filter((r: any) =>
        seasonId
          ? r.type === "CLUB_FROM_LEAGUE" && r.submission?.season?.id === seasonId
          : r.type === "PLAYER_FROM_TEAM" && r.teamPlayer?.team?.id === teamId
      )
      setRequests(relevant)
    } catch {
      // silent — the panel simply stays hidden
    }
  }, [seasonId, teamId])

  useEffect(() => {
    load()
  }, [load])

  const decide = async (requestId: string, action: "approve" | "decline") => {
    const note =
      action === "decline"
        ? window.prompt("Add a note for the requester (optional):") ?? undefined
        : undefined
    setBusy(requestId)
    setError("")
    try {
      const res = await fetch(`/api/withdrawal-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "Couldn't record the decision")
        return
      }
      await load()
      onDecided?.()
      router.refresh() // server-rendered hosts (club roster page) re-pull data
    } finally {
      setBusy(null)
    }
  }

  if (requests.length === 0 && !error) return null

  return (
    <div className="shadow-soft mb-6 rounded-[28px] border border-amber-200 bg-amber-50/50 p-6">
      <PanelHeader
        className="mb-1"
        title={
          <span className="flex items-center gap-2">
            Withdrawal requests
            <Badge tone="warning">{requests.length}</Badge>
          </span>
        }
      />
      <p className="text-ink-500 mb-4 text-xs">
        {seasonId
          ? "These clubs are asking to leave the season. Approving cancels their upcoming games and notifies opponents."
          : "These families are asking for a release from the roster. Approving frees the roster spot (history is kept)."}
      </p>
      {error && <p className="text-hoop-600 mb-3 text-sm">{error}</p>}
      <ul className="space-y-3">
        {requests.map((r) => (
          <li
            key={r.id}
            className="border-ink-100 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3"
          >
            <div className="min-w-0">
              <p className="text-ink-900 text-sm font-semibold">
                {r.type === "CLUB_FROM_LEAGUE"
                  ? `${r.submission?.team?.name ?? "Team"} — withdraw from ${r.submission?.season?.label ?? "season"}`
                  : `${r.teamPlayer?.player?.firstName ?? ""} ${r.teamPlayer?.player?.lastName ?? ""} — release from ${r.teamPlayer?.team?.name ?? "team"}`}
              </p>
              <p className="text-ink-500 mt-0.5 text-xs">
                “{r.reason}” — {r.requestedBy?.firstName} {r.requestedBy?.lastName},{" "}
                {new Date(r.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" onClick={() => decide(r.id, "approve")} disabled={busy === r.id}>
                Approve
              </Button>
              <Button
                size="sm"
                variant="subtle"
                onClick={() => decide(r.id, "decline")}
                disabled={busy === r.id}
              >
                Decline
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
