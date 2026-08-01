import { prisma } from "@youthbasketballhub/db"
import { notFound, redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"
import { SmartBack } from "@/components/ui"
import { PlannerWorkspace } from "./planner-workspace"

export const dynamic = "force-dynamic"

/**
 * Org capacity planner v1 (owner 2026-08-01): "throw all the courts into a
 * mix" — every league under the operator, one pool of courts, what-if
 * levers, does-it-all-fit verdict. Pure simulation; nothing is saved.
 */
export default async function OrgPlannerPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")

  const org = await (prisma as any).organization.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      leagues: {
        select: {
          id: true,
          name: true,
          ownerId: true,
          seasons: {
            select: {
              id: true,
              label: true,
              status: true,
              _count: { select: { sessions: true, teamSubmissions: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { name: "asc" },
      },
    },
  })
  if (!org) notFound()

  const isAdmin =
    user.roles.some((r: any) => r.role === "PlatformAdmin") ||
    org.leagues.some((l: any) => l.ownerId === user.id) ||
    (await prisma.userRole.findFirst({
      where: {
        userId: user.id,
        role: { in: ["LeagueOwner", "LeagueManager"] },
        leagueId: { in: org.leagues.map((l: any) => l.id) },
      },
      select: { id: true },
    })) !== null
  if (!isAdmin) redirect("/dashboard")

  // The court pool: every venue/court any of this org's seasons touches.
  const seasonIds = org.leagues.flatMap((l: any) => l.seasons.map((s: any) => s.id))
  const dayVenues = await (prisma as any).seasonSessionDayVenue.findMany({
    where: { day: { session: { seasonId: { in: seasonIds } } } },
    select: {
      venue: { select: { id: true, name: true } },
      courts: { select: { court: { select: { id: true, name: true } } } },
    },
  })
  const courtPool = new Map<string, { courtId: string; court: string; venue: string }>()
  for (const dv of dayVenues) {
    for (const c of dv.courts) {
      if (!c.court) continue
      courtPool.set(c.court.id, {
        courtId: c.court.id,
        court: c.court.name,
        venue: dv.venue?.name ?? "",
      })
    }
  }

  const seasons = org.leagues.flatMap((l: any) =>
    l.seasons
      .filter((s: any) => s._count.sessions > 0 && s._count.teamSubmissions > 0)
      .map((s: any) => ({
        id: s.id,
        label: `${l.name} · ${s.label}`,
        status: s.status,
      }))
  )

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <SmartBack fallback={`/manage/org/${org.id}`} fallbackLabel="Organization" />
      <h1 className="text-ink-900 mt-3 text-2xl font-bold">Capacity planner — {org.name}</h1>
      <p className="text-ink-500 mt-1 max-w-2xl text-sm">
        Every league, every court, one pool. Run the whole organization&apos;s schedules together —
        earlier runs book their courts, later runs schedule around them — then pull the levers:
        hold courts free, shrink the day, compact games. Pure simulation, nothing is saved.
      </p>
      {seasons.length === 0 ? (
        <p className="text-ink-500 mt-6 text-sm">
          No schedulable seasons yet — a season needs sessions and registered teams to join the
          pool.
        </p>
      ) : (
        <PlannerWorkspace
          orgId={org.id}
          seasons={seasons}
          courts={[...courtPool.values()].sort(
            (a, b) => a.venue.localeCompare(b.venue) || a.court.localeCompare(b.court)
          )}
        />
      )}
    </div>
  )
}
