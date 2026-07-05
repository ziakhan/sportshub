import { NextRequest, NextResponse } from "next/server"
import { getSeasonStandings } from "@/lib/queries/standings"

export const dynamic = "force-dynamic"

/**
 * GET /api/seasons/[id]/standings — compute standings on read.
 * Public (no auth) so league landing pages can embed the table.
 * Shares getSeasonStandings with the public league hub page.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const standings = await getSeasonStandings(params.id)
    if (!standings) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(standings)
  } catch (error) {
    console.error("Standings error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
