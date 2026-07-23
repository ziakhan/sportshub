import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { getPaymentConfig } from "@/lib/payments/config"
import { getStripe, StripeNotConfiguredError } from "@/lib/payments/stripe"
import { appBaseUrl } from "@/lib/email"

export const dynamic = "force-dynamic"

/**
 * Stripe Connect onboarding for a LEAGUE (payments v2 Stage H — league
 * parity). Mirrors the club route keyed on leagueId. Same Express account
 * serves both charge modes; clubs paying league fees online depend on this.
 */
async function leagueAccess(userId: string, leagueId: string, isAdmin: boolean) {
  if (isAdmin) return true
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { ownerId: true },
  })
  if (league?.ownerId === userId) return true
  const mgr = await prisma.userRole.findFirst({
    where: { userId, leagueId, role: { in: ["LeagueOwner", "LeagueManager"] } },
  })
  return !!mgr
}

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const league = await prisma.league.findUnique({
      where: { id: params.id },
      select: { id: true, name: true },
    })
    if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 })
    if (!(await leagueAccess(sessionInfo.userId, params.id, !!sessionInfo.isPlatformAdmin))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const config = await getPaymentConfig({ leagueId: params.id })
    if (!config.connectAllowed && !config.platformCollectAllowed) {
      return NextResponse.json(
        { error: "Online payments via Stripe are not enabled for this league", code: "MODE_NOT_ALLOWED" },
        { status: 400 }
      )
    }

    const stripe = getStripe()
    let accountId = config.stripeAccountId
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "CA",
        business_profile: { name: league.name },
        metadata: { leagueId: league.id },
      })
      accountId = account.id
      await prisma.paymentConfig.upsert({
        where: { leagueId: params.id },
        create: { leagueId: params.id, stripeAccountId: accountId, stripeAccountStatus: "pending" },
        update: { stripeAccountId: accountId, stripeAccountStatus: "pending" },
      })
    }

    const baseUrl = appBaseUrl()
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${baseUrl}/manage/leagues/${params.id}/payments?connect=refresh`,
      return_url: `${baseUrl}/manage/leagues/${params.id}/payments?connect=return`,
    })
    return NextResponse.json({ url: link.url, accountId })
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 503 })
    }
    console.error("League connect onboarding error:", error)
    return NextResponse.json({ error: "Failed to start Stripe onboarding" }, { status: 500 })
  }
}
