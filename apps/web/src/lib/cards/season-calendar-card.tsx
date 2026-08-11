import React from "react"
import { ImageResponse } from "next/og"
import { prisma } from "@youthbasketballhub/db"
import { FAMILY, FONT_OPTS } from "./fonts"
import { PRIMARY_DOMAIN } from "@/lib/domains"
import { siteUrl } from "@/lib/site"
import { buildPlannerState } from "@/lib/scheduler/planner"
import {
  currentAssignment,
  seasonCalendarMonths,
  type CalendarMonth,
} from "@/lib/scheduler/planner-core"

/**
 * The published season calendar as a shareable PNG — REDESIGNED 2026-08-10
 * (owner: "a complete redesign... grades and the weekends on two different
 * axes and green check marks"; QA T-011: a parent must answer "does my kid
 * play that weekend?" in under five seconds).
 *
 * The layout IS that answer: one row per grade, one column per weekend
 * date grouped under its month, a green check where that grade plays.
 * Family words only, league name first, platform watermark small.
 *
 * The card is a TRAVELLING copy — Instagram, print, the club newsletter.
 * The living version is the same data rendered as HTML on the public league
 * page; both read seasonCalendarMonths(), so the poster can never say
 * something the page does not.
 */

const W = 1200
const H = 630

/** The mock's poster palette, kept literal so the card matches it exactly. */
const INK = "#F2EFE9"
const MINT = "#8FCEAD"
const BODY = "#DCE6DF"
const FAINT = "rgba(242,239,233,0.28)"

export interface SeasonCalendarGrid {
  /** Row labels, family words ("Grade 5", "Junior Girls"), sorted. */
  grades: string[]
  months: Array<{
    month: string
    weekends: Array<{
      /** "24–25" — the dates a family looks for. */
      days: string
      /** One flag per grade row: does this grade play this weekend? */
      playing: boolean[]
    }>
  }>
}

export interface SeasonCalendarCardData {
  leagueName: string
  seasonLabel: string
  grid: SeasonCalendarGrid
  /** "sportshubone.com/org/nph" — where a reader actually goes. */
  ctaUrl: string
}

/**
 * Where a poster reader is sent. There is no per-league vanity slug, and a
 * season UUID is not something anyone types off a printed page, so the card
 * points at the operator's public profile when it has one and at the brand
 * domain otherwise.
 */
