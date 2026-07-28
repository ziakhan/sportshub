import { prisma } from "@youthbasketballhub/db"
import { notFound, redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"
import { WAIVER_TEMPLATES } from "@/lib/waivers/templates"
import { WaiversManager } from "@/components/waivers/waivers-manager"
import { SmartBack } from "@/components/ui"

export const dynamic = "force-dynamic"

/**
 * Club waivers (waivers-esign, owner spec 2026-07-20): per-club participation
 * documents — e.g. required by school-gym practice permits. Phase B attaches
 * them as a blocking step on registration paths; today clubs author and manage
 * the documents here.
 */
export default async function ClubWaiversPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")

  const tenant = await prisma.tenant.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  })
  if (!tenant) notFound()

  const role = await prisma.userRole.findFirst({
    where: {
      userId: user.id,
      OR: [
        { tenantId: params.id, role: { in: ["ClubOwner", "ClubManager"] } },
        { role: "PlatformAdmin" },
      ],
    },
  })
  if (!role) notFound()

  const waivers = await (prisma as any).waiverDocument.findMany({
    where: { tenantId: params.id },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { signatures: true } } },
  })

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <SmartBack fallback={`/clubs/${params.id}`} fallbackLabel={tenant.name} className="-ml-1" />
        <h1 className="mt-1 text-xl font-bold text-ink-900 md:text-2xl">Waivers</h1>
        <p className="mt-1 text-sm text-ink-500">
          Club-level participation documents, e.g. for programs run in school gyms.
          League waivers are managed by each league and emailed automatically when
          your teams are approved.
        </p>
      </div>

      <WaiversManager
        basePath={`/api/clubs/${params.id}/waivers`}
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
          previewBody: t.body(tenant.name),
        }))}
      />
    </div>
  )
}
