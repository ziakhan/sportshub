import { prisma } from "@youthbasketballhub/db"
import { notFound, redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"
import { formatCurrency } from "@/lib/countries"
import { getPaymentConfig } from "@/lib/payments/config"
import { merchantObligations, payerObligations, summarize } from "@/lib/payments/queries"
import { ObligationsTable } from "@/components/payments/obligations-table"
import { PaymentSettingsCard } from "@/components/payments/payment-settings-card"
import { TYPE_LABEL } from "@/components/payments/types"
import { PanelHeader } from "@/components/ui"

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
    roleNames.includes("Trainer") ||
    roleNames.includes("PlatformAdmin")
  // Security fix 2026-07-20: club money is admin-only. Staff could see (and
  // record cash against) every family's obligations club-wide.
  if (!isAdmin) notFound()

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
          delay={0}
        />
        <Tile
          label="Outstanding"
          value={formatCurrency(totals.outstanding, tenant.currency)}
          tone="text-hoop-600"
          delay={70}
        />
        <Tile
          label="Waived"
          value={formatCurrency(totals.waived, tenant.currency)}
          tone="text-ink-600"
          delay={140}
        />
      </div>

      {totals.byType.length > 0 && (
        <div
          className="reveal text-ink-600 flex flex-wrap gap-2 text-xs"
          style={{ animationDelay: "210ms" }}
        >
          {totals.byType.map(([type, amount]) => (
            <span
              key={type}
              className="bg-ink-50 ring-ink-200 rounded-full px-3 py-1 font-medium ring-1 ring-inset"
            >
              {TYPE_LABEL[type] ?? type}: {formatCurrency(amount, tenant.currency)}
            </span>
          ))}
        </div>
      )}

      <section className="reveal" style={{ animationDelay: "260ms" }}>
        <PanelHeader title={<>Owed to {tenant.name}</>} />
        <ObligationsTable
          obligations={incoming}
          view="merchant"
          canRecord={isAdmin}
          canWaive={isAdmin}
          canRefund={isAdmin}
        />
      </section>

      {outgoing.length > 0 && (
        <section className="reveal" style={{ animationDelay: "320ms" }}>
          <PanelHeader title={<>Fees {tenant.name} owes</>} />
          <p className="text-ink-500 -mt-2 mb-3 text-sm">
            League and tournament fees for your teams.
          </p>
          <ObligationsTable obligations={outgoing} view="payer" />
        </section>
      )}

      {isAdmin && (
        <div className="reveal" style={{ animationDelay: "380ms" }}>
          <PaymentSettingsCard tenantId={tenant.id} config={config} />
        </div>
      )}
    </div>
  )
}

/** Kit-styled money KPI tile — currency strings stay formatted, so no count-up. */
function Tile({
  label,
  value,
  tone,
  delay = 0,
}: {
  label: string
  value: string
  tone: string
  delay?: number
}) {
  return (
    <div
      className="reveal border-ink-100 rounded-3xl border bg-white p-5 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="text-ink-500 text-xs font-semibold uppercase tracking-[0.12em]">{label}</p>
      <p
        className={`font-condensed mt-2 text-4xl font-bold leading-none ${tone}`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
    </div>
  )
}
