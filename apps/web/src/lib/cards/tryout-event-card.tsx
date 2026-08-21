import React from "react"
import { ImageResponse } from "next/og"
import { format } from "date-fns"
import { FAMILY, FONT_OPTS } from "./fonts"
import { chosenBrandColor } from "@/lib/club-page/brand"
import { socialLinks } from "@/lib/club-page/blocks"
import { genderLabel } from "@/lib/teams/naming"
import { PRIMARY_DOMAIN } from "@/lib/domains"
import { siteUrl } from "@/lib/site"
import { getTryoutEventPublic, type PublicTryoutEvent } from "@/lib/queries/tryout-events"

/**
 * The club tryout event as a 1080×1350 Instagram announcement.
 *
 * This is the post a club would have typed out by hand: the club at the top,
 * the event name big, then one line per session with its age group, day, time
 * and gym — the same fan-out ruling 10 gives the web page, because both read
 * getTryoutEventPublic(). A poster can therefore never advertise a session the
 * page does not show, or a time the page contradicts.
 *
 * Nothing but that module reaches the image: no capacity, no signup counts, no
 * names. Ruling 11 holds by construction here — the poster has no place to
 * print a crowd number even when a club opted into showing one on the page.
 *
 * Colour comes from the club's own brand through the same "neutral by default,
 * brand by choice" gate the club page uses, deepened into a poster ground so
 * white type clears contrast whatever hue a club picked.
 */

const W = 1080
const H = 1350

/** How many session lines fit before the poster starts counting instead. */
const MAX_ROWS = 8

interface RGB {
  r: number
  g: number
  b: number
}

