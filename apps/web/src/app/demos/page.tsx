import { DemoLanesGallery } from "./lanes-gallery"
import type { DemoAudience } from "./registry"

/**
 * /demos is the gallery (owner ruling 2026-08-15), lanes edition (owner
 * approval 2026-08-19). Still chrome-free: no site header, no footer, just a
 * brand mark that leads home. Picking a card opens the player at
 * /demos/<slug>.
 *
 * ?for=clubs|leagues|parents opens the page already focused on that audience;
 * /demos/clubs-style outreach links redirect here with it ([slug] aliases).
 */
const ROLES = new Set(["clubs", "leagues", "parents"])

export default function DemosGalleryPage({
  searchParams,
}: {
  searchParams?: { for?: string }
}) {
  const raw = searchParams?.for ?? ""
  const initialRole = ROLES.has(raw) ? (raw as DemoAudience) : "all"
  return <DemoLanesGallery initialRole={initialRole} />
}
