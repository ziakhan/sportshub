/**
 * Club Page Studio — section catalogue for the preview.
 *
 * The theme model itself now lives in lib/club-page/theme.ts, shared by the
 * server render and the editor. This file keeps only what the preview needs on
 * top of it: the section list and the preview's own image state.
 */

export {
  THEMES,
  ACCENTS,
  HEADER_STYLES,
  INTENSITIES,
  SHAPES,
  DENSITIES,
  accentFor,
} from "@/lib/club-page/theme"

export type {
  Theme,
  Accent,
  Surface,
  Intensity,
  ShapeKey,
  DensityKey,
  HeaderStyle,
} from "@/lib/club-page/theme"

/** Whatever image the club happens to have. Preview-only state. */
export interface ImageState {
  present: boolean
  focalX: number
  focalY: number
  naturalAspect: number
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
  { key: "about", label: "About", hint: "Who you are, in your words", zones: ["main"], source: "written" },
  { key: "announcements", label: "Announcements", hint: "Posts you publish", zones: ["main", "rail"], source: "written" },
  { key: "programs", label: "Open programs", hint: "Tryouts, camps, house leagues", zones: ["main"], source: "auto" },
  { key: "teams", label: "Teams by age", hint: "Grouped by age band, with what is open", zones: ["main"], source: "auto" },
  { key: "schedule", label: "Schedule and scores", hint: "Recent and upcoming games", zones: ["main"], source: "auto" },
  { key: "news", label: "News and highlights", hint: "Recaps of your games", zones: ["main"], source: "auto" },
  { key: "reviews", label: "Reviews", hint: "What families say", zones: ["main"], source: "auto" },
  { key: "staff", label: "Coaches and staff", hint: "Your people, with their roles", zones: ["main"], source: "auto", isNew: true },
  { key: "venues", label: "Where we play", hint: "Your gyms, with a map", zones: ["main", "rail"], source: "auto", isNew: true },
  { key: "honours", label: "Banners and honours", hint: "Championships and finishes", zones: ["main", "rail"], source: "auto", isNew: true },
  { key: "cta", label: "Join us", hint: "One clear invitation to register", zones: ["main"], source: "written", isNew: true },
  { key: "faq", label: "Questions families ask", hint: "Fees, ages, what to bring", zones: ["main"], source: "written", isNew: true },
  { key: "nextgame", label: "Next game", hint: "Your next fixture", zones: ["rail", "main"], source: "auto" },
  { key: "contact", label: "Contact", hint: "Phone, email, address", zones: ["rail", "main"], source: "written" },
  { key: "stats", label: "At a glance", hint: "Teams, programs, staff counts", zones: ["rail"], source: "auto" },
  { key: "socials", label: "Follow us", hint: "Your social links", zones: ["rail"], source: "written" },
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
