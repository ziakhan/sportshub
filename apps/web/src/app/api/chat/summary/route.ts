import { NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getChatTeamSummaries } from "@/lib/teams/chat-access"

export const dynamic = "force-dynamic"

/** The signed-in user's team chats + unread counts — feeds the chat dock. */
export async function GET() {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const teams = await getChatTeamSummaries(auth.userId)
    return NextResponse.json({ teams })
  } catch (error) {
    console.error("Chat summary error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
