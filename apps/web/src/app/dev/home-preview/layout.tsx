import type { Metadata, Viewport } from "next"

/**
 * Bare layout for the launch homepage preview (owner "go preview", 2026-08-17).
 *
 * Sits at the top level like /demos so the draft renders without the signed-out
 * site chrome: the launch page carries its own header and footer, and the point
 * of the preview is to see exactly that page and nothing else.
 *
 * Never indexed: this is a draft for the owner, not a public surface.
 */
export const metadata: Metadata = {
  title: "Homepage preview",
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function HomePreviewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
