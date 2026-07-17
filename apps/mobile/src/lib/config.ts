import { useEffect, useState } from "react"
import { AppState } from "react-native"
import Constants from "expo-constants"
import type { ThemePalette } from "@youthbasketballhub/design-tokens"
import { apiBaseUrl } from "./api"

/**
 * Boot handshake (doc §14): GET /api/mobile/config → { minVersion,
 * stripePublishableKey, palette }. Old binaries get the forced-upgrade
 * screen; the Stripe key configures StripeProvider without baking it into
 * builds; palette reskins the app to the admin-chosen Energy Pass theme.
 * Refetched on every foreground so palette flips (and minVersion bumps)
 * reach long-lived app sessions. Unreachable config fails open — a network
 * blip must not brick the app.
 */

export interface MobileConfig {
  minVersion: string
  stripePublishableKey: string | null
  palette?: ThemePalette | null
}

export function appVersion(): string {
  return Constants.expoConfig?.version ?? "0.0.0"
}

/** true when a < b in semver-ish dotted-number terms */
export function versionLessThan(a: string, b: string): boolean {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0)
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x !== y) return x < y
  }
  return false
}

export function useMobileConfig(): {
  config: MobileConfig | null
  mustUpgrade: boolean
} {
  const [config, setConfig] = useState<MobileConfig | null>(null)

  useEffect(() => {
    let cancelled = false
    async function refresh() {
      try {
        const res = await fetch(`${apiBaseUrl()}/api/mobile/config`)
        if (!res.ok) return
        const data = (await res.json()) as MobileConfig
        if (!cancelled) setConfig(data)
      } catch {
        // fail open
      }
    }
    void refresh()
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh()
    })
    return () => {
      cancelled = true
      sub.remove()
    }
  }, [])

  const mustUpgrade = config ? versionLessThan(appVersion(), config.minVersion) : false
  return { config, mustUpgrade }
}
