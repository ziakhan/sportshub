import { NextRequest, NextResponse } from "next/server"
import { getPublishedPost } from "@/lib/queries/content"

export const dynamic = "force-dynamic"

/** GET /api/mobile/browse/news/[slug] — one published article. Anonymous. */
export async function GET(_request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const post = await getPublishedPost(params.slug)
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ post })
  } catch (error) {
    console.error("Mobile article error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
