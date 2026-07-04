import { prisma } from "@youthbasketballhub/db"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"
import { formatCurrency } from "@/lib/countries"
import { merchantObligations, summarize } from "@/lib/payments/queries"
import { ObligationsTable } from "@/components/payments/obligations-table"

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

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div>
        <Link
          href={`/leagues/${params.id}`}
          className="text-sm text-ink-500 hover:text-ink-700"
        >
          &larr; {league.name}
        </Link>
        <h1 className="mt-1 text-xl font-bold text-ink-900 md:text-2xl">Team fees & payments</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
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
          label="Waived"
          value={formatCurrency(totals.waived, league.currency)}
          tone="text-ink-600"
        />
      </div>

      <ObligationsTable
        obligations={obligations}
        view="merchant"
        canRecord
        canWaive
        canRefund
      />
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
