import { describe, expect, it } from "vitest"
import { getOnboardingNextStep } from "@/lib/onboarding-next-step"

describe("getOnboardingNextStep", () => {
  it("sends club owners to club creation", () => {
    expect(getOnboardingNextStep(["ClubOwner"])).toBe("/clubs/create")
    expect(getOnboardingNextStep(["Parent", "ClubOwner"])).toBe("/clubs/create")
  })

  it("sends league owners to the dashboard when no club owner role exists", () => {
    expect(getOnboardingNextStep(["LeagueOwner"])).toBe("/dashboard")
  })

  it("falls back to the home page for other roles", () => {
    expect(getOnboardingNextStep(["Parent"])).toBe("/")
    expect(getOnboardingNextStep(["Player", "Staff"])).toBe("/")
  })
})
