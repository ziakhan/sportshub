import { describe, expect, it } from "vitest"
import { formatSizeBreakdown, rollUpOrders, type OrderableOffer } from "./order-rollup"

const offer = (over: Partial<OrderableOffer> = {}): OrderableOffer => ({
  includesBall: false,
  includesBag: false,
  includesShoes: false,
  includesUniform: false,
  includesTracksuit: false,
  uniformSize: null,
  shoeSize: null,
  tracksuitSize: null,
  ...over,
})

describe("rollUpOrders", () => {
  it("produces the demo order sheet: 8 uniforms (3 YL, 5 AM), 5 shoes, 4 bags", () => {
    const offers = [
      ...Array.from({ length: 3 }, () =>
        offer({ includesUniform: true, uniformSize: "YL", includesShoes: true, shoeSize: "7" })
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        offer({
          includesUniform: true,
          uniformSize: "AM",
          includesShoes: i < 2,
          shoeSize: i < 2 ? "9" : null,
          includesBag: i < 4,
        })
      ),
    ]
    const rollup = rollUpOrders(offers)
    expect(rollup.players).toBe(8)
    expect(rollup.uniforms.total).toBe(8)
    expect(rollup.uniforms.bySize).toEqual([
      ["YL", 3],
      ["AM", 5],
    ])
    expect(rollup.shoes.total).toBe(5)
    expect(rollup.bags).toBe(4)
    expect(rollup.isEmpty).toBe(false)
  })

  it("counts included items with no size on file as missing, not dropped", () => {
    const rollup = rollUpOrders([
      offer({ includesUniform: true, uniformSize: "YM" }),
      offer({ includesUniform: true }), // accepted but size never captured
      offer({ includesTracksuit: true }),
    ])
    expect(rollup.uniforms.total).toBe(2)
    expect(rollup.uniforms.missing).toBe(1)
    expect(rollup.uniforms.bySize).toEqual([["YM", 1]])
    expect(rollup.tracksuits).toEqual({ total: 1, bySize: [], missing: 1 })
  })

  it("ignores sizes on offers that do not include the item", () => {
    // A declined-then-resent or template-tweaked offer can carry a stale size.
    const rollup = rollUpOrders([offer({ uniformSize: "AL", shoeSize: "10" })])
    expect(rollup.uniforms.total).toBe(0)
    expect(rollup.uniforms.bySize).toEqual([])
    expect(rollup.shoes.total).toBe(0)
    expect(rollup.isEmpty).toBe(true)
  })

  it("sorts apparel sizes youth-to-adult, not alphabetically", () => {
    const rollup = rollUpOrders(
      ["AXL", "YS", "AM", "YL", "AS"].map((s) => offer({ includesUniform: true, uniformSize: s }))
    )
    expect(rollup.uniforms.bySize.map(([s]) => s)).toEqual(["YS", "YL", "AS", "AM", "AXL"])
  })

  it("sorts shoe sizes numerically including half sizes", () => {
    const rollup = rollUpOrders(
      ["10", "8.5", "7", "9"].map((s) => offer({ includesShoes: true, shoeSize: s }))
    )
    expect(rollup.shoes.bySize.map(([s]) => s)).toEqual(["7", "8.5", "9", "10"])
  })

  it("places unknown size labels after known ones", () => {
    const rollup = rollUpOrders(
      ["Custom", "YM"].map((s) => offer({ includesUniform: true, uniformSize: s }))
    )
    expect(rollup.uniforms.bySize.map(([s]) => s)).toEqual(["YM", "Custom"])
  })

  it("is empty for no offers and for offers with no orderable items", () => {
    expect(rollUpOrders([]).isEmpty).toBe(true)
    expect(rollUpOrders([offer()]).isEmpty).toBe(true)
    expect(rollUpOrders([offer({ includesBall: true })]).isEmpty).toBe(false)
  })
})

describe("formatSizeBreakdown", () => {
  it("renders counts per size in order", () => {
    const rollup = rollUpOrders([
      offer({ includesUniform: true, uniformSize: "YL" }),
      offer({ includesUniform: true, uniformSize: "AM" }),
      offer({ includesUniform: true, uniformSize: "AM" }),
    ])
    expect(formatSizeBreakdown(rollup.uniforms)).toBe("1 YL, 2 AM")
  })

  it("appends the missing-size bucket", () => {
    const rollup = rollUpOrders([
      offer({ includesUniform: true, uniformSize: "YL" }),
      offer({ includesUniform: true }),
    ])
    expect(formatSizeBreakdown(rollup.uniforms)).toBe("1 YL, 1 size TBD")
  })
})
