import { prisma } from "@youthbasketballhub/db"
import { notFound, redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"
import { isClubAdmin } from "@/lib/authz/team-scope"
import { merchantObligations } from "@/lib/payments/queries"
import { buildAccountingReport } from "@/lib/payments/reports"
import { AccountingReportView } from "@/components/payments/accounting-report"
import { SmartBack } from "@/components/ui"

export const dynamic = "force-dynamic"

/**
 * Club accounting/reports (owner 2026-07-20/21 — sales asset): revenue per
 * program + a transactions report + QuickBooks-friendly CSV. Admin-only.
 */
export default async function ClubAccountingPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")

  const tenant = await prisma.tenant.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, currency: true, slug: true },
  })
  if (!tenant) notFound()
  if (!(await isClubAdmin(user.id, params.id))) notFound()

  const obligations = await merchantObligations({ tenantId: params.id })
  const report = buildAccountingReport(obligations)

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div>
        <SmartBack fallback={`/clubs/${params.id}`} fallbackLabel={tenant.name} className="-ml-1" />
        <h1 className="mt-1 text-xl font-bold text-ink-900 md:text-2xl">Accounting</h1>
        <p className="mt-1 text-sm text-ink-500">
          Revenue by program and every transaction owed to your club. Export a CSV for your
          treasurer or accounting software.
        </p>
      </div>
      <AccountingReportView
        report={report}
        currency={tenant.currency}
        exportName={`${tenant.slug}-accounting`}
      />
    </div>
  )
}
