import { prisma } from "@youthbasketballhub/db"
import Link from "next/link"
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

async function getTeamWithTemplates(teamId: string, tenantId: string): Promise<{ id: string; name: string; offerTemplates: TemplateData[] } | null> {
  const team = await prisma.team.findFirst({
    where: { id: teamId, tenantId },
    select: {
      id: true,
      name: true,
      offerTemplates: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
      },
    },
  })
  if (!team) return null
  return {
    ...team,
    offerTemplates: team.offerTemplates.map((t: any) => ({
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
    })),
  }
}

export default async function OfferTemplatesPage({
  params,
}: {
  params: { id: string; teamId: string }
}) {
  const team = await getTeamWithTemplates(params.teamId, params.id)

  if (!team) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-700">Team not found.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/clubs/${params.id}/teams`}
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back to Teams
        </Link>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          {team.name} - Offer Templates
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Create reusable templates to quickly send offers to players.
          Define what&apos;s included and the pricing structure.
        </p>
      </div>

      {/* Create new template */}
      <div className="mb-8">
        <TemplateForm teamId={params.teamId} clubId={params.id} />
      </div>

      {/* Existing templates */}
      {team.offerTemplates.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-8 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No templates yet</h3>
          <p className="text-gray-600">
            Create your first offer template above to start sending offers.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {team.offerTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={{
                ...template,
                seasonFee: Number(template.seasonFee),
              }}
              teamId={params.teamId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
