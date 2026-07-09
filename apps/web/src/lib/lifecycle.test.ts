import { describe, expect, it } from "vitest"
import { programLifecycle } from "./lifecycle"

const NOW = new Date("2026-07-09T12:00:00Z")
const YESTERDAY = new Date("2026-07-08T12:00:00Z")
const TOMORROW = new Date("2026-07-10T12:00:00Z")
const NEXT_WEEK = new Date("2026-07-16T12:00:00Z")

describe("programLifecycle", () => {
  it("is DRAFT whenever unpublished, regardless of dates", () => {
    const l = programLifecycle({ isPublished: false, startAt: YESTERDAY, endAt: NEXT_WEEK, now: NOW })
    expect(l.state).toBe("DRAFT")
    expect(l.can).toMatchObject({ edit: true, editFee: true, publish: true, delete: true, register: false })
  })

  it("DRAFT with dates fully in the past cannot be published", () => {
    const l = programLifecycle({
      isPublished: false,
      startAt: new Date("2026-06-01"),
      endAt: new Date("2026-06-05"),
      now: NOW,
    })
    expect(l.state).toBe("DRAFT")
    expect(l.can.publish).toBe(false)
  })

  it("is OPEN before start with spots left", () => {
    const l = programLifecycle({
      isPublished: true,
      startAt: TOMORROW,
      endAt: NEXT_WEEK,
      maxParticipants: 20,
      signupCount: 5,
      now: NOW,
    })
    expect(l.state).toBe("OPEN")
    expect(l.can).toMatchObject({
      edit: true,
      editFee: true,
      publish: false,
      unpublish: true,
      delete: false,
      register: true,
      viewRegistrants: true,
    })
  })

  it("derives FULL from capacity and blocks registration", () => {
    const l = programLifecycle({
      isPublished: true,
      startAt: TOMORROW,
      maxParticipants: 20,
      signupCount: 20,
      now: NOW,
    })
    expect(l.state).toBe("FULL")
    expect(l.can.register).toBe(false)
    expect(l.can.unpublish).toBe(true)
  })

  it("treats missing/zero capacity as never full", () => {
    expect(
      programLifecycle({ isPublished: true, startAt: TOMORROW, signupCount: 999, now: NOW }).state
    ).toBe("OPEN")
    expect(
      programLifecycle({
        isPublished: true,
        startAt: TOMORROW,
        maxParticipants: 0,
        signupCount: 999,
        now: NOW,
      }).state
    ).toBe("OPEN")
  })

  it("is IN_PROGRESS between start and end — logistics editable, money locked", () => {
    const l = programLifecycle({ isPublished: true, startAt: YESTERDAY, endAt: NEXT_WEEK, now: NOW })
    expect(l.state).toBe("IN_PROGRESS")
    expect(l.can).toMatchObject({ edit: true, editFee: false, unpublish: false, register: false })
  })

  it("is ENDED after end date — read-only history", () => {
    const l = programLifecycle({
      isPublished: true,
      startAt: new Date("2026-06-01"),
      endAt: YESTERDAY,
      now: NOW,
    })
    expect(l.state).toBe("ENDED")
    expect(l.can).toMatchObject({ edit: false, editFee: false, delete: false, viewRegistrants: true })
  })

  it("single-moment events (tryouts) use startAt as the end", () => {
    const past = programLifecycle({ isPublished: true, startAt: YESTERDAY, now: NOW })
    expect(past.state).toBe("ENDED")
    const future = programLifecycle({ isPublished: true, startAt: TOMORROW, now: NOW })
    expect(future.state).toBe("OPEN")
  })

  it("accepts ISO strings for dates", () => {
    const l = programLifecycle({ isPublished: true, startAt: "2026-07-10T12:00:00Z", now: NOW })
    expect(l.state).toBe("OPEN")
  })

  it("maps every state to a badge", () => {
    const draft = programLifecycle({ isPublished: false, startAt: TOMORROW, now: NOW })
    expect(draft.badge).toEqual({ tone: "neutral", dot: false })
    const live = programLifecycle({ isPublished: true, startAt: YESTERDAY, endAt: NEXT_WEEK, now: NOW })
    expect(live.badge).toEqual({ tone: "live", dot: true })
    expect(live.label).toBe("In progress")
  })
})
