"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
  withGymHours,
  withGymOnWeekend,
  withGymOrder,
  withGymRole,
  withWeekend,
  withWeekendChosen,
  worldWeekends,
  DEFAULT_DAY_COUNT,
} from "@/lib/scheduler/plan-world"
import { PlanBadge, PlanStepPointer, usePlanSession } from "./plan-session"
import { BTN_MD, BTN_PRIMARY, BTN_SECONDARY, BTN_SM } from "./plan-shared"
import { NoticeSlot } from "./plan-ui"

/**
 * Step 2, YOUR BUILDINGS (owner ruling 2026-08-06). This screen used to be two
 * screens wearing one coat: a roster of gyms AND a weekend-by-weekend paint
 * grid where an operator booked each building into each Saturday. The painting
 * is gone. Booking a building onto a date is board work, and the board is where
 * it happens now.
 *
 * What is left is the honest half, and it is a roster:
 *
 *   1. ONE CARD PER BUILDING. What it is to the league (the home gym, or one in
 *      the pool it rents), how many courts it runs, and the one from-to range it
 *      is available. That is the whole card.
 *   2. THE HOME GYM FILLS FIRST, at full capacity, before anything is rented.
 *      One quiet action per card names it, and because home is exclusive the
 *      operator is asked first: the old home gym goes to the pool in the same
 *      write.
 *   3. COURTS HELD BACK is one number for the whole league, so it sits above the
 *      cards rather than inside one.
 *
 * And one league-level question sits on top of the roster: WHEN WOULD YOU LIKE
 * TO RUN SESSIONS? Those weekends are a preference the draw fills first, not a
 * booking. Choosing one attaches no building to anything (owner ruling
 * 2026-08-06) — gyms and games go on dates on the board, any date, including
 * ones this row never picked.
 *
 * A PLAN OWNS ITS WORLD (owner ruling 2026-08-05, the architecture). This whole
 * screen is the SELECTED PLAN's, not the season's:
 *
 *   - a plan of the operator's own → the roles, courts, hours, buffer and chosen
 *     weekends are written into the plan document. The season's SeasonVenue rows
 *     do not move until that plan is activated.
 *   - the ACTIVE plan, or nothing open → the season's own routes, because the
 *     active plan IS the season.
 *   - the imported reference → read only. It records what the league published.
 *
 * The WEEKEND COLUMNS are the season's either way: which Saturdays exist is a
 * fact about the season's dates, not an opinion a plan holds. So choosing a
 * weekend the season has never created still creates the weekend (a session with
 * no gym on it, which is inert), and the plan then records that it wants it.
 */

/** Attached, however its hours read. Taken and off both mean not ours. Still
 *  needed to read the SEASON's own weekends back off the grid. */
