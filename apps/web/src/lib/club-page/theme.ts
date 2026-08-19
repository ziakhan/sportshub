/**
 * Club page theme model (owner rulings 2026-08-18).
 *
 * The rule this file encodes: a club picks a LOOK, never a layout language. Every
 * value is one of a curated set whose contrast has already been checked, so a
 * volunteer coach cannot produce an unreadable page.
 *
 * A THEME owns surface, type and neutrals. The club's one free choice on top of it
 * is an ACCENT, and each accent carries an on-light and an on-dark value so the
 * same pick stays legible whichever theme it lands on.
 *
 * This layer sits ON TOP of `brand.ts`, it does not replace it. The resolved
 * accent hex is fed through `brandStyle()` so all sixteen existing consumers of
 * `--brand*` (EntityHeader, Crest, blocks, tryout and camp pages) keep working
 * unchanged, and only gain the theme's surface vars.
 *
 * Shared and dependency-free apart from brand.ts, so the server render and the
 * client editor can both import it.
 */

import type { CSSProperties } from "react"
import { brandStyle } from "./brand"

export type Surface = "navy" | "daylight" | "ink"

export interface Theme {
  key: string
  /** Named in basketball, not in design jargon. */
  label: string
  blurb: string
  surface: Surface
  bg: string
  panel: string
  /** Body and muted text, both >= 4.5:1 on `panel`. */
  ink: string
  inkMuted: string
  border: string
  headingFont: string
  bodyFont: string
  headingCase: "none" | "upper"
  headingTracking: string
}

export const THEMES: Theme[] = [
  {
    key: "home-court",
    label: "Home Court",
    blurb: "Our default. Deep navy, clean and calm.",
    surface: "navy",
    bg: "#0b1729",
    panel: "#12203a",
    ink: "#eef3fb",
    inkMuted: "#a9bad4",
    border: "rgba(255,255,255,0.10)",
    headingFont: "var(--font-heavy, 'Barlow Condensed', system-ui)",
    bodyFont: "Inter, system-ui, sans-serif",
    headingCase: "none",
    headingTracking: "-0.01em",
  },
  {
    key: "hardwood",
    label: "Hardwood",
    blurb: "Warm daylight gym. Light, friendly, easy to read.",
    surface: "daylight",
    bg: "#f7f3ec",
    panel: "#ffffff",
    ink: "#1f2430",
    inkMuted: "#5a6376",
    border: "rgba(31,36,48,0.12)",
    headingFont: "var(--font-heavy, 'Barlow Condensed', system-ui)",
    bodyFont: "Inter, system-ui, sans-serif",
    headingCase: "none",
    headingTracking: "-0.01em",
  },
  {
    key: "night-game",
    label: "Night Game",
    blurb: "Under the lights. High contrast, big scores.",
    surface: "ink",
    bg: "#08090c",
    panel: "#14161c",
    ink: "#f4f6fa",
    inkMuted: "#9aa3b4",
    border: "rgba(255,255,255,0.12)",
    headingFont: "var(--font-heavy, 'Barlow Condensed', system-ui)",
    bodyFont: "Inter, system-ui, sans-serif",
    headingCase: "upper",
    headingTracking: "0.02em",
  },
  {
    key: "varsity",
    label: "Varsity",
    blurb: "Old school program. Condensed caps, bold rules.",
    surface: "ink",
    bg: "#101012",
    panel: "#1b1b1f",
    ink: "#f7f4ee",
    inkMuted: "#a29c92",
    border: "rgba(247,244,238,0.14)",
    headingFont: "'Barlow Condensed', system-ui, sans-serif",
    bodyFont: "Inter, system-ui, sans-serif",
    headingCase: "upper",
    headingTracking: "0.04em",
  },
  {
    key: "clean-sheet",
    label: "Clean Sheet",
    blurb: "Quiet and modern. Lets photos do the talking.",
    surface: "daylight",
    bg: "#f4f6f8",
    panel: "#ffffff",
    ink: "#141a22",
    inkMuted: "#59626f",
    border: "rgba(20,26,34,0.10)",
    headingFont: "Inter, system-ui, sans-serif",
    bodyFont: "Inter, system-ui, sans-serif",
    headingCase: "none",
    headingTracking: "-0.02em",
  },
  {
    key: "community",
    label: "Community",
    blurb: "Softer and rounder. Good for house league and youth.",
    surface: "daylight",
    bg: "#f2f6f4",
    panel: "#ffffff",
    ink: "#16241f",
    inkMuted: "#516059",
    border: "rgba(22,36,31,0.12)",
    headingFont: "Inter, system-ui, sans-serif",
    bodyFont: "Inter, system-ui, sans-serif",
    headingCase: "none",
    headingTracking: "-0.01em",
  },
]

