"use client"

import { DemoPlayer } from "@/components/demo-directory/player"
import { rosterStory } from "@/components/demo-directory/stories/roster-story"
import type { DemoScript } from "@/components/demo-directory/types"

/** Slug to script. A demo goes live the moment it appears in this map. */
const SCRIPTS: Record<string, { script: DemoScript; role: string; roleTone: "club" | "league" | "parent" | "referee" }> =
  {
    "roster-story": { script: rosterStory, role: "Club", roleTone: "club" },
  }

export function DemoRunner({ slug }: { slug: string }) {
  const entry = SCRIPTS[slug]
  if (!entry) return null
  return <DemoPlayer script={entry.script} role={entry.role} roleTone={entry.roleTone} />
}
