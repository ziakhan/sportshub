import { prisma } from "@youthbasketballhub/db"
import { notFound } from "next/navigation"
import Link from "next/link"
import { getCurrentUser } from "@/lib/auth-helpers"
import { LeagueBrandEditor } from "./league-brand-editor"

export const dynamic = "force-dynamic"

export default async function CustomizeLeaguePage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) notFound()

  const league = await (prisma as any).league.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true, ownerId: true, description: true,
      logoUrl: true, bannerUrl: true, tagline: true, primaryColor: true, socials: true,
      perks: true, perksNote: true,
      seasons: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } },
    },
  })
  if (!league) notFound()

  const roles = user.roles.map((r: any) => r.role)
  const isAdmin =
    roles.includes("PlatformAdmin") ||
    league.ownerId === user.id ||
    user.roles.some(
      (r: any) => r.leagueId === params.id && (r.role === "LeagueOwner" || r.role === "LeagueManager")
    )
  if (!isAdmin) notFound()

  const latestSeason = league.seasons[0]?.id as string | undefined

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={`/manage/leagues/${params.id}`}
            className="text-play-700 text-sm font-medium hover:underline"
          >
            &larr; Back to league
          </Link>
          <h1 className="text-ink-950 mt-1 text-xl font-bold">Customize your league page</h1>
          <p className="text-ink-500 text-sm">
            Brand the public page for {league.name}. Standings, scores, and leaders are shown
            automatically.
          </p>
        </div>
        {latestSeason && (
          <Link
            href={`/league/${latestSeason}`}
            target="_blank"
            className="border-ink-200 text-ink-700 hover:bg-ink-50 shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold transition"
          >
            View public page ↗
          </Link>
        )}
      </div>

      <LeagueBrandEditor
        leagueId={params.id}
        initial={{
          description: league.description ?? "",
          logoUrl: league.logoUrl ?? null,
          bannerUrl: league.bannerUrl ?? null,
          tagline: league.tagline ?? "",
          primaryColor: league.primaryColor ?? "#1d4ed8",
          socials: (league.socials as any) ?? {},
          perks: (league.perks as any) ?? [],
          perksNote: league.perksNote ?? "",
        }}
      />
    </div>
  )
}
