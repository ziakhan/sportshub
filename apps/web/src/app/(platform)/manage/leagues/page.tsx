"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { StatTile, AnimatedNumber, Button } from "@/components/ui"

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

const ACTIVE_STATUSES = new Set(["REGISTRATION", "REGISTRATION_CLOSED", "IN_PROGRESS"])

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

  const totalSeasons = leagues.reduce((a, l) => a + l._count.seasons, 0)
  const activeLeagues = leagues.filter(
    (l) => l.seasons[0] && ACTIVE_STATUSES.has(l.seasons[0].status)
  ).length

  return (
    <div className="font-barlow space-y-6">
      <div className="reveal border-ink-100 shadow-soft rounded-[28px] border bg-white p-6 sm:p-8">
        <div className="border-[color:var(--brand-line)] bg-[var(--brand-soft)] text-[color:var(--brand-ink)] mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
          Leagues
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-ink-950 text-3xl font-bold">My leagues</h1>
            <p className="text-ink-500 mt-1 text-sm">Manage your leagues and their seasons</p>
          </div>
          <Button href="/manage/leagues/create" icon={ICONS.plus}>
            Create League
          </Button>
        </div>
      </div>

      {leagues.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile value={leagues.length} label="Leagues" tone="brand" icon={ICONS.trophy} delay={0} />
          <StatTile value={totalSeasons} label="Seasons" tone="court" icon={ICONS.calendar} delay={70} />
          <StatTile value={activeLeagues} label="Active" tone="play" icon={ICONS.activity} delay={140} />
        </div>
      )}

      {leagues.length === 0 ? (
        <div className="border-ink-300 shadow-soft rounded-2xl border border-dashed bg-white p-12 text-center">
          <h3 className="font-display text-ink-950 mb-2 text-lg font-semibold">No leagues yet</h3>
          <p className="text-ink-600 mb-6">Create your first league to get started.</p>
          <div className="inline-flex">
            <Button href="/manage/leagues/create" icon={ICONS.plus}>
              Create Your First League
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {leagues.map((league, i) => {
            const latest = league.seasons[0]
            const latestStatus = latest
              ? STATUS_LABELS[latest.status] || STATUS_LABELS.DRAFT
              : null
            return (
              <Link
                key={league.id}
                href={`/manage/leagues/${league.id}`}
                style={{ animationDelay: `${i * 60}ms` }}
                className="reveal border-ink-100 shadow-soft hover:border-[color:var(--brand-line)] hover:bg-[var(--brand-softer)] block rounded-2xl border bg-white p-6 transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
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
                    <div className="text-[color:var(--brand-ink)] font-condensed text-2xl font-bold leading-none">
                      <AnimatedNumber value={league._count.seasons} />
                    </div>
                    <div className="text-ink-500 mt-1 text-xs">
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

const ICONS: Record<string, React.ReactNode> = {
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  ),
  trophy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path
        d="M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0V4zM7 6H4v2a3 3 0 003 3M17 6h3v2a3 3 0 01-3 3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
    </svg>
  ),
  activity: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
}
