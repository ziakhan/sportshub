"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  StatTile,
  AnimatedNumber,
  Button,
  PanelHeader,
  CourtBackdropLayer,
  Badge,
  toneForStatus,
  railForStatus,
} from "@/components/ui"
import { seasonStatusLabel } from "@/lib/leagues/season-progress"
import { brandStyle, chosenBrandColor, NEUTRAL_BRAND } from "@/lib/club-page/brand"

interface Season {
  id: string
  label: string
  status: string
  startDate: string | null
  endDate: string | null
  _count: { teamSubmissions: number; games: number; divisions: number }
}

interface Organization {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  primaryColor: string | null
}

interface League {
  id: string
  name: string
  description: string | null
  seasons: Season[]
  organization?: Organization | null
  _count: { seasons: number }
  owner?: { name: string; email: string }
}

/** An organization plus the leagues of this operator that sit under it. */
interface OrgGroup {
  org: Organization
  leagues: League[]
  seasons: number
}

const ACTIVE_STATUSES = new Set(["REGISTRATION", "REGISTRATION_CLOSED", "IN_PROGRESS"])

/**
 * Group the operator's leagues by the organization that runs them, newest org
 * first in the order the leagues arrive. Presentation only: the same league
 * list is still rendered in full below (owner 2026-08-14 — organizations were
 * mixed into the middle of the league list and needed their own section).
 */
function groupByOrganization(leagues: League[]): OrgGroup[] {
  const groups = new Map<string, OrgGroup>()
  for (const league of leagues) {
    const org = league.organization
    if (!org) continue
    const existing = groups.get(org.id)
    if (existing) {
      existing.leagues.push(league)
      existing.seasons += league._count.seasons
    } else {
      groups.set(org.id, { org, leagues: [league], seasons: league._count.seasons })
    }
  }
  return Array.from(groups.values())
}

