import type { ReactNode } from "react"

/**
 * Demo directory v2 script types (2026-08-15).
 *
 * The frozen /demo/classic engine (components/flow-demo/live/engine.tsx) runs an
 * imperative async script that queries the DOM and moves a camera. This kit keeps
 * its choreography quality but drops the camera: the owner's motion law forbids
 * unnecessary panning, zooming and scrolling, so the stage here is FIXED and only
 * the content inside the frames changes.
 *
 * A demo is therefore a list of BEATS. Every beat is a single readable moment:
 * one caption, one cursor destination, at most one press, at most one typed
 * field. State is accumulated by applying beats in order, which makes jumping to
 * a chapter deterministic (apply every patch up to that beat, skip the motion).
 */

/** Which frames the stage is showing. The stage box never resizes; the phone
 *  slot is reserved from the first frame and the phone slides into it. */
export type StageMode = "desktop" | "split" | "phone"

export interface DemoChapter {
  id: string
  /** Shown on the jump chip. Keep it to three or four words. */
  title: string
}

export interface DemoBeat {
  id: string
  chapter: string
  /** The caption bar line. One sentence, present tense, no em-dashes. */
  caption: string
  /** How long the beat holds before autoplay moves on, in milliseconds. */
  hold: number
  /** Switches the stage layout from this beat onward. */
  stage?: StageMode
  /** `data-demo-target` of the element the cursor glides to. */
  cursor?: string
  /** Element that shows its hover state. Defaults to the cursor target. */
  hover?: string
  /** Cursor presses its target: ripple, cursor shrink, target push. */
  press?: boolean
  /** Types a value into a state key, character by character. */
  type?: { key: string; text: string }
  /** State patch applied when the beat begins. */
  set?: Record<string, unknown>
  /** Confirmation toast that drops over the stage for this beat. */
  toast?: string
}

export interface DemoRenderContext {
  /** Current value of a state key. */
  get: <T>(key: string, fallback: T) => T
  /** The key being typed right now, or null. */
  typingKey: string | null
  /** True when the viewer asked for reduced motion: render final frames. */
  reduced: boolean
}

export interface DemoScript {
  chapters: DemoChapter[]
  beats: DemoBeat[]
  /** Layout before any beat sets its own. */
  initialStage: StageMode
  /** The desktop surface, and the phone surface when the story has one. */
  render: (ctx: DemoRenderContext) => { desktop: ReactNode; phone?: ReactNode }
  /** Address shown in the browser chrome bar. */
  desktopUrl: string
}
