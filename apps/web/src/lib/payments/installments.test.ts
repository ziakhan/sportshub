import { describe, expect, it } from "vitest"
import { computeDefaultPlan } from "./installments"

/**
 * Unit — the default plan math (owner spec): deposit + N equal monthly
 * installments summing exactly to the fee, dated the 1st of coming months.
 */
describe("computeDefaultPlan", () => {
  it("$3,000 → $750 deposit + 3 × $750, summing to the fee", () => {
    const plan = computeDefaultPlan(3000)
    expect(plan.depositAmount).toBe(750)
    expect(plan.terms).toHaveLength(3)
    expect(plan.terms.map((t) => t.amount)).toEqual([750, 750, 750])
    const total = plan.depositAmount + plan.terms.reduce((s, t) => s + t.amount, 0)
    expect(total).toBe(3000)
  })

  it("puts any rounding remainder in the deposit so parts sum to the fee", () => {
    const fee = 2755.55
    const plan = computeDefaultPlan(fee)
    const total =
      Math.round((plan.depositAmount + plan.terms.reduce((s, t) => s + t.amount, 0)) * 100) / 100
    expect(total).toBe(fee)
  })

  it("dates installments on the 1st of the next months", () => {
    const from = new Date(2026, 7, 15) // Aug 15 2026
    const plan = computeDefaultPlan(4000, { firstOfMonthFrom: from })
    expect(plan.terms.map((t) => t.dueDate.getDate())).toEqual([1, 1, 1])
    // Sept, Oct, Nov
    expect(plan.terms.map((t) => t.dueDate.getMonth())).toEqual([8, 9, 10])
  })

  it("honors a custom deposit fraction + count", () => {
    const plan = computeDefaultPlan(1000, { count: 4 })
    expect(plan.terms).toHaveLength(4)
    const total = plan.depositAmount + plan.terms.reduce((s, t) => s + t.amount, 0)
    expect(Math.round(total * 100) / 100).toBe(1000)
  })
})
