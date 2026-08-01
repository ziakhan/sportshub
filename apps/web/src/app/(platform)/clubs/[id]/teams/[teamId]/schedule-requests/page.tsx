import { prisma } from "@youthbasketballhub/db"
import { notFound } from "next/navigation"
import { SmartBack } from "@/components/ui"
import { ScheduleRequestManager } from "./schedule-request-manager"

/**
 * Club-side schedule requests (owner 2026-08-01): ONLY visible for
 * submissions where the league enabled the feature. A very limited preset
 * menu — early Sunday, late Saturday, or a blackout date — approval
 * required, best effort, never guaranteed.
 */
export default async function ScheduleRequestsPage({
  params,
  searchParams,
}: {
  params: { id: string; teamId: string }
  searchParams: { submission?: string }
}) {
  const team = (await prisma.team.findFirst({
    where: { id: params.teamId, tenantId: params.id },
    select: { id: true, name: true },
  })) as any
  if (!team) notFound()

  const submissions = (await (prisma as any).teamSubmission.findMany({
    where: { teamId: params.teamId, scheduleRequestsEnabled: true, status: "APPROVED" },
    select: {
      id: true,
      season: {
        select: { id: true, label: true, status: true, league: { select: { name: true } } },
      },
      scheduleRequests: {
        select: {
          id: true,
          kind: true,
          status: true,
          dayOfWeek: true,
          date: true,
          earliestStart: true,
          latestStart: true,
          startTime: true,
          endTime: true,
          reason: true,
          decisionNote: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  })) as any[]

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <SmartBack
        fallback={`/clubs/${params.id}/teams/${params.teamId}/dashboard`}
        fallbackLabel="Team dashboard"
      />
      <h1 className="text-ink-900 mt-3 text-2xl font-bold">Schedule requests — {team.name}</h1>
      <p className="text-ink-500 mt-1 text-sm">
        Ask the league for a friendlier weekend shape — an early Sunday game, a later Saturday
        start, or a date your team can&apos;t play. Every request needs the league&apos;s approval,
        and approved requests are honored on a <strong>best-effort basis — never guaranteed</strong>,
        starting the next time the league generates its schedule.
      </p>
      {submissions.length === 0 ? (
        <p className="text-ink-500 mt-6 text-sm">
          Schedule requests aren&apos;t enabled for this team in any league yet — ask your league to
          turn them on.
        </p>
      ) : (
        <ScheduleRequestManager
          submissions={submissions.map((s) => ({
            id: s.id,
            leagueLabel: `${s.season.league.name} · ${s.season.label}`,
            requests: s.scheduleRequests.map((r: any) => ({
              ...r,
              date: r.date ? new Date(r.date).toISOString() : null,
              createdAt: new Date(r.createdAt).toISOString(),
            })),
          }))}
          highlight={searchParams.submission}
        />
      )}
    </div>
  )
}
