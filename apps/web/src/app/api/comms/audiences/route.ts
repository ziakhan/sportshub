// GET /api/comms/audiences?scope=&orgId= — the composer's audience options
// (computed, with live recipient counts). Authorization mirrors the send
// endpoint: TENANT → ClubOwner/ClubManager of that tenant; LEAGUE → the
// league owner or league-scoped LeagueOwner/LeagueManager; PLATFORM →
// PlatformAdmin. docs/season-continuity-plan.md §4.

import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { canSendOrgComms, listAudiences } from "@/lib/comms/audiences"
import type { ConsentScope } from "@/lib/comms/consent"

export const dynamic = "force-dynamic"

const SCOPES: ConsentScope[] = ["TENANT", "LEAGUE", "PLATFORM"]

export async function GET(request: NextRequest) {
  const auth = await getSessionUserId()
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const scope = request.nextUrl.searchParams.get("scope") as ConsentScope | null
  const orgIdParam = request.nextUrl.searchParams.get("orgId")

  if (!scope || !SCOPES.includes(scope)) {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 })
  }
  const orgId = scope === "PLATFORM" ? null : orgIdParam
  if (scope !== "PLATFORM" && !orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 })
  }

  const allowed = await canSendOrgComms(scope, orgId, auth.userId, auth.isPlatformAdmin)
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const audiences = await listAudiences(scope, orgId)
  return NextResponse.json({ audiences })
}
