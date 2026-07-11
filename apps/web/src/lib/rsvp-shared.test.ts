import { describe, expect, it } from "vitest"
import { formatRsvpSummary, rsvpKey, summarizeRsvps } from "./rsvp-shared"

describe("rsvpKey", () => {
  it("namespaces by item type", () => {
    expect(rsvpKey("PRACTICE", "abc")).toBe("PRACTICE:abc")
    expect(rsvpKey("GAME", "abc")).toBe("GAME:abc")
    expect(rsvpKey("TEAM_EVENT", "abc")).toBe("TEAM_EVENT:abc")
  })
})

describe("summarizeRsvps", () => {
  it("counts each status and derives no-reply from the roster size", () => {
    const s = summarizeRsvps(12, ["GOING", "GOING", "NOT_GOING", "MAYBE"])
    expect(s).toEqual({ going: 2, notGoing: 1, maybe: 1, noReply: 8 })
  })

  it("empty answers means everyone is a no-reply", () => {
    expect(summarizeRsvps(9, [])).toEqual({ going: 0, notGoing: 0, maybe: 0, noReply: 9 })
  })

  it("never reports negative no-reply (answers can outnumber a shrunk roster)", () => {
    const s = summarizeRsvps(1, ["GOING", "NOT_GOING"])
    expect(s.noReply).toBe(0)
  })
})

describe("formatRsvpSummary", () => {
  it("always shows going + no reply; hides zero out/maybe", () => {
    expect(formatRsvpSummary({ going: 9, notGoing: 0, maybe: 0, noReply: 3 })).toBe(
      "9 going · 3 no reply"
    )
  })

  it("includes out and maybe when present", () => {
    expect(formatRsvpSummary({ going: 5, notGoing: 2, maybe: 1, noReply: 4 })).toBe(
      "5 going · 2 out · 1 maybe · 4 no reply"
    )
  })
})
