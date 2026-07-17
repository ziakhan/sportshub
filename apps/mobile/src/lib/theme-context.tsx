import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import * as SecureStore from "expo-secure-store"
import {
  DEFAULT_PALETTE_ID,
  PALETTES,
  type ThemePalette,
} from "@youthbasketballhub/design-tokens"

/**
 * Energy Pass palette, live from the server (config route sends the
 * admin-chosen theme's hex values — /dashboard/admin/settings). Ordering:
 * built-in hardwood → SecureStore cache (last seen, applies from cold boot
 * with no flash) → whatever the boot config handshake delivers. The cache
 * means a palette flip reaches devices on their next launch/foreground
 * even before config answers.
 */

const PALETTE_CACHE_KEY = "sportshub.palette"

const ThemeContext = createContext<ThemePalette>(PALETTES[DEFAULT_PALETTE_ID])

function looksLikePalette(p: unknown): p is ThemePalette {
  return (
    !!p &&
    typeof p === "object" &&
    typeof (p as ThemePalette).energy === "string" &&
    typeof (p as ThemePalette).brand === "string" &&
    typeof (p as ThemePalette).stage === "string"
  )
}

export function ThemeProvider({
  palette,
  children,
}: {
  /** The palette from the config handshake — null/undefined until it lands. */
  palette: ThemePalette | null | undefined
  children: ReactNode
}) {
  const [active, setActive] = useState<ThemePalette>(PALETTES[DEFAULT_PALETTE_ID])

  // Cold boot: last-seen palette from cache while config is in flight.
  useEffect(() => {
    let cancelled = false
    SecureStore.getItemAsync(PALETTE_CACHE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return
        try {
          const cached = JSON.parse(raw)
          if (looksLikePalette(cached)) setActive(cached)
        } catch {
          // stale/corrupt cache — hardwood stands
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Config answered: adopt + cache. Server wins over the boot cache.
  useEffect(() => {
    if (!looksLikePalette(palette)) return
    setActive(palette)
    SecureStore.setItemAsync(PALETTE_CACHE_KEY, JSON.stringify(palette)).catch(() => {})
  }, [palette])

  return <ThemeContext.Provider value={active}>{children}</ThemeContext.Provider>
}

/** The live Energy Pass palette — energy/brand/stage/highlight + inks. */
export function useTheme(): ThemePalette {
  return useContext(ThemeContext)
}
