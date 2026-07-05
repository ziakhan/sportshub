import { describe, it, expect } from "vitest"
import { abbreviatedName, fullName, publicPlayerName, playerDisplayName } from "./names"

describe("abbreviatedName", () => {
  it("abbreviates the last name to an initial", () => {
    expect(abbreviatedName({ firstName: "Maya", lastName: "Khan" })).toBe("Maya K.")
  })
  it("handles missing last name", () => {
    expect(abbreviatedName({ firstName: "Maya", lastName: "" })).toBe("Maya")
  })
  it("handles missing first name", () => {
    expect(abbreviatedName({ firstName: "", lastName: "Khan" })).toBe("K.")
  })
  it("handles fully empty parts", () => {
    expect(abbreviatedName({ firstName: "", lastName: "" })).toBe("Player")
  })
  it("trims whitespace", () => {
    expect(abbreviatedName({ firstName: " Maya ", lastName: " Khan " })).toBe("Maya K.")
  })
})

describe("publicPlayerName", () => {
  const p = { firstName: "Maya", lastName: "Khan" }
  it("abbreviates when consent is UNSET", () => {
    expect(publicPlayerName({ ...p, mediaConsent: "UNSET" })).toBe("Maya K.")
  })
  it("abbreviates when consent is DENIED", () => {
    expect(publicPlayerName({ ...p, mediaConsent: "DENIED" })).toBe("Maya K.")
  })
  it("abbreviates when consent is missing", () => {
    expect(publicPlayerName(p)).toBe("Maya K.")
  })
  it("shows full name when consent is GRANTED", () => {
    expect(publicPlayerName({ ...p, mediaConsent: "GRANTED" })).toBe("Maya Khan")
  })
})

describe("playerDisplayName", () => {
  const p = { firstName: "Maya", lastName: "Khan", mediaConsent: "UNSET" as const }
  it("shows full name to participants regardless of consent", () => {
    expect(playerDisplayName(p, true)).toBe("Maya Khan")
  })
  it("applies the public rule to non-participants", () => {
    expect(playerDisplayName(p, false)).toBe("Maya K.")
  })
})

describe("fullName", () => {
  it("joins and trims", () => {
    expect(fullName({ firstName: " Maya", lastName: "Khan " })).toBe("Maya Khan")
  })
  it("falls back when empty", () => {
    expect(fullName({ firstName: "", lastName: "" })).toBe("Player")
  })
})
