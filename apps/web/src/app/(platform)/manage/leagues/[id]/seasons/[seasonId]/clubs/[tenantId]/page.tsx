import Link from "next/link"
import { prisma } from "@youthbasketballhub/db"
import { notFound, redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"
import { Badge, SmartBack, toneForStatus } from "@/components/ui"
import { SubmissionActions } from "../../teams/[submissionId]/submission-actions"

export const dynamic = "force-dynamic"

/**
 * League-side CLUB view (owner 2026-07-29): one club's whole footprint in a
 * season — every team with status/payment and inline actions, fee rollup,
 * waiver progress, contacts. Companion to the per-team detail page; becomes
 * the entry review page when ClubSeasonEntry ships (league-operator-orgs.md).
 */
export default async function LeagueClubDetailPage({
  params,
}: {
  params: { id: string; seasonId: string; tenantId: string }
}) {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")

  const season = await (prisma as any).season.findFirst({
    where: { id: params.seasonId, leagueId: params.id },
    select: {
      id: true,
      label: true,
      currency: true,
      teamFee: true,
      league: { select: { id: true, name: true, ownerId: true } },
    },
  })
  if (!season) notFound()

  const isOwner = season.league.ownerId === user.id
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

  const tenant = await (prisma as any).tenant.findUnique({
    where: { id: params.tenantId },
    select: { id: true, name: true, slug: true, city: true, state: true, status: true },
  })
  if (!tenant) notFound()

  const submissions = await (prisma as any).teamSubmission.findMany({
    where: { seasonId: params.seasonId, team: { tenantId: params.tenantId } },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      registrationFee: true,
      createdAt: true,
      division: { select: { name: true } },
      team: { select: { id: true, name: true } },
      roster: {
        select: {
          isLocked: true,
          submittedAt: true,
          players: { select: { playerId: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  // Fee rollup across this club's submissions
  const obligations = await (prisma as any).paymentObligation.findMany({
    where: {
      referenceType: "TeamSubmission",
      referenceId: { in: submissions.map((s: any) => s.id) },
    },
    select: {
      referenceId: true,
      amount: true,
      status: true,
      dueDate: true,
      payments: { where: { status: "SUCCEEDED" }, select: { amount: true } },
    },
  })
  const now = new Date()
  const owed = obligations.reduce((a: number, o: any) => a + Number(o.amount), 0)
  const received = obligations.reduce(
    (a: number, o: any) => a + o.payments.reduce((x: number, pm: any) => x + Number(pm.amount), 0),
    0
  )
  const overdueCount = obligations.filter(
    (o: any) => o.status !== "PAID" && o.dueDate && new Date(o.dueDate) < now
  ).length

  // Waiver progress: required league waivers across this club's rostered players
  const requiredWaivers = await (prisma as any).waiverDocument.count({
    where: { leagueId: params.id, active: true, required: true, audience: "PARENT" },
  })
  // Approved teams only — waivers are requested on approval, so pending
  // teams' players would inflate the denominator vs the Overview counts.
  const playerIds = submissions
    .filter((s: any) => s.status === "APPROVED")
    .flatMap((s: any) => (s.roster?.players ?? []).map((rp: any) => rp.playerId))
  const signedCount =
    playerIds.length && requiredWaivers
      ? await (prisma as any).waiverSignature.count({
          where: {
            playerId: { in: playerIds },
            waiver: { leagueId: params.id, active: true, required: true, audience: "PARENT" },
            OR: [{ validUntil: null }, { validUntil: { gt: now } }],
          },
        })
      : 0

  const operators = await prisma.userRole.findMany({
    where: { tenantId: params.tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
    select: { role: true, user: { select: { firstName: true, lastName: true, email: true } } },
  })

  const money = (n: number) =>
    new Intl.NumberFormat("en-CA", { style: "currency", currency: season.currency || "CAD" }).format(n)
  const fmtDate = (d: Date | string) =>
    new Date(d).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })
  const panel = "border-ink-100 shadow-soft rounded-2xl border bg-white p-5"
  const approved = submissions.filter((s: any) => s.status === "APPROVED").length

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
      <div>
        <SmartBack
          fallback={`/manage/leagues/${params.id}/seasons/${params.seasonId}/manage?tab=clubs`}
          fallbackLabel={`${season.league.name} · ${season.label}`}
          className="-ml-1"
        />
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-ink-900 text-xl font-bold md:text-2xl">{tenant.name}</h1>
          <Badge tone="neutral">{[tenant.city, tenant.state].filter(Boolean).join(", ")}</Badge>
        </div>
        <p className="text-ink-500 mt-1 text-sm">
          {submissions.length} team{submissions.length === 1 ? "" : "s"} in {season.label}
          {approved ? ` · ${approved} approved` : ""} ·{" "}
          <Link href={`/club/${tenant.slug}`} className="text-play-600 hover:underline">
            public club page &rarr;
          </Link>
        </p>
      </div>

      {/* Rollups */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className={panel}>
          <h2 className="text-ink-900 mb-2 text-sm font-bold uppercase tracking-wide">Entry fees</h2>
          <p className="text-ink-700 text-sm">
            {money(received)} received of {money(owed)}
            {overdueCount > 0 ? ` · ${overdueCount} OVERDUE` : ""}
          </p>
          {obligations.length === 0 && (
            <p className="text-ink-500 mt-1 text-xs">No fees recorded yet (fees attach on approval).</p>
          )}
        </div>
        <div className={panel}>
          <h2 className="text-ink-900 mb-2 text-sm font-bold uppercase tracking-wide">Waivers</h2>
          <p className="text-ink-700 text-sm">
            {requiredWaivers === 0
              ? "No required parent waivers on this league."
              : `${signedCount} of ${playerIds.length * requiredWaivers} required signatures in`}
          </p>
          <Link
            href={`/manage/leagues/${params.id}/seasons/${params.seasonId}/waivers`}
            className="text-play-600 mt-1 inline-block text-xs font-semibold hover:underline"
          >
            Full signing grid &rarr;
          </Link>
        </div>
      </div>

      {/* Teams with inline actions */}
      <div className={panel}>
        <h2 className="text-ink-900 mb-3 text-sm font-bold uppercase tracking-wide">
          Teams ({submissions.length})
        </h2>
        {submissions.length === 0 ? (
          <p className="text-ink-500 text-sm">This club has not registered any teams yet.</p>
        ) : (
          submissions.map((s: any) => (
            <div key={s.id} className="border-court-100 bg-court-50 mb-3 rounded-xl border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/manage/leagues/${params.id}/seasons/${params.seasonId}/teams/${s.id}`}
                    className="text-ink-900 hover:text-play-600 font-medium transition-colors"
                  >
                    {s.team.name}
                  </Link>
                  <span className="text-ink-500 ml-2 text-xs">
                    {[s.division?.name, `applied ${fmtDate(s.createdAt)}`].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={toneForStatus(s.status)}>{s.status.toLowerCase()}</Badge>
                  <span className="text-ink-500 text-xs">
                    {s.roster
                      ? `${s.roster.players.length} rostered${s.roster.isLocked ? " · locked" : ""}`
                      : "no roster yet"}
                  </span>
                </div>
              </div>
              <div className="mt-2">
                <SubmissionActions
                  seasonId={params.seasonId}
                  submissionId={s.id}
                  status={s.status}
                  paymentStatus={s.paymentStatus}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Contacts */}
      <div className={panel}>
        <h2 className="text-ink-900 mb-2 text-sm font-bold uppercase tracking-wide">Club contacts</h2>
        {operators.length === 0 ? (
          <p className="text-ink-500 text-sm">No operators on record (unclaimed club).</p>
        ) : (
          operators.map((o: any, i: number) => (
            <p key={i} className="text-ink-700 mb-1 text-sm">
              {o.user.firstName} {o.user.lastName}
              <span className="text-ink-400"> · {o.role} · {o.user.email}</span>
            </p>
          ))
        )}
      </div>
    </div>
  )
}
