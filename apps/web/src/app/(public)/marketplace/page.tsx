import { redirect } from "next/navigation"

/** Marketplace merged into Programs (owner ruling 2026-07-18) — one
 *  discovery destination; tryouts are a filter there. */
export default function MarketplaceRedirect() {
  redirect("/events")
}
