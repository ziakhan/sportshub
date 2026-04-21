"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

interface Season {
  id: string
  label: string
  status: string
  startDate: string | null
  endDate: string | null
  _count: { teamSubmissions: number; games: number; divisions: number }
}

interface League {
  id: string
  name: string
  description: string | null
  seasons: Season[]
  _count: { seasons: number }
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
            <p className="text-ink-500 mt-1 text-sm">Manage your leagues and their seasons</p>
          </div>
          <Link
            href="/leagues/create"
            className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white"
          >
            Create League
          </Link>
        </div>
      </div>

      {leagues.length === 0 ? (
        <div className="border-ink-300 shadow-soft rounded-2xl border border-dashed bg-white p-12 text-center">
          <h3 className="font-display text-ink-950 mb-2 text-lg font-semibold">No leagues yet</h3>
          <p className="text-ink-600 mb-6">Create your first league to get started.</p>
          <Link
            href="/leagues/create"
            className="bg-play-600 hover:bg-play-700 inline-block rounded-xl px-6 py-2 text-sm font-semibold text-white"
          >
            Create Your First League
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {leagues.map((league) => {
            const latest = league.seasons[0]
            const latestStatus = latest
              ? STATUS_LABELS[latest.status] || STATUS_LABELS.DRAFT
              : null
            return (
              <Link
                key={league.id}
                href={`/leagues/${league.id}`}
                className="border-ink-100 shadow-soft hover:border-play-200 hover:bg-play-50 block rounded-2xl border bg-white p-6 transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <h3 className="text-ink-950 text-lg font-semibold">{league.name}</h3>
                      {latestStatus && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${latestStatus.color}`}
                        >
                          {latest!.label}: {latestStatus.label}
                        </span>
                      )}
                    </div>
                    {league.description && (
                      <p className="text-ink-500 text-sm">{league.description}</p>
                    )}
                    {league.owner && (
                      <p className="text-ink-400 text-xs">
                        Owner: {league.owner.name} ({league.owner.email})
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-play-700 text-lg font-bold">{league._count.seasons}</div>
                    <div className="text-ink-500 text-xs">
                      season{league._count.seasons === 1 ? "" : "s"}
                    </div>
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
