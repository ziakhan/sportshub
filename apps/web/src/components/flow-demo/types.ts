import type { ComponentType } from "react"

export type Persona = "league" | "club" | "parent" | "referee"

export interface SceneDef {
  id: string
  /** Chapter id this scene belongs to. */
  chapter: string
  persona: Persona
  /** Short label for the persona chip, e.g. "League office" or "Maria (parent)". */
  personaLabel: string
  frame: "desktop" | "phone" | "duo" | "interstitial"
  /** Path shown in the browser chrome, e.g. "/manage/leagues/nph-summer-league". */
  url?: string
  /** One or two sentences shown with the frame describing what is happening. */
  caption: string
  screen: ComponentType
}

export interface ChapterDef {
  id: string
  title: string
  /** One-line chapter lead-in shown on the chapter divider scene. */
  blurb: string
}

export interface FlowDef {
  id: string
  title: string
  chapters: ChapterDef[]
  /** Ordered scene list. Scenes reference chapters by id. */
  scenes: SceneDef[]
}
