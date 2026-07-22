import { prisma } from "@youthbasketballhub/db"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"
import { formatCurrency } from "@/lib/countries"
import { merchantObligations, summarize } from "@/lib/payments/queries"
import { getPaymentConfig } from "@/lib/payments/config"
import { ObligationsTable } from "@/components/payments/obligations-table"
import { PaymentSettingsCard } from "@/components/payments/payment-settings-card"

export const dynamic = "force-dynamic"

/**
 * League payments: team fees owed by clubs. The league owner/manager records
 * e-transfers, waives, refunds — same engine as the club side.
 */
export default async function LeaguePaymentsPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")

  const league = await prisma.league.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, ownerId: true, currency: true },
  })
  if (!league) notFound()

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

  const obligations = await merchantObligations({ leagueId: params.id })
  const totals = summarize(obligations)

  // Payments v2 Stage H — league can connect Stripe (both charge modes)
  const payConfig = await getPaymentConfig({ leagueId: params.id })

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div>
        <Link
          href={`/manage/leagues/${params.id}`}
          className="text-sm text-ink-500 hover:text-ink-700"
        >
          &larr; {league.name}
        </Link>
        <h1 className="mt-1 text-xl font-bold text-ink-900 md:text-2xl">Team fees & payments</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Tile
          label="Collected"
          value={formatCurrency(totals.collected, league.currency)}
          tone="text-court-700"
        />
        <Tile
          label="Outstanding"
          value={formatCurrency(totals.outstanding, league.currency)}
          tone="text-hoop-700"
        />
        <Tile
          label="Overdue"
          value={formatCurrency(totals.overdue, league.currency)}
          tone={totals.overdue > 0 ? "text-red-600" : "text-ink-400"}
        />
        <Tile
          label="Waived"
          value={formatCurrency(totals.waived, league.currency)}
          tone="text-ink-600"
        />
      </div>

      {totals.overdue > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <span className="font-semibold">
            {totals.overdueCount} payment{totals.overdueCount !== 1 ? "s" : ""} overdue
          </span>
          {totals.aging.d1to30 > 0 && (
            <span>1–30 days: {formatCurrency(totals.aging.d1to30, league.currency)}</span>
          )}
          {totals.aging.d31to60 > 0 && (
            <span>· 31–60 days: {formatCurrency(totals.aging.d31to60, league.currency)}</span>
          )}
          {totals.aging.d60plus > 0 && (
            <span>· 60+ days: {formatCurrency(totals.aging.d60plus, league.currency)}</span>
          )}
        </div>
      )}

      <ObligationsTable
        obligations={obligations}
        view="merchant"
        canRecord
        canWaive
        canRefund
      />

      {/* Everyone the page admits (owner, league manager, platform admin) may
          manage config — same audience the payment-config APIs authorize. */}
      <section className="space-y-3">
        {!payConfig.stripeAccountId && (
          <div className="rounded-xl border border-play-200 bg-play-50 px-4 py-3 text-sm text-play-800">
            Connect Stripe below to collect team fees online — recording offline
            payments (e-transfer, cash, cheque) works today.
          </div>
        )}
        <PaymentSettingsCard
          tenantId={params.id}
          basePath={`/api/leagues/${params.id}`}
          config={payConfig}
        />
      </section>
    </div>
  )
}

function Tile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-ink-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  )
}
