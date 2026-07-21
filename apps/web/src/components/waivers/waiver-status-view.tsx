"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Badge, Button } from "@/components/ui"

interface StatusWaiver {
  id: string
  title: string
  annualRenewal: boolean
  version: number
}

interface StatusPlayer {
  playerId: string
  name: string
  parentEmail: string | null
  complete: boolean
  waivers: { waiverId: string; signed: boolean; signerName: string | null; signedAt: string | null }[]
}

interface StatusTeam {
  submissionId: string
  teamId: string
  teamName: string
  complete: boolean
  players: StatusPlayer[]
}

interface StatusPayload {
  season: { id: string; label: string; leagueName: string }
  waivers: StatusWaiver[]
  teams: StatusTeam[]
  totals: { signed: number; outstanding: number }
}

export function WaiverStatusView({
  seasonId,
  leagueId,
}: {
  seasonId: string
  leagueId: string
}) {
  const [data, setData] = useState<StatusPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/seasons/${seasonId}/waiver-status`)
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(payload.error ?? "Could not load signing status")
        return
      }
      setData(payload)
      setError(null)
    } catch {
      setError("Could not load signing status")
    }
  }, [seasonId])

  useEffect(() => {
    load()
  }, [load])

  async function resend(submissionId?: string) {
    setBusy(submissionId ?? "all")
    setNotice(null)
    try {
      const res = await fetch(`/api/seasons/${seasonId}/waiver-status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "resend", ...(submissionId ? { submissionId } : {}) }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setNotice(payload.error ?? "Re-send failed")
        return
      }
      setNotice(
        payload.sent > 0
          ? `Sent ${payload.sent} email${payload.sent === 1 ? "" : "s"}.`
          : "Nothing to send: everyone has either signed or already has a live link in their inbox."
      )
      await load()
    } catch {
      setNotice("Re-send failed. Please try again.")
    } finally {
      setBusy(null)
    }
  }

  if (error) {
    return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
  }
  if (!data) {
    return <p className="p-4 text-sm text-ink-400">Loading signing status...</p>
  }

  if (data.waivers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink-300 bg-ink-50/50 p-8 text-center text-sm text-ink-500">
        This league has no required waivers yet.{" "}
        <Link href={`/manage/leagues/${leagueId}/waivers`} className="font-semibold text-play-700 hover:underline">
          Set them up here
        </Link>
        {" "}and they will be emailed automatically when teams are approved.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge tone="court">{data.totals.signed} signed</Badge>
          <Badge tone={data.totals.outstanding > 0 ? "warning" : "neutral"}>
            {data.totals.outstanding} outstanding
          </Badge>
        </div>
        <Button
          variant="subtle"
          disabled={busy !== null}
          onClick={() => resend()}
        >
          {busy === "all" ? "Sending..." : "Re-send all outstanding"}
        </Button>
      </div>

      {notice ? (
        <p className="rounded-xl bg-play-50 px-4 py-3 text-sm text-play-800">{notice}</p>
      ) : null}

      {data.teams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-300 bg-ink-50/50 p-8 text-center text-sm text-ink-500">
          No approved teams yet. Waiver emails go out the moment a team is approved.
        </div>
      ) : null}

      {data.teams.map((team) => (
        <div key={team.submissionId} className="overflow-hidden rounded-xl border border-ink-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 bg-ink-50/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-ink-900">{team.teamName}</p>
              {team.complete ? (
                <Badge tone="court">All signed</Badge>
              ) : (
                <Badge tone="warning">Missing signatures</Badge>
              )}
            </div>
            <Button
              variant="subtle"
              disabled={busy !== null || team.complete}
              onClick={() => resend(team.submissionId)}
            >
              {busy === team.submissionId ? "Sending..." : "Re-send"}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="px-4 py-2 font-semibold">Player</th>
                  {data.waivers.map((w) => (
                    <th key={w.id} className="px-4 py-2 font-semibold">
                      {w.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {team.players.map((p) => (
                  <tr key={p.playerId} className="border-t border-ink-50">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-ink-800">{p.name}</p>
                      {p.parentEmail ? (
                        <p className="text-xs text-ink-400">{p.parentEmail}</p>
                      ) : (
                        <p className="text-xs text-red-500">No parent email on file</p>
                      )}
                    </td>
                    {p.waivers.map((w) => (
                      <td key={w.waiverId} className="px-4 py-2.5">
                        {w.signed ? (
                          <span className="text-court-700" title={w.signerName ?? undefined}>
                            ✓ {w.signerName}
                          </span>
                        ) : (
                          <span className="text-amber-600">Pending</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
