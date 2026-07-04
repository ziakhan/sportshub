import { prisma } from "@youthbasketballhub/db"
import { notFound, redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"
import { formatCurrency } from "@/lib/countries"
import { getPaymentConfig } from "@/lib/payments/config"
import { merchantObligations, payerObligations, summarize } from "@/lib/payments/queries"
import { ObligationsTable } from "@/components/payments/obligations-table"
import { PaymentSettingsCard } from "@/components/payments/payment-settings-card"
import { TYPE_LABEL } from "@/components/payments/types"

export const dynamic = "force-dynamic"

/**
 * Club payments dashboard: money owed TO the club (record cash / waive /
 * refund), fees the club itself owes (leagues, tournaments — pay online),
 * summary tiles, and the payment settings incl. Stripe Connect.
 */
export default async function ClubPaymentsPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")

  const roles = await prisma.userRole.findMany({
    where: {
      userId: user.id,
      OR: [{ tenantId: params.id }, { role: "PlatformAdmin" }],
    },
    select: { role: true },
  })
  const roleNames = roles.map((r: { role: string }) => r.role)
  const isAdmin =
    roleNames.includes("ClubOwner") ||
    roleNames.includes("ClubManager") ||
    roleNames.includes("PlatformAdmin")
  const isStaff = roleNames.includes("Staff")
  if (!isAdmin && !isStaff) notFound()

  const tenant = await prisma.tenant.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, currency: true },
  })
  if (!tenant) notFound()

  const [incoming, outgoing, config] = await Promise.all([
    merchantObligations({ tenantId: params.id }),
    payerObligations({ tenantId: params.id }),
    getPaymentConfig({ tenantId: params.id }),
  ])
  const totals = summarize(incoming)

  return (
    <div className="space-y-8 p-4 md:p-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Tile
          label="Collected"
          value={formatCurrency(totals.collected, tenant.currency)}
          tone="text-court-700"
        />
        <Tile
          label="Outstanding"
          value={formatCurrency(totals.outstanding, tenant.currency)}
          tone="text-hoop-700"
        />
        <Tile
          label="Waived"
          value={formatCurrency(totals.waived, tenant.currency)}
          tone="text-ink-600"
        />
      </div>

      {totals.byType.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs text-ink-600">
          {totals.byType.map(([type, amount]) => (
            <span key={type} className="rounded-full bg-ink-100 px-3 py-1">
              {TYPE_LABEL[type] ?? type}: {formatCurrency(amount, tenant.currency)}
            </span>
          ))}
        </div>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink-900">Owed to {tenant.name}</h2>
        <ObligationsTable
          obligations={incoming}
          view="merchant"
          canRecord={isAdmin || isStaff}
          canWaive={isAdmin}
          canRefund={isAdmin}
        />
      </section>

      {outgoing.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-ink-900">
            Fees {tenant.name} owes
          </h2>
          <p className="mb-3 text-sm text-ink-500">
            League and tournament fees for your teams.
          </p>
          <ObligationsTable obligations={outgoing} view="payer" />
        </section>
      )}

      {isAdmin && <PaymentSettingsCard tenantId={tenant.id} config={config} />}
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
