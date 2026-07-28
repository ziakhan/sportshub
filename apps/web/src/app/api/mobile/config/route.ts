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
 *
 * appVersion (binary version gate, owner 2026-07-25): store BUILD numbers,
 * separate from `minVersion` above (a JS semver the OTA-aware ForcedUpgrade
 * screen compares). OTA updates ship new JS to an already-installed binary
 * without changing its build number, so a hard "this binary is unsupported"
 * gate needs its own signal. All-zero defaults mean the gate is OFF until
 * the owner sets the envs on the box (see runbook).
 */

const MIN_VERSION = "1.0.0"

export async function GET() {
  const palette = await getThemePalette()
  const appVersion = {
    iosMinBuild: Number(process.env.MOBILE_IOS_MIN_BUILD ?? 0),
    iosLatestBuild: Number(process.env.MOBILE_IOS_LATEST_BUILD ?? 0),
    androidMinBuild: Number(process.env.MOBILE_ANDROID_MIN_BUILD ?? 0),
    androidLatestBuild: Number(process.env.MOBILE_ANDROID_LATEST_BUILD ?? 0),
    iosUpdateUrl: process.env.MOBILE_IOS_UPDATE_URL ?? "https://testflight.apple.com/join/tzHQu1VK",
    androidUpdateUrl: process.env.MOBILE_ANDROID_UPDATE_URL ?? "",
    message: process.env.MOBILE_UPDATE_MESSAGE ?? "",
  }
  return NextResponse.json({
    minVersion: MIN_VERSION,
    stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null,
    palette,
    appVersion,
  })
}
