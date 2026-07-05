import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { getPublishedPost } from "@/lib/queries/content"
import { Badge, Card } from "@/components/ui"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const post = await getPublishedPost(params.slug)
  if (!post) return { title: "Story not found — SportsHub" }
  return {
    title: `${post.title} — SportsHub`,
    description: post.body.replace(/\s+/g, " ").slice(0, 155),
  }
}

export default async function NewsPostPage({ params }: { params: { slug: string } }) {
  const post = await getPublishedPost(params.slug)
  if (!post) notFound()

  const gameTag = post.tags.find((t: any) => t.gameId)
  const teamTags = post.tags.filter((t: any) => t.team)
  const clubTags = post.tags.filter((t: any) => t.tenant)
  const leagueTag = post.tags.find((t: any) => t.league)
  const leagueSeasonId = leagueTag?.league?.seasons?.[0]?.id

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <Link href="/news" className="text-hoop-600 text-sm hover:underline">
          &larr; All news
        </Link>
      </div>

      <Card className="p-8 sm:p-10">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {post.kind === "RECAP_AI" && <Badge tone="play">Game Recap</Badge>}
          {post.publishedAt && (
            <span className="text-ink-400 text-sm">
              {format(new Date(post.publishedAt), "EEEE, MMMM d, yyyy")}
            </span>
          )}
        </div>

        <h1 className="text-ink-950 mb-6 text-3xl font-bold leading-tight sm:text-4xl">
          {post.title}
        </h1>

        <div className="text-ink-700 space-y-4 text-base leading-8">
          {post.body.split(/\n{2,}/).map((para: string, i: number) => (
            <p key={i}>{para}</p>
          ))}
        </div>

        {post.kind === "RECAP_AI" && (
          <p className="text-ink-400 mt-6 text-xs">
            Recap generated automatically from the official scoring record.
          </p>
        )}

        <div className="border-ink-100 mt-8 flex flex-wrap gap-2 border-t pt-6">
          {gameTag && (
            <Link
              href={`/live/${gameTag.gameId}`}
              className="bg-play-600 hover:bg-play-700 rounded-full px-4 py-1.5 text-xs font-semibold text-white transition"
            >
              Box score &amp; play-by-play &rarr;
            </Link>
          )}
          {teamTags.map((t: any) => (
            <Link
              key={t.team.id}
              href={`/team/${t.team.id}`}
              className="bg-ink-50 text-ink-700 ring-ink-200 hover:bg-ink-100 rounded-full px-4 py-1.5 text-xs font-semibold ring-1 transition"
            >
              {t.team.name}
            </Link>
          ))}
          {clubTags.map((t: any) => (
            <Link
              key={t.tenant.id}
              href={`/club/${t.tenant.slug}`}
              className="bg-ink-50 text-ink-700 ring-ink-200 hover:bg-ink-100 rounded-full px-4 py-1.5 text-xs font-semibold ring-1 transition"
            >
              {t.tenant.name}
            </Link>
          ))}
          {leagueTag && leagueSeasonId && (
            <Link
              href={`/league/${leagueSeasonId}`}
              className="bg-ink-50 text-ink-700 ring-ink-200 hover:bg-ink-100 rounded-full px-4 py-1.5 text-xs font-semibold ring-1 transition"
            >
              {leagueTag.league.name}
            </Link>
          )}
        </div>
      </Card>
    </div>
  )
}