const isOn = (state: VenueGridCell["state"]) => state === "on" || state === "custom"

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
  onGoToStep,
}: {
  seasonId: string
  onLoaded?: (grid: VenueGrid) => void
  /** Back to step 1, where plans are chosen (owner ruling 2026-08-06). */
  onGoToStep?: (step: number) => void
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
  const [advancedFor, setAdvancedFor] = useState<string | null>(null)
  /**
   * WHICH POOL GYM HAS ITS BOOKINGS PICKER OPEN (owner ruling 2026-08-06).
   * Collapsed by default and one at a time: a league that has phoned nobody
   * should see a row of gym cards, not a wall of date grids.
   */
  const [bookingsFor, setBookingsFor] = useState<string | null>(null)
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
  /**
   * TWO QUESTIONS, NOT ONE (the old-plan fix, 2026-08-06 wave): whose gym time
   * is DRAWN, and whose is WRITTEN. Any non-active plan with a world draws it —
   * the read-only reference included, so this step and the board can never show
   * two different plans. Only the operator's own plan writes it.
   */
  const readsWorld = session.readsPlanWorld
  const pending = session.editsPlanWorld && session.world === null
  const editsWorld = session.editsPlanWorld && session.world !== null
  const readOnly = locked || isReferencePlan(session.chosen) || pending

  /**
   * THE GRID ON SCREEN. The season's columns either way; the cells are the
   * plan's when a plan of the operator's own is open (owner ruling 2026-08-05,
   * #3), so what step 3 draws and what this screen draws are one document.
   */
  const grid = useMemo(() => {
    if (!seasonGrid) return null
    if (!readsWorld) return seasonGrid
    return planGridFrom(seasonGrid, session.world as PlanWorld)
  }, [seasonGrid, readsWorld, session.world])

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
  }, [seasonGrid, session.planId, session.docVersion, readsWorld])

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

  /**
   * A weekend the SEASON does not have yet, brought into existence (owner ruling
   * 2026-08-05). Which Saturdays exist is the season's shape, so this is a season
   * write even while a plan is open — but nothing is attached to anybody's gym,
   * and the plan then says what it wants there in its own document.
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
    if (editsWorld) {
      await saveWorld(
        withGymHours(world(), venue.venueId, draft.start, draft.end),
        `${venue.seasonVenueId}:hours`,
        `${venue.name} runs ${draft.start} to ${draft.end} every weekend of this plan.`
      )
      return
    }
    // Anything that is not the season itself stops here: an editable plan
    // whose world has not arrived (`pending`), and the read-only reference —
    // the season is NEVER the fallback for either.
    if (readsWorld || pending) return
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
    if (editsWorld) {
      await saveWorld(
        withGymCourts(world(), venue.venueId, next),
        `${venue.seasonVenueId}:courts`,
        `${venue.name} runs ${next} court${next === 1 ? "" : "s"} in this plan, every weekend it is on.`
      )
      return
    }
    // Anything that is not the season itself stops here: an editable plan
    // whose world has not arrived (`pending`), and the read-only reference —
    // the season is NEVER the fallback for either.
    if (readsWorld || pending) return
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
   * THE ORDER THE LEAGUE RENTS IN (owner ruling 2026-08-06: "select the home,
   * then the next one, and the following one").
   *
   * A preference, never a gate. When two gyms would cost the draw the same, it
   * takes the one nearer the top of this list; before this, it took whichever
   * name sorted first, which is how a plan came back having booked Haber over
   * Six Park for no reason anybody could name.
   */
  const moveGym = async (venue: VenueGridRow, direction: "up" | "down") => {
    if (readOnly || !editsWorld) return
    await saveWorld(
      withGymOrder(world(), venue.venueId, direction),
      `${venue.seasonVenueId}:rank`,
      `${venue.name} moved ${direction} your rental order.`
    )
  }

  /**
   * DATES YOU HAVE ALREADY BOOKED HERE (owner ruling 2026-08-06).
   *
   * Optional, always. Availability stopped being a restriction the same day: the
   * draw books whatever it needs and marks it assumed, so nothing here is a
   * prerequisite for anything. What this buys is CERTAINTY — a weekend the
   * operator really has is one the solver prefers and the ask sheet stops asking
   * about.
   *
   * A booking is the whole day and every court, because that is what the plan's
   * model of a gym is: attaching it to the weekend IS the confirmed availability.
   */
  const toggleBooking = async (venue: VenueGridRow, sessionId: string, on: boolean) => {
    if (readOnly || !editsWorld) return
    /**
     * THE ARGUMENTS ARE (world, sessionId, venueId) AND THEY WERE THE WRONG WAY
     * ROUND (owner bug report 2026-08-06: the cells would not select).
     *
     * withGymOnWeekend looks the gym up by venueId and returns the world
     * UNCHANGED when it cannot find one, so passing them swapped made every tick
     * a silent no-op: the save succeeded, the document came back identical, and
     * the cell went back to off with nothing to explain it.
     */
    const next = withGymOnWeekend(world(), sessionId, venue.venueId, on)
    if (next === world()) {
      setError(`${venue.name} is not a gym this plan holds. Reopen the plan and try again.`)
      return
    }
    await saveWorld(
      next,
      `${venue.seasonVenueId}:booking:${sessionId}`,
      on
        ? `${venue.name} is booked that weekend in this plan, full day, all courts.`
        : `${venue.name} is not booked that weekend any more. The planner will assume it if it needs it.`
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
    if (editsWorld) {
      await saveWorld(
        withCourtBuffer(world(), next),
        "court-buffer",
        next === 0
          ? "This plan uses every court."
          : `${next} court${next === 1 ? "" : "s"} held back in this plan, at every gym, every day.`
      )
      return
    }
    // Anything that is not the season itself stops here: an editable plan
    // whose world has not arrived (`pending`), and the read-only reference —
    // the season is NEVER the fallback for either.
    if (readsWorld || pending) return
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
    if (editsWorld) {
      await saveWorld(
        withGymRole(world(), venue.venueId, "home"),
        `${venue.seasonVenueId}:role`,
        replacing
          ? `${venue.name} is this plan's home gym. ${replacing.name} is in its pool, rented when a weekend needs it.`
          : `${venue.name} is this plan's home gym. Its games cost you nothing.`
      )
      return
    }
    // Anything that is not the season itself stops here: an editable plan
    // whose world has not arrived (`pending`), and the read-only reference —
    // the season is NEVER the fallback for either.
    if (readsWorld || pending) return
    await call(
      `/api/seasons/${seasonId}/venues/${venue.seasonVenueId}`,
      json({ role: "home" }, "PATCH"),
      `${venue.seasonVenueId}:role`,
      replacing
        ? `${venue.name} is your home gym now. ${replacing.name} is in the pool, rented when you need it.`
        : `${venue.name} is your home gym now. Its games cost you nothing.`
    )
  }

  /**
   * WHEN WOULD YOU LIKE TO RUN SESSIONS (owner ruling 2026-08-05 #3, revised
   * 2026-08-06). One league-level row, above the buildings, and it is a
   * PREFERENCE: the draw fills these weekends first.
   *
   * Choosing one attaches NO gym, not even the home gym. Putting a building on a
   * date is board work now, on any date the season has, including ones this row
   * never picked. Turning a weekend off says the league would rather not run it,
   * and takes what the plan had there off with it.
   *
   * Only a plan can hold this answer: the season substrate has no "we would like
   * this weekend" of its own, so with the active plan open (or nothing open) the
   * row reads the season's weekends back and says so rather than inventing a
   * meaning for a tap.
   */
  const runWeekend = async (weekend: VenueGridWeekend, on: boolean) => {
    if (readOnly || busy !== null || !grid || !editsWorld) return
    const key = `weekend:${weekend.key}`
    const sessionId = on ? await ensureSession(weekend) : weekend.sessionId
    if (!sessionId) return
    const base = worldWithWeekend(world(), sessionId, weekend)
    await saveWorld(
      withWeekendChosen(base, sessionId, on),
      key,
      on
        ? `${weekend.label} is one this plan fills first. Put gyms and games on it from the board.`
        : `${weekend.label} is off in this plan. The draw skips it.`
    )
  }

  if (!grid) {
    return <p className="text-ink-500 p-6 text-sm">{error ?? "Loading your gyms…"}</p>
  }

  const weekends = grid.weekends
  const months = monthGroups(weekends)
  // Exactly one home gym at a time, and a season is allowed to have none yet.
  const noHome = grid.venues.length > 0 && !grid.venues.some((v) => v.role === "home")
  /**
   * THE WEEKENDS THE LEAGUE WOULD LIKE TO RUN. On a plan of the operator's own
   * that is the plan's own pick, which is a different fact from "some building
   * happens to be on it": a plan can want a weekend before it has phoned a
   * single gym, and the row has to be able to say so.
   *
   * With the active plan open, or nothing open, there is no such answer to hold
   * — the season substrate only knows which weekends have a building on them.
   * So the row shows that, and says it is read only rather than pretending a tap
   * means something.
   */
  const chosenIn = readsWorld
    ? new Set(
        worldWeekends(session.world as PlanWorld)
          .filter(weekendChosen)
          .map((w) => w.sessionId)
      )
    : null
  const weekendsEditable = editsWorld && !readOnly
  const running = weekends.map((w, i) =>
    chosenIn
      ? Boolean(w.sessionId && chosenIn.has(w.sessionId))
      : grid.venues.some((v) => isOn(v.cells[i].state))
  )
  const runningCount = running.filter(Boolean).length

  return (
    <div className="border-ink-200 shadow-soft overflow-hidden rounded-2xl border bg-white">
      {/* Screen head */}
      <div className="border-ink-200 bg-ink-50/60 flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <p className="text-ink-900 text-[15px] font-bold">Your buildings</p>
          <p className="text-ink-500 text-xs">
            Name your buildings and pick your home gym. The home gym fills first, at full capacity,
            before anything is rented.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* WHICH PLAN THIS SCREEN IS ABOUT (owner ruling 2026-08-06). It used
              to be a switcher, which changed every card below it from a control
              that read like a filter. Plans are chosen at step 1. */}
          <PlanBadge testId="step2-plan-badge" />
          <span className="border-ink-200 text-ink-600 rounded-full border bg-white px-2.5 py-0.5 text-[11px] font-bold">
            Step 2 of 5
          </span>
        </div>
      </div>

      {/* No chooser here (owner's 2026-08-06 analysis, B1): plans are opened
          and made at step 1 only. This card says so; the season's own
          buildings stay editable below it, which is what nothing-open means. */}
      {!session.planId && (
        <div className="px-5 pt-5">
          <PlanStepPointer
            detail="Buildings belong to a plan: its home gym, its pool, its courts and hours, and the weekends it would like to run. With nothing open you are editing the season's own."
            onGoToStep={onGoToStep}
            testId="step2-plan-pointer"
          />
        </div>
      )}
      {session.planId && (
        <p
          className="border-ink-100 bg-court-50/60 text-court-900 border-b px-5 py-2 text-[12px]"
          data-testid="step2-plan-line"
          data-world={pending ? "loading" : readsWorld ? "plan" : "season"}
        >
          Working in <b>{session.chosen?.name ?? "your plan"}</b>.{" "}
          {isReferencePlan(session.chosen)
            ? "This is the imported reference, so its buildings are read only."
            : pending
              ? "Opening this plan's buildings…"
              : readsWorld
                ? "These buildings, courts, hours and weekends belong to this plan. The season keeps its own until you use this plan for the season."
                : "This is the plan the season runs, so these are the season's own buildings."}
        </p>
      )}

      <div className="p-5">
        {locked && (
          <p className="border-gold-200 bg-gold-50 text-gold-900 mb-4 rounded-xl border px-4 py-2.5 text-sm">
            This season is finalized, so your buildings are read only now.
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
            space whether or not it has anything to say, so a toggle never moves
            a card under the operator's finger. */}
        <NoticeSlot
          testId="step2-notice"
          error={error}
          notice={notice}
          tone={noticeTone}
          className="mb-4"
        />

        {weekends.length === 0 && (
          <p className="border-ink-200 text-ink-500 rounded-xl border border-dashed px-4 py-6 text-center text-sm">
            This season has no dates yet. Give it a start and an end date and every weekend in
            between shows up here.
          </p>
        )}

        {grid.venues.length === 0 && weekends.length > 0 && (
          <p className="border-ink-200 text-ink-500 rounded-xl border border-dashed px-4 py-6 text-center text-sm">
            No buildings on this season yet. Add the first one below and name it your home gym.
          </p>
        )}

        {/* WHEN THE LEAGUE WOULD LIKE TO RUN (owner ruling 2026-08-05 #3,
            reframed 2026-08-06). One row, chosen once, above the buildings, and
            it books nothing: it tells the draw which weekends to fill first. */}
        {weekends.length > 0 && (
          <div
            data-testid="league-weekends"
            className="border-ink-300 mb-3.5 rounded-2xl border bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-ink-900 text-[14px] font-bold">
                When would you like to run sessions?
              </p>
              <span
                className="text-ink-500 text-[11.5px] font-bold tabular-nums"
                data-testid="league-weekends-count"
              >
                {runningCount} of {weekends.length} weekends on
              </span>
            </div>
            <p className="text-ink-500 mt-0.5 text-[11.5px]">
              The draw fills these first. You can place gyms and games on any date on the board.
            </p>
            {/* Only a plan holds this answer, so the row says whose it is
                rather than letting a tap mean nothing. */}
            {!weekendsEditable && !readOnly && (
              <p className="text-ink-400 mt-1 text-[11.5px]" data-testid="league-weekends-note">
                These are the weekends the season already has a building on. Open a plan of your own
                to choose the weekends it fills first.
              </p>
            )}
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
                            disabled={!weekendsEditable || busy !== null}
                            aria-pressed={on}
                            aria-label={`${w.label}: ${
                              on
                                ? "on, tap so the draw skips it"
                                : "off, tap to fill it first"
                            }`}
                            onClick={() => runWeekend(w, !on)}
                            /* The weekend chooser is a row of buttons, so it
                               wears the same two tiers as everything else on
                               this step (owner ruling 2026-08-06): chosen is
                               filled, unchosen is indigo-outlined, and neither
                               is white-on-white. */
                            className={`${on ? BTN_PRIMARY : BTN_SECONDARY} min-h-[44px] w-[62px] flex-col gap-0 px-1 text-[10.5px]`}
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

        {/* One card per building, the home gym first and the pool under it. */}
        {grid.venues.map((venue) => {
          const isHome = venue.role === "home"
          const draft = hours[venue.seasonVenueId] ?? { start: "", end: "" }
          const dirty =
            draft.start !== (venue.simpleOpen ?? "") || draft.end !== (venue.simpleClose ?? "")
          const courtsNow = String(venue.courtsAvailable ?? venue.courtCount)
          const courtsDraft = courts[venue.seasonVenueId] ?? courtsNow
          const courtsDirty = courtsDraft !== courtsNow
          /** The weekends this plan has REALLY booked at this gym: a cell that
           *  is on in the plan's own grid is a confirmed booking (owner ruling
           *  2026-08-06), full day and every court. */
          const bookedSessions = new Set(
            venue.cells
              .filter((c) => c.sessionId && (c.state === "on" || c.state === "custom"))
              .map((c) => c.sessionId as string)
          )
          const bookedCount = bookedSessions.size
          /** Where this gym sits in the league's rental order, among the POOL
           *  only: the home gym is not in the ordering, it is simply first. */
          const poolRows = grid.venues.filter((v) => v.role !== "home")
          const poolAt = poolRows.findIndex((v) => v.venueId === venue.venueId)
          const canRank = editsWorld && !readOnly && !isHome && poolRows.length > 1

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
                {/* THE ORDER THE LEAGUE RENTS IN (owner ruling 2026-08-06).
                    Two 44px controls on the card they are about, because the
                    thing being ordered is the card. */}
                {canRank && (
                  <span
                    role="group"
                    aria-label={`Where ${venue.name} sits in your rental order`}
                    className="border-ink-300 inline-flex h-9 items-center rounded-lg border bg-white shadow-sm"
                  >
                    <button
                      type="button"
                      data-testid="gym-rank-up"
                      data-venue-id={venue.venueId}
                      disabled={busy !== null || poolAt <= 0}
                      onClick={() => void moveGym(venue, "up")}
                      aria-label={`Rent from ${venue.name} sooner`}
                      title={`Rent from ${venue.name} sooner`}
                      className="text-play-700 hover:bg-play-50 hover:text-play-900 h-full min-w-[44px] cursor-pointer rounded-l-lg text-base font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <span className="text-ink-500 min-w-[26px] text-center text-[11px] font-bold tabular-nums">
                      {poolAt + 1}
                    </span>
                    <button
                      type="button"
                      data-testid="gym-rank-down"
                      data-venue-id={venue.venueId}
                      disabled={busy !== null || poolAt >= poolRows.length - 1}
                      onClick={() => void moveGym(venue, "down")}
                      aria-label={`Rent from ${venue.name} later`}
                      title={`Rent from ${venue.name} later`}
                      className="text-play-700 hover:bg-play-50 hover:text-play-900 h-full min-w-[44px] cursor-pointer rounded-r-lg text-base font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ↓
                    </button>
                  </span>
                )}
                {!isHome && !readOnly && (
                  <button
                    type="button"
                    data-testid="make-home"
                    disabled={busy !== null}
                    onClick={() => makeHome(venue)}
                    className={`${BTN_SECONDARY} ${BTN_SM} ml-auto`}
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
              {canRank && (
                <p className="text-ink-400 mt-0.5 text-[11.5px]" data-testid="rank-hint">
                  The planner rents from the top of this list first.
                </p>
              )}

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
                  : "The same hours every weekend. A single date that runs different hours is set on the board."}
              </p>

              {/**
                * DATES ALREADY BOOKED HERE (owner ruling 2026-08-06). Optional,
                * collapsed, and only ever asked of a gym the league RENTS: nobody
                * phones the building they own.
                *
                * The skip line is the point of it. A league that has booked
                * nothing is not behind — the draw will assume what it needs and
                * hand back a call list — so the affordance has to say that out
                * loud, or an operator reads a date grid as homework.
                */}
              {!isHome && editsWorld && !readOnly && (
                <div className="border-ink-100 mt-2.5 border-t pt-2.5">
                  <button
                    type="button"
                    data-testid="bookings-open"
                    data-venue-id={venue.venueId}
                    data-open={bookingsFor === venue.seasonVenueId ? "1" : "0"}
                    onClick={() =>
                      setBookingsFor(
                        bookingsFor === venue.seasonVenueId ? null : venue.seasonVenueId
                      )
                    }
                    /* SECONDARY, IN REAL COLOUR (owner ruling 2026-08-06). A
                       white button with a grey hairline is a label; this one
                       carries the action colour on its border and its text. */
                    className={`${BTN_SECONDARY} ${BTN_MD}`}
                  >
                    {bookingsFor === venue.seasonVenueId
                      ? "Close booked dates"
                      : "Already have dates booked here?"}
                    {bookedCount > 0 && (
                      <span
                        data-testid="bookings-count"
                        className="border-court-200 bg-court-50 text-court-800 rounded-full border px-1.5 text-[10.5px]"
                      >
                        {bookedCount}
                      </span>
                    )}
                  </button>
                  {bookingsFor === venue.seasonVenueId && (
                    <div data-testid="bookings-picker" className="mt-2.5">
                      <p className="text-ink-500 mb-2 text-[11.5px]">
                        Tick the weekends you have already booked at {venue.name}. Each one is the
                        full day and every court. These count as confirmed bookings. The planner
                        treats them as paid for and fills them first.
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {weekends
                          .filter((w) => w.sessionId)
                          .map((w) => {
                            const on = bookedSessions.has(w.sessionId as string)
                            return (
                              <button
                                key={w.sessionId}
                                type="button"
                                data-testid="booking-cell"
                                data-session-id={w.sessionId}
                                data-on={on ? "1" : "0"}
                                aria-pressed={on}
                                disabled={busy !== null}
                                onClick={() =>
                                  void toggleBooking(venue, w.sessionId as string, !on)
                                }
                                /* A CELL IS A BUTTON, NOT A LABEL (owner ruling
                                   2026-08-06, the affordance sweep): solidly
                                   outlined, dark label, hover. Dashed grey is
                                   for empty states, and this is a control. */
                                className={`${BTN_SM} ${on ? BTN_PRIMARY : BTN_SECONDARY}`}
                              >
                                {w.label}
                              </button>
                            )
                          })}
                      </div>
                      <p className="text-ink-400 mt-2 text-[11.5px]" data-testid="bookings-skip">
                        No bookings yet? Fine. The planner will assume what it needs and give you a
                        call list.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ADVANCED, IN BOTH FLOWS (owner's 2026-08-06 analysis, D1).
                  It used to vanish the moment a plan was open, so a healed old
                  plan and a new one wore different screens. What it holds is
                  scoped to whose facts they are: the physical courts list is
                  the BUILDING's, real in every world; the day-by-day windows
                  are the SEASON's, so they are edited only when the season is
                  what is on screen — a plan's hours are the one range on the
                  card, plan-scoped already. */}
              {!readOnly && (
                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
                  <button
                    type="button"
                    data-testid="venue-advanced"
                    onClick={() =>
                      setAdvancedFor(
                        advancedFor === venue.seasonVenueId ? null : venue.seasonVenueId
                      )
                    }
                    className={`${BTN_SECONDARY} ${BTN_SM}`}
                  >
                    {advancedFor === venue.seasonVenueId ? "Close advanced" : "Advanced"}
                  </button>
                </div>
              )}

              {!readOnly && advancedFor === venue.seasonVenueId && (
                <div className="border-ink-100 bg-ink-50/60 mt-3 rounded-xl border p-3">
                  <p className="text-ink-500 mb-3 text-xs">
                    {readsWorld
                      ? "The building's own courts, named one by one. Its hours in this plan are the one range on the card above."
                      : "Courts and the full day by day window. Most seasons never need this, the range above is enough."}
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
                    showHours={!readsWorld}
                    onChange={load}
                  />
                </div>
              )}
            </div>
          )
        })}

        {/* Add a gym: the same create-or-attach endpoint the season uses. */}
        <div className="mt-4">
          {addingGym ? (
            <AddGymCard
              seasonId={seasonId}
              onCancel={() => setAddingGym(false)}
              onAdded={async (name, venueId) => {
                setAddingGym(false)
                await load()
                // A building is a SEASON fact (the league has it or it does not),
                // so the plan gains it in its pool with no availability at all:
                // nobody has phoned them about any Saturday yet.
                if (editsWorld && venueId) {
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
                      ? `${name} is in this plan's pool. Set its courts and hours, then place it on dates from the board.`
                      : `${name} added to the season.`
                  )
                  return
                }
                setNotice(`${name} added to the season.`)
              }}
            />
          ) : (
            <button
              type="button"
              disabled={readOnly}
              onClick={() => setAddingGym(true)}
              className={`${BTN_SECONDARY} ${BTN_MD}`}
            >
              + Add a gym
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Add-a-gym: VenueSelector plus the two facts every later screen needs, the
 *  courts and the hours. */
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
        Name the building, its courts and the hours you have it.
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
