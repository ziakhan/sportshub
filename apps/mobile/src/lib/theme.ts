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
  textMuted: colors.ink[500],
  textFaint: colors.ink[400],
  primary: colors.play[600],
  primaryInk: colors.play[700],
  primarySoft: colors.play[50],
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
} as const

export type Tone = keyof typeof tones

export { radii, shadows }
