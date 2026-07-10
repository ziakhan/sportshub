import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * GET /api/mobile/config — the app's boot handshake (M4, doc §14).
 * minVersion gates old binaries with a forced-upgrade screen (shipped from
 * v1 because store binaries live for months); the Stripe publishable key
 * rides along so builds don't bake it in. Public — nothing here is secret.
 */

const MIN_VERSION = "1.0.0"

export async function GET() {
  return NextResponse.json({
    minVersion: MIN_VERSION,
    stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null,
  })
}
