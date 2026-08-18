/**
 * Club Page Studio — theme + section model (static preview, 2026-08-18).
 *
 * The design rule this file encodes: a club chooses a LOOK, never a layout
 * language. Every knob is a curated choice whose output has already been checked
 * for contrast, so a volunteer coach cannot produce an unreadable page.
 *
 * A theme owns surface, type and neutrals. The club owns exactly one thing on top
 * of it: their accent. That single split is what lets "our club colours" coexist
 * with "it always looks right".
 */

export type Surface = "navy" | "daylight" | "ink"

export interface Theme {
  key: string
  /** Named in basketball, not in design jargon. */
  label: string
  blurb: string
  surface: Surface
  /** Page ground and the card ground that sits on it. */
  bg: string
  panel: string
  /** Body and muted text, both >= 4.5:1 on `panel`. */
  ink: string
  inkMuted: string
  border: string
  headingFont: string
  bodyFont: string
  /** Heading transform is part of the theme's voice, not a separate control. */
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

/**
 * The club's one free choice. Every swatch carries a light and a dark variant so
 * the same pick reads correctly on a daylight theme and on an ink theme, and each
 * pair was chosen to clear 4.5:1 against that theme family's panel colour.
 */
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

/* ------------------------------------------------------------------ sections */

export type Zone = "main" | "rail"

export interface SectionDef {
  key: string
  label: string
  hint: string
  zones: Zone[]
  /** "auto" fills itself from platform data; "written" needs the club to type. */
  source: "auto" | "written" | "upload"
  /** Not yet shippable: needs blob storage rather than data URLs. */
  needsStorage?: boolean
  isNew?: boolean
}

export const SECTIONS: SectionDef[] = [
  // --- existing, main
  { key: "about", label: "About", hint: "Who you are, in your words", zones: ["main"], source: "written" },
  { key: "announcements", label: "Announcements", hint: "Posts you publish", zones: ["main", "rail"], source: "written" },
  { key: "programs", label: "Open programs", hint: "Tryouts, camps, house leagues", zones: ["main"], source: "auto" },
  { key: "teams", label: "Teams", hint: "Every team you run", zones: ["main"], source: "auto" },
  { key: "schedule", label: "Schedule and scores", hint: "Recent and upcoming games", zones: ["main"], source: "auto" },
  { key: "news", label: "News and highlights", hint: "Recaps of your games", zones: ["main"], source: "auto" },
  { key: "reviews", label: "Reviews", hint: "What families say", zones: ["main"], source: "auto" },
  // --- new, main. Every one of these fills from data the platform already holds.
  { key: "staff", label: "Coaches and staff", hint: "Your people, with their roles", zones: ["main"], source: "auto", isNew: true },
  { key: "venues", label: "Where we play", hint: "Your gyms, with a map", zones: ["main", "rail"], source: "auto", isNew: true },
  { key: "honours", label: "Banners and honours", hint: "Championships and finishes", zones: ["main", "rail"], source: "auto", isNew: true },
  { key: "cta", label: "Join us", hint: "One clear invitation to register", zones: ["main"], source: "written", isNew: true },
  { key: "faq", label: "Questions families ask", hint: "Fees, ages, what to bring", zones: ["main"], source: "written", isNew: true },
  // --- existing, rail
  { key: "nextgame", label: "Next game", hint: "Your next fixture", zones: ["rail", "main"], source: "auto" },
  { key: "contact", label: "Contact", hint: "Phone, email, address", zones: ["rail", "main"], source: "written" },
  { key: "stats", label: "At a glance", hint: "Teams, programs, staff counts", zones: ["rail"], source: "auto" },
  { key: "socials", label: "Follow us", hint: "Your social links", zones: ["rail"], source: "written" },
  // --- new, needs storage
  { key: "sponsors", label: "Sponsors", hint: "Logos of who backs you", zones: ["main", "rail"], source: "upload", needsStorage: true, isNew: true },
  { key: "gallery", label: "Photos", hint: "Shots from your season", zones: ["main"], source: "upload", needsStorage: true, isNew: true },
]

export interface SectionState {
  key: string
  zone: Zone
  visible: boolean
  order: number
}

export const DEFAULT_SECTIONS: SectionState[] = [
  { key: "about", zone: "main", visible: true, order: 1 },
  { key: "cta", zone: "main", visible: true, order: 2 },
  { key: "programs", zone: "main", visible: true, order: 3 },
  { key: "teams", zone: "main", visible: true, order: 4 },
  { key: "schedule", zone: "main", visible: true, order: 5 },
  { key: "staff", zone: "main", visible: true, order: 6 },
  { key: "news", zone: "main", visible: true, order: 7 },
  { key: "honours", zone: "main", visible: false, order: 8 },
  { key: "venues", zone: "main", visible: false, order: 9 },
  { key: "faq", zone: "main", visible: false, order: 10 },
  { key: "announcements", zone: "main", visible: false, order: 11 },
  { key: "reviews", zone: "main", visible: false, order: 12 },
  { key: "gallery", zone: "main", visible: false, order: 13 },
  { key: "nextgame", zone: "rail", visible: true, order: 1 },
  { key: "contact", zone: "rail", visible: true, order: 2 },
  { key: "stats", zone: "rail", visible: true, order: 3 },
  { key: "socials", zone: "rail", visible: true, order: 4 },
  { key: "sponsors", zone: "rail", visible: false, order: 5 },
]

export const SECTION_BY_KEY: Record<string, SectionDef> = Object.fromEntries(
  SECTIONS.map((s) => [s.key, s])
)
