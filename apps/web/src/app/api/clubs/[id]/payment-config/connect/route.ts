import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { getPaymentConfig } from "@/lib/payments/config"
import { getStripe, StripeNotConfiguredError } from "@/lib/payments/stripe"

export const dynamic = "force-dynamic"

/**
 * Stripe Connect onboarding for a club (CONNECT_DIRECT mode).
 * POST /api/clubs/[id]/payment-config/connect
 *
 * Creates (or reuses) the club's Express connected account and returns a
 * Stripe-hosted onboarding link. Money from direct charges lands in THIS
 * account — the platform never holds it. Completion is confirmed by the
 * `account.updated` webhook flipping stripeAccountStatus to "active".
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const tenant = await prisma.tenant.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, contactEmail: true, country: true },
    })
    if (!tenant) return NextResponse.json({ error: "Club not found" }, { status: 404 })

    const hasAccess = await prisma.userRole.findFirst({
      where: {
        userId: sessionInfo.userId,
        OR: [
          { tenantId: params.id, role: { in: ["ClubOwner", "ClubManager", "Trainer"] as any } },
          { role: "PlatformAdmin" },
        ],
      },
    })
    if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // A connected account is needed in BOTH online modes: direct charges
    // live on it, and platform-collect destination charges transfer into it.
    const config = await getPaymentConfig({ tenantId: params.id })
    if (!config.connectAllowed && !config.platformCollectAllowed) {
      return NextResponse.json(
        { error: "Online payments via Stripe are not enabled for this club", code: "MODE_NOT_ALLOWED" },
        { status: 400 }
      )
    }

    const stripe = getStripe()

    let accountId = config.stripeAccountId
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: tenant.country || "CA",
        email: tenant.contactEmail ?? undefined,
        business_profile: { name: tenant.name },
        metadata: { tenantId: tenant.id },
      })
      accountId = account.id
      await prisma.paymentConfig.upsert({
        where: { tenantId: params.id },
        create: { tenantId: params.id, stripeAccountId: accountId, stripeAccountStatus: "pending" },
        update: { stripeAccountId: accountId, stripeAccountStatus: "pending" },
      })
    }

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${baseUrl}/clubs/${params.id}/settings?connect=refresh`,
      return_url: `${baseUrl}/clubs/${params.id}/settings?connect=return`,
    })

    return NextResponse.json({ url: link.url, accountId })
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 503 })
    }
    console.error("Connect onboarding error:", error)
    return NextResponse.json({ error: "Failed to start Stripe onboarding" }, { status: 500 })
  }
}
