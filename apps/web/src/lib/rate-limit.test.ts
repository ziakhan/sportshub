import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { rateLimit, resetRateLimits } from "@/lib/rate-limit"

describe("rateLimit", () => {
  beforeEach(() => {
    resetRateLimits()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("allows up to max attempts, then blocks", () => {
    for (let i = 0; i < 5; i++) {
      expect(rateLimit("k", 5, 60_000)).toBe(true)
    }
    expect(rateLimit("k", 5, 60_000)).toBe(false)
  })

  it("keys are independent", () => {
    for (let i = 0; i < 5; i++) rateLimit("a", 5, 60_000)
    expect(rateLimit("a", 5, 60_000)).toBe(false)
    expect(rateLimit("b", 5, 60_000)).toBe(true)
  })

  it("attempts fall out of the window", () => {
    for (let i = 0; i < 5; i++) rateLimit("k", 5, 60_000)
    expect(rateLimit("k", 5, 60_000)).toBe(false)
    vi.advanceTimersByTime(61_000)
    expect(rateLimit("k", 5, 60_000)).toBe(true)
  })

  it("blocked attempts do not extend the window", () => {
    for (let i = 0; i < 5; i++) rateLimit("k", 5, 60_000)
    vi.advanceTimersByTime(59_000)
    expect(rateLimit("k", 5, 60_000)).toBe(false) // still within window
    vi.advanceTimersByTime(2_000) // originals now expired
    expect(rateLimit("k", 5, 60_000)).toBe(true)
  })
})
