import Link from "next/link"
import { prisma } from "@youthbasketballhub/db"
import { notFound, redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"
import { Badge, SmartBack, toneForStatus } from "@/components/ui"
import { SubmissionActions } from "./submission-actions"

export const dynamic = "force-dynamic"

/**
 * League-side team detail (owner 2026-07-29): everything about ONE team's
 * season entry in one place — application + payment state with actions,
 * submitted roster with per-player waiver status, roster change requests,
 * blackouts, games and contacts — instead of scattering it across the
 * Teams tab, the Waivers grid and the roster-requests queue.
 */
export default async function LeagueTeamDetailPage({
  params,
}: {
  params: { id: string; seasonId: string; submissionId: string }
}) {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")

  const submission = await (prisma as any).teamSubmission.findFirst({
    where: { id: params.submissionId, seasonId: params.seasonId, season: { leagueId: params.id } },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      registrationFee: true,
      createdAt: true,
      division: { select: { id: true, name: true } },
      season: {
        select: {
          id: true,
          label: true,
          teamFee: true,
          currency: true,
          league: { select: { id: true, name: true, ownerId: true } },
        },
      },
      team: {
        select: {
          id: true,
          name: true,
          ageGroup: true,
          gender: true,
          tenantId: true,
          tenant: { select: { id: true, name: true, slug: true } },
          players: {
            where: { status: "ACTIVE", player: { deletedAt: null } },
            select: {
              jerseyNumber: true,
              player: { select: { id: true, firstName: true, lastName: true, dateOfBirth: true, position: true } },
            },
          },
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
              jerseyNumber: true,
              player: { select: { id: true, firstName: true, lastName: true, dateOfBirth: true, position: true } },
            },
          },
          changeRequests: {
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              status: true,
              message: true,
              createdAt: true,
              requestedBy: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
      blackouts: { select: { id: true, date: true, reason: true }, orderBy: { date: "asc" } },
    },
  })
  if (!submission) notFound()

  const league = submission.season.league
  const isOwner = league.ownerId === user.id
  const role = isOwner
    ? null
    : await prisma.userRole.findFirst({
        where: {
          userId: user.id,
          OR: [
            { leagueId: params.id, role: { in: ["LeagueOwner", "LeagueManager"] } },
            { role: "PlatformAdmin" },
          ],
        },
      })
  if (!isOwner && !role) notFound()

  // Roster the league sees = the SUBMITTED roster; fall back to the club's
  // current active roster if nothing was submitted yet.
  const rosterRows: Array<{ jerseyNumber: number | null; player: any }> =
    submission.roster?.players?.length ? submission.roster.players : submission.team.players
  const playerIds = rosterRows.map((r) => r.player.id)

  // Per-player status for every required league waiver (signed / sent / not sent)
  const waivers = await (prisma as any).waiverDocument.findMany({
    where: { leagueId: params.id, active: true, required: true },
    select: { id: true, title: true, annualRenewal: true },
    orderBy: { createdAt: "asc" },
  })
  const waiverIds = waivers.map((w: any) => w.id)
  const now = new Date()
  const [signatures, signRequests] = await Promise.all([
    (prisma as any).waiverSignature.findMany({
      where: { waiverId: { in: waiverIds }, playerId: { in: playerIds } },
      select: { waiverId: true, playerId: true, signedAt: true, validUntil: true },
    }),
    (prisma as any).waiverSignRequest.findMany({
      where: { waiverId: { in: waiverIds }, playerId: { in: playerIds }, seasonId: params.seasonId },
      select: { waiverId: true, playerId: true },
    }),
  ])
  const signedSet = new Set(
    signatures
      .filter((s: any) => !s.validUntil || new Date(s.validUntil) > now)
      .map((s: any) => `${s.waiverId}:${s.playerId}`)
  )
  const sentSet = new Set(signRequests.map((s: any) => `${s.waiverId}:${s.playerId}`))

  // Money: the entry-fee obligation + recorded payments (deposit rows etc.)
  const obligation = await (prisma as any).paymentObligation.findFirst({
    where: { referenceType: "TeamSubmission", referenceId: submission.id },
    select: {
      amount: true,
      status: true,
      dueDate: true,
      payments: {
        where: { status: "SUCCEEDED" },
        select: { id: true, amount: true, method: true, description: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  })
  const paidTotal = (obligation?.payments ?? []).reduce((a: number, x: any) => a + Number(x.amount), 0)
  const feeAmount = Number(submission.registrationFee ?? submission.season.teamFee ?? 0)
  const overdue =
    obligation && obligation.status !== "PAID" && obligation.dueDate && new Date(obligation.dueDate) < now

  // Games this season (none until the schedule is generated)
  const games = await (prisma as any).game.findMany({
    where: {
      seasonId: params.seasonId,
      OR: [{ homeTeamId: submission.team.id }, { awayTeamId: submission.team.id }],
    },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      homeScore: true,
      awayScore: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
    orderBy: { scheduledAt: "asc" },
    take: 12,
  })

  // Contacts: team staff + club operators
  const [teamStaff, clubOperators] = await Promise.all([
    prisma.userRole.findMany({
      where: { teamId: submission.team.id, role: "Staff" },
      select: {
        designation: true,
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    }),
    prisma.userRole.findMany({
      where: { tenantId: submission.team.tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
      select: { role: true, user: { select: { firstName: true, lastName: true, email: true } } },
    }),
  ])

  const fmtDate = (d: Date | string) =>
    new Date(d).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })
  const money = (n: number) =>
    new Intl.NumberFormat("en-CA", { style: "currency", currency: submission.season.currency || "CAD" }).format(n)
  const age = (dob: Date | string | null) =>
    dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 86400_000)) : null

  const panel = "border-ink-100 shadow-soft rounded-2xl border bg-white p-5"

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
      <div>
        <SmartBack
          fallback={`/manage/leagues/${params.id}/seasons/${params.seasonId}/manage`}
          fallbackLabel={`${league.name} · ${submission.season.label}`}
          className="-ml-1"
        />
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-ink-900 text-xl font-bold md:text-2xl">{submission.team.name}</h1>
          <Badge tone={toneForStatus(submission.status)}>{submission.status.toLowerCase()}</Badge>
          <Badge tone={["PAID_MANUAL", "PAID_STRIPE", "WAIVED"].includes(submission.paymentStatus) ? "success" : overdue ? "danger" : "warning"}>
            {submission.paymentStatus === "UNPAID" && overdue ? "overdue" : submission.paymentStatus.replace("_", " ").toLowerCase()}
          </Badge>
        </div>
        <p className="text-ink-500 mt-1 text-sm">
          {[submission.team.tenant?.name, submission.division?.name, `applied ${fmtDate(submission.createdAt)}`]
            .filter(Boolean)
            .join(" · ")}
          {" · "}
          <Link href={`/team/${submission.team.id}`} className="text-play-600 hover:underline">
            public page &rarr;
          </Link>
        </p>
      </div>

      <SubmissionActions
        seasonId={params.seasonId}
        submissionId={submission.id}
        status={submission.status}
        paymentStatus={submission.paymentStatus}
      />

      {/* Entry fee */}
      <div className={panel}>
        <h2 className="text-ink-900 mb-2 text-sm font-bold uppercase tracking-wide">Entry fee</h2>
        <p className="text-ink-700 text-sm">
          {money(feeAmount)}
          {obligation?.dueDate ? ` · balance due ${fmtDate(obligation.dueDate)}` : ""}
          {paidTotal > 0 ? ` · ${money(paidTotal)} received` : " · nothing received yet"}
          {overdue ? " · OVERDUE" : ""}
        </p>
        {(obligation?.payments ?? []).map((pm: any) => (
          <p key={pm.id} className="text-ink-500 mt-1 text-xs">
            {fmtDate(pm.createdAt)} — {money(Number(pm.amount))} ({pm.method.toLowerCase()}) {pm.description}
          </p>
        ))}
      </div>

      {/* Roster + waivers */}
      <div className={panel}>
        <h2 className="text-ink-900 mb-1 text-sm font-bold uppercase tracking-wide">
          Roster ({rosterRows.length})
        </h2>
        <p className="text-ink-500 mb-3 text-xs">
          {submission.roster
            ? `Submitted ${submission.roster.submittedAt ? fmtDate(submission.roster.submittedAt) : ""}${submission.roster.isLocked ? " · locked" : " · not locked yet"}`
            : "No roster submitted yet — showing the club's current roster."}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ink-400 border-ink-100 border-b text-left text-xs uppercase">
                <th className="py-1.5 pr-2">#</th>
                <th className="py-1.5 pr-2">Player</th>
                <th className="py-1.5 pr-2">Age</th>
                <th className="py-1.5 pr-2">Position</th>
                {waivers.map((w: any) => (
                  <th key={w.id} className="py-1.5 pr-2">
                    {w.title.length > 26 ? `${w.title.slice(0, 26)}…` : w.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rosterRows.map((r) => (
                <tr key={r.player.id} className="border-ink-50 border-b last:border-0">
                  <td className="text-ink-500 py-1.5 pr-2">{r.jerseyNumber ?? "—"}</td>
                  <td className="text-ink-900 py-1.5 pr-2 font-medium">
                    {r.player.firstName} {r.player.lastName}
                  </td>
                  <td className="text-ink-500 py-1.5 pr-2">{age(r.player.dateOfBirth) ?? "—"}</td>
                  <td className="text-ink-500 py-1.5 pr-2">{r.player.position ?? "—"}</td>
                  {waivers.map((w: any) => {
                    const key = `${w.id}:${r.player.id}`
                    const state = signedSet.has(key) ? "signed" : sentSet.has(key) ? "sent" : "not sent"
                    return (
                      <td key={w.id} className="py-1.5 pr-2">
                        <Badge tone={state === "signed" ? "success" : state === "sent" ? "warning" : "neutral"}>
                          {state}
                        </Badge>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {waivers.length > 0 && (
          <p className="text-ink-400 mt-2 text-xs">
            Signing emails go out automatically on approval.{" "}
            <Link
              href={`/manage/leagues/${params.id}/seasons/${params.seasonId}/waivers`}
              className="text-play-600 hover:underline"
            >
              Full signing grid &rarr;
            </Link>
          </p>
        )}
      </div>

      {/* Roster change requests */}
      {(submission.roster?.changeRequests ?? []).length > 0 && (
        <div className={panel}>
          <h2 className="text-ink-900 mb-2 text-sm font-bold uppercase tracking-wide">
            Roster change requests
          </h2>
          {submission.roster.changeRequests.map((cr: any) => (
            <p key={cr.id} className="text-ink-700 mb-1 text-sm">
              <Badge tone={toneForStatus(cr.status)}>{cr.status.toLowerCase()}</Badge>{" "}
              {fmtDate(cr.createdAt)} — {cr.requestedBy.firstName} {cr.requestedBy.lastName}
              {cr.message ? `: ${cr.message}` : ""}
            </p>
          ))}
          <p className="text-ink-400 mt-1 text-xs">
            Pending requests are approved from the Teams tab&apos;s request queue.
          </p>
        </div>
      )}

      {/* Games */}
      <div className={panel}>
        <h2 className="text-ink-900 mb-2 text-sm font-bold uppercase tracking-wide">
          Games ({games.length})
        </h2>
        {games.length === 0 ? (
          <p className="text-ink-500 text-sm">
            None yet — games appear here once the schedule is generated.
          </p>
        ) : (
          games.map((g: any) => (
            <p key={g.id} className="text-ink-700 mb-1 text-sm">
              <Link href={`/live/${g.id}`} className="hover:text-play-600">
                {fmtDate(g.scheduledAt)} — {g.homeTeam.name} vs {g.awayTeam.name}
                {g.status === "COMPLETED" ? ` (${g.homeScore}–${g.awayScore})` : ` · ${g.status.toLowerCase()}`}
              </Link>
            </p>
          ))
        )}
      </div>

      {/* Blackouts + contacts */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className={panel}>
          <h2 className="text-ink-900 mb-2 text-sm font-bold uppercase tracking-wide">Blackout dates</h2>
          {submission.blackouts.length === 0 ? (
            <p className="text-ink-500 text-sm">None requested.</p>
          ) : (
            submission.blackouts.map((b: any) => (
              <p key={b.id} className="text-ink-700 mb-1 text-sm">
                {fmtDate(b.date)}
                {b.reason ? ` — ${b.reason}` : ""}
              </p>
            ))
          )}
        </div>
        <div className={panel}>
          <h2 className="text-ink-900 mb-2 text-sm font-bold uppercase tracking-wide">Contacts</h2>
          {teamStaff.map((s: any, i: number) => (
            <p key={`s-${i}`} className="text-ink-700 mb-1 text-sm">
              {s.user.firstName} {s.user.lastName}
              <span className="text-ink-400"> · {s.designation ?? "Staff"} · {s.user.email}</span>
            </p>
          ))}
          {clubOperators.map((s: any, i: number) => (
            <p key={`o-${i}`} className="text-ink-700 mb-1 text-sm">
              {s.user.firstName} {s.user.lastName}
              <span className="text-ink-400"> · {s.role} · {s.user.email}</span>
            </p>
          ))}
          {teamStaff.length === 0 && clubOperators.length === 0 && (
            <p className="text-ink-500 text-sm">No staff on record.</p>
          )}
        </div>
      </div>
    </div>
  )
}
