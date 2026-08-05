"use client"

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react"
import { Button, DateTimePicker } from "@/components/ui"
import { VenueEditor } from "@/components/venue-editor"
import { VenueSelector } from "@/components/venue-selector"
import type {
  VenueGrid,
  VenueGridCell,
  VenueGridRow,
  VenueGridWeekend,
} from "@/lib/seasons/venue-grid"
import { isReferencePlan, PLAN_COPY, type PlanWorld } from "@/lib/scheduler/plan-documents"
import {
  planGridFrom,
  weekendChosen,
  withCourtBuffer,
  withGym,
  withGymCourts,
  withGymEveryWeekend,
  withGymHours,
  withGymOnWeekend,
  withGymRole,
  withWeekend,
  withWeekendChosen,
  withWeekendGymHours,
  worldWeekends,
  DEFAULT_DAY_COUNT,
} from "@/lib/scheduler/plan-world"
import { PlanChooser, PlanEmptyState, usePlanSession } from "./plan-session"

/**
 * Step 2, gyms and weekends (owner-approved mock, 2026-08-02, revised the
 * same day after the owner drove it). One card per gym, one column per
 * weekend, and three rulings the screen is built around:
 *
 *   1. EVERY weekend of the season is here, month by month, not just the ones
 *      that already exist. "We currently don't have visibility."
 *   2. A cell is a one-tap on/off toggle. Tapping it never opens a panel.
 *   3. Hours are ONE from-to range per gym, the same every weekend. This is
 *      the estimate phase. A single weekend that runs different hours lives
 *      behind a quiet link, and shows up amber on the grid so it is never
 *      invisible.
 *
 * Owner ruling 2026-08-02 added a fourth state: a weekend the season does not
 * have this gym on, WITH the reason (Six Park East is taken by the NJC/NSC
 * circuits on six known 2026-27 weekends). It is pre-marked from what we
 * know, it is dashed gold so it never reads as a weekend nobody got to yet,
 * and tapping it is still just "turn the gym on" — the operator always wins,
 * and the notice says what was overridden.
 *
 * Owner rulings 2026-08-03 (venue model v2) replaced ranking with roles:
 *
 *   4. FILL ORDER IS GONE from this screen. No arrows, no "fills first", no
 *      "overflow #2". A gym is either the building the league owns or a gym it
 *      rents, and that is the only thing a card says about it.
 *   5. Each card wears its ROLE. The home gym costs nothing and always fills
 *      first; every other gym is in the pool, rented by the court when a
 *      weekend needs it. One quiet action per card names a new home gym, and
 *      because home is exclusive the operator is asked first: the server sends
 *      the old home gym to the pool in the same write.
 *   6. A weekend can be ours on paper without being booked. An assumed
 *      attachment is hatched and says "assumed"; one tap per weekend confirms
 *      it once the gym has said yes. No bulk confirm — a booking is a phone
 *      call, and pretending otherwise is how a season ends up double-booked.
 *
 * A PLAN OWNS ITS WORLD (owner ruling 2026-08-05, the architecture). This whole
 * screen is the SELECTED PLAN's gym time, not the season's:
 *
 *   - a plan of the operator's own → every toggle, every court, every hour and
 *     the buffer are written into the plan document. The season's SeasonVenue
 *     rows and its weekend attachments do not move until that plan is activated.
 *   - the ACTIVE plan, or nothing open → the season's own routes, exactly as
 *     before, because the active plan IS the season.
 *   - the imported reference → read only. It records what the league published.
 *
 * The COLUMNS are the season's either way: which Saturdays exist is a fact about
 * the season's dates, not an opinion a plan holds. So turning on a weekend the
 * season has never created still creates the weekend (a session with no gym on
 * it, which is inert), and then the PLAN attaches its own gym to it.
 */

const CELL_CLS: Record<VenueGridCell["state"], string> = {
  on: "border-court-200 bg-court-50 text-court-800 hover:border-court-400",
  off: "border-ink-200 border-dashed bg-ink-50 text-ink-400 hover:border-ink-400",
  custom: "border-gold-200 bg-gold-50 text-gold-800 hover:border-gold-400",
  // Dashed like off (the gym is not on this weekend) but gold like custom
  // (there is something to read here).
  taken: "border-gold-300 border-dashed bg-gold-50/70 text-gold-800 hover:border-gold-500",
}

/** An assumed booking keeps its colour and gains a texture: the weekend still
 *  reads as one we are counting on, it just stops looking like a weekend the
 *  gym has already said yes to. */
const ASSUMED_HATCH: CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(20,83,45,0.16) 0 2px, transparent 2px 5px)",
}

/** Attached, however its hours read. Taken and off both mean not ours. */
const isOn = (state: VenueGridCell["state"]) => state === "on" || state === "custom"

/** Ours on paper, nobody has booked it yet. */
const isAssumed = (cell: VenueGridCell) => isOn(cell.state) && cell.bookingStatus === "assumed"

/** What a cell says out loud. Booking status only ever qualifies a weekend we
 *  have — "off, assumed" would be nonsense. */
function cellLabel(venueName: string, weekend: string, cell: VenueGridCell): string {
  const head = `${venueName}, ${weekend}: `
  if (cell.state === "off") return `${head}off, tap to turn it on`
  if (cell.state === "taken") {
    return `${head}not available, ${cell.reason ?? "marked unavailable"}, tap to turn it on anyway`
  }
  const booking = cell.bookingStatus === "assumed" ? ", assumed, not booked yet" : ""
  const hours = cell.state === "custom" ? `, ${cell.startTime} to ${cell.endTime}` : ""
  return `${head}on${hours}${booking}, tap to turn it off`
}

/** What fits in a 62px cell: "Taken: NJC/NSC" reads as "NJC/NSC". */
function shortReason(reason: string | null): string | null {
  if (!reason) return null
  const tail = reason.includes(":") ? reason.slice(reason.indexOf(":") + 1) : reason
  const value = tail.trim()
  if (!value) return null
  return value.length > 9 ? `${value.slice(0, 8)}…` : value
}

interface HoursDraft {
  start: string
  end: string
}

/** Month bands over the weekend strip: one header per month, spanning its
 *  weekends, so a long season still reads as October through February. */
function monthGroups(weekends: VenueGridWeekend[]): Array<{ month: string; span: number }> {
  const groups: Array<{ month: string; span: number }> = []
  for (const w of weekends) {
    const last = groups[groups.length - 1]
    if (last && last.month === w.month) last.span++
    else groups.push({ month: w.month, span: 1 })
  }
  return groups
}

