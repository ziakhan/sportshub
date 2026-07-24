import { NextRequest, NextResponse } from "next/server"
import { getClubProfile } from "@/lib/queries/club-profile"
import { trainingSortDate } from "@/lib/training"

export const dynamic = "force-dynamic"

/**
 * GET /api/mobile/browse/clubs/[slug] — a club's public profile for the
 * native club screen. Anonymous.
 *
 * Shares getClubProfile() with the web /club/[slug] page (2026-07-24 drift
 * fix, same class as the directory-clubs/directory-leagues consolidations):
 * this route used to hand-roll its own prisma queries with PUBLISHED-only
 * reviews (undercounting FLAGGED ones, which the web page counts) and no
 * tournament/training-session programs. Existing field names are kept
 * as-is (additive only) — a fielded app build reading only the old fields
 * still works. New: `club.address/phoneNumber/contactEmail/staffCount`,
 * `tournament`/`training` program entries, and richer review status parity.
 *
 * 2026-07-25 (native club-page rebuild): further additive fields for the
 * beautified native club screen — `club.tagline/bannerUrl/zipCode/
 * followerCount`, plus `announcements`, `recentGames`, `upcomingGames`, and
 * `news` (all rendered on web but previously missing from this payload).
 */
export async function GET(_request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const profile = await getClubProfile(params.slug)
    if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const {
      club,
      teams,
      tryouts,
      camps,
      houseLeagues,
      tournaments,
      trainingSessions,
      rating,
      reviews,
      staffCount,
      followerCount,
      announcements,
      recentGames,
      upcomingGames,
      news,
    } = profile

    return NextResponse.json({
      club: {
        id: club.id,
        slug: club.slug,
        name: club.name,
        description: club.description,
        city: club.city,
        state: club.state,
        country: club.country,
        website: club.website,
        status: club.status,
        primaryColor: club.branding?.primaryColor ?? null,
        logoUrl: club.branding?.logoUrl ?? null,
        teams: teams.map((t) => ({ id: t.id, name: t.name, ageGroup: t.ageGroup, gender: t.gender })),
        // Additive (five-tab parity pass, 2026-07-24): the venue/contact
        // details the web page's Contact block shows and the native screen
        // didn't request before.
        address: club.address,
        phoneNumber: club.phoneNumber,
        contactEmail: club.contactEmail,
        staffCount,
        // Additive (native club-page rebuild, 2026-07-25): hero branding +
        // stat-chip data the beautified native screen needs.
        tagline: club.branding?.tagline ?? null,
        bannerUrl: club.branding?.bannerUrl ?? null,
        zipCode: club.zipCode,
        followerCount,
      },
      programs: [
        ...tryouts.map((t: any) => ({
          id: t.id,
          type: "tryout" as const,
          name: t.title,
          ageGroup: t.ageGroup,
          startDate: t.scheduledAt,
          location: t.location,
          fee: t.fee,
        })),
        ...camps.map((c: any) => ({
          id: c.id,
          type: "camp" as const,
          name: c.name,
          ageGroup: c.ageGroup,
          startDate: c.startDate,
          location: c.location,
          fee: c.weeklyFee,
        })),
        ...houseLeagues.map((h: any) => ({
          id: h.id,
          type: "house-league" as const,
          name: h.name,
          ageGroup: (h.ageGroups || "").split(",").join(", "),
          startDate: h.startDate,
          location: h.location,
          fee: h.fee,
        })),
        // Additive: the web Programs block also lists hosted tournaments and
        // trainer sessions — the mobile screen was missing both entirely.
        ...tournaments.map((t: any) => ({
          id: t.id,
          type: "tournament" as const,
          name: t.name,
          ageGroup: null,
          startDate: t.startDate,
          location: [t.city, t.state].filter(Boolean).join(", "),
          fee: t.teamFee,
        })),
        ...trainingSessions.map((s: any) => ({
          id: s.id,
          type: "training" as const,
          name: s.title,
          ageGroup: null,
          startDate: trainingSortDate(s),
          location: s.location || "",
          fee: s.fee,
        })),
      ].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()),
      rating: {
        average: rating.average,
        count: rating.count,
      },
      reviews: reviews.slice(0, 5).map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        content: r.content,
        createdAt: r.createdAt,
        reviewer: r.reviewer?.firstName ?? "Parent",
      })),
      // Additive (native club-page rebuild, 2026-07-25): announcements,
      // schedule and news the web page's Announcements/Schedule/News blocks
      // render but the mobile screen never requested.
      announcements: announcements.map((a: any) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        isPinned: a.isPinned,
        createdAt: a.createdAt,
      })),
      recentGames: recentGames.map((g: any) => ({
        id: g.id,
        scheduledAt: g.scheduledAt,
        status: "COMPLETED" as const,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        homeTeam: { name: g.homeTeam?.name ?? "" },
        awayTeam: { name: g.awayTeam?.name ?? "" },
      })),
      upcomingGames: upcomingGames.map((g: any) => ({
        id: g.id,
        scheduledAt: g.scheduledAt,
        status: g.status,
        homeScore: null,
        awayScore: null,
        homeTeam: { name: g.homeTeam?.name ?? "" },
        awayTeam: { name: g.awayTeam?.name ?? "" },
      })),
      news: news.map((p: any) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        publishedAt: p.publishedAt,
        coverUrl: p.media?.[0]?.posterUrl || (p.media?.[0]?.type === "IMAGE" ? p.media?.[0]?.url : null) || null,
      })),
    })
  } catch (error) {
    console.error("Mobile club profile error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
