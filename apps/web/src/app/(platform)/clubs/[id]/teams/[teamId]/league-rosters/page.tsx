import { prisma } from "@youthbasketballhub/db"
import Link from "next/link"
import { notFound } from "next/navigation"
import { evaluateRosterEdit } from "@/lib/seasons/roster-policy"
import { Button } from "@/components/ui"
import { LeagueRosterManager } from "./league-roster-manager"

/**
 * The club's view of every league-submitted roster VERSION for this team —
 * exactly what each league sees, with lock state, plus edit / request-change
 * actions per the league's policy.
 */
export default async function LeagueRostersPage({
  params,
  searchParams,
}: {
  params: { id: string; teamId: string }
  searchParams: { submission?: string }
}) {
  const team = (await prisma.team.findFirst({
    where: { id: params.teamId, tenantId: params.id },
    select: {
      id: true,
      name: true,
      players: {
        where: { status: "ACTIVE" },
        select: {
          playerId: true,
          jerseyNumber: true,
          player: { select: { firstName: true, lastName: true, position: true } },
        },
        orderBy: { jerseyNumber: "asc" },
      },
    },
  })) as any
  if (!team) notFound()

  const submissions = (await prisma.teamSubmission.findMany({
    where: { teamId: params.teamId },
    select: {
      id: true,
      status: true,
      division: { select: { name: true } },
      season: {
        select: {
          id: true,
          label: true,
          status: true,
          rosterChangePolicy: true,
          rosterChangeDeadline: true,
          league: { select: { id: true, name: true } },
        },
      },
      roster: {
        select: {
          id: true,
          isLocked: true,
          submittedAt: true,
          lockedAt: true,
          players: {
            select: {
              playerId: true,
              jerseyNumber: true,
              position: true,
              player: { select: { firstName: true, lastName: true } },
            },
            orderBy: { jerseyNumber: "asc" },
          },
          changeRequests: {
            select: { id: true, status: true, message: true, createdAt: true, resolutionNote: true },
            orderBy: { createdAt: "desc" },
            take: 3,
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })) as any[]

  const clubRoster = team.players.map((tp: any) => ({
    playerId: tp.playerId,
    name: `${tp.player.firstName} ${tp.player.lastName}`,
    jerseyNumber: tp.jerseyNumber,
    position: tp.player.position,
  }))

  // League-waiver status per player (owner 2026-07-20): staff see who has
  // signed each league's required waivers straight on the roster.
  const leagueIds = Array.from(
    new Set(submissions.map((s) => s.season.league.id).filter(Boolean))
  )
  const rosterPlayerIds = Array.from(
    new Set(
      submissions.flatMap((s) => (s.roster?.players ?? []).map((p: any) => p.playerId))
    )
  )
  const requiredWaivers =
    leagueIds.length > 0
      ? await (prisma as any).waiverDocument.findMany({
          where: { leagueId: { in: leagueIds }, active: true, required: true },
          select: { id: true, leagueId: true, version: true },
        })
      : []
  const waiverSignatures =
    requiredWaivers.length > 0 && rosterPlayerIds.length > 0
      ? await (prisma as any).waiverSignature.findMany({
          where: {
            playerId: { in: rosterPlayerIds },
            waiverId: { in: requiredWaivers.map((w: any) => w.id) },
            OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
          },
          select: { playerId: true, waiverId: true, waiverVersion: true },
        })
      : []
  const signedKeys = new Set(
    waiverSignatures
      .filter((s: any) => {
        const w = requiredWaivers.find((w: any) => w.id === s.waiverId)
        return w && s.waiverVersion === w.version
      })
      .map((s: any) => `${s.waiverId}:${s.playerId}`)
  )
  const waiverStatusFor = (leagueId: string, playerId: string) => {
    const waivers = requiredWaivers.filter((w: any) => w.leagueId === leagueId)
    const outstanding = waivers.filter(
      (w: any) => !signedKeys.has(`${w.id}:${playerId}`)
    ).length
    return { waiversTotal: waivers.length, waiversOutstanding: outstanding }
  }

  const versions = submissions
    .filter((s) => s.roster)
    .map((s) => {
      const editability = evaluateRosterEdit({
        isLocked: s.roster.isLocked,
        policy: s.season.rosterChangePolicy,
        deadline: s.season.rosterChangeDeadline,
      })
      return {
        submissionId: s.id,
        submissionStatus: s.status,
        leagueName: s.season.league.name,
        seasonId: s.season.id,
        seasonLabel: s.season.label,
        divisionName: s.division?.name ?? null,
        policy: s.season.rosterChangePolicy,
        deadline: s.season.rosterChangeDeadline
          ? s.season.rosterChangeDeadline.toISOString()
          : null,
        isLocked: s.roster.isLocked,
        submittedAt: s.roster.submittedAt ? s.roster.submittedAt.toISOString() : null,
        canEdit: editability.canEdit,
        canRequest: editability.canRequest,
        reason: editability.reason,
        players: s.roster.players.map((p: any) => ({
          playerId: p.playerId,
          name: `${p.player.firstName} ${p.player.lastName}`,
          jerseyNumber: p.jerseyNumber,
          position: p.position,
          ...waiverStatusFor(s.season.league.id, p.playerId),
        })),
        requests: s.roster.changeRequests.map((r: any) => ({
          id: r.id,
          status: r.status,
          message: r.message,
          createdAt: r.createdAt.toISOString(),
          resolutionNote: r.resolutionNote,
        })),
      }
    })

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/clubs/${params.id}/teams/${params.teamId}/dashboard`}
          className="text-play-700 text-sm hover:underline"
        >
          &larr; Back to Team Dashboard
        </Link>
      </div>

      <div className="reveal mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-condensed text-ink-950 text-2xl font-bold uppercase tracking-wide">
            {team.name} — League Rosters
          </h2>
          <p className="text-ink-500 mt-1 text-sm">
            Each league only sees the version you submitted to it — your club roster of{" "}
            {clubRoster.length} stays yours.
          </p>
        </div>
        <Button
          href={`/browse-leagues?team=${params.teamId}`}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          }
        >
          Add this team to a league
        </Button>
      </div>

      {versions.length === 0 ? (
        <div
          className="reveal border-ink-300 shadow-soft rounded-[28px] border border-dashed bg-white p-12 text-center"
          style={{ animationDelay: "80ms" }}
        >
          <h3 className="font-condensed text-ink-900 mb-2 text-lg font-bold uppercase tracking-wide">
            No league submissions yet
          </h3>
          <p className="text-ink-600">
            Submit this team to a league and its roster version will appear here.
          </p>
        </div>
      ) : (
        <LeagueRosterManager
          versions={versions}
          clubRoster={clubRoster}
          highlight={searchParams.submission}
        />
      )}
    </div>
  )
}
