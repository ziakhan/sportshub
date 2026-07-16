/**
 * @youthbasketballhub/design-tokens
 *
 * Single source of truth for SportsHub's visual design tokens.
 *
 * ⚠️ ZERO runtime dependencies and NO Node-only APIs. This module is a plain,
 * platform-agnostic TypeScript file so it can be consumed by BOTH:
 *   - the web app's Tailwind config (apps/web/tailwind.config.ts), and
 *   - a future React Native app via NativeWind.
 *
 * Values here are copied EXACTLY from apps/web/tailwind.config.ts and the
 * `:root` brand variables in apps/web/src/app/globals.css. Keep them in sync.
 */

/* -------------------------------------------------------------------------- */
/*  Colors                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Core SportsHub palette scales, copied verbatim from tailwind.config.ts.
 * Every shade is a literal hex string (no CSS vars) so the values resolve
 * identically on web and native.
 */
export const colors = {
  ink: {
    50: "#f7f7f8",
    100: "#eeeef1",
    200: "#d9d9df",
    300: "#b8b8c3",
    400: "#9191a1",
    500: "#747486",
    600: "#5e5e6e",
    700: "#4d4d5a",
    800: "#42424c",
    900: "#3a3a42",
    950: "#18181b",
  },
  court: {
    50: "#f0fdf0",
    100: "#dcfce7",
    200: "#bbf7d0",
    300: "#86efac",
    400: "#4ade80",
    500: "#22c55e",
    600: "#16a34a",
    700: "#15803d",
    800: "#166534",
    900: "#14532d",
  },
  hoop: {
    50: "#fef3ee",
    100: "#fee5d6",
    200: "#fcc7ac",
    300: "#f9a178",
    400: "#f57041",
    500: "#f24e1e",
    600: "#e33612",
    700: "#bc2711",
    800: "#962216",
    900: "#792015",
  },
  play: {
    50: "#eef2ff",
    100: "#e0e7ff",
    200: "#c7d2fe",
    300: "#a5b4fc",
    400: "#818cf8",
    500: "#6366f1",
    600: "#4f46e5",
    700: "#4338ca",
    800: "#3730a3",
    900: "#312e81",
  },
  // Reserved strictly for live/in-progress states (live score dot, "LIVE"
  // badge). Scarcity keeps it meaningful — do not use as a general red.
  live: {
    50: "#fef2f2",
    100: "#fee2e2",
    500: "#ef4444",
    600: "#dc2626",
  },
  // Highlight / featured / standings-leader accent. Used sparingly.
  gold: {
    50: "#fffbeb",
    100: "#fef3c7",
    400: "#fbbf24",
    500: "#f59e0b",
    600: "#d97706",
  },
} as const

/**
 * Default "brand" tone — the design-system indigo fallback used app-wide when
 * no per-org brand wrapper is present. Copied from the `:root` custom
 * properties in apps/web/src/app/globals.css. Keys map to CSS var names:
 *   DEFAULT -> --brand, on -> --brand-on, ink -> --brand-ink,
 *   soft -> --brand-soft, softer -> --brand-softer, line -> --brand-line.
 * Operator/public surfaces override these per-org at runtime via brandStyle()
 * (apps/web/src/lib/club-page/brand.ts) — these are only the defaults.
 */
export const brand = {
  DEFAULT: "#4f46e5", // --brand
  on: "#ffffff", // --brand-on
  ink: "#4338ca", // --brand-ink
  soft: "#eef2ff", // --brand-soft
  softer: "#f5f7ff", // --brand-softer
  line: "#c7d2fe", // --brand-line
} as const

/* -------------------------------------------------------------------------- */
/*  Typography                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Font families for the athletic type pair scoped to club/league public pages.
 *
 * `name` values are font FACE NAMES, not CSS variables. The web app loads them
 * via next/font (exposed to Tailwind as --font-condensed / --font-barlow) while
 * a native app loads the same faces via expo-font under these exact names.
 * `stack` is the ordered fallback list for use in a fontFamily theme entry.
 */
export const fontFamilies = {
  condensed: {
    name: "Barlow Condensed",
    stack: ["Barlow Condensed", "ui-sans-serif", "sans-serif"],
  },
  barlow: {
    name: "Barlow",
    stack: ["Barlow", "ui-sans-serif", "sans-serif"],
  },
} as const

/* -------------------------------------------------------------------------- */
/*  Radii                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Border radius scale. On web, Tailwind maps these to CSS custom properties
 * derived from `--radius` (0.5rem in globals.css); the resolved rem values are
 * given here so NativeWind — which cannot evaluate CSS vars or calc() — gets
 * concrete values. `base` is the raw `--radius`.
 */
export const radii = {
  base: "0.5rem", // --radius
  lg: "0.5rem", // var(--radius)
  md: "0.375rem", // calc(var(--radius) - 2px)
  sm: "0.25rem", // calc(var(--radius) - 4px)
} as const

/* -------------------------------------------------------------------------- */
/*  Shadows                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Elevation shadows as CSS box-shadow strings (copied from tailwind.config.ts).
 * WEB-ONLY: React Native does not accept CSS box-shadow syntax — native
 * surfaces should use the `elevation` prop (Android) / shadow* props (iOS)
 * instead of consuming these strings directly.
 */
export const shadows = {
  soft: "0 10px 40px rgba(24, 24, 27, 0.08)",
  panel: "0 18px 60px rgba(24, 24, 27, 0.08)",
} as const

