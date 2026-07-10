import { colors, radii } from "@youthbasketballhub/design-tokens"

/**
 * SportsHub visual constants for React Native, straight from the shared
 * design-tokens package (same hex values as the web's Tailwind config).
 * v1 styles with StyleSheet + these tokens; NativeWind can layer on later
 * without changing the values.
 */

export const palette = {
  ink: colors.ink,
  court: colors.court,
  hoop: colors.hoop,
  play: colors.play,
  gold: colors.gold,
}

export const ui = {
  background: "#ffffff",
  surface: colors.ink[50],
  border: colors.ink[200],
  text: colors.ink[950],
  textMuted: colors.ink[500],
  primary: colors.play[600],
  live: colors.court[500],
  danger: colors.hoop[600],
  radius: {
    lg: 16,
    md: 12,
    sm: 8,
  },
} as const

export { radii }
