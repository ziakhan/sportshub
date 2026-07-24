import { NextRequest, NextResponse } from "next/server"
import { getClubsDirectory } from "@/lib/queries/directory-clubs"

export const dynamic = "force-dynamic"

/**
 * GET /api/mobile/browse/clubs?q=&city= — the public clubs directory for the
 * native Browse → Clubs screen. Anonymous.
 *
 * Shares getClubsDirectory() with the web /club page (2026-07-24 drift fix,
 * same class as the leagues directory bug) — the native screen previously
 * called /api/clubs/public, a separate query that never excluded
 * test-world/simulator tenants and had no featured/city grouping, so the two
 * browse surfaces could show different club sets. `q` and `city` are new
 * (additive) params; a build that doesn't send them still gets the full
 * directory, unfiltered.
 */
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q") || undefined
    const city = request.nextUrl.searchParams.get("city") || undefined

    const { featured, clubs, cities } = await getClubsDirectory({ q, city })

    const shape = (c: (typeof clubs)[number]) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      city: c.city,
      state: c.state,
      description: c.description,
      status: c.status,
      // Kept for parity with the old /api/clubs/public shape the app used.
      teamCount: c._count.teams,
      tryoutCount: c._count.tryouts,
      primaryColor: c.branding?.primaryColor || "#1a73e8",
      logoUrl: c.branding?.logoUrl ?? null,
    })

    return NextResponse.json({
      clubs: clubs.map(shape),
      featured: featured.map(shape),
      cities,
    })
  } catch (error) {
    console.error("Mobile clubs directory error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