export interface Accent {
  key: string
  label: string
  onDark: string
  onLight: string
}

export const ACCENTS: Accent[] = [
  { key: "royal", label: "Royal", onDark: "#5b9dff", onLight: "#1b4fd8" },
  { key: "red", label: "Red", onDark: "#ff6b6b", onLight: "#c22626" },
  { key: "gold", label: "Gold", onDark: "#f5c451", onLight: "#8a6206" },
  { key: "green", label: "Green", onDark: "#4ecb8b", onLight: "#0f7a45" },
  { key: "orange", label: "Orange", onDark: "#ff9457", onLight: "#b04a06" },
  { key: "purple", label: "Purple", onDark: "#b18cff", onLight: "#5b32bd" },
  { key: "teal", label: "Teal", onDark: "#45c9d6", onLight: "#0b6b78" },
  { key: "maroon", label: "Maroon", onDark: "#e2708c", onLight: "#8d1c3c" },
  { key: "sky", label: "Sky", onDark: "#6fc7ff", onLight: "#0d6291" },
  { key: "slate", label: "Slate", onDark: "#a8b6cc", onLight: "#3d4a5d" },
]

export function accentFor(theme: Theme, accent: Accent): string {
  return theme.surface === "daylight" ? accent.onLight : accent.onDark
}

/* ------------------------------------------------------------- the look axes */

export interface HeaderStyle {
  key: string
  label: string
  blurb: string
  /** Photo is used, never required. Every style has a no-photo answer. */
  usesPhoto: boolean
}

export const HEADER_STYLES: HeaderStyle[] = [
  { key: "banner", label: "Wide banner", blurb: "A photo across the top, crest overlapping.", usesPhoto: true },
  { key: "split", label: "Split", blurb: "Photo on one side, your name and call to action on the other.", usesPhoto: true },
  { key: "immersive", label: "Full bleed", blurb: "Photo fills the screen, name over it.", usesPhoto: true },
  { key: "crest", label: "Crest first", blurb: "Big crest on your colour. No photo needed.", usesPhoto: false },
  { key: "plain", label: "Name only", blurb: "Quiet band of colour. Fastest to load.", usesPhoto: false },
]

export const INTENSITIES = [
  { key: "subtle", label: "Subtle", blurb: "Colour on accents only" },
  { key: "balanced", label: "Balanced", blurb: "Colour on headings and buttons" },
  { key: "bold", label: "Bold", blurb: "Colour fills sections" },
] as const
export type Intensity = (typeof INTENSITIES)[number]["key"]

export const SHAPES = [
  { key: "sharp", label: "Sharp", radius: 2 },
  { key: "soft", label: "Soft", radius: 12 },
  { key: "round", label: "Round", radius: 22 },
] as const
export type ShapeKey = (typeof SHAPES)[number]["key"]

export const DENSITIES = [
  { key: "airy", label: "Airy", pad: 18, gap: 16 },
  { key: "normal", label: "Normal", pad: 12, gap: 12 },
  { key: "tight", label: "Tight", pad: 8, gap: 8 },
] as const
export type DensityKey = (typeof DENSITIES)[number]["key"]

/* --------------------------------------------------------------- resolution */

