import { prisma } from "@youthbasketballhub/db"
import { notFound, redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"
import { SmartBack } from "@/components/ui"
import { EntryForm } from "./entry-form"
import { effectiveSeasonConfig } from "@/lib/org/season-defaults"

export const dynamic = "force-dynamic"

/**
 * Level-1 registration, club side (owner 2026-07-29): enter the season as a
 * CLUB — application answers once, planned team count, club official signs
 * the league's agreement. Teams are registered afterwards, one by one.
 */
export default async function SeasonEnterPage({ params }: { params: { seasonId: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect(`/sign-in?callbackUrl=/seasons/${params.seasonId}/enter`)

  const season = await (prisma as any).season.findUnique({
    where: { id: params.seasonId },
    select: {
      id: true,
      label: true,
      status: true,
      teamFee: true,
      depositPct: true,
      applicationQuestions: true,
      leagueId: true,
      league: {
        select: { name: true, organization: { select: { seasonDefaults: true } } },
      },
    },
  })
  if (!season) notFound()
  // Questions may live on the org rulebook (Phase A) — resolve before render.
  const { values: cfg } = effectiveSeasonConfig(
    season,
    season.league?.organization?.seasonDefaults
  )

  const operatorRoles = await prisma.userRole.findMany({
    where: { userId: user.id, role: { in: ["ClubOwner", "ClubManager"] }, tenantId: { not: null } },
    select: { tenantId: true },
  })
  const tenantIds = [...new Set(operatorRoles.map((r) => r.tenantId as string))]
  const tenants = tenantIds.length
    ? await (prisma as any).tenant.findMany({
        where: { id: { in: tenantIds } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : []

  const existing = tenantIds.length
    ? await (prisma as any).clubSeasonEntry.findMany({
        where: { seasonId: params.seasonId, tenantId: { in: tenantIds } },
        select: { tenantId: true, status: true },
      })
    : []

  const clubDoc = await (prisma as any).waiverDocument.findFirst({
    where: { leagueId: season.leagueId, active: true, required: true, audience: "CLUB_OFFICIAL" },
    select: { id: true, title: true, body: true },
  })

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 md:p-6">
      <div>
        <SmartBack fallback={`/league/${season.id}`} fallbackLabel={season.league.name} className="-ml-1" />
        <h1 className="text-ink-900 mt-1 text-xl font-bold md:text-2xl">
          Enter {season.league.name} · {season.label}
        </h1>
        <p className="text-ink-500 mt-1 text-sm">
          One application per club — your program answers once, then you register each team
          under it.
          {season.teamFee != null
            ? ` Team fee ${new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(Number(season.teamFee))}${season.depositPct != null ? ` (${season.depositPct}% deposit at approval, balance 14 days before tip-off)` : ""}.`
            : ""}
        </p>
      </div>
      {tenants.length === 0 ? (
        <p className="border-gold-100 bg-gold-50 text-ink-700 rounded-xl border p-4 text-sm">
          Season entries are made by club operators. You do not manage a club on SportsHub One
          yet.
        </p>
      ) : season.status !== "REGISTRATION" ? (
        <p className="border-gold-100 bg-gold-50 text-ink-700 rounded-xl border p-4 text-sm">
          Registration is not open for this season.
        </p>
      ) : (
        <EntryForm
          seasonId={season.id}
          tenants={tenants}
          existing={existing}
          questions={Array.isArray(cfg.applicationQuestions) ? (cfg.applicationQuestions as unknown[]) : []}
          agreement={clubDoc}
        />
      )}
    </div>
  )
}