/** Two-letter crest fallback for an organization with no logo. */
function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
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

  const totalSeasons = leagues.reduce((a, l) => a + l._count.seasons, 0)
  const activeLeagues = leagues.filter(
    (l) => l.seasons[0] && ACTIVE_STATUSES.has(l.seasons[0].status)
  ).length
  const orgGroups = groupByOrganization(leagues)

  return (
    // `main` in the platform layout ships no padding, so the page owns its
    // gutters (same as the league dashboard) — without them the cards ran
    // flush into the viewport edge.
    <div className="font-barlow space-y-8 p-6 md:p-8">
      {/* Arena-night band: the one loud surface on this screen, the sections
          below stay calm (court system v2, screen 04). */}
      <div className="shadow-soft relative isolate overflow-hidden rounded-[30px]">
        <CourtBackdropLayer variant="navy" intensity="band" />
        <div className="relative z-10 p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-gold-400 mb-3 text-[11px] font-black uppercase tracking-[0.22em]">
                League operations
              </div>
              <h1 className="font-display text-3xl font-black tracking-[-0.02em] text-white sm:text-4xl">
                My leagues
              </h1>
              <p className="text-ink-200 mt-2 max-w-2xl text-sm sm:text-base">
                Your organizations and every league running under them.
              </p>
            </div>
            <Button href="/manage/leagues/create" tone="hoop" icon={ICONS.plus}>
              Create League
            </Button>
          </div>
        </div>
      </div>

      {leagues.length > 0 && (
        <div className={`grid gap-4 sm:grid-cols-2 ${orgGroups.length > 0 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          {orgGroups.length > 0 && (
            <StatTile
              value={orgGroups.length}
              label="Organizations"
              tone="ink"
              icon={ICONS.building}
              delay={0}
            />
          )}
          <StatTile value={leagues.length} label="Leagues" tone="brand" icon={ICONS.trophy} delay={70} />
          <StatTile value={totalSeasons} label="Seasons" tone="court" icon={ICONS.calendar} delay={140} />
          <StatTile value={activeLeagues} label="Active" tone="play" icon={ICONS.activity} delay={210} />
        </div>
      )}

      {orgGroups.length > 0 && (
        <section>
          <PanelHeader title={`Organizations (${orgGroups.length})`} />
          <p className="text-ink-500 -mt-2 mb-4 text-sm">
            Branding, rulebook and capacity for every league you run under them.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {orgGroups.map((group, i) => (
              <Link
                key={group.org.id}
                href={`/manage/org/${group.org.id}`}
                // Operator orgs are hand-created, never bulk-imported, so a
                // colour here really was chosen; one that is still the schema
                // default falls back to navy (owner ruling 2026-08-14).
                style={{
                  ...brandStyle(
                    chosenBrandColor({ primaryColor: group.org.primaryColor }) ?? NEUTRAL_BRAND
                  ),
                  animationDelay: `${i * 60}ms`,
                }}
                className="reveal shadow-soft relative overflow-hidden rounded-[24px] border border-[color:var(--brand-line)] bg-[var(--brand-softer)] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--brand)]"
              >
                <span aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-[var(--brand)]" />
                <div className="flex items-start gap-4">
                  {group.org.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={group.org.logoUrl}
                      alt=""
                      className="border-ink-100 h-14 w-14 shrink-0 rounded-2xl border bg-white object-contain p-1.5"
                    />
                  ) : (
                    <span className="font-condensed flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand)] text-xl font-bold tracking-wide text-[color:var(--brand-on)]">
                      {monogram(group.org.name)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[color:var(--brand-ink)] text-[11px] font-black uppercase tracking-[0.18em]">
                      Organization
                    </div>
                    <h3 className="font-display text-ink-950 mt-0.5 truncate text-xl font-bold">
                      {group.org.name}
                    </h3>
                    <p className="text-ink-500 mt-0.5 text-xs">
                      <AnimatedNumber value={group.leagues.length} /> league
                      {group.leagues.length === 1 ? "" : "s"} {"·"} {group.seasons} season
                      {group.seasons === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {group.leagues.slice(0, 4).map((l) => (
                    <span
                      key={l.id}
                      className="border-[color:var(--brand-line)] text-ink-700 rounded-full border bg-white px-2.5 py-1 text-xs font-medium"
                    >
                      {l.name}
                    </span>
                  ))}
                  {group.leagues.length > 4 && (
                    <span className="text-ink-500 rounded-full px-2.5 py-1 text-xs font-medium">
                      +{group.leagues.length - 4} more
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[color:var(--brand-line)] pt-3">
                  <span className="text-ink-400 text-xs uppercase tracking-[0.12em]">
                    Organization settings
                  </span>
                  <span className="text-[color:var(--brand-ink)] text-sm font-semibold">
                    Open &rarr;
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
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
        <section>
          <PanelHeader title={`Leagues (${leagues.length})`} />
          <p className="text-ink-500 -mt-2 mb-4 text-sm">
            Open a league for its seasons, teams and schedule.
          </p>
          <div className="space-y-4">
            {leagues.map((league, i) => {
              const latest = league.seasons[0]
              return (
                <Link
                  key={league.id}
                  href={`/manage/leagues/${league.id}`}
                  style={{ animationDelay: `${i * 60}ms` }}
                  className="reveal border-ink-100 shadow-soft hover:border-[color:var(--brand-line)] hover:bg-[var(--brand-softer)] group relative block overflow-hidden rounded-2xl border bg-white p-6 pl-7 transition-all duration-200 hover:-translate-y-0.5"
                >
                  {/* Status rail: the season the league is living in, read at
                      a glance before any text (2026-08-14 affordance pass). */}
                  <span
                    aria-hidden
                    className={`absolute inset-y-0 left-0 w-1.5 ${
                      latest ? railForStatus(latest.status) : "bg-ink-200"
                    }`}
                  />
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h3 className="text-ink-950 text-lg font-semibold">{league.name}</h3>
                        {latest && (
                          <Badge tone={toneForStatus(latest.status)}>
                            {latest.label}: {seasonStatusLabel(latest.status)}
                          </Badge>
                        )}
                      </div>
                      {league.organization && (
                        <p className="text-ink-400 mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em]">
                          <span
                            aria-hidden
                            className="h-2 w-2 rounded-full"
                            style={{
                              background:
                                chosenBrandColor({
                                  primaryColor: league.organization.primaryColor,
                                }) ?? NEUTRAL_BRAND,
                            }}
                          />
                          {league.organization.name}
                        </p>
                      )}
                      {league.description && (
                        <p className="text-ink-500 text-sm">{league.description}</p>
                      )}
                      {league.owner && (
                        <p className="text-ink-400 text-xs">
                          Owner: {league.owner.name} ({league.owner.email})
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <div className="text-right">
                        <div className="text-[color:var(--brand-ink)] font-condensed text-2xl font-bold leading-none">
                          <AnimatedNumber value={league._count.seasons} />
                        </div>
                        <div className="text-ink-500 mt-1 text-xs">
                          season{league._count.seasons === 1 ? "" : "s"}
                        </div>
                      </div>
                      <span className="border-ink-100 text-ink-400 group-hover:border-[color:var(--brand-line)] group-hover:text-[color:var(--brand-ink)] flex h-9 w-9 items-center justify-center rounded-full border transition">
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
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
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
  building: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M3 21h18M5 21V5a2 2 0 012-2h6a2 2 0 012 2v16M15 21V11h4a2 2 0 012 2v8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 7h2M9 11h2M9 15h2" strokeLinecap="round" />
    </svg>
  ),
}
