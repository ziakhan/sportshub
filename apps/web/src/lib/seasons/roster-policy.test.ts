import { describe, expect, it } from "vitest"
import { evaluateRosterEdit } from "./roster-policy"

const at = (iso: string) => new Date(iso)

describe("evaluateRosterEdit", () => {
  it("unlocked rosters are always editable regardless of policy", () => {
    for (const policy of ["OPEN_UNTIL_DEADLINE", "REQUEST_ONLY", "CLOSED"]) {
      const r = evaluateRosterEdit({ isLocked: false, policy, deadline: null })
      expect(r.canEdit).toBe(true)
      expect(r.canRequest).toBe(false)
    }
  })

  it("OPEN_UNTIL_DEADLINE: edit before the deadline, request after it", () => {
    const deadline = at("2026-08-01T00:00:00Z")
    const before = evaluateRosterEdit({
      isLocked: true,
      policy: "OPEN_UNTIL_DEADLINE",
      deadline,
      now: at("2026-07-15T00:00:00Z"),
    })
    expect(before.canEdit).toBe(true)

    const after = evaluateRosterEdit({
      isLocked: true,
      policy: "OPEN_UNTIL_DEADLINE",
      deadline,
      now: at("2026-08-02T00:00:00Z"),
    })
    expect(after.canEdit).toBe(false)
    expect(after.canRequest).toBe(true)
  })

  it("OPEN_UNTIL_DEADLINE without a deadline behaves like request-only once locked", () => {
    const r = evaluateRosterEdit({ isLocked: true, policy: "OPEN_UNTIL_DEADLINE", deadline: null })
    expect(r.canEdit).toBe(false)
    expect(r.canRequest).toBe(true)
  })

  it("REQUEST_ONLY: locked rosters can only be requested", () => {
    const r = evaluateRosterEdit({ isLocked: true, policy: "REQUEST_ONLY", deadline: null })
    expect(r.canEdit).toBe(false)
    expect(r.canRequest).toBe(true)
  })

  it("CLOSED: locked means locked — no edit, no request", () => {
    const r = evaluateRosterEdit({ isLocked: true, policy: "CLOSED", deadline: null })
    expect(r.canEdit).toBe(false)
    expect(r.canRequest).toBe(false)
  })
})
