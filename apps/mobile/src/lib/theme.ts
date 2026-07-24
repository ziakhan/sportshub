import { colors, radii, shadows } from "@youthbasketballhub/design-tokens"

/**
 * SportsHub visual constants for React Native, straight from the shared
 * design-tokens package (same hex values as the web's Tailwind config).
 *
 * Surface scheme mirrors the WEB (audit v2 §5): near-white page background
 * with white, softly-shadowed cards — not the inverted white-page/gray-card
 * scheme v1 shipped with. `tones` is the native twin of the web's
 * toneForStatus() families.
 */

export const palette = {
  ink: colors.ink,
  court: colors.court,
  hoop: colors.hoop,
  play: colors.play,
  gold: colors.gold,
}

export const ui = {
  /** Page background — web public layout uses #fafafa. */
  background: "#fafafa",
  /** Cards sit WHITE on the gray page, like the web. */
  surface: "#ffffff",
  /** Subtle inset panels inside cards (inputs, option rows). */
  surfaceSunken: colors.ink[50],
  border: colors.ink[100],
  borderStrong: colors.ink[200],
  text: colors.ink[950],
  // Readability pass 2026-07-17: muted/faint darkened one shade each —
  // ink500 measured 4.3–4.6:1 (borderline) and ink400 2.9–3.1:1 (fails
  // WCAG AA) on our surfaces. Decoration that may stay light should use
  // palette.ink[300/400] explicitly, not these semantic slots.
  textMuted: colors.ink[600],
  textFaint: colors.ink[500],
  primary: colors.play[600],
  primaryInk: colors.play[700],
  primarySoft: colors.play[50],
  // Energy Pass hot colors live in theme-context.tsx (useTheme) — they
  // follow the admin-chosen palette; nothing palette-dependent belongs in
  // this static object.
  live: colors.court[500],
  danger: colors.hoop[600],
  radius: {
    xl: 20,
    lg: 16,
    md: 12,
    sm: 8,
  },
} as const

/** Native shadow approximating the web's soft card shadow. */
export const cardShadow = {
  shadowColor: colors.ink[950],
  shadowOpacity: 0.05,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
} as const

/** Status tone families — native twin of the web's toneForStatus(). */
export const tones = {
  positive: { fg: colors.court[700], bg: colors.court[100], border: colors.court[200] },
  warning: { fg: "#9a3412", bg: "#fff7ed", border: "#fdba74" },
  danger: { fg: colors.hoop[700], bg: colors.hoop[50], border: colors.hoop[200] },
  info: { fg: colors.play[700], bg: colors.play[50], border: colors.play[200] },
  neutral: { fg: colors.ink[600], bg: colors.ink[50], border: colors.ink[200] },
  gold: { fg: colors.gold[600], bg: colors.gold[50], border: colors.gold[100] },
  // Programs-tab parity (five-tab visual-parity pass 2026-07-24): the web
  // /events type badges use Tailwind violet (camp) and sky (training) — two
  // families the app didn't have a tone for yet. Same hex values as the
  // web's bg-violet-100/text-violet-700 and bg-sky-100/text-sky-700.
  violet: { fg: "#6d28d9", bg: "#ede9fe", border: "#ddd6fe" },
  sky: { fg: "#0369a1", bg: "#e0f2fe", border: "#bae6fd" },
} as const

export type Tone = keyof typeof tones

export { radii, shadows }

/**
 * Brand typography (native-parity-v2 P0) — the SAME families the web loads
 * via next/font: Outfit = font-display, Work Sans = font-body, Barlow
 * Condensed = font-condensed (scores/tabular). Loaded in app/_layout.tsx.
 */
export const fonts = {
  display: "Outfit_700Bold",
  displayHeavy: "Outfit_800ExtraBold",
  displaySemi: "Outfit_600SemiBold",
  displayMed: "Outfit_500Medium",
  body: "WorkSans_400Regular",
  bodyMed: "WorkSans_500Medium",
  bodySemi: "WorkSans_600SemiBold",
  bodyBold: "WorkSans_700Bold",
  condensed: "BarlowCondensed_700Bold",
  condensedMed: "BarlowCondensed_600SemiBold",
} as const