function ctaFor(orgSlug: string | null): string {
  const host = siteUrl().replace(/^https?:\/\//, "") || PRIMARY_DOMAIN
  return orgSlug ? `${host}/org/${orgSlug}` : host
}

/** "Grade 10" sorts numerically; girls' and named groups follow after. */
function gradeSort(a: string, b: string): number {
  const na = /grade\s+(\d+)/i.exec(a)
  const nb = /grade\s+(\d+)/i.exec(b)
  if (na && nb) return Number(na[1]) - Number(nb[1])
  if (na) return -1
  if (nb) return 1
  return a.localeCompare(b)
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
  const assignment = currentAssignment(state)
  const months: CalendarMonth[] = seasonCalendarMonths(state, assignment)

  /* The grid: every grade that plays at least one weekend gets a row;
     "Junior Girls" and friends spelled out, never abbreviated. */
  const unitLabel = new Map(state.units.map((u) => [u.key, u.label]))
  const playingKeys = new Set<string>()
  for (const m of months) {
    for (const w of m.weekends) {
      for (const k of assignment[w.sessionId] ?? []) playingKeys.add(k)
    }
  }
  const grades = [...playingKeys]
    .map((k) => unitLabel.get(k) ?? k)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .sort(gradeSort)
  const rowIndex = new Map(grades.map((g, i) => [g, i]))

  const grid: SeasonCalendarGrid = {
    grades,
    months: months.map((m) => ({
      month: m.month,
      weekends: m.weekends.map((w) => {
        const playing = grades.map(() => false)
        for (const k of assignment[w.sessionId] ?? []) {
          const label = unitLabel.get(k) ?? k
          const idx = rowIndex.get(label)
          if (idx !== undefined) playing[idx] = true
        }
        return { days: w.days, playing }
      }),
    })),
  }

  return {
    leagueName: season.league?.name ?? "League",
    seasonLabel: season.label ?? "",
    grid,
    ctaUrl: ctaFor(season.league?.organization?.slug ?? null),
  }
}

export function renderSeasonCalendarCard(data: SeasonCalendarCardData) {
  const { grades, months } = data.grid
  const weekendCount = months.reduce((n, m) => n + m.weekends.length, 0)
  const LABEL_W = 190
  const GRID_W = W - 112 - LABEL_W
  const colW = weekendCount > 0 ? Math.max(34, Math.min(88, Math.floor(GRID_W / weekendCount))) : 0
  const rowH = grades.length > 0 ? Math.max(24, Math.min(40, Math.floor(340 / grades.length))) : 0
  const check = Math.min(rowH - 6, Math.floor(colW * 0.55))

  const cell = (w: number, h: number, child?: React.ReactNode) => (
    <div
      style={{
        display: "flex",
        width: w,
        height: h,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {child}
    </div>
  )

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: W,
          height: H,
          padding: "44px 56px",
          background: "linear-gradient(160deg, #173A2A 0%, #0E2018 100%)",
          color: INK,
          fontFamily: FAMILY,
        }}
      >
        <span style={{ fontSize: 46, fontWeight: 800, color: "#ffffff" }}>{data.leagueName}</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 2 }}>
          <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: 3, color: MINT }}>
            {data.seasonLabel.toUpperCase()}
          </span>
          <span style={{ fontSize: 20, color: BODY }}>
            Every game weekend, every grade. Find your row.
          </span>
        </div>

        {grades.length === 0 || weekendCount === 0 ? (
          <span style={{ fontSize: 28, color: BODY, marginTop: 40 }}>
            Weekends are still being set.
          </span>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 20 }}>
            {/* month band */}
            <div style={{ display: "flex", marginLeft: LABEL_W }}>
              {months.map((m, i) => (
                <div
                  key={`m-${i}`}
                  style={{
                    display: "flex",
                    width: m.weekends.length * colW,
                    justifyContent: "center",
                    fontSize: 19,
                    fontWeight: 700,
                    letterSpacing: 2,
                    color: MINT,
                    borderLeft: i > 0 ? `1px solid ${FAINT}` : "none",
                  }}
                >
                  {m.month.toUpperCase()}
                </div>
              ))}
            </div>
            {/* date header row */}
            <div style={{ display: "flex", marginLeft: LABEL_W, marginTop: 4 }}>
              {months.map((m, mi) =>
                m.weekends.map((w, wi) =>
                  cell(
                    colW,
                    24,
                    <span style={{ fontSize: 16, color: BODY, fontWeight: 700 }}>{w.days}</span>
                  )
                )
              )}
            </div>
            {/* grade rows */}
            {grades.map((g, gi) => (
              <div
                key={g}
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: rowH,
                  backgroundColor: gi % 2 === 0 ? "rgba(255,255,255,0.05)" : "transparent",
                  borderRadius: 8,
                }}
              >
                <span
                  style={{
                    display: "flex",
                    width: LABEL_W,
                    paddingLeft: 12,
                    fontSize: Math.min(21, rowH - 8),
                    fontWeight: 700,
                    color: INK,
                  }}
                >
                  {g}
                </span>
                {months.map((m) =>
                  m.weekends.map((w, wi) =>
                    cell(
                      colW,
                      rowH,
                      w.playing[gi] ? (
                        <span style={{ fontSize: check, fontWeight: 800, color: MINT }}>✓</span>
                      ) : (
                        <span style={{ fontSize: 12, color: FAINT }}>·</span>
                      )
                    )
                  )
                )}
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
            paddingTop: 18,
          }}
        >
          <span style={{ fontSize: 26, fontWeight: 700, color: MINT }}>
            Register at {data.ctaUrl}
          </span>
          <span style={{ fontSize: 20, fontWeight: 800, color: "rgba(242,239,233,0.45)" }}>
            Sports<span style={{ color: MINT }}>Hub</span> One
          </span>
        </div>
      </div>
    ),
    { width: W, height: H, ...FONT_OPTS }
  )
}