export function GymsWeekendsStep({
  seasonId,
  onLoaded,
}: {
  seasonId: string
  onLoaded?: (grid: VenueGrid) => void
}) {
  const session = usePlanSession()
  const [seasonGrid, setSeasonGrid] = useState<VenueGrid | null>(null)
  const [locked, setLocked] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // A save that only partly landed reads amber, never the green of a clean
  // save — the same rule the board paints tone by.
  const [noticeTone, setNoticeTone] = useState<"court" | "gold">("court")
  const [error, setError] = useState<string | null>(null)
  const [hours, setHours] = useState<Record<string, HoursDraft>>({})
  const [courts, setCourts] = useState<Record<string, string>>({})
  /** Courts the league keeps empty at every gym, every day. One number for
   *  the whole season, so it sits above the gym cards rather than inside one. */
  const [buffer, setBuffer] = useState("0")
  const [exceptionFor, setExceptionFor] = useState<string | null>(null)
  const [exceptionKey, setExceptionKey] = useState<string>("")
  const [exceptionDraft, setExceptionDraft] = useState<HoursDraft>({ start: "", end: "" })
  const [advancedFor, setAdvancedFor] = useState<string | null>(null)
  const [addingGym, setAddingGym] = useState(false)

  const load = useCallback(async () => {
    // no-store: capacity is the number this screen exists to get right, and a
    // cached grid would hand back yesterday's courts and hours.
    const res = await fetch(`/api/seasons/${seasonId}/planner/venues`, {
      cache: "no-store",
    }).catch(() => null)
    if (!res?.ok) {
      setError("Couldn't load your gyms")
      return
    }
    const data = await res.json()
    setSeasonGrid(data.grid)
    setLocked(["FINALIZED", "IN_PROGRESS", "COMPLETED"].includes(data.seasonStatus))
  }, [seasonId])

  useEffect(() => {
    load()
  }, [load])

  /**
   * WHOSE GYM TIME THIS SCREEN IS EDITING. The plan ROW decides it — the season
   * runs the active plan, the reference is read only, anything else is the
   * operator's own — and the row is known the moment they choose it.
   *
   * THE DOCUMENT ARRIVES A MOMENT LATER, and until it does this screen must not
   * be touchable (found by the 2026-08-05 drive, and it was the worst kind of
   * bug: a click in that gap took the SEASON path and attached a gym to the
   * league's real calendar). So `pending` disables every control, and the write
   * paths below can only ever see a world that is really there.
   */
  const planWorldMode = session.editsPlanWorld
  const pending = planWorldMode && session.world === null
  const onPlanWorld = planWorldMode && session.world !== null
  const readOnly = locked || isReferencePlan(session.chosen) || pending

  /**
   * THE GRID ON SCREEN. The season's columns either way; the cells are the
   * plan's when a plan of the operator's own is open (owner ruling 2026-08-05,
   * #3), so what step 3 draws and what this screen draws are one document.
   */
  const grid = useMemo(() => {
    if (!seasonGrid) return null
    if (!onPlanWorld) return seasonGrid
    return planGridFrom(seasonGrid, session.world as PlanWorld)
  }, [seasonGrid, onPlanWorld, session.world])

  /** The drafts follow whichever grid is on screen, and reseed when the plan or
   *  the document changes so a switch never leaves last plan's hours in a box. */
  useEffect(() => {
    if (!grid) return
    setHours(
      Object.fromEntries(
        grid.venues.map((v) => [v.seasonVenueId, { start: v.simpleOpen ?? "", end: v.simpleClose ?? "" }])
      )
    )
    setCourts(
      Object.fromEntries(
        grid.venues.map((v) => [v.seasonVenueId, String(v.courtsAvailable ?? v.courtCount)])
      )
    )
    setBuffer(String(grid.courtBuffer ?? 0))
    onLoaded?.(grid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonGrid, session.planId, session.docVersion, onPlanWorld])

  /**
   * ONE WRITE PATH FOR THE PLAN'S WORLD. Every toggle on this screen ends up
   * here when a plan of the operator's own is open: the pure editor makes the
   * next world, it is PATCHed onto the plan document, and the grid re-derives
   * from what came back. Nothing touches the season.
   */
  const saveWorld = async (
    next: PlanWorld,
    key: string,
    success: string,
    tone: "court" | "gold" = "court"
  ) => {
    setBusy(key)
    setError(null)
    setNotice(null)
    setNoticeTone(tone)
    const ok = await session.saveWorld(next)
    setBusy(null)
    if (!ok) {
      setError(session.error ?? "That didn't save. Try again.")
      return false
    }
    setNotice(success)
    return true
  }

  /** The plan's world as it stands, for an editor to build the next one from. */
  const world = () => session.world as PlanWorld

  /** `success` may read the response: some saves only know what they did
   *  after the server answers (how many weekends followed, what a game held
   *  on to), and the operator gets told the truth either way. */
  const call = async (
    url: string,
    init: RequestInit,
    key: string,
    success: string | ((data: any) => string)
  ) => {
    setBusy(key)
    setError(null)
    setNotice(null)
    setNoticeTone("court")
    const res = await fetch(url, init).catch(() => null)
    setBusy(null)
    const data = await res?.json().catch(() => null)
    if (!res?.ok) {
      setError(data?.error ?? "That didn't save. Try again.")
      return false
    }
    setNotice(typeof success === "function" ? success(data) : success)
    await load()
    return true
  }

  const json = (body: unknown, method = "POST"): RequestInit => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  /** One tap: on becomes off, off becomes on. A weekend that has no session
   *  yet gets one created on the way in. A weekend marked taken turns on the
   *  same way — the tap IS the override — and the notice names what it
   *  overrode, so nobody wonders where the reason went. */
  /**
   * A weekend the SEASON does not have yet, brought into existence (owner ruling
   * 2026-08-05). Which Saturdays exist is the season's shape, so this is a season
   * write even while a plan is open — but nothing is attached to anybody's gym,
   * and the plan then says what it has there in its own document.
   */
  const ensureSession = async (weekend: VenueGridWeekend): Promise<string | null> => {
    if (weekend.sessionId) return weekend.sessionId
    if (!weekend.satDateISO) return null
    const res = await fetch(`/api/seasons/${seasonId}/weekends`, json({ satDate: weekend.satDateISO }))
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
    if (!res?.sessionId) {
      setError("That weekend didn't get created. Try again.")
      return null
    }
    // The columns move with it, so the world below can name the new session.
    await load()
    return res.sessionId as string
  }

  /** A weekend the plan has never held, in the month it belongs to. */
  const worldWithWeekend = (
    from: PlanWorld,
    sessionId: string,
    weekend: VenueGridWeekend
  ): PlanWorld => {
    if (worldWeekends(from).some((w) => w.sessionId === sessionId)) return from
    const sample = worldWeekends(from)[0]
    return withWeekend(from, `${weekend.month} ${weekend.dateISO.slice(0, 4)}`, {
      sessionId,
      label: weekend.label,
      dateISO: weekend.dateISO,
      dayCount: weekend.dayCount ?? DEFAULT_DAY_COUNT,
      chosen: true,
      capacityGames: 0,
      largestVenueCapacity: 0,
      targetGamesPerTeam: sample?.targetGamesPerTeam ?? 2,
      venues: [],
    })
  }

  const toggleCell = async (
    venue: VenueGridRow,
    weekend: VenueGridWeekend,
    cell: VenueGridCell
  ) => {
    const key = `${venue.venueId}:${weekend.key}`

    // THE PLAN'S OWN GYM TIME. One document, one write, no season row touched.
    if (onPlanWorld) {
      const on = !isOn(cell.state)
      const sessionId = on ? await ensureSession(weekend) : cell.sessionId
      if (!sessionId) return
      const base = worldWithWeekend(world(), sessionId, weekend)
      await saveWorld(
        withGymOnWeekend(base, sessionId, venue.venueId, on),
        key,
        on
          ? `${venue.name} is on for ${weekend.label} in this plan.`
          : `${venue.name} is off for ${weekend.label} in this plan.`,
        on && cell.state === "taken" ? "gold" : "court"
      )
      return
    }
    // The plan's world has not arrived yet, so there is nothing to write it
    // into — and the season is NOT the fallback (see `pending` above).
    if (planWorldMode) return

    if (!isOn(cell.state)) {
      const on: string | (() => string) =
        cell.state === "taken"
          ? () => {
              // Amber, not green: claiming a weekend somebody else had is
              // worth reading twice.
              setNoticeTone("gold")
              return `${venue.name} is on for ${weekend.label}. It was marked ${
                cell.reason ?? "unavailable"
              }.`
            }
          : `${venue.name} is on for ${weekend.label}.`
      if (cell.sessionId) {
        await call(
          `/api/seasons/${seasonId}/sessions/${cell.sessionId}/venues/${venue.venueId}`,
          { method: "POST" },
          key,
          on
        )
      } else if (cell.satDateISO) {
        await call(
          `/api/seasons/${seasonId}/weekends`,
          json({ satDate: cell.satDateISO, venueId: venue.venueId }),
          key,
          on
        )
      }
      return
    }
    if (!cell.sessionId) return
    await call(
      `/api/seasons/${seasonId}/sessions/${cell.sessionId}/venues/${venue.venueId}`,
      { method: "DELETE" },
      key,
      `${venue.name} is off for ${weekend.label}.`
    )
  }

  /** The whole hours model on this screen: one range, every weekend. */
  const saveHours = async (venue: VenueGridRow) => {
    const draft = hours[venue.seasonVenueId]
    if (!draft?.start || !draft?.end) {
      setError("Set both a start and an end time.")
      return
    }
    if (draft.start >= draft.end) {
      setError("The end time has to be after the start time.")
      return
    }
    if (onPlanWorld) {
      await saveWorld(
        withGymHours(world(), venue.venueId, draft.start, draft.end),
        `${venue.seasonVenueId}:hours`,
        `${venue.name} runs ${draft.start} to ${draft.end} every weekend of this plan.`
      )
      return
    }
    // The plan's world has not arrived yet, so there is nothing to write it
    // into — and the season is NOT the fallback (see `pending` above).
    if (planWorldMode) return
    await call(
      `/api/seasons/${seasonId}/venues/${venue.seasonVenueId}/hours`,
      json(
        {
          hours: [
            { dayOfWeek: 6, openTime: draft.start, closeTime: draft.end },
            { dayOfWeek: 0, openTime: draft.start, closeTime: draft.end },
          ],
        },
        "PUT"
      ),
      `${venue.seasonVenueId}:hours`,
      `${venue.name} runs ${draft.start} to ${draft.end} every weekend.`
    )
  }

  /** Courts are capacity, so editing them here has to reach every weekend
   *  the gym is already on — not just the ones created afterwards (owner hit
   *  exactly that on 2026-08-02: six courts entered, step 3 still red). */
  const saveCourts = async (venue: VenueGridRow) => {
    const next = Number(courts[venue.seasonVenueId])
    if (!Number.isInteger(next) || next < 1 || next > 30) {
      setError("Courts has to be a whole number from 1 to 30.")
      return
    }
    if (onPlanWorld) {
      await saveWorld(
        withGymCourts(world(), venue.venueId, next),
        `${venue.seasonVenueId}:courts`,
        `${venue.name} runs ${next} court${next === 1 ? "" : "s"} in this plan, every weekend it is on.`
      )
      return
    }
    // The plan's world has not arrived yet, so there is nothing to write it
    // into — and the season is NOT the fallback (see `pending` above).
    if (planWorldMode) return
    await call(
      `/api/seasons/${seasonId}/venues/${venue.seasonVenueId}`,
      json({ courtsAvailable: next }, "PATCH"),
      `${venue.seasonVenueId}:courts`,
      (data) => {
        const count = `${venue.name} now runs ${next} court${next === 1 ? "" : "s"}`
        const blocked = Number(data?.daysBlocked ?? 0)
        setNoticeTone(blocked > 0 ? "gold" : "court")
        // Never both: claiming every weekend updated while some kept a court
        // would be the same half-truth this whole fix is about.
        if (blocked === 0) return `${count}, every weekend updated.`
        const names = (data?.blockedCourts ?? []).map((c: { name: string }) => c.name).join(", ")
        return `${count}. ${blocked} day${blocked === 1 ? "" : "s"} kept ${
          names || "a court"
        } because a game is already scheduled there.`
      }
    )
  }

  /**
   * COURTS HELD BACK (owner ruling 2026-08-03). Games overrun and teams still
   * turn up in September, so a league plans a court short on purpose. It is
   * one number for the season, and every capacity on the next screens is
   * already net of it: the weekends, the rentals and the ask sheet.
   */
  const saveBuffer = async () => {
    const next = Number(buffer)
    if (!Number.isInteger(next) || next < 0 || next > 10) {
      setError("Courts held back has to be a whole number from 0 to 10.")
      return
    }
    if (onPlanWorld) {
      await saveWorld(
        withCourtBuffer(world(), next),
        "court-buffer",
        next === 0
          ? "This plan uses every court."
          : `${next} court${next === 1 ? "" : "s"} held back in this plan, at every gym, every day.`
      )
      return
    }
    // The plan's world has not arrived yet, so there is nothing to write it
    // into — and the season is NOT the fallback (see `pending` above).
    if (planWorldMode) return
    await call(
      `/api/seasons/${seasonId}/planner/venues`,
      json({ courtBuffer: next }, "PATCH"),
      "court-buffer",
      next === 0
        ? "Every court is in the plan now."
        : `${next} court${next === 1 ? "" : "s"} held back at every gym, every day.`
    )
  }

  /**
   * Name the building the league OWNS (owner ruling 2026-08-03). Home is
   * exclusive — one league, one building — so the server sends whichever gym
   * held the role into the pool in the same write. That is a real consequence
   * (the old home gym's weekends start reading as rentals), so the operator is
   * asked before anything moves.
   */
  const makeHome = async (venue: VenueGridRow) => {
    if (!grid || readOnly || busy !== null) return
    const current = grid.venues.find((v) => v.role === "home")
    const replacing = current && current.seasonVenueId !== venue.seasonVenueId ? current : null
    const question = replacing
      ? `Make ${venue.name} your home gym? ${replacing.name} goes into the pool, so its weekends get priced as gym you rent.`
      : `Make ${venue.name} your home gym? Games there cost you nothing, and it gets used before anything you rent.`
    if (!window.confirm(question)) return
    if (onPlanWorld) {
      await saveWorld(
        withGymRole(world(), venue.venueId, "home"),
        `${venue.seasonVenueId}:role`,
        replacing
          ? `${venue.name} is this plan's home gym. ${replacing.name} is in its pool, rented when a weekend needs it.`
          : `${venue.name} is this plan's home gym. Its games cost you nothing.`
      )
      return
    }
    // The plan's world has not arrived yet, so there is nothing to write it
    // into — and the season is NOT the fallback (see `pending` above).
    if (planWorldMode) return
    await call(
      `/api/seasons/${seasonId}/venues/${venue.seasonVenueId}`,
      json({ role: "home" }, "PATCH"),
      `${venue.seasonVenueId}:role`,
      replacing
        ? `${venue.name} is your home gym now. ${replacing.name} is in the pool, rented when you need it.`
        : `${venue.name} is your home gym now. Its games cost you nothing.`
    )
  }

  /** The gym said yes. One weekend, one tap, and every day of that weekend
   *  moves together — a gym does not rent you Saturday and think about
   *  Sunday. */
  const confirmBooking = async (
    venue: VenueGridRow,
    weekend: VenueGridWeekend,
    cell: VenueGridCell
  ) => {
    if (!cell.sessionId) return
    await call(
      `/api/seasons/${seasonId}/sessions/${cell.sessionId}/venues/${venue.venueId}`,
      json({ bookingStatus: "confirmed" }, "PATCH"),
      `${venue.venueId}:${weekend.key}:booked`,
      `${venue.name} is booked for ${weekend.label}.`
    )
  }

  /** A gym on, or off, for the whole season in one press. Turning it off
   *  everywhere is how an operator asks what a one-gym season looks like. */
  const toggleSeason = async (venue: VenueGridRow, on: boolean) => {
    if (onPlanWorld) {
      const running = worldWeekends(world()).filter(weekendChosen).length
      await saveWorld(
        withGymEveryWeekend(world(), venue.venueId, on),
        `${venue.seasonVenueId}:season:${on ? "on" : "off"}`,
        on
          ? running === 0
            ? "This plan runs no weekends yet. Choose the weekends above and the gym goes on with them."
            : `${venue.name} is on for all ${running} weekend${running === 1 ? "" : "s"} this plan runs.`
          : `${venue.name} is off for every weekend of this plan.`
      )
      return
    }
    // The plan's world has not arrived yet, so there is nothing to write it
    // into — and the season is NOT the fallback (see `pending` above).
    if (planWorldMode) return
    await call(
      `/api/seasons/${seasonId}/venues/${venue.seasonVenueId}/toggle-season`,
      json({ on }),
      `${venue.seasonVenueId}:season:${on ? "on" : "off"}`,
      (data) => {
        const changed = Number(data?.weekendsChanged ?? 0)
        const blocked = Number(data?.weekendsBlocked ?? 0)
        const unavailable = Number(data?.weekendsUnavailable ?? 0)
        setNoticeTone(blocked > 0 || unavailable > 0 ? "gold" : "court")
        if (Number(data?.weekends ?? 0) === 0) {
          return "This season has no weekends yet. Tap one on the grid and it gets created."
        }
        const lead =
          changed === 0
            ? `${venue.name} was already ${on ? "on" : "off"} for every weekend.`
            : `${venue.name} is ${on ? "on" : "off"} for ${changed} weekend${
                changed === 1 ? "" : "s"
              }.`
        const parts = [lead]
        if (blocked > 0) {
          parts.push(
            `${blocked} weekend${
              blocked === 1 ? "" : "s"
            } kept it because a game is already scheduled there.`
          )
        }
        // "On all weekends" never claims a building somebody else has: the
        // marked ones stayed put, and the operator gets told which and why.
        if (unavailable > 0) {
          const reason = data?.unavailableReason
          parts.push(
            `Left ${unavailable} weekend${unavailable === 1 ? "" : "s"} marked ${
              reason ?? "unavailable"
            }.`
          )
        }
        return parts.join(" ")
      }
    )
  }

  /**
   * THE LEAGUE'S WEEKENDS, CHOSEN ONCE (owner ruling 2026-08-05, #3).
   *
   * "When do you want to run sessions?" is a league question, not a per-gym
   * one: an operator should not have to paint the same eleven weekends across
   * three gym cards to say the season runs on them. So the season calendar sits
   * above the grid as one row of toggles, and the per-gym cells FOLLOW it:
   *
   *  - a weekend turned on attaches the HOME GYM, because that is the building
   *    the league already has and does not have to ask anybody for;
   *  - the pool is deliberately left alone. Nobody has phoned those gyms about
   *    that Saturday, and a board that ticked them would be asserting
   *    availability the league does not have.
   *
   * The grid underneath stays exactly as it was, because a gym really can be
   * unavailable on a weekend the league wants to run.
   */
  const runWeekend = async (weekend: VenueGridWeekend, on: boolean) => {
    if (readOnly || busy !== null || !grid) return
    const index = grid.weekends.findIndex((w) => w.key === weekend.key)
    if (index < 0) return
    const key = `weekend:${weekend.key}`
    const home = grid.venues.find((v) => v.role === "home")

    // THE PLAN'S OWN WEEKENDS. Choosing one attaches the home gym in the plan's
    // document; the pool stays untouched, because nobody has phoned those gyms.
    if (onPlanWorld) {
      const sessionId = on ? await ensureSession(weekend) : weekend.sessionId
      if (!sessionId) return
      const base = worldWithWeekend(world(), sessionId, weekend)
      await saveWorld(
        withWeekendChosen(base, sessionId, on),
        key,
        on
          ? home
            ? `${weekend.label} is on in this plan, with ${home.name}. Gyms you rent stay off until you turn them on.`
            : `${weekend.label} is on in this plan. Pick a home gym and it goes on with your weekends.`
          : `${weekend.label} is off in this plan. No gym is on it.`
      )
      return
    }
    // The plan's world has not arrived yet, so there is nothing to write it
    // into — and the season is NOT the fallback (see `pending` above).
    if (planWorldMode) return

    if (on) {
      if (!home) {
        setError("Pick your home gym first, then choose the weekends you want to run.")
        return
      }
      const cell = home.cells[index]
      if (cell?.sessionId) {
        await call(
          `/api/seasons/${seasonId}/sessions/${cell.sessionId}/venues/${home.venueId}`,
          { method: "POST" },
          key,
          `${weekend.label} is on, with ${home.name}. Gyms you rent stay off until you turn them on.`
        )
      } else if (weekend.satDateISO) {
        await call(
          `/api/seasons/${seasonId}/weekends`,
          json({ satDate: weekend.satDateISO, venueId: home.venueId }),
          key,
          `${weekend.label} is on, with ${home.name}. Gyms you rent stay off until you turn them on.`
        )
      }
      return
    }

    // Off means off: every gym the season has on that weekend comes off it, so
    // "we are not running that weekend" is one tap and not one tap per gym.
    const attached = grid.venues
      .map((v) => ({ venue: v, cell: v.cells[index] }))
      .filter((row) => isOn(row.cell.state) && row.cell.sessionId)
    if (attached.length === 0) return
    setBusy(key)
    setError(null)
    setNotice(null)
    setNoticeTone("court")
    const results = await Promise.all(
      attached.map((row) =>
        fetch(
          `/api/seasons/${seasonId}/sessions/${row.cell.sessionId}/venues/${row.venue.venueId}`,
          { method: "DELETE" }
        )
          .then((res) => res.ok)
          .catch(() => false)
      )
    )
    setBusy(null)
    if (results.some((ok) => !ok)) {
      setError("That weekend did not come off. Try again.")
    } else {
      setNotice(`${weekend.label} is off. No gym is on it.`)
    }
    await load()
  }

  const saveException = async (venue: VenueGridRow, cell: VenueGridCell, label: string) => {
    if (!exceptionDraft.start || !exceptionDraft.end) {
      setError("Set both a start and an end time.")
      return
    }
    if (exceptionDraft.start >= exceptionDraft.end) {
      setError("The end time has to be after the start time.")
      return
    }
    if (onPlanWorld) {
      if (!cell.sessionId) return
      await saveWorld(
        withWeekendGymHours(world(), cell.sessionId, venue.venueId, {
          startTime: exceptionDraft.start,
          endTime: exceptionDraft.end,
        }),
        `${venue.venueId}:${exceptionKey}:hours`,
        `${label} at ${venue.name} runs ${exceptionDraft.start} to ${exceptionDraft.end} in this plan. Every other weekend keeps your usual hours.`
      )
      return
    }
    // The plan's world has not arrived yet, so there is nothing to write it
    // into — and the season is NOT the fallback (see `pending` above).
    if (planWorldMode) return
    // The panel stays open on purpose: the weekend now reads amber and
    // putting it back is one click away.
    await call(
      `/api/seasons/${seasonId}/sessions/${cell.sessionId}/venues/${venue.venueId}/hours`,
      json({ startTime: exceptionDraft.start, endTime: exceptionDraft.end }, "PATCH"),
      `${venue.venueId}:${exceptionKey}:hours`,
      `${label} at ${venue.name} runs ${exceptionDraft.start} to ${exceptionDraft.end}. Every other weekend keeps your usual hours.`
    )
  }

  const resetException = async (venue: VenueGridRow, cell: VenueGridCell, label: string) => {
    if (onPlanWorld) {
      if (!cell.sessionId) return
      const done = await saveWorld(
        withWeekendGymHours(world(), cell.sessionId, venue.venueId, null),
        `${venue.venueId}:${exceptionKey}:reset`,
        `${label} is back on your usual hours in this plan.`
      )
      if (done) setExceptionFor(null)
      return
    }
    // The plan's world has not arrived yet, so there is nothing to write it
    // into — and the season is NOT the fallback (see `pending` above).
    if (planWorldMode) return
    const ok = await call(
      `/api/seasons/${seasonId}/sessions/${cell.sessionId}/venues/${venue.venueId}/hours`,
      json({ reset: true }, "PATCH"),
      `${venue.venueId}:${exceptionKey}:reset`,
      `${label} is back on your usual hours.`
    )
    if (ok) setExceptionFor(null)
  }

  if (!grid) {
    return <p className="text-ink-500 p-6 text-sm">{error ?? "Loading your gyms…"}</p>
  }

  const weekends = grid.weekends
  const months = monthGroups(weekends)
  // Exactly one home gym at a time, and a season is allowed to have none yet.
  const noHome = grid.venues.length > 0 && !grid.venues.some((v) => v.role === "home")
  /**
   * THE WEEKENDS THE LEAGUE RUNS. On a plan of the operator's own that is the
   * plan's own pick, which is a different fact from "some gym happens to be on
   * it": a plan can choose a weekend before it has phoned a single gym, and the
   * row has to be able to say so.
   */
  const chosenIn = onPlanWorld
    ? new Set(
        worldWeekends(session.world as PlanWorld)
          .filter(weekendChosen)
          .map((w) => w.sessionId)
      )
    : null
  const running = weekends.map((w, i) =>
    chosenIn ? Boolean(w.sessionId && chosenIn.has(w.sessionId)) : grid.venues.some((v) => isOn(v.cells[i].state))
  )
  const runningCount = running.filter(Boolean).length

  return (
    <div className="border-ink-200 shadow-soft overflow-hidden rounded-2xl border bg-white">
      {/* Screen head */}
      <div className="border-ink-200 bg-ink-50/60 flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <p className="text-ink-900 text-[15px] font-bold">Gym time</p>
          <p className="text-ink-500 text-xs">
            Choose the weekends the league runs, then say which gym you have on each one.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* THE PLAN IS THE SUBJECT OF THIS SCREEN (owner ruling 2026-08-05).
              Switching plans here changes every cell below it, so the control
              belongs where the cells are. */}
          <PlanChooser locked={locked} busy={busy !== null} compact testId="step2-plan-chooser" />
          <span className="border-ink-200 text-ink-600 rounded-full border bg-white px-2.5 py-0.5 text-[11px] font-bold">
            Step 2 of 5
          </span>
        </div>
      </div>

      {!session.planId && (
        <div className="px-5 pt-5">
          <PlanEmptyState
            locked={locked}
            busy={busy !== null}
            heading="Which plan's gym time is this?"
            detail="Gym time belongs to a plan: its weekends, its gyms, its courts and hours. Open one of yours, or start a new one. With nothing open you are editing the season's own gym time."
            testId="step2-plan-empty"
          />
        </div>
      )}
      {session.planId && (
        <p
          className="border-ink-100 bg-court-50/60 text-court-900 border-b px-5 py-2 text-[12px]"
          data-testid="step2-plan-line"
          data-world={pending ? "loading" : onPlanWorld ? "plan" : "season"}
        >
          Working in <b>{session.chosen?.name ?? "your plan"}</b>.{" "}
          {isReferencePlan(session.chosen)
            ? "This is the imported reference, so its gym time is read only."
            : pending
              ? "Opening this plan's gym time…"
              : onPlanWorld
                ? "These weekends, gyms, courts and hours belong to this plan. The season keeps its own until you use this plan for the season."
                : "This is the plan the season runs, so this is the season's own gym time."}
        </p>
      )}

      <div className="p-5">
        {locked && (
          <p className="border-gold-200 bg-gold-50 text-gold-900 mb-4 rounded-xl border px-4 py-2.5 text-sm">
            This season is finalized, so gyms and weekends are read only now.
          </p>
        )}
        {!locked && isReferencePlan(session.chosen) && (
          <p
            className="border-ink-200 bg-ink-50 text-ink-600 mb-4 rounded-xl border px-4 py-2.5 text-sm"
            data-testid="step2-reference-note"
          >
            {PLAN_COPY.reference}
          </p>
        )}
        {/* The message slot, and it is ALWAYS here (owner 2026-08-02: "when
            I'm removing the gym on and off, I'm seeing a message on top which
            is fluctuating and shifting the whole layout"). The line keeps its
            space whether or not it has anything to say, so toggling a cell
            never moves a card under the operator's finger. */}
        <div className="mb-4">
          <p
            data-testid="step2-notice"
            data-tone={error ? "hoop" : noticeTone}
            aria-live="polite"
            className={`rounded-xl border px-4 py-2.5 text-sm transition-opacity duration-150 ${
              error
                ? "border-hoop-200 bg-hoop-50 text-hoop-900"
                : noticeTone === "gold"
                  ? "border-gold-200 bg-gold-50 text-gold-900"
                  : "border-court-200 bg-court-50 text-court-900"
            } ${error || notice ? "opacity-100" : "invisible opacity-0"}`}
          >
            {error ?? notice ?? " "}
          </p>
        </div>

        {weekends.length === 0 && (
          <p className="border-ink-200 text-ink-500 rounded-xl border border-dashed px-4 py-6 text-center text-sm">
            This season has no dates yet. Give it a start and an end date and every weekend in
            between shows up here.
          </p>
        )}

        {grid.venues.length === 0 && weekends.length > 0 && (
          <p className="border-ink-200 text-ink-500 rounded-xl border border-dashed px-4 py-6 text-center text-sm">
            No gyms on this season yet. Add the first one below, then tap the weekends you have it.
          </p>
        )}

        {/* A season with no home gym yet is one tick away from pricing every
            weekend as a rental, so the screen says so once, quietly. */}
        {noHome && (
          <p
            data-testid="step2-home-nudge"
            className="border-ink-200 bg-ink-50/60 text-ink-600 mb-3.5 rounded-xl border border-dashed px-4 py-2.5 text-sm"
          >
            Pick your home gym, the building you own or control. Every other gym stays in the pool,
            rented by the court when a weekend needs it.
          </p>
        )}

        {/* Courts the league keeps empty on purpose (owner ruling
            2026-08-03). It belongs beside the hours because it is the same
            kind of fact — how much of the building the season is really
            willing to use — and it is one number for every gym. */}
        {grid.venues.length > 0 && (
          <div className="border-ink-100 bg-ink-50/50 mb-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-2xl border px-4 py-3">
            <label htmlFor="court-buffer" className="text-ink-700 text-xs font-semibold">
              Courts left empty
            </label>
            {readOnly ? (
              <span className="border-ink-100 text-ink-700 rounded-lg border bg-white px-2.5 py-1 text-xs">
                <b className="text-ink-900">{grid.courtBuffer}</b>
              </span>
            ) : (
              <>
                <input
                  id="court-buffer"
                  data-testid="court-buffer"
                  type="number"
                  min={0}
                  max={10}
                  value={buffer}
                  aria-label="Courts left empty at every gym"
                  onChange={(e) => setBuffer(e.target.value)}
                  className="border-ink-200 focus:border-play-500 w-16 rounded-lg border bg-white px-2 py-1 text-sm focus:outline-none"
                />
                {buffer !== String(grid.courtBuffer) && (
                  <Button
                    size="sm"
                    tone="court"
                    disabled={busy !== null}
                    onClick={() => saveBuffer()}
                  >
                    {busy === "court-buffer" ? "Saving…" : "Save"}
                  </Button>
                )}
              </>
            )}
            <p className="text-ink-400 w-full text-[11.5px]">
              At every gym, every day. Games run long and teams turn up late, so a court held back
              is a court you still have.{" "}
              {grid.courtBuffer > 0
                ? `Your weekends plan on ${grid.courtBuffer} court${
                    grid.courtBuffer === 1 ? "" : "s"
                  } fewer than the gyms hold, and the calendar says so.`
                : "Zero plans to the whole building."}
            </p>
          </div>
        )}

        {/* WHEN THE LEAGUE RUNS (owner ruling 2026-08-05, #3). One row, chosen
            once, above every gym card: the season's own weekends. */}
        {weekends.length > 0 && (
          <div
            data-testid="league-weekends"
            className="border-ink-300 mb-3.5 rounded-2xl border bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-ink-900 text-[14px] font-bold">
                When do you want to run sessions?
              </p>
              <span
                className="text-ink-500 text-[11.5px] font-bold tabular-nums"
                data-testid="league-weekends-count"
              >
                {runningCount} of {weekends.length} weekends on
              </span>
            </div>
            <p className="text-ink-500 mt-0.5 text-[11.5px]">
              Tap the weekends this league plays. Your home gym goes on with them; gyms you rent
              stay off until you have asked them, and the grid below is where a gym says it cannot
              make one of these weekends.
            </p>
            <div className="mt-2.5 overflow-x-auto pb-1">
              <table className="border-separate border-spacing-1">
                <thead>
                  <tr>
                    {months.map((m, i) => (
                      <th
                        key={`league-${m.month}-${i}`}
                        scope="colgroup"
                        colSpan={m.span}
                        className={`text-ink-500 px-1 pb-0.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] ${
                          i > 0 ? "border-ink-200 border-l pl-2" : ""
                        }`}
                      >
                        {m.month}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {weekends.map((w, i) => {
                      const on = running[i]
                      const key = `weekend:${w.key}`
                      return (
                        <td key={w.key} className="p-0 align-top">
                          <button
                            type="button"
                            data-testid="league-weekend"
                            data-on={on ? "1" : "0"}
                            data-weekend={w.key}
                            disabled={readOnly || busy !== null}
                            aria-pressed={on}
                            aria-label={`${w.label}: ${
                              on ? "on, tap to turn the whole weekend off" : "off, tap to run it"
                            }`}
                            onClick={() => runWeekend(w, !on)}
                            className={`min-h-[44px] w-[62px] cursor-pointer rounded-lg border px-1 text-[10.5px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                              on
                                ? "border-court-500 bg-court-100 text-court-900 hover:border-court-600"
                                : "border-ink-300 text-ink-500 hover:border-ink-500 hover:bg-ink-50 border-dashed bg-white"
                            }`}
                          >
                            <span className="block leading-tight">{w.dayLabel}</span>
                            <span className="block text-[9.5px] font-semibold">
                              {busy === key ? "…" : on ? "on" : "off"}
                            </span>
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* One card per gym, the home gym first and the pool under it. */}
        {grid.venues.map((venue) => {
          const isHome = venue.role === "home"
          const assumedCount = venue.cells.filter(isAssumed).length
          const draft = hours[venue.seasonVenueId] ?? { start: "", end: "" }
          const dirty =
            draft.start !== (venue.simpleOpen ?? "") || draft.end !== (venue.simpleClose ?? "")
          const courtsNow = String(venue.courtsAvailable ?? venue.courtCount)
          const courtsDraft = courts[venue.seasonVenueId] ?? courtsNow
          const courtsDirty = courtsDraft !== courtsNow
          const exceptionOpen = exceptionFor === venue.seasonVenueId
          const liveWeekends = weekends.filter((w, i) => isOn(venue.cells[i].state) && w.sessionId)

          return (
            <div
              key={venue.seasonVenueId}
              className="border-ink-300 mb-3.5 rounded-2xl border bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="text-ink-900 text-[16px] font-bold">
                  {venue.name}
                  {venue.city ? ` · ${venue.city}` : ""}
                </span>
                {/* What this gym IS to the league: the building it owns, or a
                    gym it rents by the court. */}
                <span
                  data-testid="venue-role-chip"
                  data-role={venue.role}
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                    isHome
                      ? "border-court-200 bg-court-50 text-court-800"
                      : "border-ink-200 bg-ink-50 text-ink-500"
                  }`}
                >
                  {isHome ? "Home gym" : "In the pool"}
                </span>
                {!isHome && !readOnly && (
                  <button
                    type="button"
                    data-testid="make-home"
                    disabled={busy !== null}
                    onClick={() => makeHome(venue)}
                    className="border-ink-300 text-ink-800 hover:border-ink-400 hover:bg-ink-50 ml-auto inline-flex min-h-[32px] cursor-pointer items-center rounded-lg border bg-white px-2.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy === `${venue.seasonVenueId}:role` ? "Working…" : "Make this the home gym"}
                  </button>
                )}
              </div>
              <p className="text-ink-400 mt-1 text-[11.5px]">
                {isHome
                  ? "You own this one. Its games cost you nothing, so it gets used before anything you rent."
                  : "In the pool. You rent it by the court when a weekend needs the space."}
              </p>

              {/* Courts stay a fact; hours are ONE range for the whole season. */}
              <div
                role="group"
                aria-label={`${venue.name} availability`}
                className="mt-2.5 flex flex-wrap items-center gap-2"
              >
                {readOnly ? (
                  <span className="border-ink-100 bg-ink-50 text-ink-700 rounded-lg border px-2.5 py-1 text-xs">
                    <b className="text-ink-900">{courtsNow}</b> courts
                  </span>
                ) : (
                  <>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={courtsDraft}
                      aria-label={`${venue.name} courts`}
                      onChange={(e) =>
                        setCourts((c) => ({ ...c, [venue.seasonVenueId]: e.target.value }))
                      }
                      className="border-ink-200 focus:border-play-500 w-16 rounded-lg border px-2 py-1 text-sm focus:outline-none"
                    />
                    <span className="text-ink-700 text-xs font-semibold">courts</span>
                    {courtsDirty && (
                      <Button
                        size="sm"
                        tone="court"
                        disabled={busy !== null}
                        onClick={() => saveCourts(venue)}
                      >
                        Save courts
                      </Button>
                    )}
                  </>
                )}
                {/* Two facts, one row: how many courts, and when. The chips
                    of the locked card already read apart. */}
                {!readOnly && <span className="bg-ink-200 mx-1 h-5 w-px" aria-hidden />}
                {readOnly ? (
                  <span className="border-ink-100 bg-ink-50 text-ink-700 rounded-lg border px-2.5 py-1 text-xs">
                    Available{" "}
                    <b className="text-ink-900">
                      {venue.simpleOpen ?? "—"} to {venue.simpleClose ?? "—"}
                    </b>
                  </span>
                ) : (
                  <>
                    <span className="text-ink-700 text-xs font-semibold">Available</span>
                    <DateTimePicker
                      mode="time"
                      value={draft.start}
                      onChange={(v) =>
                        setHours((h) => ({
                          ...h,
                          [venue.seasonVenueId]: { ...draft, start: v },
                        }))
                      }
                      className="w-24"
                      placeholder="Start"
                    />
                    <span className="text-ink-400 text-xs">to</span>
                    <DateTimePicker
                      mode="time"
                      value={draft.end}
                      onChange={(v) =>
                        setHours((h) => ({
                          ...h,
                          [venue.seasonVenueId]: { ...draft, end: v },
                        }))
                      }
                      className="w-24"
                      placeholder="End"
                    />
                    {dirty && (
                      <Button
                        size="sm"
                        tone="court"
                        disabled={busy !== null}
                        onClick={() => saveHours(venue)}
                      >
                        Save hours
                      </Button>
                    )}
                  </>
                )}
              </div>
              <p className="text-ink-400 mt-1.5 text-[11.5px]">
                {venue.hoursVary
                  ? "Saturday and Sunday run different hours right now. Saving makes them the same."
                  : "The same hours every weekend. You can fine tune a single weekend below."}
              </p>

              {/* The whole season in one press (owner 2026-08-02: turning a
                  gym off for every weekend is how you ask what the season
                  looks like without it). */}
              {!readOnly && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-ink-400 text-[11px] font-semibold uppercase tracking-[0.06em]">
                    Every weekend
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() => toggleSeason(venue, true)}
                  >
                    {busy === `${venue.seasonVenueId}:season:on` ? "Working…" : "On all weekends"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() => toggleSeason(venue, false)}
                  >
                    {busy === `${venue.seasonVenueId}:season:off` ? "Working…" : "Off all weekends"}
                  </Button>
                </div>
              )}

              {/* The weekend grid: month bands, then one cell per weekend. */}
              <div className="mt-3 overflow-x-auto pb-1">
                <table className="border-separate border-spacing-1">
                  <thead>
                    <tr>
                      {months.map((m, i) => (
                        <th
                          key={`${m.month}-${i}`}
                          scope="colgroup"
                          colSpan={m.span}
                          className={`text-ink-400 px-1 pb-0.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] ${
                            i > 0 ? "border-ink-100 border-l pl-2" : ""
                          }`}
                        >
                          {m.month}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {weekends.map((w) => (
                        <th
                          key={w.key}
                          scope="col"
                          className="text-ink-500 px-1 pb-1 text-center text-[10.5px] font-bold"
                        >
                          {w.dayLabel}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {venue.cells.map((cell, i) => {
                        const w = weekends[i]
                        const key = `${venue.venueId}:${w.key}`
                        const assumed = isAssumed(cell)
                        return (
                          <td key={w.key} className="p-0 align-top">
                            <button
                              type="button"
                              disabled={readOnly || busy !== null}
                              onClick={() => toggleCell(venue, w, cell)}
                              aria-pressed={isOn(cell.state)}
                              aria-label={cellLabel(venue.name, w.label, cell)}
                              title={
                                cell.state === "taken"
                                  ? (cell.reason ?? undefined)
                                  : assumed
                                    ? "Assumed for now. Nobody has booked this weekend with the gym yet."
                                    : undefined
                              }
                              style={assumed ? ASSUMED_HATCH : undefined}
                              className={`min-h-[44px] w-[62px] cursor-pointer rounded-lg border px-1 text-[10.5px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                CELL_CLS[cell.state]
                              } ${assumed ? "border-dashed" : ""}`}
                            >
                              {busy === key ? (
                                "…"
                              ) : cell.state === "off" ? (
                                "Off"
                              ) : cell.state === "taken" ? (
                                <span className="block leading-tight">Taken</span>
                              ) : cell.state === "custom" ? (
                                <span className="block leading-tight">
                                  {cell.hoursLabel ?? "Custom"}
                                </span>
                              ) : (
                                "Yes"
                              )}
                              {cell.state === "taken" && shortReason(cell.reason) && (
                                <span className="text-gold-700 block text-[9px] font-semibold">
                                  {shortReason(cell.reason)}
                                </span>
                              )}
                              {isOn(cell.state) && cell.daysOn < cell.dayCount && (
                                <span className="text-ink-400 block text-[9px] font-semibold">
                                  {cell.daysOn} of {cell.dayCount} days
                                </span>
                              )}
                              {assumed && (
                                <span className="text-ink-500 block text-[9px] font-semibold">
                                  assumed
                                </span>
                              )}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                    {/* One tap per assumed weekend, and only under the weekends
                        that have something to confirm. Never a bulk button:
                        every one of these is its own phone call. */}
                    {assumedCount > 0 && !readOnly && (
                      <tr>
                        {venue.cells.map((cell, i) => {
                          const w = weekends[i]
                          const key = `${venue.venueId}:${w.key}:booked`
                          if (!isAssumed(cell)) return <td key={w.key} className="p-0" />
                          return (
                            <td key={w.key} className="p-0 pt-1 align-top">
                              <button
                                type="button"
                                disabled={busy !== null}
                                onClick={() => confirmBooking(venue, w, cell)}
                                aria-label={`${venue.name} is booked for ${w.label}`}
                                title={`The gym said yes to ${w.label}`}
                                className="border-court-400 text-court-800 hover:border-court-600 hover:bg-court-50 min-h-[28px] w-[62px] cursor-pointer rounded-lg border bg-white px-1 text-[9.5px] font-bold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {busy === key ? "…" : "Booked it"}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {assumedCount > 0 && (
                <p className="text-ink-500 mt-1.5 text-[11.5px]">
                  {assumedCount === 1
                    ? "One weekend here is assumed. Tap Booked it once the gym says yes."
                    : `${assumedCount} weekends here are assumed. Tap Booked it under each one the gym says yes to.`}
                </p>
              )}

              {/* Quiet links: the exception, and the full venue editor. */}
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => {
                    const next = exceptionOpen ? null : venue.seasonVenueId
                    setExceptionFor(next)
                    setAdvancedFor(null)
                    const firstKey = liveWeekends[0]?.key ?? ""
                    setExceptionKey(firstKey)
                    const idx = weekends.findIndex((w) => w.key === firstKey)
                    setExceptionDraft({
                      start: (idx >= 0 ? venue.cells[idx].startTime : null) ?? draft.start,
                      end: (idx >= 0 ? venue.cells[idx].endTime : null) ?? draft.end,
                    })
                  }}
                  className="border-ink-300 text-ink-800 hover:border-ink-400 hover:bg-ink-50 inline-flex min-h-[32px] cursor-pointer items-center rounded-lg border bg-white px-2.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {exceptionOpen ? "Close" : "One weekend runs different hours?"}
                </button>
                {/* Advanced edits the SEASON's own courts and day windows, so
                    it is not offered while a plan of the operator's own is the
                    thing on screen: the card above is that plan's gym time, and
                    a panel that quietly wrote past it into the season would be
                    exactly the confusion this architecture removes. */}
                {!onPlanWorld && (
                  <button
                    type="button"
                    onClick={() => {
                      setAdvancedFor(
                        advancedFor === venue.seasonVenueId ? null : venue.seasonVenueId
                      )
                      setExceptionFor(null)
                    }}
                    className="border-ink-300 text-ink-700 hover:border-ink-400 hover:bg-ink-50 inline-flex min-h-[32px] cursor-pointer items-center rounded-lg border bg-white px-2.5 text-xs font-bold transition-colors"
                  >
                    {advancedFor === venue.seasonVenueId ? "Close advanced" : "Advanced"}
                  </button>
                )}
              </div>

              {/* One weekend's exception. Everything else keeps the card's range. */}
              {exceptionOpen &&
                (() => {
                  const idx = weekends.findIndex((w) => w.key === exceptionKey)
                  const cell = idx >= 0 ? venue.cells[idx] : null
                  const label = idx >= 0 ? weekends[idx].label : "that weekend"
                  return (
                    <div className="border-ink-100 bg-ink-50/60 mt-3 rounded-xl border p-3">
                      {liveWeekends.length === 0 ? (
                        <p className="text-ink-500 text-xs">
                          Turn this gym on for a weekend first, then you can give that one weekend
                          its own hours.
                        </p>
                      ) : (
                        <>
                          <p className="text-ink-500 mb-2.5 text-xs">
                            Pick the weekend that runs different hours. Your usual range stays
                            exactly as it is everywhere else.
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={exceptionKey}
                              onChange={(e) => {
                                setExceptionKey(e.target.value)
                                const j = weekends.findIndex((w) => w.key === e.target.value)
                                setExceptionDraft({
                                  start: (j >= 0 ? venue.cells[j].startTime : null) ?? draft.start,
                                  end: (j >= 0 ? venue.cells[j].endTime : null) ?? draft.end,
                                })
                              }}
                              aria-label="Weekend with different hours"
                              className="border-ink-200 focus:border-play-500 rounded-lg border px-2 py-1.5 text-sm focus:outline-none"
                            >
                              {liveWeekends.map((w) => (
                                <option key={w.key} value={w.key}>
                                  {w.label}
                                </option>
                              ))}
                            </select>
                            <DateTimePicker
                              mode="time"
                              value={exceptionDraft.start}
                              onChange={(v) => setExceptionDraft((d) => ({ ...d, start: v }))}
                              className="w-24"
                              placeholder="Start"
                            />
                            <span className="text-ink-400 text-xs">to</span>
                            <DateTimePicker
                              mode="time"
                              value={exceptionDraft.end}
                              onChange={(v) => setExceptionDraft((d) => ({ ...d, end: v }))}
                              className="w-24"
                              placeholder="End"
                            />
                            <Button
                              size="sm"
                              tone="court"
                              disabled={readOnly || busy !== null || !cell?.sessionId}
                              onClick={() => cell && saveException(venue, cell, label)}
                            >
                              Save these hours
                            </Button>
                            {cell?.state === "custom" && (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={readOnly || busy !== null}
                                onClick={() => resetException(venue, cell, label)}
                              >
                                Back to your usual hours
                              </Button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })()}

              {/* Advanced: courts and the full seven-day window, unchanged. */}
              {advancedFor === venue.seasonVenueId && (
                <div className="border-ink-100 bg-ink-50/60 mt-3 rounded-xl border p-3">
                  <p className="text-ink-500 mb-3 text-xs">
                    Courts and the full day by day window. Most seasons never need this, the range
                    above is enough.
                  </p>
                  <VenueEditor
                    venueId={venue.venueId}
                    venueName={venue.name}
                    courts={venue.courts}
                    hours={venue.defaultHours}
                    hoursEndpoint={`/api/seasons/${seasonId}/venues/${venue.seasonVenueId}/hours`}
                    hoursLabel="This season's hours here"
                    referenceHours={venue.postedHours}
                    referenceLabel="The gym's posted hours"
                    onChange={load}
                  />
                </div>
              )}
            </div>
          )
        })}

        {/* Legend, straight from the mock. */}
        <div className="text-ink-500 mt-2 flex flex-wrap gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <i className="border-court-200 bg-court-50 inline-block h-3 w-3 rounded border" />
            you have the gym
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="border-ink-200 bg-ink-100 inline-block h-3 w-3 rounded border border-dashed" />
            off (tap any weekend to turn it on)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i
              style={ASSUMED_HATCH}
              className="border-court-200 bg-court-50 inline-block h-3 w-3 rounded border border-dashed"
            />
            assumed, nobody has booked it yet
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="border-gold-200 bg-gold-50 inline-block h-3 w-3 rounded border" />
            custom hours that weekend
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="border-gold-300 bg-gold-50/70 inline-block h-3 w-3 rounded border border-dashed" />
            taken that weekend (tap to take it anyway)
          </span>
        </div>

        {/* Add a gym: the same create-or-attach endpoint the season uses. */}
        <div className="mt-4">
          {addingGym ? (
            <AddGymCard
              seasonId={seasonId}
              onCancel={() => setAddingGym(false)}
              onAdded={async (name, venueId) => {
                setAddingGym(false)
                await load()
                // A gym is a SEASON fact (the league has it or it does not), so
                // the plan gains it in its pool with no availability at all:
                // nobody has phoned them about any Saturday yet.
                if (onPlanWorld && venueId) {
                  const added = await session.saveWorld(
                    withGym(world(), {
                      venueId,
                      name,
                      role: "pool",
                      courts: 0,
                      openTime: null,
                      closeTime: null,
                    })
                  )
                  setNotice(
                    added
                      ? `${name} is in this plan's pool. Tap the weekends you have it.`
                      : `${name} added to the season.`
                  )
                  return
                }
                setNotice(`${name} added, on for every weekend the season already has.`)
              }}
            />
          ) : (
            <button
              type="button"
              disabled={readOnly}
              onClick={() => setAddingGym(true)}
              className="border-ink-300 text-ink-800 hover:border-ink-400 hover:bg-ink-50 inline-flex min-h-[36px] cursor-pointer items-center rounded-lg border bg-white px-3 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Add a gym
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Add-a-gym: VenueSelector plus the two facts the grid needs (courts and
 *  the hours), attached to the weekends the season already has. */
function AddGymCard({
  seasonId,
  onAdded,
  onCancel,
}: {
  seasonId: string
  onAdded: (name: string, venueId: string) => void
  onCancel: () => void
}) {
  const [venue, setVenue] = useState<{ id: string; name: string } | null>(null)
  const [courtCount, setCourtCount] = useState(2)
  const [openTime, setOpenTime] = useState("09:00")
  const [closeTime, setCloseTime] = useState("21:00")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!venue) {
      setError("Pick a gym first.")
      return
    }
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/seasons/${seasonId}/venues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        venueId: venue.id,
        courtCount,
        openTime,
        closeTime,
        addToSessions: true,
      }),
    }).catch(() => null)
    setSaving(false)
    if (!res?.ok) {
      const data = await res?.json().catch(() => null)
      setError(data?.error ?? "Couldn't add that gym.")
      return
    }
    onAdded(venue.name, venue.id)
  }

  return (
    <div className="border-ink-100 bg-ink-50/60 rounded-xl border p-4">
      <p className="text-ink-900 text-sm font-bold">Add a gym</p>
      <p className="text-ink-500 mb-3 mt-0.5 text-xs">
        Set the hours you have it, then tap the weekends on the grid.
      </p>
      <VenueSelector
        value={venue?.id ?? ""}
        venueName={venue?.name ?? ""}
        onSelect={(v) => setVenue({ id: v.id, name: v.name })}
        onClear={() => setVenue(null)}
      />
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-ink-700 text-xs font-semibold">
          Courts
          <input
            type="number"
            min={1}
            max={30}
            value={courtCount}
            onChange={(e) => setCourtCount(Math.max(1, Number(e.target.value) || 1))}
            className="border-ink-200 focus:border-play-500 mt-1 block w-20 rounded-lg border px-2 py-1.5 text-sm focus:outline-none"
          />
        </label>
        <label className="text-ink-700 text-xs font-semibold">
          Opens
          <DateTimePicker
            mode="time"
            value={openTime}
            onChange={setOpenTime}
            className="mt-1 w-28"
            placeholder="Open"
          />
        </label>
        <label className="text-ink-700 text-xs font-semibold">
          Closes
          <DateTimePicker
            mode="time"
            value={closeTime}
            onChange={setCloseTime}
            className="mt-1 w-28"
            placeholder="Close"
          />
        </label>
        <Button size="sm" tone="court" disabled={saving} onClick={save}>
          {saving ? "Adding…" : "Add gym"}
        </Button>
        <Button size="sm" variant="secondary" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {error && <p className="text-hoop-700 mt-2 text-xs font-semibold">{error}</p>}
    </div>
  )
}
