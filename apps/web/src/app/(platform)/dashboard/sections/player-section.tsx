import Link from "next/link"
import { StatTile, Button, PanelHeader } from "@/components/ui"
import type { DashboardData } from "../get-dashboard-data"

interface PlayerSectionProps {
  data: NonNullable<DashboardData["player"]>
}

export function PlayerSection({ data }: PlayerSectionProps) {
  const averagePoints =
    data.stats.length > 0
      ? Math.round(data.stats.reduce((sum, stat) => sum + stat.points, 0) / data.stats.length)
      : 0

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-condensed text-ink-950 text-2xl font-bold uppercase tracking-wide">
            Player dashboard
          </h2>
          <p className="text-ink-500 mt-1 text-sm">
            Your teams, upcoming fixtures, and latest stat line.
          </p>
        </div>
        <Button href="/settings/profile" variant="subtle" icon={EDIT_ICON}>
          Edit profile
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          value={data.teams.length}
          label="Teams"
          tone="court"
          icon={<IconUsers className="h-5 w-5" />}
          delay={0}
        />
        <StatTile
          value={data.upcomingGames.length}
          label="Upcoming games"
          tone="play"
          icon={<IconCalendar className="h-5 w-5" />}
          delay={70}
        />
        <StatTile
          value={data.stats.length}
          label="Recent stat lines"
          tone="hoop"
          icon={<IconChart className="h-5 w-5" />}
          delay={140}
        />
        <StatTile
          value={averagePoints}
          label="Avg points"
          tone="gold"
          icon={<IconTarget className="h-5 w-5" />}
          delay={210}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div
          className="reveal border-ink-100 shadow-soft rounded-2xl border bg-white p-6"
          style={{ animationDelay: "260ms" }}
        >
          <PanelHeader
            title="My teams"
            action={
              <span className="text-ink-400 text-xs uppercase tracking-[0.12em]">Current season</span>
            }
          />
          {data.teams.length > 0 ? (
            <ul className="space-y-3">
              {data.teams.map((team) => (
                <li key={team.id}>
                  <Link
                    href={`/team/${team.id}`}
                    className="border-ink-100 bg-ink-50 hover:border-[color:var(--brand-line)] hover:bg-[var(--brand-soft)] block rounded-xl border p-4 transition-all duration-200 hover:translate-x-0.5"
                  >
                    <p className="text-ink-900 font-semibold">{team.name}</p>
                    <p className="text-ink-500 mt-1 text-sm">
                      {team.ageGroup} · {team.club}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-500 text-sm">
              You have not been added to a team yet.{" "}
              <Link
                href="/events"
                className="font-semibold text-[color:var(--brand-ink)] hover:underline"
              >
                Browse programs &rarr;
              </Link>
            </p>
          )}
        </div>

        <div className="space-y-6">
          <div
            className="reveal border-ink-100 shadow-soft rounded-2xl border bg-white p-6"
            style={{ animationDelay: "320ms" }}
          >
            <PanelHeader title="Upcoming games" />
            {data.upcomingGames.length > 0 ? (
              <ul className="space-y-3">
                {data.upcomingGames.map((game) => (
                  <li key={game.id}>
                    <Link
                      href={`/live/${game.id}`}
                      className="border-ink-100 bg-ink-50 hover:border-[color:var(--brand-line)] hover:bg-[var(--brand-soft)] block rounded-xl border p-4 transition-all duration-200 hover:translate-x-0.5"
                    >
                      <p className="text-ink-900 font-semibold">
                        {game.homeTeam} vs {game.awayTeam}
                      </p>
                      <p className="text-ink-500 mt-1 text-sm">
                        {new Date(game.scheduledAt).toLocaleDateString()} · {game.location || "TBD"}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-500 text-sm">
                No upcoming games scheduled yet.{" "}
                <Link
                  href="/scores"
                  className="font-semibold text-[color:var(--brand-ink)] hover:underline"
                >
                  League scoreboard &rarr;
                </Link>
              </p>
            )}
          </div>

          <div
            className="reveal border-ink-100 shadow-soft rounded-2xl border bg-white p-6"
            style={{ animationDelay: "380ms" }}
          >
            <PanelHeader title="Recent stat lines" />
            {data.stats.length > 0 ? (
              <div className="space-y-3">
                {data.stats.slice(0, 3).map((stat) => (
                  <div key={stat.id} className="border-ink-100 bg-ink-50 rounded-xl border p-4">
                    <StatRow label="Points" value={stat.points} strong />
                    <StatRow label="Rebounds" value={stat.rebounds} />
                    <StatRow label="Assists" value={stat.assists} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-ink-500 text-sm">No stats recorded yet.</p>
            )}
            <Link
              href="/players"
              className="mt-4 inline-flex text-sm font-semibold text-[color:var(--brand-ink)] hover:underline"
            >
              Full stats &amp; game logs &rarr;
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

const EDIT_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

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

function IconTarget({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}

function StatRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-500">{label}</span>
      <span
        className={
          strong
            ? "font-condensed text-base font-bold text-[color:var(--brand-ink)]"
            : "text-ink-900 font-semibold"
        }
      >
        {value}
      </span>
    </div>
  )
}
