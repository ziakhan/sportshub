import { DemoGallery } from "./gallery"

/**
 * /demos is the gallery (owner ruling 2026-08-15). It is still chrome-free:
 * no site header, no footer, no bottom tabs, just a brand mark that leads home.
 * Picking a card opens the full screen player at /demos/<slug>.
 */
export default function DemosGalleryPage() {
  return <DemoGallery />
}
