import { NextResponse } from "next/server"
import { getThemePalette } from "@/lib/platform-settings"

export const dynamic = "force-dynamic"

/**
 * GET /api/mobile/config — the app's boot handshake (M4, doc §14).
 * minVersion gates old binaries with a forced-upgrade screen (shipped from
 * v1 because store binaries live for months); the Stripe publishable key
 * rides along so builds don't bake it in. Public — nothing here is secret.
 *
 * palette (Energy Pass): the admin-chosen theme's actual hex values, so the
 * app reskins with the website — and future custom palettes need no app
 * update. The app treats these as overrides on its built-in hardwood theme.
 */

const MIN_VERSION = "1.0.0"

export async function GET() {
  const palette = await getThemePalette()
  return NextResponse.json({
    minVersion: MIN_VERSION,
    stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null,
    palette,
  })
}
