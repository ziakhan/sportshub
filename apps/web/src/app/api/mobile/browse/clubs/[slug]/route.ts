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
 */
export async function GET(_request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const profile = await getClubProfile(params.slug)
    if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { club, teams, tryouts, camps, houseLeagues, tournaments, trainingSessions, rating, reviews, staffCount } =
      profile

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
    })
  } catch (error) {
    console.error("Mobile club profile error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
