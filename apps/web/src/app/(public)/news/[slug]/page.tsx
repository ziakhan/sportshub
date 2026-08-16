import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { getPostBySlug, getPublishedPost } from "@/lib/queries/content"
import { getSessionUserId } from "@/lib/auth-helpers"
import { canManageRecapPost } from "@/lib/content/recap-authz"
import { Badge, Card, SmartBack } from "@/components/ui"
import {
  LeaderboardCard,
  MatchupCard,
  RivalryCard,
} from "@/components/social/cards/showcase-cards"
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

  /** Session-cadence kinds store a card payload as JSON rather than prose. */
  const generatedPayload = (() => {
    if (!["LEADERBOARD", "MATCHUP", "RIVALRY", "CLUTCH_PLAY"].includes(post.kind)) return null
    try {
      const v = JSON.parse(post.body)
      return v && typeof v === "object" ? v : null
    } catch {
      return null
    }
  })()

  return (
    <div className="container mx-auto max-w-3xl px-4 pb-10 pt-4 sm:px-6 sm:pt-8">
      {post.status === "PUBLISHED" && (
        <JsonLd
          data={newsArticleJsonLd({
            slug: params.slug,
            title: post.title,
            // JSON payloads must never leak into search metadata.
            body: generatedPayload
              ? (generatedPayload.lede ?? generatedPayload.caption ?? post.title)
              : post.body,
            publishedAt: post.publishedAt,
            imageUrls: images.map((m: any) => m.url).filter(Boolean),
          })}
        />
      )}
      {canManage && (
        <AdminBar
          postId={post.id}
          status={post.status}
          title={post.title}
          body={post.body}
          isRecap={post.kind === "RECAP_AI"}
        />
      )}

      <Card className="p-5 sm:p-10">
        {/* One flat header row: back control, kind, date (owner 2026-08-17,
            "flattened and lowered": the back row and the pill row were
            stacking into dead space above the title on phones). */}
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <SmartBack fallback="/news" fallbackLabel="News" className="-ml-1" />
          {post.kind === "RECAP_AI" && <Badge tone="play">Game Recap</Badge>}
          {post.publishedAt && (
            <span className="text-ink-400 text-sm">
              {format(new Date(post.publishedAt), "EEEE, MMMM d, yyyy")}
            </span>
          )}
        </div>

        <h1 className="text-ink-950 mb-4 text-3xl font-bold leading-tight sm:text-4xl">
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

        {/* Generated kinds carry a JSON payload in `body`, not prose — render
            the card and its written copy instead of dumping JSON on the page
            (2026-08-13). Everything else reads as paragraphs, unchanged. */}
        {generatedPayload ? (
          <div className="space-y-5">
            {post.kind === "LEADERBOARD" && <LeaderboardCard {...(generatedPayload as any)} />}
            {post.kind === "MATCHUP" && <MatchupCard {...(generatedPayload as any)} />}
            {post.kind === "RIVALRY" && <RivalryCard {...(generatedPayload as any)} />}
            {typeof generatedPayload.lede === "string" && (
              <p className="text-ink-700 text-base leading-8">{generatedPayload.lede}</p>
            )}
            {typeof generatedPayload.caption === "string" && (
              <p className="text-ink-700 text-base leading-8">{generatedPayload.caption}</p>
            )}
            {typeof generatedPayload.note === "string" && (
              <p className="text-ink-700 text-base leading-8">{generatedPayload.note}</p>
            )}
          </div>
        ) : (
          <div className="text-ink-700 space-y-4 text-base leading-8">
            {post.body.split(/\n{2,}/).map((para: string, i: number) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        )}

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
                <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
                  <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  <path
                    d="M2 10h16M10 2v16M4.2 4.2c3.2 3.2 3.2 8.4 0 11.6M15.8 4.2c-3.2 3.2-3.2 8.4 0 11.6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                </svg>
                Player of the Game: {publicPlayerName(g.potgPlayer)}
              </Link>
            )
          })())}

        {post.kind === "RECAP_AI" && (
          <p className="text-ink-400 mt-6 text-xs">
            From the official scoring record.
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
