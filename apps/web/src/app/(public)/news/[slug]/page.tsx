import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { getPostBySlug, getPublishedPost } from "@/lib/queries/content"
import { getSessionUserId } from "@/lib/auth-helpers"
import { canManageRecapPost } from "@/lib/content/recap-authz"
import { Badge, Card } from "@/components/ui"
import { AdminBar } from "./admin-bar"
import { prisma } from "@youthbasketballhub/db"
import { publicPlayerName } from "@/lib/privacy/names"
import { JsonLd, newsArticleJsonLd } from "@/lib/seo/jsonld"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const post = await getPublishedPost(params.slug)
  if (!post) return { title: "Story not found" }
  return {
    title: `${post.title}`,
    description: post.body.replace(/\s+/g, " ").slice(0, 155),
    alternates: { canonical: `/news/${params.slug}` },
  }
}

export default async function NewsPostPage({ params }: { params: { slug: string } }) {
  // Fetch any-status, then gate: managers (league owner, club owner/manager,
  // platform admin) can still see a TAKEN_DOWN story — that's how they
  // restore it. Everyone else 404s on anything not PUBLISHED.
  const post = await getPostBySlug(params.slug)
  if (!post) notFound()

  const viewer = await getSessionUserId()
  const canManage = viewer ? (await canManageRecapPost(post.id, viewer)).allowed : false
  if (post.status !== "PUBLISHED" && !canManage) notFound()

  const gameTag = post.tags.find((t: any) => t.gameId)
  const teamTags = post.tags.filter((t: any) => t.team)
  const clubTags = post.tags.filter((t: any) => t.tenant)
  const leagueTag = post.tags.find((t: any) => t.league)
  const leagueSeasonId = leagueTag?.league?.seasons?.[0]?.id
  const images = (post.media ?? []).filter((m: any) => m.type === "IMAGE")
  const videos = (post.media ?? []).filter((m: any) => m.type === "VIDEO_EMBED")

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10 sm:px-6">
      {post.status === "PUBLISHED" && (
        <JsonLd
          data={newsArticleJsonLd({
            slug: params.slug,
            title: post.title,
            body: post.body,
            publishedAt: post.publishedAt,
            imageUrls: images.map((m: any) => m.url).filter(Boolean),
          })}
        />
      )}
      <div className="mb-6">
        <Link href="/news" className="text-hoop-600 text-sm hover:underline">
          &larr; All news
        </Link>
      </div>

      {canManage && (
        <AdminBar
          postId={post.id}
          status={post.status}
          title={post.title}
          body={post.body}
          isRecap={post.kind === "RECAP_AI"}
        />
      )}

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

        {images[0] && (
          <div className="bg-ink-100 mb-6 overflow-hidden rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[0].url}
              alt={images[0].title || post.title}
              className="aspect-[16/9] w-full object-cover"
            />
          </div>
        )}

        <div className="text-ink-700 space-y-4 text-base leading-8">
          {post.body.split(/\n{2,}/).map((para: string, i: number) => (
            <p key={i}>{para}</p>
          ))}
        </div>

        {videos.length > 0 && (
          <div className="mt-6 space-y-4">
            {videos.map((v: any) => (
              <div key={v.id} className="bg-ink-950 overflow-hidden rounded-2xl">
                <iframe
                  src={v.url}
                  title={v.title || post.title}
                  className="aspect-video w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ))}
          </div>
        )}

        {images.length > 1 && (
          <div className="mt-6 grid grid-cols-2 gap-3">
            {images.slice(1).map((img: any) => (
              <div key={img.id} className="bg-ink-100 overflow-hidden rounded-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.title || ""} className="aspect-[4/3] w-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {/* Player of the Game reference (owner 2026-07-23: the game summary
            article never mentioned the award) — render-time lookup so recaps
            written before the award still show it */}
        {gameTag &&
          (await (async () => {
            const g = await (prisma as any).game.findUnique({
              where: { id: gameTag.gameId },
              select: {
                potgPlayerId: true,
                potgPlayer: { select: { firstName: true, lastName: true, mediaConsent: true } },
              },
            })
            if (!g?.potgPlayerId) return null
            return (
              <Link
                href={`/player/${g.potgPlayerId}`}
                className="border-gold-300 bg-gold-50 text-gold-800 mt-6 flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold hover:bg-gold-100"
              >
                🏀 Player of the Game: {publicPlayerName(g.potgPlayer)}
              </Link>
            )
          })())}

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
