import type { Metadata } from "next"
import { ClubStudio } from "./studio"

/**
 * Club Page Studio — static preview for owner approval (2026-08-18).
 *
 * Estimate-first (design law): the look gets approved here before any of it
 * touches TenantBranding, the customize route or the public club page. Nothing on
 * this page reads or writes real data.
 */
export const metadata: Metadata = {
  title: "Club Page Studio (preview)",
  robots: { index: false, follow: false },
}

export default function ClubStudioPreviewPage() {
  return <ClubStudio />
}
