/**
 * THE PLAYER ACCENT — eight curated tones, one per player, forever.
 *
 * OWNER RULING 2026-08-15 (PlayerMug v2): a roster of unphotographed kids was
 * eight identical grey tiles. "All those cards are light and grey — we don't
 * want team colours but we need some sort of accent to distinguish them."
 *
 * So the accent is a PROPERTY OF THE PERSON, not of their club: a deterministic
 * hash of the player id picks one of eight muted-deep tones, and that tone
 * follows the kid across every surface (roster row, leaders card, player hero)
 * for the life of the id. Two players on the same team get different tones;
 * the same player is the same tone on every page and every device, with no
 * storage and no round trip.
 *
 * Why these eight, and why "muted-deep":
 *  - Every tone is dark and desaturated, so it reads as ink-with-a-mood rather
 *    than as branding. Nobody will mistake a mug for a club colour.
 *  - None of them lands near the semantic families. Closest approach to the
 *    LIVE red / success green / gold / hoop-orange tokens is ΔE 47 (bronze vs
 *    live-500) — the nearest neighbour is still further away than black is
 *    from mid-grey, so an accent can never be misread as a status.
 *  - `deep` on `jersey` clears WCAG AA at every tone (4.5:1 minimum; the set
 *    measures 5.16–7.31, ochre being the tightest). On dark surfaces
 *    `darkNumber` on the composited jersey measures 4.75–5.02 over both the
 *    navy-950 and ink-950 backdrops the app actually uses.
 *  - The eight `deep` values sit ≥ ΔE 21 apart, so a full roster reads as eight
 *    distinct kids rather than a gradient.
 *
 * Contrast + separation are re-checkable: scratchpad/accent-check.mjs derives
 * every tint below from the deep/mid seed pair and prints the whole table.
 */

export interface PlayerAccent {
  /** Tone name — for debugging and design review, never shown to a user. */
  name: string
  /** The number on the jersey, and any emphasis stroke, on a light tile. */
  deep: string
  /** The tone at full strength. Everything softer is mixed down from here. */
  mid: string
  /** Jersey fill on a light tile (24% of `mid` over white). */
  jersey: string
  /** Tile background on a light tile (13%). */
  wash: string
  /** A container that holds the mug and wants to echo it — 8%. */
  washSoft: string
  /** The same echo at a whisper — 4.5%, for the quieter of two cards. */
  washFaint: string
  /** The number on a dark tile. */
  darkNumber: string
  /**
   * Source colour for dark tiles. Always used WITH an alpha (wash 12%, jersey
   * 26%) so it composites over whatever navy/ink the surface happens to be
   * instead of punching an opaque hole in it.
   */
  darkTint: string
}

export const PLAYER_ACCENTS: readonly PlayerAccent[] = [
  { name: "bronze",     deep: "#7d4021", mid: "#a85c2c", jersey: "#ead8cc", wash: "#f4eae4", washSoft: "#f8f2ee", washFaint: "#fbf8f6", darkNumber: "#e5cec0", darkTint: "#d4ae96" },
  { name: "ochre",      deep: "#6b5a05", mid: "#93801a", jersey: "#e5e1c8", wash: "#f1eee1", washSoft: "#f6f5ed", washFaint: "#faf9f5", darkNumber: "#dfd9ba", darkTint: "#c9c08d" },
  { name: "forest",     deep: "#1c5742", mid: "#2e785c", jersey: "#cddfd8", wash: "#e4edea", washSoft: "#eef4f2", washFaint: "#f6f9f8", darkNumber: "#c0d7ce", darkTint: "#97bcae" },
  { name: "slate-teal", deep: "#17505f", mid: "#287086", jersey: "#cbdde2", wash: "#e3ecef", washSoft: "#eef4f5", washFaint: "#f5f9fa", darkNumber: "#bfd4db", darkTint: "#94b8c3" },
  { name: "storm-blue", deep: "#253f6e", mid: "#385f97", jersey: "#cfd9e6", wash: "#e5eaf1", washSoft: "#eff2f7", washFaint: "#f6f8fa", darkNumber: "#c3cfe0", darkTint: "#9cafcb" },
  { name: "indigo",     deep: "#423a90", mid: "#5d53b0", jersey: "#d8d6ec", wash: "#eae9f5", washSoft: "#f2f1f9", washFaint: "#f8f7fb", darkNumber: "#cecbe7", darkTint: "#aea9d8" },
  { name: "plum",       deep: "#6d2c74", mid: "#8f4396", jersey: "#e4d2e6", wash: "#f0e7f1", washSoft: "#f6f0f7", washFaint: "#faf7fa", darkNumber: "#ddc7e0", darkTint: "#c7a1cb" },
  { name: "burgundy",   deep: "#7c2a46", mid: "#a34260", jersey: "#e9d2d9", wash: "#f3e6ea", washSoft: "#f8f0f2", washFaint: "#fbf6f8", darkNumber: "#e3c6cf", darkTint: "#d1a1b0" },
]

/**
 * FNV-1a, 32-bit. Chosen because it is four lines, has no dependencies, and
 * scatters short similar strings (`...-a1`, `...-a2`) into different buckets —
 * which matters, because sequential seed ids are exactly what a demo roster is
 * made of. Case- and whitespace-insensitive so "Ava Chen" and "ava chen " are
 * one player.
 */
function hashKey(key: string): number {
  let h = 0x811c9dc5
  const s = key.trim().toLowerCase()
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * The player's tone. Pass the player id wherever one exists — it is stable for
 * the life of the account, where a display name changes the day a kid starts
 * going by their middle name. Name is the documented fallback, not the default
 * you should reach for.
 */
export function accentForKey(key: string): PlayerAccent {
  const clean = (key ?? "").trim()
  if (!clean) return PLAYER_ACCENTS[0]
  return PLAYER_ACCENTS[hashKey(clean) % PLAYER_ACCENTS.length]
}
