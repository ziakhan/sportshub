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
  /**
   * The caption bar line. One sentence, present tense, no em-dashes.
   *
   * ONE VOICE (owner ruling 2026-08-16): a beat that carries a `callout` is
   * explained at the point of action, so the caption bar drops its sentence
   * for that beat and shows the chapter name alone. Two voices narrating the
   * same moment is what made the last cut hard to follow. Write the caption
   * anyway: it is what the beat stepper and reduced motion read.
   */
  caption: string
  /**
   * The slim one-line strip over the scene: "NPH Showcase League · Plan".
   *
   * Scene presentation has no browser chrome and no site header, so this is
   * the only thing telling the viewer which product screen they are on. It
   * accumulates like `url` does: set it when the story moves screens.
   */
  context?: string
  /** How long the beat holds before autoplay moves on, in milliseconds. */
  hold: number
  /** Switches the stage layout from this beat onward. */
  stage?: StageMode
  /**
   * Address shown in the browser chrome from this beat onward. A story that
   * moves between workspace screens has to move the address bar with them, or
   * the frame is telling the viewer something the product does not do.
   */
  url?: string
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

  /* ── Pacing and emphasis (owner ruling 2026-08-16) ─────────────────────
   * "Demos move too fast and viewers miss the detail." Three fields answer
   * that, and every script may use them. The caption bar under the stage
   * still narrates the beat; these are the LOCAL layer, at the point of
   * action.
   */

  /**
   * A balloon anchored to the beat's target, saying why this step matters.
   *
   * It appears when the cursor ARRIVES (with the press, not during the
   * glide), holds for the rest of the beat and leaves with it. It is anchored
   * to the measured target rect, flips below / above / beside by whichever
   * space is free, never covers the target and never leaves the stage panel.
   *
   * Anchor resolution, in order: `cursor`, then a string `emphasize`, then
   * `hover`. A beat with none of those has nothing to point at, so the
   * callout is skipped rather than parked in a corner.
   *
   * One sentence, present tense, no em-dashes. Say why, not what: the screen
   * already shows what.
   */
  callout?: string
  /**
   * Rings the beat's key element with a gold glow that pulses twice and then
   * settles. `true` rings the cursor target; a string rings that
   * `data-demo-target` instead, which is how a beat with no cursor (a screen
   * that changes on its own) still points at the thing that changed.
   *
   * Setting it also buys the beat EMPHASIS_HOLD_MS more dwell, so the viewer
   * gets the extra seconds the owner asked for without every script
   * re-timing itself.
   */
  emphasize?: boolean | string
  /**
   * Extra dwell in milliseconds, ADDED to `hold`.
   *
   * Defaults to EMPHASIS_HOLD_MS (1200) when `emphasize` is set and 0
   * otherwise; setting it overrides that default, so `holdMs: 0` on an
   * emphasized beat keeps the original timing and `holdMs: 2000` on a plain
   * beat buys dwell without a ring. The progress bar and the chapter markers
   * both read the same total, so chapter jumps stay exact.
   */
  holdMs?: number
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
  /**
   * A demo that only ever happens on a phone. The stage drops the browser
   * window entirely rather than parking a dimmed empty one beside the handset,
   * and the phone is scaled on its own so it reads at close to life size.
   * Stories that hand off between surfaces leave this alone.
   */
  soloPhone?: boolean
  /** Address shown in the browser chrome bar before any beat sets its own. */
  desktopUrl: string
  /**
   * How the stage presents the story (owner ruling 2026-08-16, audit D2).
   *
   *   "frames": the 2026-08-15 stage: a mock browser window (chrome, traffic
   *     lights, address bar) at 1120x660 with a phone column reserved beside
   *     it, the pair scaled to fit the panel. Every story written before the
   *     rebuild uses this.
   *
   *   "scene": the presentation the old homepage flow-demo proved and the
   *     owner ruled back in: NO browser chrome, NO site header, the screen
   *     composed as a focused working REGION at 1160 logical and rendered at
   *     scale 1.0 on a computer, so text authored at 14px reaches the viewer
   *     at 14px. When a phone joins, the desktop region is composed NARROWER
   *     rather than scaled down, and the phone is life size.
   */
  presentation?: "frames" | "scene"
  /** Context strip before any beat sets its own (scene presentation only). */
  context?: string
}
