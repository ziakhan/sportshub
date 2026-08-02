import React from "react"
import { ImageResponse } from "next/og"
import { prisma } from "@youthbasketballhub/db"
import { FAMILY, FONT_OPTS } from "./fonts"
import { PRIMARY_DOMAIN } from "@/lib/domains"
import { siteUrl } from "@/lib/site"
import { buildPlannerState } from "@/lib/scheduler/planner"
import { currentAssignment, seasonCalendarMonths, type CalendarMonth } from "@/lib/scheduler/planner-core"

/**
 * The published season calendar as a shareable PNG (plan wizard step 4,
 * owner-approved mock 2026-08-02). The graphic operators used to hand-build
 * in a design tool every August, now a byproduct of planning: month columns,
 * the weekends each grade plays, and where to register.
 *
 * The card is a TRAVELLING copy — Instagram, print, the club newsletter. The
 * living version is the same data rendered as HTML on the public league page;
 * both read seasonCalendarMonths(), so the poster can never say something the
 * page does not.
 */

const W = 1200
const H = 630

/** The mock's poster palette, kept literal so the card matches it exactly. */
const INK = "#F2EFE9"
const MINT = "#8FCEAD"
const BODY = "#DCE6DF"

export interface SeasonCalendarCardData {
  leagueName: string
  seasonLabel: string
  months: CalendarMonth[]
  /** "sportshubone.com/org/nph" — where a reader actually goes. */
  ctaUrl: string
}

/**
 * Where a poster reader is sent. There is no per-league vanity slug, and a
 * season UUID is not something anyone types off a printed page, so the card
 * points at the operator's public profile when it has one and at the brand
 * domain otherwise. The Preview action in the wizard links to the exact
 * season page; this line is for people reading paper.
 */
function ctaFor(orgSlug: string | null): string {
  const host = siteUrl().replace(/^https?:\/\//, "") || PRIMARY_DOMAIN
  return orgSlug ? `${host}/org/${orgSlug}` : host
}

/** Everything the card needs; null when the season does not exist. */
export async function loadSeasonCalendarCard(
  seasonId: string
): Promise<SeasonCalendarCardData | null> {
  const season = await (prisma as any).season.findUnique({
    where: { id: seasonId },
    select: {
      label: true,
      league: {
        select: { name: true, organization: { select: { slug: true } } },
      },
    },
  })
  if (!season) return null

  const state = await buildPlannerState(seasonId)
  return {
    leagueName: season.league?.name ?? "League",
    seasonLabel: season.label ?? "",
    months: seasonCalendarMonths(state, currentAssignment(state)),
    ctaUrl: ctaFor(season.league?.organization?.slug ?? null),
  }
}

/** Five columns fit comfortably; a longer season packs tighter rather than
 *  spilling off the card. */
function scaleFor(columns: number) {
  if (columns <= 4) return { month: 26, row: 23, gap: 12, pad: 18 }
  if (columns === 5) return { month: 23, row: 20, gap: 10, pad: 16 }
  if (columns === 6) return { month: 21, row: 18, gap: 8, pad: 14 }
  return { month: 18, row: 15, gap: 6, pad: 11 }
}

export function renderSeasonCalendarCard(data: SeasonCalendarCardData) {
  const columns = Math.max(1, data.months.length)
  const s = scaleFor(columns)
  const eyebrow = [data.leagueName, data.seasonLabel].filter(Boolean).join(" · ").toUpperCase()

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: W,
          height: H,
          padding: "48px 56px",
          background: "linear-gradient(160deg, #173A2A 0%, #0E2018 100%)",
          color: INK,
          fontFamily: FAMILY,
        }}
      >
        <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: 4, color: MINT }}>
          {eyebrow}
        </span>
        <span style={{ fontSize: 58, fontWeight: 800, color: "#ffffff", marginTop: 6 }}>
          Season calendar
        </span>

        {data.months.length === 0 ? (
          <span style={{ fontSize: 28, color: BODY, marginTop: 40 }}>
            Weekends are still being set.
          </span>
        ) : (
          // No flex:1 — the month tiles hug their weekends the way the mock
          // does, and the footer takes the slack below them.
          <div style={{ display: "flex", gap: s.gap, marginTop: 26 }}>
            {data.months.map((m, i) => (
              <div
                key={`${m.month}-${i}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  padding: s.pad,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                <span
                  style={{
                    fontSize: s.month,
                    fontWeight: 700,
                    letterSpacing: 2,
                    color: MINT,
                    marginBottom: 10,
                  }}
                >
                  {m.month.toUpperCase()}
                </span>
                {m.weekends.map((w) => (
                  <div
                    key={w.sessionId}
                    style={{
                      display: "flex",
                      fontSize: s.row,
                      lineHeight: 1.45,
                      color: BODY,
                      marginBottom: 6,
                    }}
                  >
                    {`${w.days} · ${w.grades}`}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "auto",
            paddingTop: 22,
          }}
        >
          <span style={{ fontSize: 26, fontWeight: 700, color: MINT }}>
            Register at {data.ctaUrl}
          </span>
          <span style={{ fontSize: 24, fontWeight: 800, color: "rgba(242,239,233,0.55)" }}>
            Sports<span style={{ color: MINT }}>Hub</span> One
          </span>
        </div>
      </div>
    ),
    { width: W, height: H, ...FONT_OPTS }
  )
}
