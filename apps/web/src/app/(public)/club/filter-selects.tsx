"use client"

import { useRouter } from "next/navigation"
import { BrandListbox } from "@/components/ui"

/**
 * Phone filters for the club directory (owner 2026-08-17): three chip rows
 * are a wall on a small screen, so mobile gets two dropdowns instead. The
 * chips stay on desktop where they read at a glance; both drive the same
 * ?prov= and ?city= params.
 */
export function ClubFilterSelects({
  provinces,
  cities,
  prov,
  city,
}: {
  /** [code, label with count] pairs, Ontario first. */
  provinces: [string, string][]
  cities: string[]
  prov?: string
  city?: string
}) {
  const router = useRouter()

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-2.5 sm:hidden">
      <BrandListbox
        value={prov ?? ""}
        onChange={(v) => router.push(v ? `/club?prov=${encodeURIComponent(v)}` : "/club")}
        options={[
          { value: "", label: "All Canada" },
          ...provinces.map(([code, label]) => ({ value: code, label })),
        ]}
        ariaLabel="Filter by province"
      />
      <BrandListbox
        value={city ?? ""}
        onChange={(v) =>
          router.push(v ? `/club?city=${encodeURIComponent(v)}` : prov ? `/club?prov=${prov}` : "/club")
        }
        options={[
          { value: "", label: "All cities" },
          ...cities.map((c) => ({ value: c, label: c })),
        ]}
        ariaLabel="Filter by city"
      />
    </div>
  )
}
