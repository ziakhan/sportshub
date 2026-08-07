"use client"

import { useEffect } from "react"
import { currentAssignment, type PlannerState } from "@/lib/scheduler/planner-core"
import {
  activateConfirmText,
  canWriteToPlan,
  suggestPlanName,
  PLAN_COPY,
  type PlanDocument,
} from "@/lib/scheduler/plan-documents"
import {
  planStateFrom,
  withAssertedGymsInWorld,
  withWeekendHoursInWorld,
  withFridayBlocksInWorld,
  worldFromState,
} from "@/lib/scheduler/plan-world"
import { plural, savedVenueMap } from "./board-shared"
import type { BoardModel } from "./board-state"

/**
 * THE PLAN AS A DOCUMENT (owner 2026-08-02: "we can have multiple plans, we can
 * save them, we can name them"). Opening one onto the board, saving the board
 * back onto it, taking a copy, and making the season run it.
 *
 * Every write the working copy owes the SEASON rather than the plan lives here
 * too — where a rental stands, a gym that gave fewer courts, a backup gym
 * somebody asserted — because all three are only true of the plan the season
 * actually runs, and that rule is easiest to keep in one place.
 */
export function useBoardPlans(m: BoardModel) {
  const {
    seasonId,
    session,
    plans,
    planId,
    planDoc,
    planVersion,
    drawnPlan,
    skipRedraw,
    selectedPlan,
    drift,
    state,
    setState,
    liveState,
    setLiveState,
    planSettings,
    setPlanSettings,
    onPlanWorld,
    setOnPlanWorld,
    assignment,
    setAssignment,
    setVenues,
    shown,
    blockStatus,
    setBlockStatus,
    courtOverrides,
    setCourtOverrides,
    hourOverrides,
    setHourOverrides,
    assertedGyms,
    setAssertedGyms,
    fridays,
    setFridays,
    setEmptyGyms,
    setUndoStack,
    setDirty,
    fromLever,
    setFromLever,
    setArmed,
    setArmedVenue,
    setArmedSection,
    setFlashUnits,
    setGhosts,
    setKept,
    setKeptVenues,
    setVenueGrid,
    setBusy,
    setError,
    setNotice,
    naming,
    setNaming,
    load,
  } = m

  /**
   * MAY THIS BOARD WRITE? Only onto a plan whose document is the one on screen,
   * or onto no plan at all (a copy taken off the season's own board). Every save
   * path asks this first (the cold-open data-loss fix, 2026-08-06).
   */
  const writable = canWriteToPlan(planId, planDoc)

  /**
   * Open a plan on the board: its calendar, its gyms, its WORLD, and a clean
   * slate. The working copy is thrown away, so an operator who has unsaved work
   * is asked first — unless they asked for this themselves ("Undo changes").
   *
   * A plan the season does not run is drawn under the settings it was SAVED
   * with, so every fraction, meter and idea on screen is the one the operator
   * saw when they saved it. The plan the season runs is drawn under the
   * season's own world, because that world is the one it is running in.
   */
  const openPlan = (plan: PlanDocument) => {
    drawnPlan.current = `${plan.id}|${planVersion}`
    setError(null)
    const settings = plan.settings ?? null
    const ownWorld = Boolean(settings) && !plan.isActive
    setPlanSettings(settings)
    setOnPlanWorld(ownWorld)
    // The plan's own world, read the one shared way. A plan the season RUNS is
    // drawn under the season's world, because that world is the one it runs in.
    const own = ownWorld ? planStateFrom(seasonId, plan) : null
    if (own) setState(own)
    else if (liveState) setState(liveState)
    setAssignment(plan.assignment ?? {})
    setVenues(plan.venues ?? {})
    // A plan document holds a calendar, not bookings: the statuses come back
    // from the gyms themselves (step 2's grid) the moment a plan is opened.
    setBlockStatus({})
    setCourtOverrides({})
    setHourOverrides({})
    // The plan's own world says which gyms it has on which weekends, and on what
    // hours, so nothing is asserted or overridden on a board that has just
    // opened.
    setAssertedGyms({})
    setEmptyGyms({})
    setFridays({})
    setFlashUnits([])
    setGhosts([])
    setArmedSection(null)
    setUndoStack([])
    setDirty(false)
    setFromLever(false)
    setArmed(null)
    setArmedVenue(null)
    setNaming(null)
    setNotice(
      session.lastCreatedId === plan.id
        ? `${plan.name} is a fresh calendar from the planner. Adjust anything, then use it for the season.`
        : plan.isActive
          ? `${plan.name} is on the board. This is the calendar the season runs.`
          : ownWorld
            ? `${plan.name} is on the board, under the settings it was saved with.`
            : `${plan.name} is on the board.`
    )
  }

  /**
   * OPEN WHAT THE OPERATOR CHOSE, AT THE VERSION IT IS NOW (owner ruling
   * 2026-08-05, #2 and #4). The plan lives above the steps, so the board is a
   * follower: it draws whatever plan the wizard is in, at whatever version the
   * wizard holds, and draws nothing at all until somebody opens one.
   *
   * THE VERSION IS IN THE KEY, and that is the staleness fix. Step 2 writes the
   * plan, the wizard's document changes, and stepping to step 3 redraws the
   * board from THAT document — never from a board state that outlived the plan
   * it was drawn from. A save made here sets skipRedraw, because it has already
   * put its own result on screen.
   */
  useEffect(() => {
    /**
     * THE SEASON, NOT THE BOARD (the cold-open fix, 2026-08-06). This used to
     * wait for `state`, the world the board is drawing — which load() only sets
     * when no plan is open now, so a mount that already has a plan chosen would
     * have waited for a world nothing was ever going to put there. What opening
     * a plan really needs is the SEASON to have answered: openPlan reads
     * liveState for the one plan that has no world of its own.
     */
    if (!liveState || !planId || !planDoc || planDoc.id !== planId) return
    const key = `${planId}|${planVersion}`
    if (drawnPlan.current === key) return
    if (skipRedraw.current) {
      skipRedraw.current = false
      drawnPlan.current = key
      return
    }
    openPlan(planDoc)
    // openPlan is recreated every render and is deliberately not a dependency:
    // the ref above is what makes this run exactly once per (plan, version).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, planVersion, planDoc, liveState])

  /**
   * WHERE "ASSUMED" IS WRITTEN DOWN (the 2026-08-03 wiring decision, and the
   * one place this file writes anything about a booking).
   *
   * A plan document holds a calendar and its gyms; where a BOOKING stands lives
   * on the gym's attachment to the weekend (SeasonSessionDayVenue.bookingStatus),
   * which is step 2's own truth and what the grid reads back. So:
   *
   *  - while an operator is thinking, the statuses live in the working copy;
   *  - they are written through only for the plan the season actually RUNS,
   *    where "this rented weekend is not booked yet" is a true fact about the
   *    season. A plan the season does not run must never mark anybody's gym;
   *  - the grid is re-read afterwards, so the base every status falls back to
   *    is the one the season just recorded.
   */
  const writeBookingStatus = async () => {
    const rows = Object.entries(blockStatus)
    if (rows.length === 0) return
    await Promise.all(
      rows.map(([key, bookingStatus]) => {
        const [sessionId, venueId] = key.split("|")
        if (!sessionId || !venueId) return Promise.resolve(null)
        return fetch(`/api/seasons/${seasonId}/sessions/${sessionId}/venues/${venueId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingStatus }),
        }).catch(() => null)
      })
    )
    const res = await fetch(`/api/seasons/${seasonId}/planner/venues`, { cache: "no-store" }).catch(
      () => null
    )
    const data = res?.ok ? await res.json().catch(() => null) : null
    if (data?.grid) setVenueGrid(data.grid)
  }

  /** Back to what the selected plan says, re-read from the server so "undo my
   *  changes" cannot land on a document that moved while the board was open. */
  const revert = async () => {
    if (planId) {
      setBusy(`plan:${planId}`)
      const fresh = await session.refreshDoc()
      setBusy(null)
      if (fresh) openPlan(fresh)
      else setError("Couldn't reopen that plan. Try again.")
      return
    }
    await load()
  }

  /** Save the board as a NEW plan. Nothing is applied: the plan lands beside
   *  the others until somebody uses it for the season — except on a season
   *  that runs nothing yet, where the first plan saved IS the calendar.
   *
   *  The world it records is the season's, read on the server at save time. So
   *  a copy taken while an older plan's world was on the board comes back in
   *  today's world, and the board follows it there rather than keeping numbers
   *  the new plan does not claim. */
  const saveAsNew = async () => {
    const name = (naming ?? "").trim()
    if (!name) return
    // A copy of a plan the board has not finished reading is a copy of the wrong
    // world (the cold-open fix, 2026-08-06). Copying the SEASON deliberately is
    // fine, which is why this only refuses while a plan is chosen and unread.
    if (!writable) {
      setError(PLAN_COPY.saveUnread)
      return
    }
    setBusy("save-new")
    setError(null)
    // Save the buildings the board is SHOWING — the same chronological pass
    // both views draw from. A preview the operator kept is a promise about
    // where a family drives, so it is written down like a hand pick.
    const res = await fetch(`/api/seasons/${seasonId}/plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        assignment,
        venues: shown.venues,
        source: fromLever ? "proposed" : "manual",
        // A COPY CARRIES THE WORLD IT WAS DRAWN IN (owner ruling 2026-08-05). A
        // plan owns its world, so a copy taken while that world is on the board
        // is a copy of the world too — otherwise the numbers would change under
        // the operator the moment they pressed Save a copy. Any backup gym the
        // operator asserted is part of that world (ruling #1).
        ...(onPlanWorld && planSettings
          ? { settings: { ...planSettings, state: worldWithAssertions() ?? planSettings.state } }
          : {}),
      }),
    }).catch(() => null)
    const data = res ? await res.json().catch(() => null) : null
    if (!res?.ok || !data?.plan) {
      setBusy(null)
      setError(data?.error ?? "That didn't save. Try again.")
      return
    }
    const plan = data.plan as PlanDocument
    const takesOver = !plans.some((p) => p.isActive)
    let fresh: PlannerState | null = null
    if (takesOver) {
      await fetch(`/api/seasons/${seasonId}/plans/${plan.id}/activate`, { method: "POST" }).catch(
        () => null
      )
      // The season runs this calendar now, so where its rentals stand and which
      // gyms gave fewer courts are facts about the season, not only about the
      // board. Both are written through here and nowhere else.
      fresh = await writeSeasonFacts()
      setKept(assignment)
      setKeptVenues(shown.venues)
    }
    const wasOnPlanWorld = onPlanWorld
    // The board is ALREADY drawing this plan, so the wizard is told which plan
    // it is in without the open-on-choice effect redrawing it underneath.
    skipRedraw.current = true
    await session.refresh()
    session.choose(plan.id)
    session.setDoc(plan)
    setPlanSettings(plan.settings ?? null)
    // A copy that carried its world keeps drawing that world; one saved in the
    // season's world goes back to the season's numbers.
    setOnPlanWorld(Boolean(plan.settings) && wasOnPlanWorld && !takesOver)
    // A correction the save just wrote moved the season's own capacity, so THAT
    // is the world the board lands in. Without this the stale live world would
    // quietly put the courts back.
    if (wasOnPlanWorld && !takesOver && plan.settings) {
      const own = planStateFrom(seasonId, plan)
      if (own) setState(own)
    } else if (fresh) setState(fresh)
    else if (liveState) setState(liveState)
    setVenues(shown.venues)
    setBlockStatus({})
    // A plan the season does not run never marked anybody's gym, so its
    // corrections are still only the board's opinion and they stay on it.
    if (takesOver) setCourtOverrides({})
    // The new plan's world carries the assertions and the per-date hours (or the
    // season does, where this save took over), so the working copy hands them
    // over.
    setAssertedGyms({})
    setEmptyGyms({})
    setFridays({})
    setHourOverrides({})
    setUndoStack([])
    setDirty(false)
    setFromLever(false)
    setNaming(null)
    setArmed(null)
    setArmedVenue(null)
    setBusy(null)
    setNotice(
      takesOver
        ? `Saved as ${plan.name}. It is the calendar this season runs.`
        : wasOnPlanWorld
          ? `Saved as ${plan.name}, with the gyms and estimates this plan was drawn in.`
          : `Saved as ${plan.name}. Use it for the season when you are ready.`
    )
  }

  /** Save the board onto the plan it came from. On the plan the season runs,
   *  the server writes it through to the calendar everyone sees. */
  const savePlan = async () => {
    const plan = selectedPlan
    if (!plan) return
    /**
     * NEVER WRITE A WORLD WE HAVE NOT READ (the cold-open data-loss fix,
     * 2026-08-06). `worldWithAssertions` falls back to `worldFromState(state)`
     * when planSettings is null, and on a board that has not finished opening
     * this plan that state is the SEASON's world. Saving then wrote the season's
     * gyms, courts and hours straight over the plan's own, silently and for good.
     *
     * The test is not "does it have settings" — a plan written before plans
     * remembered their world honestly has none, and saving onto it is right. It
     * is "is the document on screen this plan's document".
     */
    if (!writable) {
      setError(PLAN_COPY.saveUnread)
      return
    }
    setBusy("save-plan")
    setError(null)
    // A gym the operator asserted travels with the calendar, EXCEPT on the plan
    // the season runs: there it is the season's own attachment, written through
    // by writeSeasonFacts below.
    const assertedWorld = plan.isActive ? null : worldWithAssertions()
    const res = await fetch(`/api/seasons/${seasonId}/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignment,
        venues: shown.venues,
        ...(assertedWorld ? { settings: { state: assertedWorld } } : {}),
      }),
    }).catch(() => null)
    const data = res ? await res.json().catch(() => null) : null
    setBusy(null)
    if (!res?.ok || !data?.plan) {
      // The reference plan refuses content and says why. Say it in the
      // operator's own words and open the one door that is not shut: a plan
      // of their own, with these changes in it.
      if (res?.status === 409 && data?.error) {
        setNotice(data.error)
        setNaming(suggestPlanName(plans))
        return
      }
      setError(data?.error ?? "That didn't save. Try again.")
      return
    }
    const saved = data.plan as PlanDocument
    const wasOnPlanWorld = onPlanWorld
    // The active plan IS the season's calendar, so where its rentals stand and
    // any gym it corrected are written through with it. A plan the season does
    // not run leaves the gyms alone (writeBookingStatus explains why).
    const fresh = plan.isActive ? await writeSeasonFacts() : null
    /**
     * THE PLAN KEEPS ITS OWN WORLD (owner ruling 2026-08-05). Saving a calendar
     * onto a plan used to re-snapshot the season over the plan's world, which
     * silently moved every number on the board; the server leaves it alone now,
     * so the board stays in the world the operator was working in.
     */
    skipRedraw.current = true
    session.setDoc(saved)
    setPlanSettings(saved.settings ?? null)
    setOnPlanWorld(Boolean(saved.settings) && !plan.isActive)
    if (!plan.isActive && saved.settings) {
      const own = planStateFrom(seasonId, saved)
      if (own) setState(own)
    } else if (fresh) setState(fresh)
    else if (liveState) setState(liveState)
    setVenues(shown.venues)
    setBlockStatus({})
    if (plan.isActive) setCourtOverrides({})
    // The assertion and the hours are written down now, in the plan's world or on
    // the season's attachment, so the working copy stops carrying them.
    setAssertedGyms({})
    setEmptyGyms({})
    setHourOverrides({})
    setUndoStack([])
    setDirty(false)
    setFromLever(false)
    setArmed(null)
    setArmedVenue(null)
    setArmedSection(null)
    await session.refresh()
    if (plan.isActive) {
      // The write-through happened, so this is what every later comparison is
      // against.
      setKept(assignment)
      setKeptVenues(shown.venues)
    }
    setNotice(
      plan.isActive
        ? `Saved to ${plan.name}. Everything after this step follows this calendar.`
        : wasOnPlanWorld
          ? `Saved to ${plan.name}, in its own gyms and estimates.`
          : `Saved to ${plan.name}.`
    )
  }

  /**
   * Make the selected plan the one the season runs. The CALENDAR is all that
   * moves: the season keeps its own gyms, hours and estimates, so a plan drawn
   * in an older world is asked about first, with the differences named, and the
   * confirmation says plainly what will not change.
   */
  const activatePlan = async () => {
    const plan = selectedPlan
    if (!plan || plan.isActive) return
    if (!window.confirm(activateConfirmText(plan.name, drift))) return
    setBusy("activate")
    setError(null)
    const res = await fetch(`/api/seasons/${seasonId}/plans/${plan.id}/activate`, {
      method: "POST",
    }).catch(() => null)
    const data = res ? await res.json().catch(() => null) : null
    setBusy(null)
    if (!res?.ok || !data?.state) {
      setError(data?.error ?? "That didn't take. Try again.")
      return
    }
    const next = data.state as PlannerState
    const savedNow = currentAssignment(next)
    const savedVenuesNow = savedVenueMap(next)
    setState(next)
    setLiveState(next)
    /**
     * THE SEASON TOOK THE WHOLE PLAN (owner ruling 2026-08-05, #5): its calendar
     * AND its gym setup. So the plan's world and the season's are the same world
     * now, the board draws the live one, and the drift line has nothing to say —
     * which is the truth rather than a silence.
     */
    setOnPlanWorld(false)
    setPlanSettings(null)
    skipRedraw.current = true
    setAssignment(savedNow)
    setVenues(savedVenuesNow)
    setKept(savedNow)
    setKeptVenues(savedVenuesNow)
    setBlockStatus({})
    setCourtOverrides({})
    setHourOverrides({})
    setAssertedGyms({})
    setEmptyGyms({})
    setUndoStack([])
    setArmed(null)
    setArmedVenue(null)
    setArmedSection(null)
    setDirty(false)
    setFromLever(false)
    await session.refresh()
    await session.refreshDoc()
    // A gym a GAME is already on could not be released, and that is a real
    // difference between the plan and the season the operator has to hear.
    // THE RE-SOLVE OFFER rides the same line (owner's 2026-08-06 analysis,
    // C4): a plan that was saved under older settings, or one that could not
    // fully land, gets the way to a clean calendar named — Redraw is in the
    // header, one press away, and now solves in the world the season just took.
    const blocked = Number(data.world?.blocked ?? 0)
    const redrawOffer = " If anything looks off, Redraw rebuilds the calendar under these settings."
    setNotice(
      blocked > 0
        ? `${plan.name} is the season's calendar and gym setup now, except ${plural(blocked, "weekend", "weekends")} that kept a gym because a game is already scheduled there.${redrawOffer}`
        : drift.length > 0
          ? `${plan.name} is the season's calendar and gym setup now. The season had moved since it was saved, and it now runs this plan's version.${redrawOffer}`
          : `${plan.name} is the season's calendar and gym setup now. Everything after this step follows it.`
    )
  }

  /**
   * WHAT THE WORKING COPY OWES THE SEASON on save: where its rentals stand, and
   * any gym it corrected. Both are facts about the SEASON rather than about a
   * calendar, so both are written only for the plan the season actually runs
   * (writeBookingStatus explains why), and both are re-read afterwards so the
   * board's base is the one the season just recorded.
   */
  const writeCourtCaps = async (): Promise<PlannerState | null> => {
    const rows = Object.entries(courtOverrides)
    if (rows.length === 0) return null
    await Promise.all(
      rows.map(([key, courts]) => {
        const [sessionId, venueId] = key.split("|")
        if (!sessionId || !venueId) return Promise.resolve(null)
        return fetch(`/api/seasons/${seasonId}/sessions/${sessionId}/venues/${venueId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courts }),
        }).catch(() => null)
      })
    )
    // Capacity moved, so the season's own world moved with it.
    const res = await fetch(`/api/seasons/${seasonId}/planner`, { cache: "no-store" }).catch(
      () => null
    )
    const data = res?.ok ? await res.json().catch(() => null) : null
    const fresh = (data?.state ?? null) as PlannerState | null
    if (fresh) setLiveState(fresh)
    return fresh
  }

  /**
   * THE BACKUP GYMS THE OPERATOR ASSERTED, written onto the SEASON (owner ruling
   * 2026-08-05, #1). Only for the plan the season runs, where "we have Haber that
   * Saturday" is a fact about the season's own gym time — the same attachment
   * step 2 makes when a cell is turned on. A plan the season does not run keeps
   * its assertion in its own world instead (see savePlan).
   */
  const writeAssertedGyms = async () => {
    const pairs = Object.entries(assertedGyms).flatMap(([sessionId, venueIds]) =>
      (venueIds ?? []).map((venueId) => ({ sessionId, venueId }))
    )
    if (pairs.length === 0) return
    await Promise.all(
      pairs.map(({ sessionId, venueId }) =>
        fetch(`/api/seasons/${seasonId}/sessions/${sessionId}/venues/${venueId}`, {
          method: "POST",
        }).catch(() => null)
      )
    )
  }

  /**
   * THE PER-DATE HOURS, written onto the SEASON (owner ruling 2026-08-06, #5).
   * The same one-weekend exception step 2's grid cell writes, and only for the
   * plan the season runs: on any other plan the hours are the plan's own and
   * travel in its world (see worldWithAssertions).
   */
  const writeWeekendHours = async () => {
    const rows = Object.entries(hourOverrides)
    if (rows.length === 0) return
    await Promise.all(
      rows.map(([key, window]) => {
        const [sessionId, venueId] = key.split("|")
        if (!sessionId || !venueId) return Promise.resolve(null)
        return fetch(
          `/api/seasons/${seasonId}/sessions/${sessionId}/venues/${venueId}/hours`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(window),
          }
        ).catch(() => null)
      })
    )
  }

  /**
   * Everything the working copy owes the season, in one errand, handing back
   * the season's world if a correction moved it. The caller decides which world
   * the board lands in, so a stale `liveState` can never overwrite a capacity
   * the save just changed.
   */
  const writeSeasonFacts = async (): Promise<PlannerState | null> => {
    // The gyms first: a correction to a gym the season did not have yet would
    // otherwise be written against nothing.
    await writeAssertedGyms()
    await writeWeekendHours()
    await writeBookingStatus()
    return writeCourtCaps()
  }

  /**
   * THE PLAN'S WORLD, WITH THE ASSERTIONS IN IT (owner ruling 2026-08-05, #1).
   * What a save sends for a plan the season does not run: the world the board has
   * been drawing, plus every backup gym the operator put on a weekend, so
   * reopening the plan finds that gym really there.
   *
   * A plan that never remembered a world gets one built from the state on screen.
   * That is not a new claim: the server already re-snapshots the season over a
   * world-less plan on any content write, so this only makes the snapshot include
   * what the operator just told us.
   */
  const worldWithAssertions = () => {
    const nothingAsserted = Object.values(assertedGyms).every((ids) => (ids ?? []).length === 0)
    const noHours = Object.keys(hourOverrides).length === 0
    const noFridays = Object.keys(fridays).length === 0
    if (nothingAsserted && noHours && noFridays) return null
    const base = planSettings?.state ?? (state ? worldFromState(state) : null)
    if (!base) return null
    // The gyms first, because hours for a gym the world does not have on that
    // weekend would be written against nothing.
    return withFridayBlocksInWorld(
      withWeekendHoursInWorld(
        withAssertedGymsInWorld(base, assertedGyms),
        hourOverrides
      ),
      // Last: a Friday is extra capacity at a gym the weekend already has, so
      // the gym has to be on it before the block can ride along.
      fridays
    )
  }

  return { openPlan, revert, saveAsNew, savePlan, activatePlan, writable }
}
