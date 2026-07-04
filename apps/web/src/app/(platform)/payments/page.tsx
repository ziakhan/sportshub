import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"
import { formatCurrency } from "@/lib/countries"
import { payerObligations } from "@/lib/payments/queries"
import { ObligationsTable } from "@/components/payments/obligations-table"
import { paidSoFar } from "@/components/payments/types"

export const dynamic = "force-dynamic"

/**
 * "My payments" — everything the signed-in user owes (tryout fees, season
 * fees, camps, house leagues) and their full payment history. Open items can
 * be paid online when the organization accepts it; otherwise the row shows
 * the offline methods the club takes.
 */
export default async function MyPaymentsPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")

  const obligations = await payerObligations({ userId: user.id })
  const open = obligations.filter((o) => ["PENDING", "PARTIALLY_PAID"].includes(o.status))
  const owing = open.reduce((sum, o) => sum + Math.max(0, o.amount - paidSoFar(o)), 0)
  const currency = obligations[0]?.currency ?? "CAD"

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold text-ink-900 md:text-2xl">My payments</h1>
        <p className="mt-1 text-sm text-ink-500">
          {open.length === 0
            ? "You're all settled up."
            : `${open.length} open item${open.length > 1 ? "s" : ""} — ${formatCurrency(owing, currency)} outstanding.`}
        </p>
      </div>

      <ObligationsTable obligations={obligations} view="payer" />

      <p className="text-xs text-ink-400">
        Need a refund or a correction? Contact the club or league directly — they manage
        payments on their side.
      </p>
    </div>
  )
}