function parseHex(input?: string | null): RGB | null {
  if (!input) return null
  let h = input.trim().replace(/^#/, "")
  if (h.length === 3) h = h.split("").map((c) => c + c).join("")
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function toHex({ r, g, b }: RGB): string {
  const c = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0")
  return `#${c(r)}${c(g)}${c(b)}`
}

function mix(a: RGB, b: RGB, weightA: number): RGB {
  return {
    r: a.r * weightA + b.r * (1 - weightA),
    g: a.g * weightA + b.g * (1 - weightA),
    b: a.b * weightA + b.b * (1 - weightA),
  }
}

function luminance({ r, g, b }: RGB): number {
  const ch = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
}

const NEAR_BLACK: RGB = { r: 8, g: 13, b: 24 }
const WHITE: RGB = { r: 255, g: 255, b: 255 }
/** Maple, the court system's own warm line colour — the neutral club's accent. */
const MAPLE = "#e8c184"

/** A poster ground: the brand hue pushed deep enough that white type sings. */
function ground(brand: RGB): { top: string; bottom: string } {
  return {
    top: toHex(mix(brand, NEAR_BLACK, 0.36)),
    bottom: toHex(mix(brand, NEAR_BLACK, 0.08)),
  }
}

/** The brand lifted until it reads as a highlight on that dark ground. */
function highlight(brand: RGB): string {
  let out = brand
  let w = 1
  while (luminance(out) < 0.42 && w > 0.05) {
    w -= 0.05
    out = mix(brand, WHITE, w)
  }
  return toHex(out)
}

/** "MON, SEP 8" — the line a family scans for. */
function dayLine(session: PublicTryoutEvent["sessions"][number]): string {
  return format(new Date(session.scheduledAt), "EEE, MMM d").toUpperCase()
}

function timeLine(session: PublicTryoutEvent["sessions"][number]): string {
  const start = new Date(session.scheduledAt)
  if (!session.endsAt) return format(start, "h:mm a")
  const end = new Date(session.endsAt)
  const sameHalf = format(start, "a") === format(end, "a")
  return `${format(start, sameHalf ? "h:mm" : "h:mm a")} – ${format(end, "h:mm a")}`
}

/** Where a reader goes: the club's own site, its handle, or its page here. */
function footerHandle(club: PublicTryoutEvent["club"]): string {
  const ig = socialLinks(club.branding?.socials).find((s) => s.key === "instagram")
  if (ig) {
    const tail = ig.href.replace(/\/+$/, "").split("/").pop()
    if (tail) return `@${tail.replace(/^@/, "")}`
  }
  if (club.website) {
    const host = club.website.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]
    if (host && host.includes(".")) return host
  }
  const base = siteUrl().replace(/^https?:\/\//, "") || PRIMARY_DOMAIN
  return `${base}/club/${club.slug}`
}

export async function loadTryoutEventCard(eventId: string): Promise<PublicTryoutEvent | null> {
  return getTryoutEventPublic(eventId)
}

export function renderTryoutEventCard(event: PublicTryoutEvent) {
  const club = event.club
  const chosen = chosenBrandColor({
    status: club.status,
    primaryColor: club.branding?.primaryColor,
  })
  const brandRgb = parseHex(chosen) ?? parseHex("#0f1b33")!
  const bg = ground(brandRgb)
  const accent = chosen ? highlight(brandRgb) : MAPLE
  const INK = "#ffffff"
  const BODY = "rgba(255,255,255,0.80)"
  const FAINT = "rgba(255,255,255,0.14)"

  const rows = event.sessions.slice(0, MAX_ROWS)
  const overflow = event.sessions.length - rows.length
  const titleSize = event.title.length > 42 ? 60 : event.title.length > 26 ? 74 : 90
  // A six-session poster and a two-session poster both have to fill 1350px
  // without the last line running into the footer: the rows breathe when
  // there are few and tighten when there are many.
  const rowPad = rows.length >= 7 ? 14 : rows.length >= 5 ? 19 : 28
  const place = [club.city, club.state].filter(Boolean).join(", ")

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: W,
          height: H,
          padding: "72px 68px 60px",
          background: `linear-gradient(165deg, ${bg.top} 0%, ${bg.bottom} 100%)`,
          color: INK,
          fontFamily: FAMILY,
        }}
      >
        {/* Club identity */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              width: 76,
              height: 76,
              borderRadius: 20,
              backgroundColor: accent,
              color: bg.bottom,
              alignItems: "center",
              justifyContent: "center",
              fontSize: 42,
              fontWeight: 800,
            }}
          >
            {(club.name || "C").slice(0, 1).toUpperCase()}
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 22 }}>
            <span style={{ fontSize: 38, fontWeight: 800, color: INK }}>{club.name}</span>
            {place ? (
              <span style={{ fontSize: 24, fontWeight: 700, color: BODY, marginTop: 2 }}>
                {place}
              </span>
            ) : null}
          </div>
        </div>

        {/* The announcement */}
        <span
          style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: 6,
            color: accent,
            marginTop: 56,
          }}
        >
          {event.seasonLabel.toUpperCase()} TRYOUTS
        </span>
        <span
          style={{
            fontSize: titleSize,
            fontWeight: 800,
            lineHeight: 1.03,
            color: INK,
            marginTop: 10,
          }}
        >
          {event.title}
        </span>

        <div
          style={{
            display: "flex",
            width: 140,
            height: 8,
            borderRadius: 4,
            backgroundColor: accent,
            marginTop: 28,
          }}
        />

        {/* One line per session: age group, day, time, gym. Never merged. */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 34 }}>
          {rows.map((s, i) => {
            const label = [s.ageGroup, genderLabel(s.gender as any)]
              .filter(Boolean)
              .join(" ")
            const time = timeLine(s)
            return (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  paddingTop: rowPad,
                  paddingBottom: rowPad,
                  borderTop: i === 0 ? "none" : `2px solid ${FAINT}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: 178,
                    height: 70,
                    borderRadius: 16,
                    border: `3px solid ${accent}`,
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: label.length > 8 ? 27 : 36,
                    fontWeight: 800,
                    color: accent,
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    marginLeft: 24,
                    width: 348,
                  }}
                >
                  <span style={{ fontSize: 23, fontWeight: 800, letterSpacing: 3, color: accent }}>
                    {dayLine(s)}
                  </span>
                  <span
                    style={{
                      fontSize: time.length > 15 ? 31 : 36,
                      fontWeight: 800,
                      color: INK,
                      marginTop: 2,
                    }}
                  >
                    {time}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 23,
                    fontWeight: 700,
                    color: BODY,
                    marginLeft: 14,
                    flex: 1,
                    textAlign: "right",
                  }}
                >
                  {s.venue?.name ?? s.location}
                </span>
              </div>
            )
          })}
          {overflow > 0 ? (
            <span
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: BODY,
                marginTop: 18,
                borderTop: `2px solid ${FAINT}`,
                paddingTop: 20,
              }}
            >
              And {overflow} more session{overflow === 1 ? "" : "s"}. Full times on our page.
            </span>
          ) : null}
        </div>

        {/* Where to go next */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginTop: "auto",
            paddingTop: 30,
            borderTop: `2px solid ${FAINT}`,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: 4, color: BODY }}>
              REGISTER AT
            </span>
            <span style={{ fontSize: 40, fontWeight: 800, color: accent, marginTop: 4 }}>
              {footerHandle(club)}
            </span>
          </div>
          <span style={{ fontSize: 24, fontWeight: 800, color: "rgba(255,255,255,0.42)" }}>
            Sports<span style={{ color: accent }}>Hub</span> One
          </span>
        </div>
      </div>
    ),
    { width: W, height: H, ...FONT_OPTS }
  )
}
