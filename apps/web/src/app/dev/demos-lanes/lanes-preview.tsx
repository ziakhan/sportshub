"use client"

import { DemoLanesGallery } from "../../demos/lanes-gallery"

/**
 * The lanes design shipped as the real /demos gallery (owner 2026-08-19), so
 * this preview is now a thin alias over the shipped component: the public
 * link the owner circulated keeps working and always shows exactly what
 * production shows. The route stays in PUBLIC_DEV_EXCEPTIONS until the
 * circulated links die out; then both can go.
 */
export function DemoLanesPreview() {
  return <DemoLanesGallery />
}
