import { prisma } from "@youthbasketballhub/db"
import { getCurrentUser } from "@/lib/auth-helpers"
import { redirect } from "next/navigation"
import { TemplateForm } from "./template-form"
import { TemplateCard } from "./template-card"

interface TemplateData {
  id: string
  name: string
  seasonFee: number
  installments: number
  practiceSessions: number
  includesBall: boolean
  includesBag: boolean
  includesShoes: boolean
  includesUniform: boolean
  includesTracksuit: boolean
}

async function getClubTemplates(clubId: string): Promise<TemplateData[]> {
  const raw = await prisma.offerTemplate.findMany({
    where: { tenantId: clubId, isActive: true },
    orderBy: { createdAt: "desc" },
  })
  return raw.map((t: any) => ({
    id: t.id,
    name: t.name,
    seasonFee: Number(t.seasonFee),
    installments: t.installments,
    practiceSessions: t.practiceSessions,
    includesBall: t.includesBall,
    includesBag: t.includesBag,
    includesShoes: t.includesShoes,
    includesUniform: t.includesUniform,
    includesTracksuit: t.includesTracksuit,
  }))
}

async function isClubAdmin(clubId: string, userId: string): Promise<boolean> {
  const role = await prisma.userRole.findFirst({
    where: {
      userId,
      OR: [
        { tenantId: clubId, role: { in: ["ClubOwner", "ClubManager"] } },
        { role: "PlatformAdmin" },
      ],
    },
  })
  return !!role
}

export default async function ClubOfferTemplatesPage({
  params,
}: {
  params: { id: string }
}) {
  const dbUser = await getCurrentUser()
  if (!dbUser) redirect("/sign-in")

  const [templates, isAdmin] = await Promise.all([
    getClubTemplates(params.id),
    isClubAdmin(params.id, dbUser.id),
  ])

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-ink-900">Offer Templates</h2>
        <p className="text-sm text-ink-500 mt-1">
          {isAdmin
            ? "Create reusable templates for sending offers to players. All teams in the club share these templates."
            : "Templates created by club management for sending offers to players."}
        </p>
      </div>

      {/* Create new template — admin only */}
      {isAdmin && (
        <div className="mb-8">
          <TemplateForm clubId={params.id} />
        </div>
      )}

      {/* Existing templates */}
      {templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-300 bg-white p-8 text-center shadow-soft">
          <h3 className="text-lg font-semibold text-ink-900 mb-2">No templates yet</h3>
          <p className="text-ink-600">
            {isAdmin
              ? "Create your first offer template above. Templates define the fee structure and included items for offers sent to players."
              : "No templates have been created yet. Ask your club owner or manager to set up offer templates."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              clubId={params.id}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  )
}
