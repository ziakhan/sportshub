"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"

interface League {
  id: string
  name: string
  season: string
  leagueStatus: string
  startDate: string | null
  endDate: string | null
  registrationDeadline: string | null
  teamFee: number | null
  gamesGuaranteed: number | null
  _count: { teams: number; games: number }
  divisions: { id: string; name: string; ageGroup: string }[]
  owner?: { name: string; email: string }
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "bg-ink-100 text-ink-700" },
  REGISTRATION: { label: "Open for Registration", color: "bg-court-50 text-court-700" },
  REGISTRATION_CLOSED: { label: "Registration Closed", color: "bg-play-50 text-play-700" },
  FINALIZED: { label: "Finalized", color: "bg-hoop-50 text-hoop-700" },
  IN_PROGRESS: { label: "In Progress", color: "bg-play-50 text-play-700" },
  COMPLETED: { label: "Completed", color: "bg-ink-100 text-ink-600" },
}

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/leagues?mine=true")
      .then((res) => res.json())
      .then((data) => setLeagues(data.leagues || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-ink-500 p-6 py-12 text-center">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="border-ink-100 shadow-soft rounded-[28px] border bg-white p-6 sm:p-8">
        <div className="border-play-100 bg-play-50 text-play-600 mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
          Leagues
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-ink-950 text-3xl font-bold">My leagues</h1>
            <p className="text-ink-500 mt-1 text-sm">Manage your league seasons</p>
          </div>
          <Link
            href="/leagues/create"
            className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white"
          >
            Create Season
          </Link>
        </div>
      </div>

      {leagues.length === 0 ? (
        <div className="border-ink-300 shadow-soft rounded-2xl border border-dashed bg-white p-12 text-center">
          <h3 className="font-display text-ink-950 mb-2 text-lg font-semibold">No leagues yet</h3>
          <p className="text-ink-600 mb-6">Create your first league season to get started.</p>
          <Link
            href="/leagues/create"
            className="bg-play-600 hover:bg-play-700 inline-block rounded-xl px-6 py-2 text-sm font-semibold text-white"
          >
            Create Your First Season
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {leagues.map((league) => {
            const status = STATUS_LABELS[league.leagueStatus] || STATUS_LABELS.DRAFT
            return (
              <Link
                key={league.id}
                href={`/leagues/${league.id}/manage`}
                className="border-ink-100 shadow-soft hover:border-play-200 hover:bg-play-50 block rounded-2xl border bg-white p-6 transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <h3 className="text-ink-950 text-lg font-semibold">{league.name}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    <p className="text-ink-500 text-sm">{league.season}</p>
                    {league.owner && (
                      <p className="text-ink-400 text-xs">
                        Owner: {league.owner.name} ({league.owner.email})
                      </p>
                    )}
                    {league.startDate && league.endDate && (
                      <p className="text-ink-400 mt-1 text-xs">
                        {format(new Date(league.startDate), "MMM d")} -{" "}
                        {format(new Date(league.endDate), "MMM d, yyyy")}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {league.divisions.map((d) => (
                        <span
                          key={d.id}
                          className="bg-play-50 text-play-700 rounded-full px-2 py-0.5 text-xs"
                        >
                          {d.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-play-700 text-lg font-bold">{league._count.teams}</div>
                    <div className="text-ink-500 text-xs">teams</div>
                    {league.teamFee && (
                      <div className="text-ink-400 mt-1 text-xs">
                        {formatCurrency(league.teamFee)}/team
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
