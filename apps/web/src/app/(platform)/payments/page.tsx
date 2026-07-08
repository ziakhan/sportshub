import Link from "next/link"
import { redirect } from "next/navigation"
import { prisma } from "@youthbasketballhub/db"
import { getCurrentUser } from "@/lib/auth-helpers"
import { formatCurrency } from "@/lib/countries"
import { payerObligations } from "@/lib/payments/queries"
import { ObligationsTable } from "@/components/payments/obligations-table"
import { paidSoFar } from "@/components/payments/types"

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  SUCCEEDED: { label: "Paid", tone: "text-court-700 bg-court-50" },
  PENDING: { label: "Upcoming", tone: "text-ink-600 bg-ink-100" },
  PROCESSING: { label: "Processing", tone: "text-play-700 bg-play-50" },
  FAILED: { label: "Failed — retrying", tone: "text-red-700 bg-red-50" },
}

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

  // Payments v2 Stage H — the installment timeline (deposit + scheduled)
  const installments = await (prisma as any).payment.findMany({
    where: { payerId: user.id, installmentNumber: { not: null } },
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      dueDate: true,
      description: true,
      installmentNumber: true,
    },
    orderBy: [{ dueDate: "asc" }, { installmentNumber: "asc" }],
  })

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

      {installments.length > 0 && (
        <div className="border-ink-100 rounded-2xl border bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-ink-900 text-sm font-bold">Payment plan</h2>
            <Link href="/settings/payments" className="text-play-600 text-xs font-semibold hover:underline">
              Manage cards →
            </Link>
          </div>
          <ul className="divide-ink-100 divide-y">
            {installments.map((p: any) => {
              const s = STATUS_LABEL[p.status] ?? STATUS_LABEL.PENDING
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-ink-800 truncate text-sm font-medium">
                      {p.installmentNumber === 1 ? "Deposit" : p.description || `Installment ${p.installmentNumber}`}
                    </p>
                    <p className="text-ink-400 text-xs">
                      {p.dueDate
                        ? new Date(p.dueDate).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })
                        : "Paid at signup"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-ink-800 text-sm font-semibold">
                      {formatCurrency(Number(p.amount), p.currency)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${s.tone}`}>
                      {s.label}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="text-ink-400 mt-2 text-[11px]">
            Scheduled payments charge automatically to your default card. Update it any time under
            Manage cards.
          </p>
        </div>
      )}

      <ObligationsTable obligations={obligations} view="payer" />

      <p className="text-xs text-ink-400">
        Need a refund or a correction? Contact the club or league directly — they manage
        payments on their side.
      </p>
    </div>
  )
}
