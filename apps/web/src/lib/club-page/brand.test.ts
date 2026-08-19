import { describe, expect, it } from "vitest"
import { hasChosenBrand, chosenBrandColor, IMPORTER_BRAND_HEXES } from "./brand"

// Neutral by default, brand by choice (owner ruling 2026-08-14): a colour only
// counts once a human stood behind it. These lock the two importer stamps out.
describe("hasChosenBrand", () => {
  it("never honours a colour on an UNCLAIMED club, however vivid", () => {
    expect(hasChosenBrand({ status: "UNCLAIMED", primaryColor: "#9333ea" })).toBe(false)
  })

  it("treats the schema default as no choice", () => {
    expect(hasChosenBrand({ status: "ACTIVE", primaryColor: "#1a73e8" })).toBe(false)
  })

  it("treats the census import stamp #1e40af as no choice, even after a claim", () => {
    // 1,611 branding rows hold this hex, all census-sourced. A claim flips
    // status to ACTIVE; the hex alone must keep the page neutral.
    expect(hasChosenBrand({ status: "ACTIVE", primaryColor: "#1e40af" })).toBe(false)
    expect(chosenBrandColor({ status: "ACTIVE", primaryColor: "#1E40AF" })).toBeNull()
  })

  it("honours a genuine choice on a claimed club", () => {
    expect(hasChosenBrand({ status: "ACTIVE", primaryColor: "#1d4ed8" })).toBe(true)
    expect(chosenBrandColor({ status: "ACTIVE", primaryColor: "#1d4ed8" })).toBe("#1d4ed8")
  })

  it("returns false on a missing or malformed hex", () => {
    expect(hasChosenBrand({ status: "ACTIVE", primaryColor: null })).toBe(false)
    expect(hasChosenBrand({ status: "ACTIVE", primaryColor: "navy" })).toBe(false)
  })

  it("keeps both importer stamps in the deny set", () => {
    expect(IMPORTER_BRAND_HEXES.has("#1a73e8")).toBe(true)
    expect(IMPORTER_BRAND_HEXES.has("#1e40af")).toBe(true)
  })
})
