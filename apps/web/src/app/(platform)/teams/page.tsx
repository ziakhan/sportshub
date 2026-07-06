import Link from "next/link"
import { redirect } from "next/navigation"
import { prisma } from "@youthbasketballhub/db"
import { getCurrentUser } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

export const metadata = { title: "My Teams — SportsHub" }

/**
 * The sidebar's "My Teams" destination (players and team staff). Shows the
 * teams this account is connected to — as a player (13+ self-managed player
 * records use parentId = own user id) and as team staff — each linking to
 * the public team hub and, for staff, the team's management dashboard.
 */
export default async function MyTeamsPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")

  const [playerRows, staffRoles] = await Promise.all([
    (prisma as any).player.findMany({
      where: { parentId: user.id, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        teams: {
          where: { status: "ACTIVE" },
          select: {
            jerseyNumber: true,
            team: {
              select: {
                id: true,
                name: true,
                ageGroup: true,
                tenant: { select: { name: true, branding: { select: { primaryColor: true } } } },
              },
            },
          },
        },
      },
    }),
    (prisma as any).userRole.findMany({
      where: { userId: user.id, teamId: { not: null } },
      select: {
        role: true,
        designation: true,
        team: {
          select: {
            id: true,
            name: true,
            ageGroup: true,
            tenantId: true,
            tenant: { select: { name: true, branding: { select: { primaryColor: true } } } },
          },
        },
      },
    }),
  ])

  const playing = playerRows.flatMap((p: any) =>
    p.teams.map((tp: any) => ({
      key: `${p.id}-${tp.team.id}`,
      team: tp.team,
      jersey: tp.jerseyNumber,
      who: `${p.firstName} ${p.lastName}`,
    }))
  )
  const staffing = staffRoles.filter((r: any) => r.team)

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="border-ink-100 shadow-soft rounded-[28px] border bg-white p-6 sm:p-8">
        <div className="border-play-100 bg-play-50 text-play-600 mb-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
          Teams
        </div>
        <h1 className="font-display text-ink-950 text-3xl font-bold">My teams</h1>
        <p className="text-ink-500 mt-1 text-sm">
          Every team you play on or work with — schedules, results and stats live on each team&apos;s page.
        </p>
      </div>

      {playing.length === 0 && staffing.length === 0 ? (
        <div className="border-ink-300 shadow-soft rounded-2xl border border-dashed bg-white p-10 text-center">
          <h3 className="font-display text-ink-950 text-xl font-semibold">No teams yet</h3>
          <p className="text-ink-500 mx-auto mb-5 mt-2 max-w-lg text-sm">
            Once you join a roster — through an accepted offer or a program registration — your
            teams show up here automatically.
          </p>
          <Link
            href="/events"
            className="bg-play-600 hover:bg-play-700 inline-flex rounded-xl px-6 py-3 text-sm font-semibold text-white transition"
          >
            Browse programs
          </Link>
        </div>
      ) : (
        <>
          {playing.length > 0 && (
            <section>
              <h2 className="text-ink-950 mb-3 px-1 text-lg font-bold">Playing</h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {playing.map((row: any) => (
                  <Link
                    key={row.key}
                    href={`/team/${row.team.id}`}
                    className="border-ink-100 shadow-soft hover:border-play-200 group flex items-center gap-4 rounded-2xl border bg-white p-5 transition"
                  >
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                      style={{ backgroundColor: row.team.tenant?.branding?.primaryColor || "#4f46e5" }}
                    >
                      {row.jersey ?? row.team.name.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-ink-950 group-hover:text-play-600 block truncate font-semibold transition-colors">
                        {row.team.name}
                      </span>
                      <span className="text-ink-500 block truncate text-sm">
                        {[row.who, row.team.tenant?.name, row.team.ageGroup].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="text-play-600 shrink-0 text-sm font-semibold">
                      Team page &rarr;
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {staffing.length > 0 && (
            <section>
              <h2 className="text-ink-950 mb-3 px-1 text-lg font-bold">Coaching &amp; staff</h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {staffing.map((r: any, i: number) => (
                  <div
                    key={`${r.team.id}-${i}`}
                    className="border-ink-100 shadow-soft flex items-center gap-4 rounded-2xl border bg-white p-5"
                  >
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                      style={{ backgroundColor: r.team.tenant?.branding?.primaryColor || "#4f46e5" }}
                    >
                      {r.team.name.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-ink-950 block truncate font-semibold">{r.team.name}</span>
                      <span className="text-ink-500 block truncate text-sm">
                        {[r.designation || r.role, r.team.tenant?.name, r.team.ageGroup]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="flex shrink-0 gap-3 text-sm font-semibold">
                      <Link
                        href={`/clubs/${r.team.tenantId}/teams/${r.team.id}/dashboard`}
                        className="text-ink-600 hover:text-ink-950"
                      >
                        Manage
                      </Link>
                      <Link href={`/team/${r.team.id}`} className="text-play-600 hover:text-play-700">
                        Public page
                      </Link>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
