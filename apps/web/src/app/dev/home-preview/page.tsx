import { HomePreview } from "./preview"

/**
 * The owner's iteration surface for the launch homepage. The LIVE page is
 * /launch (served at "/" on the brand apex by the middleware host rewrite)
 * and renders this same component — edits here go live on deploy.
 */
export default function HomePreviewPage() {
  return <HomePreview />
}
