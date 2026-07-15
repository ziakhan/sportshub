import { NextResponse } from "next/server"
import { getAllPrograms } from "@/lib/queries/programs"

export const dynamic = "force-dynamic"

/**
 * GET /api/mobile/browse/programs — the full public programs list (tryouts,
 * house leagues, camps, tournaments), same aggregation as the web /events
 * page. Anonymous.
 */
export async function GET() {
  try {
    return NextResponse.json({ programs: await getAllPrograms() })
  } catch (error) {
    console.error("Mobile programs error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
