import { describe, it, expect } from "vitest"
import { digestDateKey, digestTitle, isNotableFinal, mergeFeedWithExtras, weekdayOf } from "./feed"
import type { FeedItem, FeedExtras } from "./feed"

describe("isNotableFinal", () => {
  it("a clutch margin (<=3) is notable regardless of milestones", () => {
    expect(isNotableFinal(0, false)).toBe(true)
    expect(isNotableFinal(3, false)).toBe(true)
  })
  it("a blowout margin is notable only with a milestone", () => {
    expect(isNotableFinal(4, false)).toBe(false)
    expect(isNotableFinal(20, true)).toBe(true)
  })
})

describe("digestDateKey / weekdayOf", () => {
  it("round-trips a UTC noon instant to the same calendar day (Toronto, no DST edge)", () => {
    const key = digestDateKey(new Date("2026-07-24T16:00:00Z")) // noon EDT
    expect(key).toBe("2026-07-24")
    expect(weekdayOf(key)).toBe(5) // Friday
  })
})

describe("digestTitle", () => {
  const now = new Date("2026-07-25T16:00:00Z") // Saturday noon EDT

  it("labels today and yesterday specially, older days by weekday", () => {
    expect(digestTitle(digestDateKey(now), now)).toBe("Today around your clubs")
    expect(digestTitle(digestDateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000)), now)).toBe(
      "Yesterday around your clubs"
    )
    expect(digestTitle(digestDateKey(new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)), now)).toBe(
      "Wednesday around your clubs"
    )
  })
})

describe("mergeFeedWithExtras", () => {
  const post = (id: string, publishedAt: string): FeedItem => ({
    type: "post",
    id,
    kind: "ARTICLE",
    title: id,
    body: "",
    slug: id,
    publishedAt,
    visibility: "PUBLIC",
    authorName: null,
    repostedBy: null,
    repostedAt: null,
    cardImage: null,
    mediaUrl: null,
    mediaType: null,
    gameId: null,
    playerName: null,
    isSystemFinal: false,
    counts: { reactions: 0, comments: 0, reposts: 0 },
    myEmojis: [],
    myRepost: false,
  })

  it("interleaves posts, digest, and preview items by their sort timestamp, most recent first", () => {
    const items: FeedItem[] = [post("mid", "2026-07-24T12:00:00Z"), post("old", "2026-07-20T12:00:00Z")]
    const extras: FeedExtras = {
      digest: [
        {
          type: "digest",
          id: "digest-2026-07-23",
          dateKey: "2026-07-23",
          title: "Yesterday around your clubs",
          games: [],
          sortAt: "2026-07-23T22:00:00Z",
        },
      ],
      previews: [
        {
          type: "preview",
          id: "preview-g1",
          gameId: "g1",
          title: "Sat: Lords vs Kings",
          homeTeam: "Lords",
          awayTeam: "Kings",
          homeColor: null,
          awayColor: null,
          mine: "home",
          venueName: null,
          scheduledAt: "2026-07-26T18:00:00Z",
          sortAt: "2026-07-26T18:00:00Z",
        },
      ],
    }
    const merged = mergeFeedWithExtras(items, extras)
    expect(merged.map((r) => r.id)).toEqual(["preview-g1", "mid", "digest-2026-07-23", "old"])
  })

  it("returns just the posts, unmerged-shape, when there are no extras", () => {
    const items: FeedItem[] = [post("a", "2026-07-24T12:00:00Z")]
    const merged = mergeFeedWithExtras(items, { digest: [], previews: [] })
    expect(merged).toEqual(items)
  })
})
