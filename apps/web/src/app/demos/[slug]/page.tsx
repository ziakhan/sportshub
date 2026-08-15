import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { DEMOS, getDemo } from "../registry"
import { DemoStage } from "../demo-runner"

export function generateStaticParams() {
  return DEMOS.map((d) => ({ slug: d.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const demo = getDemo(params.slug)
  if (!demo) return { title: "Demo" }
  return { title: demo.title, description: demo.description }
}

/**
 * The stage half of the console. It renders the selected demo's INTRO first
 * (owner ruling 2026-08-15: read, then play), and the player only after the
 * viewer presses Play. The rail, search and filter come from the layout, and
 * the title, pills and duration now live on the intro itself, so nothing here
 * re-states the directory.
 */
export default function DemoStagePage({ params }: { params: { slug: string } }) {
  const demo = getDemo(params.slug)
  if (!demo) notFound()

  return (
    <div className="flex w-full flex-1 flex-col">
      <DemoStage demo={demo} />
    </div>
  )
}
