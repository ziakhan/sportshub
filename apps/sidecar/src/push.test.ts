import { describe, expect, it, vi } from "vitest"
import {
  buildMessages,
  chunk,
  foldTickets,
  inQuietHours,
  processReceipts,
  processSend,
  wallMinutes,
  type DeviceRow,
  type PushDb,
  type PushItem,
} from "./push"

const min = (h: number, m = 0) => h * 60 + m

describe("inQuietHours", () => {
  it("plain window (13:00–15:00)", () => {
    const w = { start: "13:00", end: "15:00" }
    expect(inQuietHours(min(12, 59), w)).toBe(false)
    expect(inQuietHours(min(13), w)).toBe(true)
    expect(inQuietHours(min(14, 59), w)).toBe(true)
    expect(inQuietHours(min(15), w)).toBe(false)
  })

  it("midnight-wrapping window (22:00–08:00)", () => {
    const w = { start: "22:00", end: "08:00" }
    expect(inQuietHours(min(21, 59), w)).toBe(false)
    expect(inQuietHours(min(22), w)).toBe(true)
    expect(inQuietHours(min(23, 30), w)).toBe(true)
    expect(inQuietHours(min(0), w)).toBe(true)
    expect(inQuietHours(min(7, 59), w)).toBe(true)
    expect(inQuietHours(min(8), w)).toBe(false)
    expect(inQuietHours(min(12), w)).toBe(false)
  })

  it("never quiet when unset, invalid, or zero-length", () => {
    expect(inQuietHours(min(3), { start: null, end: null })).toBe(false)
    expect(inQuietHours(min(3), { start: "22:00", end: null })).toBe(false)
    expect(inQuietHours(min(3), { start: "junk", end: "08:00" })).toBe(false)
    expect(inQuietHours(min(3), { start: "25:00", end: "08:00" })).toBe(false)
    expect(inQuietHours(min(3), { start: "09:00", end: "09:00" })).toBe(false)
  })
})

describe("wallMinutes", () => {
  it("converts an instant to timezone wall minutes", () => {
    // 2026-01-15T03:30:00Z = 22:30 previous day in Toronto (UTC-5)
    const instant = new Date("2026-01-15T03:30:00Z")
    expect(wallMinutes(instant, "UTC")).toBe(min(3, 30))
    expect(wallMinutes(instant, "America/Toronto")).toBe(min(22, 30))
  })
})

describe("chunk", () => {
  it("splits into fixed-size groups", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 2)).toEqual([])
  })
})

describe("buildMessages", () => {
  const items: PushItem[] = [
    { userId: "u1", type: "team_chat", title: "Chat", message: "hi", link: "/teams/t1/chat" },
    { userId: "u2", type: "game_final", title: "Final", message: "50-40" },
  ]
  const devices: DeviceRow[] = [
    { userId: "u1", token: "tokA" },
    { userId: "u1", token: "tokB" },
    { userId: "u2", token: "tokC" },
  ]

  it("fans each item out to every device of its user", () => {
    const { messages, skippedQuiet } = buildMessages(items, devices, new Map(), min(12))
    expect(messages.map((m) => m.to).sort()).toEqual(["tokA", "tokB", "tokC"])
    expect(messages[0].data).toEqual({ link: "/teams/t1/chat", type: "team_chat" })
    expect(skippedQuiet).toBe(0)
  })

  it("skips users inside quiet hours, counts them", () => {
    const quiet = new Map([["u1", { start: "22:00", end: "08:00" }]])
    const { messages, skippedQuiet } = buildMessages(items, devices, quiet, min(23))
    expect(messages.map((m) => m.to)).toEqual(["tokC"])
    expect(skippedQuiet).toBe(1)
  })

  it("users with no devices produce nothing", () => {
    const { messages } = buildMessages(items, [], new Map(), min(12))
    expect(messages).toEqual([])
  })
})

