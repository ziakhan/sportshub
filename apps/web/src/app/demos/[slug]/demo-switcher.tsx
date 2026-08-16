"use client"

import { useRouter } from "next/navigation"
import { BrandListbox } from "@/components/ui"
import { DEMOS } from "../registry"

/**
 * Jump between demos without leaving the player (owner 2026-08-17: "a central
 * demo page where you can alter between the things"). The gallery stays the
 * hub; this is the shortcut for someone already watching.
 */
export function DemoSwitcher({ current }: { current: string }) {
  const router = useRouter()
  return (
    <BrandListbox
      value={current}
      onChange={(slug) => {
        if (slug !== current) router.push(`/demos/${slug}`)
      }}
      options={DEMOS.map((d) => ({
        value: d.slug,
        label: d.status === "live" ? d.title : `${d.title} (coming soon)`,
        disabled: d.status !== "live" && d.slug !== current,
      }))}
      ariaLabel="Switch demo"
      className="hidden w-[240px] md:block"
    />
  )
}
