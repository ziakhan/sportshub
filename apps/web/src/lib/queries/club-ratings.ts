import { prisma } from "@youthbasketballhub/db"

export interface ClubRating {
  average: number
  count: number
}

/**
 * Published-review rating per club, for discovery surfaces (browse cards,
 * club profile). One groupBy regardless of how many clubs are on screen.
 */
export async function getClubRatings(tenantIds: string[]): Promise<Map<string, ClubRating>> {
  if (tenantIds.length === 0) return new Map()
  const grouped = await prisma.review.groupBy({
    by: ["tenantId"],
    // FLAGGED reviews stay publicly visible (and counted) until an admin
    // moderates — only REMOVED drops out. Keep in sync with GET /api/reviews.
    where: { tenantId: { in: tenantIds }, status: { in: ["PUBLISHED", "FLAGGED"] } },
    _avg: { rating: true },
    _count: { rating: true },
  })
  return new Map(
    grouped
      .filter((g: (typeof grouped)[number]) => g.tenantId && g._avg.rating != null)
      .map((g: (typeof grouped)[number]) => [
        g.tenantId as string,
        {
          average: Number((g._avg.rating as number).toFixed(1)),
          count: g._count.rating,
        },
      ])
  )
}
