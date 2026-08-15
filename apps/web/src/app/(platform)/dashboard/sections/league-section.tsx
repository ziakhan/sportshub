import type { ReactNode } from "react"
import Link from "next/link"
import type { DashboardData } from "../get-dashboard-data"
import {
  StatTile,
  AnimatedNumber,
  Button,
  Badge,
  toneForStatus,
  railForStatus,
} from "@/components/ui"
import { seasonStatusLabel } from "@/lib/leagues/season-progress"

interface LeagueSectionProps {
  data: NonNullable<DashboardData["leagueOwner"]>
}

export function LeagueSection({ data }: LeagueSectionProps) {
  const totalTeams = data.leagues.reduce((sum, league) => sum + league._count.teams, 0)
  const totalGames = data.leagues.reduce((sum, league) => sum + league._count.games, 0)

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-ink-950 text-2xl font-bold">League operations</h2>
          <p className="text-ink-500 mt-1 text-sm">Track teams, fixtures, and season activity.</p>
        </div>
        {data.leagues.length > 0 && (
          <Button
            href={`/manage/leagues/${data.leagues[0].leagueId}`}
            variant="subtle"
            icon={ACTION_ICONS.pencil}
          >
            Edit League
          </Button>
        )}
      </div>

      {data.leagues.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label="Live now"
              value={data.liveNow}
              tone="hoop"
              icon={<IconChart className="h-5 w-5" />}
              delay={0}
            />
            <StatTile
              label="Games this week"
              value={data.gamesThisWeek}
              tone="brand"
              icon={<IconCalendar className="h-5 w-5" />}
              delay={70}
            />
            <StatTile
              label="Rosters awaiting approval"
              value={data.pendingSubmissions}
              tone="court"
              icon={<IconUsers className="h-5 w-5" />}
              delay={140}
            />
            <StatTile
              label="Teams"
              value={totalTeams}
              tone="ink"
              icon={<IconTrophy className="h-5 w-5" />}
              delay={210}
            />
          </div>

          {/* Whole card is the link (parity of affordance, 2026-08-14): a
              status-tinted rail + pill say where the season is, the chevron
              says it opens. No nested control inside the link. */}
          <div className="grid gap-4 lg:grid-cols-2">
            {data.leagues.map((league, i) => (
              <Link
                key={league.id}
                href={`/manage/leagues/${league.leagueId}/seasons/${league.id}/manage`}
                className="reveal border-ink-100 shadow-soft card-lift group relative block overflow-hidden rounded-3xl border bg-white p-5 pl-6 transition-colors hover:border-[color:var(--brand-line)]"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <span
                  aria-hidden
                  className={`absolute inset-y-0 left-0 w-1.5 ${railForStatus(league.status)}`}
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-ink-950 font-semibold">{league.name}</h3>
                    <p className="text-ink-500 mt-1 text-sm">{league.season}</p>
                  </div>
                  <Badge tone={toneForStatus(league.status)}>
                    {seasonStatusLabel(league.status)}
                  </Badge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="bg-ink-50 rounded-xl p-3">
                    <p className="text-ink-400 text-xs uppercase tracking-[0.1em]">Teams</p>
                    <p className="font-condensed text-ink-900 mt-1 text-2xl font-bold leading-none">
                      <AnimatedNumber value={league._count.teams} />
                    </p>
                  </div>
                  <div className="bg-ink-50 rounded-xl p-3">
                    <p className="text-ink-400 text-xs uppercase tracking-[0.1em]">Games</p>
                    <p className="font-condensed text-ink-900 mt-1 text-2xl font-bold leading-none">
                      <AnimatedNumber value={league._count.games} />
                    </p>
                  </div>
                </div>

                <div className="border-ink-100 mt-4 flex items-center justify-between border-t pt-4">
                  <span className="text-ink-400 text-xs uppercase tracking-[0.12em]">
                    League workspace
                  </span>
                  <span className="text-ink-700 group-hover:text-[color:var(--brand-ink)] inline-flex items-center gap-1.5 text-sm font-semibold transition">
                    Open
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <div className="reveal border-ink-300 shadow-soft rounded-3xl border border-dashed bg-white p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[color:var(--brand-ink)]">
            <IconTrophy className="h-5 w-5" />
          </div>
          <h3 className="font-display text-ink-950 text-xl font-semibold">
            Create your first league
          </h3>
          <p className="text-ink-500 mx-auto mb-5 mt-2 max-w-xl text-sm">
            You&apos;ve signed up as a league organizer but haven&apos;t created a league yet. Get
            started now!
          </p>
          <div className="flex justify-center">
            <Button href="/manage/leagues/create" size="lg" icon={ACTION_ICONS.plus}>
              Create League
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

/** Unsized SVG icons for the kit Buttons (the Button sizes them per `size`). */
const ACTION_ICONS: Record<string, ReactNode> = {
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  ),
  pencil: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" strokeLinecap="round" />
      <path
        d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function IconChart({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M3 3v18h18" />
      <path d="m7 14 3-3 3 2 4-5" />
    </svg>
  )
}

function IconTrophy({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4z" />
      <path d="M17 6h2a2 2 0 0 1 0 4h-2" />
      <path d="M7 6H5a2 2 0 0 0 0 4h2" />
    </svg>
  )
}
