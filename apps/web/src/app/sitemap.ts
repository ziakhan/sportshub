import type { MetadataRoute } from "next"
import { prisma } from "@youthbasketballhub/db"
import { siteUrl } from "@/lib/site"
import { isTestWorldSlug } from "@/lib/demo-data"

export const dynamic = "force-dynamic"

/**
 * Single sitemap for now (~few hundred URLs). Split with generateSitemaps()
 * when any segment approaches thousands of entries (seo-strategy Phase T).
 *
 * Deliberate exclusions:
 * - /player/[id] — bare stat pages stay out of the sitemap; claimed handle
 *   URLs (/p/<handle>) represent players (family opt-in signal; minors
 *   indexing policy in docs/roadmap/seo-strategy.md §1.3).
 * - /live/[gameId] — ephemeral; recaps are the durable game pages.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl()

  const [clubs, posts, seasons, camps, tryouts, houseLeagues, tournaments, handles] =
    await Promise.all([
      prisma.tenant.findMany({
        where: { status: { in: ["ACTIVE", "UNCLAIMED"] } },
        select: { slug: true, updatedAt: true },
      }),
      prisma.post.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, publishedAt: true, updatedAt: true },
      }),
      prisma.season.findMany({
        where: { status: { not: "DRAFT" } },
        select: { id: true, updatedAt: true },
      }),
      prisma.camp.findMany({ select: { id: true, updatedAt: true } }),
      prisma.tryout.findMany({ select: { id: true, updatedAt: true } }),
      prisma.houseLeague.findMany({ select: { id: true, updatedAt: true } }),
      prisma.tournament.findMany({ select: { id: true, updatedAt: true } }),
      prisma.player.findMany({
        where: { handle: { not: null } },
        select: { handle: true, updatedAt: true },
      }),
    ])

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/club`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/leagues`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/scores`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${base}/news`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/events`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/marketplace`, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/for-clubs`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/for-leagues`, changeFrequency: "monthly", priority: 0.6 },
  ]

  const realClubs = clubs.filter((c) => !isTestWorldSlug(c.slug))

  return [
    ...staticPages,
    ...realClubs.map((c) => ({
      url: `${base}/club/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...posts.map((p) => ({
      url: `${base}/news/${p.slug}`,
      lastModified: p.updatedAt ?? p.publishedAt ?? undefined,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...seasons.map((s) => ({
      url: `${base}/league/${s.id}`,
      lastModified: s.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...camps.map((c) => ({
      url: `${base}/camp/${c.id}`,
      lastModified: c.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...tryouts.map((t) => ({
      url: `${base}/tryout/${t.id}`,
      lastModified: t.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...houseLeagues.map((h) => ({
      url: `${base}/house-league/${h.id}`,
      lastModified: h.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...tournaments.map((t) => ({
      url: `${base}/tournament/${t.id}`,
      lastModified: t.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...handles
      .filter((h): h is { handle: string; updatedAt: Date } => !!h.handle)
      .map((h) => ({
        url: `${base}/p/${h.handle}`,
        lastModified: h.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.5,
      })),
  ]
}
