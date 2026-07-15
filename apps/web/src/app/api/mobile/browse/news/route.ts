import { NextResponse } from "next/server"
import { getPublicFeed } from "@/lib/queries/content"

export const dynamic = "force-dynamic"

/** GET /api/mobile/browse/news — the public news feed (posts + public announcements). Anonymous. */
export async function GET() {
  try {
    return NextResponse.json({ items: await getPublicFeed(30) })
  } catch (error) {
    console.error("Mobile news error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
