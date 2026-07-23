import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getChatMembership } from "@/lib/teams/chat-access"
import { getTeamRoster } from "@/lib/teams/roster"
import { SmartBack } from "@/components/ui"

export const dynamic = "force-dynamic"

export const metadata = { title: "Team home — SportsHub" }

/**
 * The coach/staff TEAM HOME (owner 2026-07-15): where "My Team" lands.
 * Clean and team-scoped — no club-workspace chrome, no breadcrumbs into
 * the club dashboard. Schedule, chat, polls, roster; club operators get a
 * quiet link into the management view, everyone else never sees it.
 * Family members are forwarded to the public team page.
 */
export default async function TeamHomePage({ params }: { params: { teamId: string } }) {
  const auth = await getSessionUserId()
  if (!auth) redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/teams/${params.teamId}`)}`)

  const membership = await getChatMembership(params.teamId, auth.userId, auth.isPlatformAdmin)
  if (!membership) notFound()
  if (membership.role === "family") redirect(`/team/${params.teamId}`)

  const now = new Date()
  const [team, roster, games, practices, operatorRole, pendingRequests] = await Promise.all([
    prisma.team.findUnique({
      where: { id: params.teamId },
      select: { id: true, name: true, ageGroup: true, gender: true },
    }),
    getTeamRoster(params.teamId, { activeOnly: true }),
    prisma.game.findMany({
      where: {
        OR: [{ homeTeamId: params.teamId }, { awayTeamId: params.teamId }],
        scheduledAt: { gte: now },
        status: { not: "CANCELLED" },
      },
      select: {
        id: true,
        scheduledAt: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        venue: { select: { name: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 3,
    }),
    prisma.practice.findMany({
      where: { teamId: params.teamId, scheduledAt: { gte: now }, status: "SCHEDULED" },
      select: { id: true, scheduledAt: true, location: true, venue: { select: { name: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 3,
    }),
    prisma.userRole.findFirst({
      where: {
        userId: auth.userId,
        tenantId: membership.tenantId,
        role: { in: ["ClubOwner", "ClubManager"] },
      },
      select: { id: true },
    }),
    (prisma as any).teamSubmissionRequest.findMany({
      where: { teamId: params.teamId, status: "PENDING" },
      select: {
        id: true,
        createdAt: true,
        season: { select: { label: true, league: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ])
  if (!team) notFound()

  const upcoming = [
    ...games.map((g: any) => ({
      key: `g-${g.id}`,
      at: g.scheduledAt as Date,
      title: `${g.homeTeam.name} vs ${g.awayTeam.name}`,
      where: g.venue?.name ?? null,
      kind: "Game",
    })),
    ...practices.map((p: any) => ({
      key: `p-${p.id}`,
      at: p.scheduledAt as Date,
      title: "Practice",
      where: p.venue?.name ?? p.location ?? null,
      kind: "Practice",
    })),
  ]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, 4)

  const fmt = (d: Date) =>
    d.toLocaleString("en-CA", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })

  // UX audit 2026-07-18 (no-redundant-nav): on phones the bottom tabs
  // already reach Chat/Calendar/this screen — those tiles hide below sm.
  // Desktop (no tab bar) keeps all five.
  const actions = [
    {
      href: `/teams/${team.id}/calendar`,
      title: "Calendar & RSVPs",
      detail: "Schedule, attendance roll-ups, practice planning",
      phoneRedundant: true,
    },
    {
      href: `/teams/${team.id}/chat`,
      title: "Team chat",
      detail: "Message families and staff",
      phoneRedundant: true,
    },
    {
      href: `/teams/${team.id}/polls`,
      title: "Polls",
      detail: "Votes and quick decisions",
      phoneRedundant: true,
    },
    { href: `/team/${team.id}`, title: "Public team page", detail: "What families and fans see" },
    {
      href: `/browse-leagues?team=${team.id}`,
      title: "Register for a league",
      detail: "Pick a league and roster — your club approves before it's submitted",
    },
  ]

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6 lg:max-w-5xl">
      <SmartBack fallback="/teams" fallbackLabel="My teams" className="-ml-1" />
      <div className="border-ink-100 shadow-soft rounded-[28px] border bg-white p-6 sm:p-8">
        <div className="border-play-100 bg-play-50 text-play-600 mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
          My team
        </div>
        <h1 className="font-display text-ink-950 text-3xl font-bold">{team.name}</h1>
        <p className="text-ink-500 mt-1 text-sm">
          {[membership.clubName, team.ageGroup, team.gender].filter(Boolean).join(" · ")}
        </p>
        {(auth.isPlatformAdmin || operatorRole) && (
          <Link
            href={`/clubs/${membership.tenantId}/teams/${team.id}/dashboard`}
            className="text-ink-400 hover:text-ink-600 mt-3 inline-block text-xs font-medium underline-offset-2 hover:underline"
          >
            Club management view &rarr;
          </Link>
        )}
      </div>

      {(pendingRequests as any[]).length > 0 && (
        <div className="border-gold-100 bg-gold-50 rounded-2xl border p-4">
          {(pendingRequests as any[]).map((r: any) => (
            <p key={r.id} className="text-gold-600 text-sm font-medium">
              League registration waiting on your club:{" "}
              {r.season?.league?.name ?? "league"} — {r.season?.label}
            </p>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className={`border-ink-100 shadow-soft hover:border-play-200 group rounded-2xl border bg-white p-5 transition ${
              (a as { phoneRedundant?: boolean }).phoneRedundant ? "hidden sm:block" : ""
            }`}
          >
            <p className="text-ink-950 group-hover:text-play-600 font-semibold transition-colors">
              {a.title}
            </p>
            <p className="text-ink-500 mt-1 text-sm">{a.detail}</p>
          </Link>
        ))}
      </div>

      {upcoming.length > 0 && (
        <section className="border-ink-100 shadow-soft rounded-2xl border bg-white p-5">
          <h2 className="text-ink-950 mb-3 text-lg font-bold">Coming up</h2>
          <ul className="divide-ink-100 divide-y">
            {upcoming.map((e) => (
              <li key={e.key} className="flex items-center gap-3 py-2.5">
                <span className="bg-play-50 text-play-700 w-14 shrink-0 rounded-lg px-2 py-1 text-center text-[11px] font-bold uppercase">
                  {e.kind}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-ink-950 block truncate text-sm font-medium">{e.title}</span>
                  <span className="text-ink-500 block truncate text-xs">
                    {fmt(e.at)}
                    {e.where ? ` · ${e.where}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <Link
            href={`/teams/${team.id}/calendar`}
            className="text-play-600 hover:text-play-700 mt-3 inline-block text-sm font-semibold"
          >
            Full calendar &rarr;
          </Link>
        </section>
      )}

      <section className="border-ink-100 shadow-soft rounded-2xl border bg-white p-5">
        <h2 className="text-ink-950 mb-3 text-lg font-bold">
          Roster{roster.length > 0 ? ` (${roster.length})` : ""}
        </h2>
        {roster.length === 0 ? (
          <p className="text-ink-500 text-sm">No active players yet.</p>
        ) : (
          <ul className="divide-ink-100 divide-y">
            {roster.map((r: any) => (
              <li key={r.player.id} className="flex items-center gap-3 py-2">
                <span className="bg-ink-50 text-ink-600 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold">
                  {r.jerseyNumber ?? "–"}
                </span>
                <span className="text-ink-950 min-w-0 flex-1 truncate text-sm font-medium">
                  {r.player.firstName} {r.player.lastName}
                </span>
                {r.player.position && (
                  <span className="text-ink-400 shrink-0 text-xs">{r.player.position}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
