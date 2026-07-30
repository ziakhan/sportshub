import Link from "next/link"
import { prisma } from "@youthbasketballhub/db"
import { notFound } from "next/navigation"
import { EntityHeader, SmartBack, Badge } from "@/components/ui"

export const dynamic = "force-dynamic"

/**
 * Public league-operator profile (owner 2026-07-29, decision: public from
 * day one): the organization's identity + every league it runs, each linking
 * to its latest season.
 */
export default async function OrganizationPage({ params }: { params: { slug: string } }) {
  const org = await (prisma as any).organization.findUnique({
    where: { slug: params.slug },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      primaryColor: true,
      tagline: true,
      description: true,
      leagues: {
        select: {
          id: true,
          name: true,
          description: true,
          seasons: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, label: true, status: true, _count: { select: { teamSubmissions: true } } },
          },
        },
        orderBy: { name: "asc" },
      },
    },
  })
  if (!org) notFound()

  const STATUS: Record<string, string> = {
    DRAFT: "Not started",
    REGISTRATION: "Registration open",
    REGISTRATION_CLOSED: "Registration closed",
    FINALIZED: "Finalized",
    IN_PROGRESS: "In progress",
    COMPLETED: "Completed",
  }

  return (
    <div className="container mx-auto px-4 py-10 sm:px-6">
      <SmartBack fallback="/leagues" fallbackLabel="Leagues" className="-ml-1 mb-2" />
      <EntityHeader
        name={org.name}
        subtitle={org.tagline ?? "League operator"}
        meta={[`${org.leagues.length} league${org.leagues.length === 1 ? "" : "s"}`]}
        primaryColor={org.primaryColor ?? "#4f46e5"}
        logoUrl={org.logoUrl}
        crestText={org.name.slice(0, 1)}
        className="mb-6"
      />
      {org.description && <p className="text-ink-600 mb-8 max-w-2xl text-sm">{org.description}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {org.leagues.map((l: any) => {
          const season = l.seasons[0]
          return (
            <Link
              key={l.id}
              href={season ? `/league/${season.id}` : "#"}
              className="border-ink-100 shadow-soft hover:border-play-200 group rounded-2xl border bg-white p-5 transition"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-ink-950 group-hover:text-play-600 font-semibold transition-colors">
                  {l.name}
                </p>
                {season && (
                  <Badge tone={season.status === "REGISTRATION" ? "success" : "neutral"}>
                    {STATUS[season.status] ?? season.status}
                  </Badge>
                )}
              </div>
              {season && (
                <p className="text-ink-500 mt-1 text-sm">
                  {season.label}
                  {season._count.teamSubmissions > 0
                    ? ` · ${season._count.teamSubmissions} teams`
                    : ""}
                </p>
              )}
              {l.description && (
                <p className="text-ink-400 mt-1 line-clamp-2 text-xs">{l.description}</p>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
