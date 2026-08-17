import { HomePreview } from "../dev/home-preview/preview"

/**
 * The soft-launch homepage, served at "/" on the brand apex by the
 * middleware host rewrite. Renders the SAME component as /dev/home-preview
 * on purpose: the owner iterates on the preview and the live page follows,
 * one source of truth until the launch arc closes.
 */
export default function LaunchHomePage() {
  return <HomePreview />
}