describe("foldTickets", () => {
  it("maps ok tickets to receipts and DeviceNotRegistered to revocations", () => {
    const { revokeTokens, receiptMap } = foldTickets(
      [
        { status: "ok", id: "r1" },
        { status: "error", details: { error: "DeviceNotRegistered" } },
        { status: "error", details: { error: "MessageTooBig" } },
      ],
      ["tokA", "tokB", "tokC"]
    )
    expect(revokeTokens).toEqual(["tokB"])
    expect(receiptMap).toEqual({ r1: "tokA" })
  })
})

function fakeDb(devices: DeviceRow[], users: any[]) {
  const updateMany = vi.fn().mockResolvedValue({})
  const db: PushDb = {
    device: { findMany: vi.fn().mockResolvedValue(devices), updateMany },
    user: { findMany: vi.fn().mockResolvedValue(users) },
  }
  return { db, updateMany }
}

describe("processSend", () => {
  it("sends via Expo, prunes DeviceNotRegistered, schedules receipts", async () => {
    const { db, updateMany } = fakeDb(
      [
        { userId: "u1", token: "tokA" },
        { userId: "u1", token: "tokDead" },
      ],
      [{ id: "u1", pushQuietStart: null, pushQuietEnd: null }]
    )
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { status: "ok", id: "r1" },
            { status: "error", details: { error: "DeviceNotRegistered" } },
          ],
        })
      )
    )
    const scheduleReceipts = vi.fn().mockResolvedValue(undefined)

    const result = await processSend(
      [{ userId: "u1", type: "team_chat", title: "T", message: "M" }],
      { db, fetchFn: fetchFn as any, now: () => new Date("2026-01-15T17:00:00Z"), scheduleReceipts }
    )

    expect(result).toEqual({ sent: 2, skippedQuiet: 0, revoked: 1 })
    expect(fetchFn).toHaveBeenCalledTimes(1)
    const sentBody = JSON.parse(fetchFn.mock.calls[0][1].body)
    expect(sentBody).toHaveLength(2)
    expect(updateMany).toHaveBeenCalledWith({
      where: { token: { in: ["tokDead"] } },
      data: { revokedAt: expect.any(Date) },
    })
    expect(scheduleReceipts).toHaveBeenCalledWith({ r1: "tokA" })
  })

  it("skips everything during quiet hours without calling Expo", async () => {
    const { db } = fakeDb(
      [{ userId: "u1", token: "tokA" }],
      [{ id: "u1", pushQuietStart: "22:00", pushQuietEnd: "08:00" }]
    )
    const fetchFn = vi.fn()
    const result = await processSend(
      [{ userId: "u1", type: "team_chat", title: "T", message: "M" }],
      {
        db,
        fetchFn: fetchFn as any,
        // 23:30 UTC — inside the window (APP_TIMEZONE=UTC in test config)
        now: () => new Date("2026-01-15T23:30:00Z"),
        scheduleReceipts: vi.fn(),
      }
    )
    expect(result).toEqual({ sent: 0, skippedQuiet: 1, revoked: 0 })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it("throws on whole-request Expo failure so the queue retries", async () => {
    const { db } = fakeDb(
      [{ userId: "u1", token: "tokA" }],
      [{ id: "u1", pushQuietStart: null, pushQuietEnd: null }]
    )
    const fetchFn = vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 }))
    await expect(
      processSend([{ userId: "u1", type: "x", title: "T", message: "M" }], {
        db,
        fetchFn: fetchFn as any,
        now: () => new Date("2026-01-15T17:00:00Z"),
        scheduleReceipts: vi.fn(),
      })
    ).rejects.toThrow("expo push send failed: 429")
  })
})

describe("processReceipts", () => {
  it("revokes devices whose receipts came back DeviceNotRegistered", async () => {
    const { db, updateMany } = fakeDb([], [])
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            r1: { status: "ok" },
            r2: { status: "error", details: { error: "DeviceNotRegistered" } },
          },
        })
      )
    )
    const result = await processReceipts(
      { r1: "tokA", r2: "tokB" },
      { db, fetchFn: fetchFn as any }
    )
    expect(result.revoked).toBe(1)
    expect(updateMany).toHaveBeenCalledWith({
      where: { token: { in: ["tokB"] } },
      data: { revokedAt: expect.any(Date) },
    })
  })
})
