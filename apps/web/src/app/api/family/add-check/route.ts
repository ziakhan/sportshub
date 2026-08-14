import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { rateLimit } from "@/lib/rate-limit"
import { findSelfRegisteredMatches } from "@/lib/family/claim-target"

export const dynamic = "force-dynamic"

/**
 * GET /api/family/add-check — "this kid may already be on here" checked while
 * the parent fills in the add-a-player form (parent-child linking arc
 * 2026-08-13).
 *
 * Contract:
 *   query  firstName=Jamie&lastName=Okafor&birthYear=2011
 *   200    { selfRegisteredMatch: true | false }
 *   400    { error } — a field is missing or the year is not a real year
 *   401    { error } — signed out
 *   429    { error } — over the hourly ceiling
 *
 * A true means somebody already signed up as that name and birth year and is
 * still their own guardian, so the parent is about to create the second copy
 * of a child who is already here. The right next step is a link (send them a
 * link code, or invite them), not another player row.
 *
 * Advisory only. POST /api/players is untouched and still creates whatever it
 * is told to: the parent may genuinely have a second kid with the same name
 * and year, and a name collision is never a reason to block a family.
 *
 * One bit, same as claim-check: no name, no email, no id, no count. The
 * parent supplied the name and year themselves, so the answer tells them
 * nothing they did not already type.
 */

const MAX_CHECKS_PER_HOUR = 10

export async function GET(request: NextRequest) {
  const session = await getSessionUserId()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!rateLimit(`family-add-check:${session.userId}`, MAX_CHECKS_PER_HOUR, 60 * 60_000)) {
    return NextResponse.json(
      { error: "Too many checks. Try again in a little while." },
      { status: 429 }
    )
  }

  const params = new URL(request.url).searchParams
  const firstName = (params.get("firstName") ?? "").trim()
  const lastName = (params.get("lastName") ?? "").trim()
  const birthYear = Number(params.get("birthYear"))
  const thisYear = new Date().getFullYear()
  if (
    !firstName ||
    !lastName ||
    !Number.isInteger(birthYear) ||
    birthYear < 1900 ||
    birthYear > thisYear
  ) {
    return NextResponse.json({ error: "Enter a first name, last name, and birth year" }, { status: 400 })
  }

  const matches = await findSelfRegisteredMatches({ firstName, lastName, birthYear })
  return NextResponse.json({ selfRegisteredMatch: matches.length > 0 })
}
