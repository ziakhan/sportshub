"use client"

import { useEffect, useRef } from "react"
import { currentAssignment, type PlannerState } from "@/lib/scheduler/planner-core"
import {
  activateConfirmText,
  canWriteToPlan,
  isReferencePlan,
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

/** How long the working copy sits quiet before autosave writes it (owner
 *  ruling 2026-08-07, #4). */
const AUTOSAVE_DEBOUNCE_MS = 1000

/**
 * THE PLAN AS A DOCUMENT (owner 2026-08-02: "we can have multiple plans, we can
 * save them, we can name them"). Opening one onto the board, saving the board
 * back onto it (now on a debounce — autosave, owner ruling 2026-08-07, #4),
 * and taking a copy.
 *
 * WRITE-THROUGH DIED HERE TOO (owner ruling 2026-08-07, #2): this file used to
 * also own every write the working copy owed the SEASON rather than the
 * plan — where a rental stood, a gym that gave fewer courts, a backup gym
 * somebody asserted — for whichever plan happened to be the season's active
 * one. Plans are sandboxes, full stop, so that whole category of write is
 * gone; see the note above worldWithAssertions for what still travels with a
 * save and what, for now, only lives in the working copy.
 */
export function useBoardPlans(m: BoardModel) {
  /** The latest pending-save closure, for the unmount flush below. */
  const flushRef = useRef<{
    dirty: boolean
    planId: string | null
    selectedPlan: import("@/lib/scheduler/plan-documents").PlanRow | null
    savePlan: () => Promise<void> | void
  }>({ dirty: false, planId: null, selectedPlan: null, savePlan: () => {} })
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
    setCourtOverrides,
    hourOverrides,
    setHourOverrides,
    assertedGyms,
    setAssertedGyms,
    fridays,
    setFridays,
    setEmptyGyms,
    setUndoStack,
    dirty,
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
   * slate. The working copy is thrown away — autosave means there is rarely
   * more than a second of it to lose (owner ruling 2026-08-07, #4).
   *
   * Every plan is drawn under the settings it was SAVED with now, the active
   * plan included (write-through died, owner ruling 2026-08-07): every
   * fraction, meter and idea on screen is the one the operator saw when they
   * saved it. The `liveState` fallback below only matters for the rare
   * pre-heal instant before a plan has any settings of its own at all.
   */
  const openPlan = (plan: PlanDocument) => {
    drawnPlan.current = `${plan.id}|${planVersion}`
    setError(null)
    const settings = plan.settings ?? null
    const ownWorld = Boolean(settings)
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
        ? `${plan.name} is a fresh calendar from the planner. Adjust anything — every change saves on its own.`
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

  /**
   * Save the board as a NEW plan, and nothing else moves (owner ruling
   * 2026-08-07, #2 and #3: write-through died, and the single generate
   * button is the only door into the season now). This used to also make the
   * first plan a season ever saved its calendar automatically — that was
   * write-through wearing a different hat, a save silently becoming the
   * season's driver, and it goes with the rest of it. A season with nothing
   * generated yet simply has nothing generated yet.
   *
   * This is "Save a copy" now: the reference plan's only escape, offered on
   * the board, and the same machinery the picker's row menu's copy action
   * reaches for when the plan being duplicated is the one already open.
   *
   * The world it records is the season's, read on the server at save time. So
   * a copy taken while an older plan's world was on the board comes back in
   * today's world, and the board follows it there rather than keeping numbers
   * the new plan does not claim. */
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
    setOnPlanWorld(Boolean(plan.settings) && wasOnPlanWorld)
    if (wasOnPlanWorld && plan.settings) {
      const own = planStateFrom(seasonId, plan)
      if (own) setState(own)
    } else if (liveState) setState(liveState)
    setVenues(shown.venues)
    setBlockStatus({})
    // The new plan's world carries the assertions and the per-date hours, so
    // the working copy hands them over.
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
      wasOnPlanWorld
        ? `Saved as ${plan.name}, with the gyms and estimates this plan was drawn in.`
        : `Saved as ${plan.name}.`
    )
  }

  /**
   * SAVE THE BOARD ONTO THE PLAN IT CAME FROM — THE PLAN DOCUMENT ONLY (owner
   * ruling 2026-08-07, #1 and #2: plans are sandboxes, full stop, and
   * write-through died). This used to write straight through to the season's
   * own sessions on the plan the season runs; it never does that any more,
   * the active plan included. Every plan's calendar and world land in its
   * own document, the same way, and the season only takes on a plan's world
   * through the generate button, elsewhere.
   *
   * This is what autosave calls, on a debounce, every time the working copy
   * goes dirty (see the effect below). Nothing here is a user-visible "save" —
   * the plan-state line says so quietly, and errors still surface through
   * `error`/`notice` because a save that silently failed is worse than one
   * that never ran.
   */
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
    // Every plan keeps its own world now, the active plan included: the
    // asserted gyms, the per-date hours and any Friday the operator added are
    // always part of what gets saved, not only on a plan the season does not
    // run.
    const assertedWorld = worldWithAssertions()
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
    /**
     * THE PLAN KEEPS ITS OWN WORLD (owner ruling 2026-08-05, the active case
     * retired 2026-08-07). Saving a calendar onto a plan never re-snapshots
     * the season over the plan's world; the board stays in the world the
     * operator was working in, whichever plan that is.
     */
    skipRedraw.current = true
    session.setDoc(saved)
    setPlanSettings(saved.settings ?? null)
    setOnPlanWorld(Boolean(saved.settings))
    if (saved.settings) {
      const own = planStateFrom(seasonId, saved)
      if (own) setState(own)
    } else if (liveState) setState(liveState)
    setVenues(shown.venues)
    setBlockStatus({})
    // The assertion and the hours are written down now, in the plan's own
    // world, so the working copy stops carrying them.
    setAssertedGyms({})
    setEmptyGyms({})
    setHourOverrides({})
    setUndoStack([])
    // Quietly: autosave has nothing to announce beyond clearing dirty, which
    // is what turns the plan-state line back to "Every change saves to
    // <name>." (BoardTools reads `dirty`, not this function's return).
    setDirty(false)
    setFromLever(false)
    setArmed(null)
    setArmedVenue(null)
    setArmedSection(null)
    await session.refresh()
  }

  /**
   * Make the selected plan the one the season runs. The CALENDAR is all that
   * moves: the season keeps its own gyms, hours and estimates, so a plan drawn
   * in an older world is asked about first, with the differences named, and the
   * confirmation says plainly what will not change.
   *
   * NO CONTROL IN THIS FILE CALLS THIS ANY MORE (owner ruling 2026-08-07, #3:
   * one door into the season, the single generate button elsewhere). Kept
   * exported so that button's own client can reuse the same machinery rather
   * than a second copy of it; "activate" itself has already left every
   * user-facing string this file owns.
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
   * COURT CORRECTIONS AND BOOKING STATUSES HAVE NO SEASON WRITE PATH ANY MORE
   * (owner ruling 2026-08-07, #1 and #2). This file used to keep four
   * functions here — writeCourtCaps, writeAssertedGyms, writeWeekendHours,
   * writeBookingStatus, bundled as writeSeasonFacts — that wrote the working
   * copy's corrections onto the SEASON's own rows, but only for the plan the
   * season ran. That whole notion of "the plan the season runs" writing
   * somewhere different from every other plan is exactly the write-through
   * ruling 2 kills, so they are gone with it.
   *
   * `assertedGyms`, `hourOverrides` and `fridays` still travel with every
   * save, in the plan's own world (worldWithAssertions, below) — that part
   * already worked the same way for every non-active plan. `courtOverrides`
   * and `blockStatus`, the per-weekend court corrections and booking-status
   * annotations, have no equivalent in-world representation to travel in:
   * they stay working-copy state, same as they already were on every plan
   * that was never the season's active one. Giving them a real home is
   * outside this file's reach this wave (plan-world.ts is locked to one
   * appended function, spent on withUnitRemoved).
   */

  /**
   * THE PLAN'S WORLD, WITH THE ASSERTIONS IN IT (owner ruling 2026-08-05, #1;
   * every plan since 2026-08-07). What a save sends now, for every plan alike:
   * the world the board has been drawing, plus every backup gym the operator
   * put on a weekend, so reopening the plan finds that gym really there.
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

  /**
   * AUTOSAVE (owner ruling 2026-08-07, #4: "no Save/Save-as on the default
   * path, the board saves itself"). The moment the working copy goes dirty, a
   * debounced write lands it on the OPEN plan; a further edit inside the
   * window re-arms the timer, because `shown` and `blockStatus` — the
   * derived and raw state every save reads from — get new identities on
   * every meaningful change, and both sit in the dependency array below.
   * Never for the read-only reference, which has no world of its own to
   * take it, and never with nothing open, where there is no plan to hold it.
   */
  useEffect(() => {
    if (!dirty || !planId || !selectedPlan || isReferencePlan(selectedPlan)) return
    const timer = setTimeout(() => {
      void savePlan()
    }, AUTOSAVE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, planId, selectedPlan, shown, blockStatus])

  /**
   * THE LAST SECOND IS NEVER LOST (seam fix, 2026-08-07). The debounce above
   * dies with the board: an edit made and then immediately walked away from —
   * "Next: Publish" inside the one-second window — would vanish with the
   * unmount. The ref carries the latest save closure so THIS effect can be
   * mount-empty and still flush the real pending state on the way out. It is
   * unmount-only on purpose: a cleanup on the debounce effect itself would
   * fire on every re-arm and save every keystroke.
   */
  flushRef.current = { dirty, planId, selectedPlan, savePlan }
  useEffect(
    () => () => {
      const last = flushRef.current
      if (last.dirty && last.planId && last.selectedPlan && !isReferencePlan(last.selectedPlan)) {
        void last.savePlan()
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  return { openPlan, revert, saveAsNew, savePlan, activatePlan, writable }
}
