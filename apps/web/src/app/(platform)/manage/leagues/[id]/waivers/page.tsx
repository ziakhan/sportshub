import { prisma } from "@youthbasketballhub/db"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"
import { WAIVER_TEMPLATES } from "@/lib/waivers/templates"
import { WaiversManager } from "@/components/waivers/waivers-manager"

export const dynamic = "force-dynamic"

/**
 * League waivers (waivers-esign, owner spec 2026-07-20): the documents that are
 * auto-emailed to every roster parent when a team's submission is approved.
 */
export default async function LeagueWaiversPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")

  const league = await prisma.league.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, ownerId: true },
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

  const waivers = await (prisma as any).waiverDocument.findMany({
    where: { leagueId: params.id },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { signatures: true } } },
  })

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <Link
          href={`/manage/leagues/${params.id}`}
          className="text-sm text-ink-500 hover:text-ink-700"
        >
          &larr; {league.name}
        </Link>
        <h1 className="mt-1 text-xl font-bold text-ink-900 md:text-2xl">Waivers</h1>
        <p className="mt-1 text-sm text-ink-500">
          Required waivers are emailed automatically to every parent on a team&apos;s
          roster the moment that team is approved for a season. Track who has signed
          from each season&apos;s Signing status page.
        </p>
      </div>

      <WaiversManager
        basePath={`/api/leagues/${params.id}/waivers`}
        initialWaivers={waivers.map((w: any) => ({
          id: w.id,
          title: w.title,
          type: w.type,
          version: w.version,
          required: w.required,
          annualRenewal: w.annualRenewal,
          active: w.active,
          body: w.body,
          signatureCount: w._count.signatures,
        }))}
        templates={WAIVER_TEMPLATES.map((t) => ({
          key: t.key,
          title: t.title,
          description: t.description,
          annualRenewal: t.annualRenewal,
          previewBody: t.body(league.name),
        }))}
      />
    </div>
  )
}
