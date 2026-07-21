import { prisma } from "@youthbasketballhub/db"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"
import { merchantObligations } from "@/lib/payments/queries"
import { buildAccountingReport } from "@/lib/payments/reports"
import { AccountingReportView } from "@/components/payments/accounting-report"

export const dynamic = "force-dynamic"

/** League accounting/reports — team fees by season + transactions + CSV. */
export default async function LeagueAccountingPage({ params }: { params: { id: string } }) {
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
  const report = buildAccountingReport(obligations)

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div>
        <Link
          href={`/manage/leagues/${params.id}`}
          className="text-sm text-ink-500 hover:text-ink-700"
        >
          &larr; {league.name}
        </Link>
        <h1 className="mt-1 text-xl font-bold text-ink-900 md:text-2xl">Accounting</h1>
        <p className="mt-1 text-sm text-ink-500">
          Team-fee revenue and every transaction owed to your league. Export a CSV for your
          treasurer or accounting software.
        </p>
      </div>
      <AccountingReportView
        report={report}
        currency={league.currency}
        exportName={`league-accounting`}
      />
    </div>
  )
}