/* -------------------------------------------------------------------------- */
/*  Tailwind / NativeWind helper                                               */
/* -------------------------------------------------------------------------- */

/**
 * Pre-shaped bundle for spreading into a Tailwind or NativeWind
 * `theme.extend`. Example:
 *
 *   import { tailwindTokens } from "@youthbasketballhub/design-tokens"
 *   export default {
 *     theme: { extend: { ...tailwindTokens } },
 *   }
 *
 * `colors` exposes each palette scale plus the default `brand` object.
 * `fontFamily` uses face-name stacks (works directly in NativeWind).
 * `boxShadow` is web-only (see `shadows`).
 */
export const tailwindTokens = {
  colors: {
    ink: colors.ink,
    court: colors.court,
    hoop: colors.hoop,
    play: colors.play,
    live: colors.live,
    gold: colors.gold,
    brand,
  },
  fontFamily: {
    condensed: fontFamilies.condensed.stack,
    barlow: fontFamilies.barlow.stack,
  },
  borderRadius: {
    lg: radii.lg,
    md: radii.md,
    sm: radii.sm,
  },
  boxShadow: {
    soft: shadows.soft,
    panel: shadows.panel,
  },
} as const

/* -------------------------------------------------------------------------- */
/*  Theme palettes (Energy Pass, 2026-07-15)                                   */
/* -------------------------------------------------------------------------- */

/**
 * Admin-switchable platform palettes. Semantic roles, not raw scales:
 *   - brand:     chrome accent (links, active nav, primary buttons)
 *   - energy:    THE hot color — key stat, live states, one CTA per screen
 *   - stage:     broadcast-dark surface pair (anything with a score on it)
 *   - highlight: leaders/winners/pinned (gold family)
 * Each color ships with an `*On` ink so contrast survives palette swaps
 * (fastbreak's volt lime needs dark text where hardwood's orange takes white).
 * Web consumes these as CSS variables (globals.css + <html> style stamp);
 * native reads them off /api/mobile/config at boot.
 */
export interface ThemePalette {
  id: "hardwood" | "fastbreak" | "primetime"
  label: string
  brand: string
  brandInk: string
  brandSoft: string
  brandLine: string
  brandOn: string
  energy: string
  energyInk: string
  energySoft: string
  energyOn: string
  stage: string
  stage2: string
  highlight: string
  highlightSoft: string
  highlightOn: string
}

export const PALETTES: Record<ThemePalette["id"], ThemePalette> = {
  hardwood: {
    id: "hardwood",
    label: "Hardwood",
    brand: "#4f46e5",
    brandInk: "#4338ca",
    brandSoft: "#eef2ff",
    brandLine: "#c7d2fe",
    brandOn: "#ffffff",
    energy: "#f24e1e",
    energyInk: "#bc2711",
    energySoft: "#fef3ee",
    energyOn: "#ffffff",
    stage: "#0b1628",
    stage2: "#1e2d4d",
    highlight: "#fbbf24",
    highlightSoft: "#fffbeb",
    highlightOn: "#3b2a06",
  },
  fastbreak: {
    id: "fastbreak",
    label: "Fastbreak",
    brand: "#6d28d9",
    brandInk: "#5b21b6",
    brandSoft: "#f5f0ff",
    brandLine: "#d8b4fe",
    brandOn: "#ffffff",
    energy: "#a3e635",
    energyInk: "#4d7c0f",
    energySoft: "#f4fce3",
    energyOn: "#1a2e05",
    stage: "#190a2e",
    stage2: "#3b1372",
    highlight: "#22d3ee",
    highlightSoft: "#ecfeff",
    highlightOn: "#083344",
  },
  primetime: {
    id: "primetime",
    label: "Prime Time",
    brand: "#dc2626",
    brandInk: "#b91c1c",
    brandSoft: "#fef2f2",
    brandLine: "#fca5a5",
    brandOn: "#ffffff",
    energy: "#f59e0b",
    energyInk: "#b45309",
    energySoft: "#fffbeb",
    energyOn: "#3b2306",
    stage: "#0c0f13",
    stage2: "#1c2430",
    highlight: "#f59e0b",
    highlightSoft: "#fffbeb",
    highlightOn: "#3b2306",
  },
} as const

export const DEFAULT_PALETTE_ID: ThemePalette["id"] = "hardwood"

/** Unknown/legacy values fail open to hardwood — never crash on a bad row. */
export function resolvePalette(id: string | null | undefined): ThemePalette {
  return PALETTES[(id as ThemePalette["id"]) ?? DEFAULT_PALETTE_ID] ?? PALETTES[DEFAULT_PALETTE_ID]
}

/** CSS custom properties for a palette — stamped on <html> by the web layout. */
export function paletteCssVars(p: ThemePalette): Record<string, string> {
  return {
    "--brand": p.brand,
    "--brand-ink": p.brandInk,
    "--brand-soft": p.brandSoft,
    "--brand-line": p.brandLine,
    "--brand-on": p.brandOn,
    "--energy": p.energy,
    "--energy-ink": p.energyInk,
    "--energy-soft": p.energySoft,
    "--energy-on": p.energyOn,
    "--stage": p.stage,
    "--stage-2": p.stage2,
    "--highlight": p.highlight,
    "--highlight-soft": p.highlightSoft,
    "--highlight-on": p.highlightOn,
  }
}

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export type Colors = typeof colors
export type Brand = typeof brand
export type FontFamilies = typeof fontFamilies
export type Radii = typeof radii
export type Shadows = typeof shadows
export type TailwindTokens = typeof tailwindTokens
