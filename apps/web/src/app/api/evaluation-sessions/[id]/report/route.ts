import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { isClubStaff } from "@/lib/authz/team-scope"
import { buildReport, loadSession } from "@/lib/evaluation/session"

export const dynamic = "force-dynamic"

/** The consolidated report, already filtered to what this viewer may see. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getSessionUserId()
  if (!auth?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const session = await loadSession(params.id)
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!(await isClubStaff(auth.userId, session.tenantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const report = await buildReport(params.id, auth.userId)
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({
    session: { id: session.id, title: session.event.title, status: session.status, visibility: session.visibility },
    ...report,
  })
}
