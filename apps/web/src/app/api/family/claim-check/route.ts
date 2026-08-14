import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { rateLimit } from "@/lib/rate-limit"
import { findClaimTargetByName } from "@/lib/family/claim-target"

export const dynamic = "force-dynamic"

/**
 * GET /api/family/claim-check?birthYear=YYYY — "has a parent already added
 * you?" asked during onboarding (parent-child linking arc 2026-08-13).
 *
 * Contract:
 *   query  birthYear=2011
 *   200    { match: true | false }
 *   400    { error } — birthYear missing or not a real year
 *   401    { error } — signed out
 *   429    { error } — over the hourly ceiling
 *
 * The answer is one bit and nothing else: no name, no email, no id, no count.
 * The kid is being asked about THEIR OWN name and birth year, which they
 * already know, so the bit tells them nothing about anyone else's account.
 * Everything that could identify the family stays server-side until the
 * parent themself approves the link.
 *
 * Runs before onboarding finishes, so it must work for a user with no roles,
 * no player row, and no onboardedAt.
 */

/** A guess-and-check crawler would need a name and a birth year per try. */
const MAX_CHECKS_PER_HOUR = 10

export async function GET(request: NextRequest) {
  const session = await getSessionUserId()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!rateLimit(`family-claim-check:${session.userId}`, MAX_CHECKS_PER_HOUR, 60 * 60_000)) {
    return NextResponse.json(
      { error: "Too many checks. Try again in a little while." },
      { status: 429 }
    )
  }

  const raw = new URL(request.url).searchParams.get("birthYear")
  const birthYear = Number(raw)
  const thisYear = new Date().getFullYear()
  if (!raw || !Number.isInteger(birthYear) || birthYear < 1900 || birthYear > thisYear) {
    return NextResponse.json({ error: "Enter the year they were born" }, { status: 400 })
  }

  const me = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { firstName: true, lastName: true },
  })
  if (!me?.firstName?.trim() || !me?.lastName?.trim()) {
    return NextResponse.json({ match: false })
  }

  const matches = await findClaimTargetByName({
    firstName: me.firstName,
    lastName: me.lastName,
    birthYear,
  })

  return NextResponse.json({ match: matches.length > 0 })
}
