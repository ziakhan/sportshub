import type { Metadata } from "next"
import { DemoDirectory } from "./directory"

/**
 * The public demo directory (phase-1 launch, owner brief 2026-08-14).
 *
 * Ten scripted walkthroughs of the real product, watchable with no account.
 * The frozen twelve-minute walkthrough at /demo/classic stays exactly where it
 * is; this directory is a separate surface with its own v2 scene kit.
 */
export const metadata: Metadata = {
  title: "Product demos",
  description:
    "Watch how clubs, leagues and families use SportsHub. Ten short walkthroughs of the real screens, no account needed.",
}

export default function DemosPage() {
  return (
    <div className="bg-white">
      <DemoDirectory />
    </div>
  )
}
