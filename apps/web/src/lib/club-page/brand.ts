// Brand color tokens for the customizable club / league pages.
//
// Each org stores a single `primaryColor` hex. To "carry the brand through the
// page" (accents, prices, badges, tints) without shipping a palette per club, we
// derive a small, accessible set of colors from that one hex and expose them as
// CSS custom properties on the page wrapper. Blocks then reference the vars via
// static Tailwind classes (e.g. `text-[color:var(--brand-ink)]`), so only the
// *values* are dynamic — the classes are generated at build time.
//
// Accessibility: a club can pick any color, including ones too light to read as
// text on white. So `ink` is darkened until it clears WCAG 4.5:1 on white, and
// `on` flips between white / near-black to stay legible on a brand fill.

import type { CSSProperties } from "react"

export interface BrandTokens {
  /** Raw brand color — fills and large accents (bars, buttons, monograms). */
  brand: string
  /** Text color to place ON a brand fill (#fff or near-black). */
  on: string
  /** Brand-derived color guaranteed >= 4.5:1 on white — links, prices, small text. */
  ink: string
  /** ~9% brand tint on white — band / section backgrounds. */
  soft: string
  /** ~5% brand tint on white — the subtlest surface wash. */
  softer: string
  /** ~24% brand tint on white — hairline borders that still read as "brand". */
  line: string
}

const FALLBACK = "#1a73e8"

interface RGB {
  r: number
  g: number
  b: number
}

function parseHex(input?: string | null): RGB | null {
  if (!input) return null
  let h = input.trim().replace(/^#/, "")
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("")
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function toHex({ r, g, b }: RGB): string {
  const c = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, "0")
  return `#${c(r)}${c(g)}${c(b)}`
}

function srgbToLinear(channel: number): number {
  const s = channel / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function relativeLuminance({ r, g, b }: RGB): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

/** WCAG contrast ratio between two relative luminances. */
function contrast(l1: number, l2: number): number {
  const hi = Math.max(l1, l2)
  const lo = Math.min(l1, l2)
  return (hi + 0.05) / (lo + 0.05)
}

/** Mix `rgb` with white; `weight` is the fraction of brand kept (0..1). */
function tintWithWhite(rgb: RGB, weight: number): RGB {
  return {
    r: rgb.r * weight + 255 * (1 - weight),
    g: rgb.g * weight + 255 * (1 - weight),
    b: rgb.b * weight + 255 * (1 - weight),
  }
}

/** Scale toward black (keeps hue roughly constant). */
function darken(rgb: RGB, factor: number): RGB {
  return { r: rgb.r * factor, g: rgb.g * factor, b: rgb.b * factor }
}

const WHITE_LUM = 1
const BLACK_LUM = 0

export function brandTokens(hex?: string | null): BrandTokens {
  const rgb = parseHex(hex) ?? parseHex(FALLBACK)!
  const lum = relativeLuminance(rgb)

  // Text placed on a brand fill: whichever of white / near-black reads better.
  const on = contrast(lum, WHITE_LUM) >= contrast(lum, BLACK_LUM) ? "#ffffff" : "#18181b"

  // Readable brand ink for text on white: darken until it clears 4.5:1.
  let inkRgb = rgb
  let factor = 1
  while (contrast(relativeLuminance(inkRgb), WHITE_LUM) < 4.5 && factor > 0.05) {
    factor -= 0.05
    inkRgb = darken(rgb, factor)
  }

  return {
    brand: toHex(rgb),
    on,
    ink: toHex(inkRgb),
    soft: toHex(tintWithWhite(rgb, 0.09)),
    softer: toHex(tintWithWhite(rgb, 0.05)),
    line: toHex(tintWithWhite(rgb, 0.24)),
  }
}

/** The CSS custom properties to spread onto a page wrapper's `style`. */
export function brandStyle(hex?: string | null): CSSProperties {
  const t = brandTokens(hex)
  return {
    "--brand": t.brand,
    "--brand-on": t.on,
    "--brand-ink": t.ink,
    "--brand-soft": t.soft,
    "--brand-softer": t.softer,
    "--brand-line": t.line,
  } as CSSProperties
}
