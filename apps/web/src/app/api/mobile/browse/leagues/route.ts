import { NextResponse } from "next/server"
import { getLeaguesDirectory } from "@/lib/queries/directory-leagues"

export const dynamic = "force-dynamic"

/**
 * GET /api/mobile/browse/leagues — every league in the public directory, for
 * the native Browse → Leagues screen. Anonymous.
 *
 * Shares getLeaguesDirectory() with the web /leagues page (2026-07-24 drift
 * fix) — this used to run its own query filtered to
 * `seasons.some.status IN (REGISTRATION, IN_PROGRESS)`, which hid any league
 * whose only season was still DRAFT or already past REGISTRATION_CLOSED /
 * FINALIZED / COMPLETED. New leagues were invisible on iOS while visible on
 * web. Field shape kept backward-compatible (`seasons: [season]`,
 * `teamCount`/`divisionCount` on each season) with the richer directory
 * fields (`completedGames`, `liveGames`, full season dates) added
 * additively — a fielded app build reading only the old fields still works.
 */
export async function GET() {
  try {
    const leagues = await getLeaguesDirectory()

    return NextResponse.json({
      leagues: leagues.map((l) => ({
        id: l.id,
        name: l.name,
        description: l.description,
        perks: l.perks,
        completedGames: l.completedGames,
        liveGames: l.liveGames,
        // Kept as an array (old shape) — always the one latest season.
        seasons: [
          {
            id: l.season.id,
            name: l.season.label,
            status: l.season.status,
            startDate: l.season.startDate,
            endDate: l.season.endDate,
            teamCount: l.season.teamCount,
            divisionCount: l.season.divisionCount,
          },
        ],
      })),
    })
  } catch (error) {
    console.error("Mobile leagues error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
