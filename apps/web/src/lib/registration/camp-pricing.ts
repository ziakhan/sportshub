/**
 * Camp fee math — THE single implementation (was duplicated 6× across the
 * signup API, public page, signup form, create/edit forms, and mobile — the
 * mobile copy even advertised a "full camp" price with no is-it-actually-
 * cheaper guard). The signup API is authoritative; every display surface
 * either imports this or reads the API's result.
 */

export interface CampPricingInput {
  numberOfWeeks: number
  weeklyFee: number
  fullCampFee: number | null
}

export interface CampFee {
  total: number
  /** True when the full-camp price applied (all weeks + genuinely cheaper). */
  usedFullCampFee: boolean
  /** True when a real discount exists at all (fullCampFee < weekly total). */
  hasDiscount: boolean
  savingsPercent: number
}

export function campHasDiscount(camp: CampPricingInput): boolean {
  return (
    camp.fullCampFee != null &&
    camp.numberOfWeeks > 1 &&
    camp.fullCampFee < camp.weeklyFee * camp.numberOfWeeks
  )
}

export function computeCampFee(camp: CampPricingInput, weeksCount: number): CampFee {
  const weeks = Math.max(1, Math.min(weeksCount, camp.numberOfWeeks))
  const weeklyTotal = camp.weeklyFee * weeks
  const hasDiscount = campHasDiscount(camp)
  const allWeeks = weeks >= camp.numberOfWeeks

  // Full-camp price applies for all-weeks whenever set and not WORSE than
  // weekly (matches the signup API's historical behavior); the discount
  // badge only shows when it's genuinely cheaper.
  if (allWeeks && camp.fullCampFee != null && camp.fullCampFee <= weeklyTotal) {
    const fullWeeklyTotal = camp.weeklyFee * camp.numberOfWeeks
    return {
      total: camp.fullCampFee,
      usedFullCampFee: true,
      hasDiscount,
      savingsPercent: hasDiscount ? Math.round((1 - camp.fullCampFee / fullWeeklyTotal) * 100) : 0,
    }
  }

  return { total: weeklyTotal, usedFullCampFee: false, hasDiscount, savingsPercent: hasDiscount ? Math.round((1 - (camp.fullCampFee as number) / (camp.weeklyFee * camp.numberOfWeeks)) * 100) : 0 }
}
