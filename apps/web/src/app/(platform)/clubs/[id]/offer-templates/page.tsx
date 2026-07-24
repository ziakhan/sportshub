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
  gamesMin: number | null
  gamesMax: number | null
  programDescription: string | null
  customItems: string[]
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
    gamesMin: t.gamesMin,
    gamesMax: t.gamesMax,
    programDescription: t.programDescription,
    customItems: t.customItems,
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

  const [templates, isAdmin, tenant] = await Promise.all([
    getClubTemplates(params.id),
    isClubAdmin(params.id, dbUser.id),
    prisma.tenant.findUnique({ where: { id: params.id }, select: { currency: true } }),
  ])
  const currency = tenant?.currency || "CAD"

  return (
    <div>
      <div className="reveal mb-6">
        <h2 className="font-condensed text-ink-950 text-2xl font-bold uppercase tracking-wide">
          Offer Templates
        </h2>
        <p className="text-ink-500 mt-1 text-sm">
          {isAdmin
            ? "Create reusable templates for sending offers to players. All teams in the club share these templates."
            : "Templates created by club management for sending offers to players."}
        </p>
      </div>

      {/* Create new template — admin only */}
      {isAdmin && (
        <div className="reveal mb-8" style={{ animationDelay: "60ms" }}>
          <TemplateForm clubId={params.id} />
        </div>
      )}

      {/* Existing templates */}
      {templates.length === 0 ? (
        <div
          className="reveal border-ink-300 shadow-soft rounded-[28px] border border-dashed bg-white p-10 text-center"
          style={{ animationDelay: "120ms" }}
        >
          <h3 className="font-condensed text-ink-900 mb-2 text-lg font-bold uppercase tracking-wide">
            No templates yet
          </h3>
          <p className="text-ink-600 mx-auto max-w-xl">
            {isAdmin
              ? "Create your first offer template above. Templates define the fee structure and included items for offers sent to players."
              : "No templates have been created yet. Ask your club owner or manager to set up offer templates."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template, i) => (
            <div
              key={template.id}
              className="reveal"
              style={{ animationDelay: `${120 + i * 60}ms` }}
            >
              <TemplateCard
                template={template}
                clubId={params.id}
                isAdmin={isAdmin}
                currency={currency}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
