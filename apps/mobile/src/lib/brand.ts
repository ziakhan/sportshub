/**
 * Brand color tokens for org (club/league) hero screens — native twin of the
 * web's apps/web/src/lib/club-page/brand.ts. Duplicated rather than shared
 * (same call as lib/perks.ts): pure math, no react/prisma, small enough to
 * keep in sync by hand.
 *
 * An org can pick any primaryColor hex, including light ones that don't read
 * as white text. `onBrand` flips between white / near-black to stay legible
 * on a brand fill; `ink` is darkened until it clears 4.5:1 on white so price
 * tags and links stay readable outside the hero.
 */

export interface BrandTokens {
  /** Raw brand color — the hero fill, chips, accents. */
  brand: string
  /** Text/icon color to place ON a brand fill (#fff or near-black). */
  onBrand: string
  /** Brand-derived color guaranteed >= 4.5:1 on white — prices, links. */
  ink: string
  /** ~10% brand tint on white — soft chip backgrounds. */
  soft: string
  /** ~28% brand tint on white — hairline borders that still read as brand. */
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
  if (h.length === 3) h = h.split("").map((c) => c + c).join("")
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
}

function toHex({ r, g, b }: RGB): string {
  const c = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0")
  return `#${c(r)}${c(g)}${c(b)}`
}

function srgbToLinear(channel: number): number {
  const s = channel / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function relativeLuminance({ r, g, b }: RGB): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

function contrast(l1: number, l2: number): number {
  const hi = Math.max(l1, l2)
  const lo = Math.min(l1, l2)
  return (hi + 0.05) / (lo + 0.05)
}

function tintWithWhite(rgb: RGB, weight: number): RGB {
  return { r: rgb.r * weight + 255 * (1 - weight), g: rgb.g * weight + 255 * (1 - weight), b: rgb.b * weight + 255 * (1 - weight) }
}

function darken(rgb: RGB, factor: number): RGB {
  return { r: rgb.r * factor, g: rgb.g * factor, b: rgb.b * factor }
}

const cache = new Map<string, BrandTokens>()

export function brandTokens(hex?: string | null): BrandTokens {
  const key = hex ?? "__fallback__"
  const hit = cache.get(key)
  if (hit) return hit

  const rgb = parseHex(hex) ?? parseHex(FALLBACK)!
  const lum = relativeLuminance(rgb)
  const onBrand = contrast(lum, 1) >= contrast(lum, 0) ? "#ffffff" : "#18181b"

  let inkRgb = rgb
  let factor = 1
  while (contrast(relativeLuminance(inkRgb), 1) < 4.5 && factor > 0.05) {
    factor -= 0.05
    inkRgb = darken(rgb, factor)
  }

  const tokens: BrandTokens = {
    brand: toHex(rgb),
    onBrand,
    ink: toHex(inkRgb),
    soft: toHex(tintWithWhite(rgb, 0.1)),
    line: toHex(tintWithWhite(rgb, 0.28)),
  }
  cache.set(key, tokens)
  return tokens
}
