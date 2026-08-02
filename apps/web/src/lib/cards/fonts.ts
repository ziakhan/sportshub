import { readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * Embedded card fonts (bug 2026-07-25): the box's standalone build never
 * loaded ImageResponse's bundled default font — every prod card rendered
 * TEXTLESS (the "three vertical bars"). We now pass Outfit TTFs explicitly,
 * which also puts the brand display font on every card. Resolved from the
 * workspace node_modules wherever the server's cwd happens to be.
 *
 * Every renderer under lib/cards reads FONT_OPTS + FAMILY from here, so a
 * new card can never quietly reintroduce the textless bug.
 */
function loadFont(rel: string): Buffer | null {
  for (const base of [process.cwd(), join(process.cwd(), "../.."), join(process.cwd(), "..")]) {
    try {
      return readFileSync(join(base, "node_modules", rel))
    } catch {
      /* try next base */
    }
  }
  console.error(`card fonts: could not load ${rel}`)
  return null
}

const outfit700 = loadFont("@expo-google-fonts/outfit/700Bold/Outfit_700Bold.ttf")
const outfit800 = loadFont("@expo-google-fonts/outfit/800ExtraBold/Outfit_800ExtraBold.ttf")

export const CARD_FONTS = [
  ...(outfit700 ? [{ name: "Outfit", data: outfit700, weight: 700 as const }] : []),
  ...(outfit800 ? [{ name: "Outfit", data: outfit800, weight: 800 as const }] : []),
]

/** Spread into the ImageResponse options — empty when the TTFs are missing,
 *  so a card still renders (with the runtime default) rather than throwing. */
export const FONT_OPTS = CARD_FONTS.length ? { fonts: CARD_FONTS } : {}

export const FAMILY = CARD_FONTS.length ? "Outfit" : "sans-serif"
