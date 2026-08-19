import type { Metadata } from "next"
import { MotionLab } from "./motion-lab"

/**
 * Draft route for the homepage motion pass (2026-08-19).
 *
 * Deliberately NOT /dev/home-preview: that component is what `/launch` serves
 * on the brand apex, so a draft written into it would be live. This route
 * renders it unmodified and layers three proposals over it, each on a switch.
 */
export const metadata: Metadata = {
  title: { absolute: "Motion lab" },
  robots: { index: false, follow: false },
}

export default function HomeMotionLabPage() {
  return <MotionLab />
}