/** The shape we read off TenantBranding. Loose on purpose: every field falls back. */
export interface ThemeInput {
  theme?: string | null
  accentKey?: string | null
  headerStyle?: string | null
  intensity?: string | null
  shape?: string | null
  density?: string | null
  bannerUrl?: string | null
  bannerFocalX?: number | null
  bannerFocalY?: number | null
  /** Pre-studio clubs only ever set this. Honoured when no accentKey is stored. */
  primaryColor?: string | null
}

export interface ResolvedTheme {
  theme: Theme
  accent: Accent
  /** The accent resolved against the theme's surface. Feed this to brandStyle. */
  accentHex: string
  header: HeaderStyle
  intensity: Intensity
  radius: number
  pad: number
  gap: number
  /** CSS `object-position`, e.g. "50% 38%". */
  focal: string
  hasPhoto: boolean
}

export function resolveTheme(input?: ThemeInput | null): ResolvedTheme {
  const theme = THEMES.find((t) => t.key === input?.theme) ?? THEMES[0]
  const accent = ACCENTS.find((a) => a.key === input?.accentKey) ?? ACCENTS[0]
  const header = HEADER_STYLES.find((h) => h.key === input?.headerStyle) ?? HEADER_STYLES[0]
  const intensity = (INTENSITIES.find((i) => i.key === input?.intensity)?.key ?? "balanced") as Intensity
  const shape = SHAPES.find((s) => s.key === input?.shape) ?? SHAPES[1]
  const density = DENSITIES.find((d) => d.key === input?.density) ?? DENSITIES[1]

  // Accent resolution, in priority order:
  //   1. a curated accentKey, resolved against this theme's surface
  //   2. the club's own hex, whether typed into the colour picker or set before
  //      the studio existed. Safe to allow freely because brand.ts derives every
  //      downstream token from it and darkens `ink` until it clears 4.5:1, and
  //      flips `on` between white and near-black. An unreadable custom colour is
  //      therefore not reachable, which is why "bring your own" costs us nothing.
  //   3. the theme's default accent
  const stored = input?.primaryColor?.trim()
  const accentHex = input?.accentKey ? accentFor(theme, accent) : stored || accentFor(theme, accent)

  const fx = clampPct(input?.bannerFocalX, 50)
  const fy = clampPct(input?.bannerFocalY, 50)

  return {
    theme,
    accent,
    accentHex,
    header,
    intensity,
    radius: shape.radius,
    pad: density.pad,
    gap: density.gap,
    focal: `${fx}% ${fy}%`,
    hasPhoto: header.usesPhoto && !!input?.bannerUrl,
  }
}

function clampPct(n: number | null | undefined, fallback: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback
  return Math.min(100, Math.max(0, Math.round(n)))
}

/**
 * CSS custom properties for the page wrapper.
 *
 * Composes with `brandStyle()` rather than duplicating it, so `--brand`,
 * `--brand-on`, `--brand-ink`, `--brand-soft` and friends keep the exact meaning
 * every existing block already relies on, and the theme only adds surface, type
 * and geometry on top.
 */
export function themeStyle(r: ResolvedTheme): CSSProperties {
  return {
    ...brandStyle(r.accentHex),
    ["--club-bg" as any]: r.theme.bg,
    ["--club-panel" as any]: r.theme.panel,
    ["--club-ink" as any]: r.theme.ink,
    ["--club-muted" as any]: r.theme.inkMuted,
    ["--club-border" as any]: r.theme.border,
    ["--club-radius" as any]: `${r.radius}px`,
    ["--club-pad" as any]: `${r.pad}px`,
    ["--club-gap" as any]: `${r.gap}px`,
    ["--club-heading-font" as any]: r.theme.headingFont,
    ["--club-body-font" as any]: r.theme.bodyFont,
    ["--club-heading-case" as any]: r.theme.headingCase === "upper" ? "uppercase" : "none",
    ["--club-heading-tracking" as any]: r.theme.headingTracking,
    ["--club-focal" as any]: r.focal,
  }
}

/** True when the theme's ground is dark, so callers can flip photo overlays. */
export function isDarkTheme(r: ResolvedTheme): boolean {
  return r.theme.surface !== "daylight"
}
