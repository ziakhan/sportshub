"use client"

import { AskSheet, VenueTray } from "./plan-ui"
import { PlanEmptyState } from "./plan-session"
import { Segmented, StripView } from "./season-strip"
import type { PlanHeaderInfo } from "./teams-step"
import { COPY, headerPill } from "./board-shared"
import { useBoardState } from "./board-state"
import { useBoardPlans } from "./board-plans"
import { useBoardVerbs } from "./board-verbs"
import {
  ArmedLines,
  BoardHead,
  DrawHero,
  DriftLine,
  GymLegend,
  StrandedBanner,
} from "./board-chrome"
import { BoardView } from "./board-view"
import { WeekendZoom } from "./weekend-zoom"
import { WorkRail } from "./work-rail"
import { BoardTools } from "./board-tools"

/**
 * Step 3, the calendar (owner-approved mock, 2026-08-02). The screen the
 * whole flow exists for: the operator's own hand-drawn season calendar,
 * computed in a second.
 *
 * The rule the screen is built around: it OPENS on the answer. A season with
 * nothing planned yet asks the solver for the balanced plan before first
 * paint, so nobody has to press a button to see a calendar. That opening
 * plan is unsaved and says so; a season that already has one opens on it.
 *
 * Grouping rules are league truths, not preferences, so they are not a step.
 * The three levers live behind a quiet link for the operator who cares.
 *
 * Two views of the SAME calendar (owner 2026-08-02): the board, which is where
 * a month gets rearranged, and the season strip, which reads a grade's whole
 * season left to right and names the gyms each weekend. This component owns
 * every piece of state; the views only draw it.
 *
 * PLANS AS DOCUMENTS (owner 2026-08-02: "we can have multiple plans, we can
 * save them, we can name them ... when I do it fresh it should be our own").
 * The board is a working copy of ONE named plan, chosen in the picker. Saving
 * writes to that plan and nowhere else, which is why the direct planner/apply
 * call is gone: a plan the season runs is written through on save, a plan it
 * does not run waits for "Use for the season", and the league's own imported
 * calendar is read only so there is always something to compare against.
 *
 * A PLAN REMEMBERS ITS WORLD (owner 2026-08-02: "a new plan also could have
 * different venues. It could have different settings, so how are you going to
 * save it and how do you remember? It could be a different team combination").
 * Every plan carries the gyms, hours, fill order and team estimates it was
 * drawn under, so opening one puts the board back in THAT world: the fractions,
 * the meters and the ideas are the ones the operator saw when they saved it,
 * not this month's. Where the season has since moved on, the board says so
 * above the calendar instead of quietly re-drawing the plan under new numbers.
 *
 * Two things follow from that, and both are deliberate:
 *  - the levers and the hours chips are DISABLED on a plan drawn in its own
 *    saved world. They solve against the season as it stands, so their answer
 *    would be in a different world from the board it landed on.
 *  - activating still applies the CALENDAR only. The season keeps its own
 *    gyms, hours and estimates, and the confirmation says so out loud.
 */

/**
 * WHERE THE SCREEN IS PUT TOGETHER, and nothing else. The working copy and
 * everything derived from it is board-state; what a click does to it is
 * board-verbs; what a save does with it is board-plans; the calendar, the rail,
 * the zoom and the furniture draw themselves from what this hands them.
 *
 * The order of the three hooks is load-bearing: the world first, then the plan
 * opened into it, then the verbs that edit it.
 */
export function CalendarStep({
  seasonId,
  onLoaded,
  onGoToStep,
}: {
  seasonId: string
  onLoaded?: (info: PlanHeaderInfo) => void
  /** The wizard's own step control, so a board with no world to solve in can
   *  send the operator back to the step that gives it one (owner ruling
   *  2026-08-05, #1). */
  onGoToStep?: (step: number) => void
}) {
  const m = useBoardState({ seasonId, onLoaded })
  const planDocs = useBoardPlans(m)
  const verbs = useBoardVerbs(m)

  const {
    board,
    worldUsable,
    calendarEmpty,
    onPlanWorld,
    assignment,
    venues,
    undoStack,
    courtCaps,
    dirty,
    armed,
    setArmed,
    armedVenue,
    setArmedVenue,
    armedBlock,
    setArmedBlock,
    armedSection,
    setArmedSection,
    zoomSession,
    setZoomSession,
    flashSessions,
    flashUnits,
    ghosts,
    boardScroll,
    assignMode,
    setAssignMode,
    locked,
    busy,
    notice,
    error,
    showRules,
    setShowRules,
    showHours,
    setShowHours,
    hoursChip,
    setHoursChip,
    hoursPreview,
    setHoursPreview,
    hoursError,
    setHoursError,
    view,
    setView,
    side,
    setSide,
    comparing,
    setComparing,
    naming,
    setNaming,
    kept,
    keptShown,
    compare,
    plans,
    planId,
    selectedPlan,
    activePlan,
    drift,
    worldUnknown,
    gone,
    stranded,
    strandedAt,
    strandedMove,
    shown,
    suggestions,
    gyms,
    fillsFirst,
    gymShort,
    weekendById,
    unitByKey,
    blocks,
    ask,
    statusOf,
    blockRows,
    blockCounts,
    whyIn,
    trayGyms,
    backupGyms,
    venueGrid,
    poolOn,
    roomsOn,
    summary,
    addable,
  } = m
  const { revert, saveAsNew, savePlan, activatePlan } = planDocs
  const {
    endMoveMarks,
    undoMove,
    move,
    removeUnit,
    switchGym,
    moveBlock,
    moveSection,
    armSection,
    placeVenue,
    fillFromPool,
    onDrop,
    onDropVenue,
    onDropSection,
    draw,
    redraw,
    runLever,
    splitAxesFor,
    correctCourts,
    addWeekend,
    previewHours,
    applyHours,
    jumpToWeekend,
    gradeList,
  } = verbs

  if (!board) {
    return <p className="text-ink-500 p-6 text-sm">{error ?? "Working out your calendar…"}</p>
  }

  const pill = summary ? headerPill(summary) : null
  const interactive = !locked
  /** The strip can show the calendar the league KEPT, which is read only and
   *  is not what the levers, the suggestions or Keep act on. */
  const showingKept = view === "strip" && side === "kept" && kept !== null

  /** The weekend the operator is standing inside, if any. Zoom is a board
   *  altitude, so the strip never has one. */
  const zoomWeekend =
    view === "board" && zoomSession ? (weekendById.get(zoomSession) ?? null) : null

  return (
    <div
      className="border-ink-100 shadow-soft overflow-hidden rounded-2xl border bg-white"
      /**
       * ANY interaction with the board ends the last move's marks, and it has to
       * be seen BEFORE the thing that was touched gets to act (owner re-ruling
       * 2026-08-05, #2). Capture does that: the marks clear, then the handler
       * runs, so a click that starts a new move writes its own marks over the
       * cleared ones and every other click simply puts them out.
       */
      onClickCapture={endMoveMarks}
      onKeyDownCapture={endMoveMarks}
      onDragStartCapture={endMoveMarks}
      onClick={() => {
        setArmed(null)
        setArmedVenue(null)
        setArmedBlock(null)
        setArmedSection(null)
      }}
    >
      {/* Screen head */}
      <BoardHead
        planId={planId}
        dirty={dirty}
        interactive={interactive}
        locked={locked}
        busy={busy}
        view={view}
        pill={pill}
        selectedPlan={selectedPlan}
        undoStack={undoStack}
        worldUsable={worldUsable}
        onUndo={undoMove}
        onRedraw={redraw}
        onViewChange={(next) => {
          setView(next)
          setArmed(null)
        }}
      />

      <div className="p-5">
        {locked && (
          <p className="border-gold-200 bg-gold-50 text-gold-900 mb-4 rounded-xl border px-4 py-2.5 text-sm">
            This season is finalized, so the calendar is read only now.
          </p>
        )}
        {error && (
          <p className="border-hoop-200 bg-hoop-50 text-hoop-900 mb-4 rounded-xl border px-4 py-2.5 text-sm">
            {error}
          </p>
        )}
        {compare && !error && (
          <div
            className="border-gold-400 bg-gold-50 mb-4 rounded-xl border px-4 py-2.5"
            aria-live="polite"
            data-testid="compare-banner"
          >
            <p className="text-ink-900 text-sm font-semibold">{compare.line}</p>
            <p className="text-ink-500 mt-0.5 text-xs">{COPY.compareLegend}</p>
          </div>
        )}
        {notice && !error && !compare && (
          <p
            className="border-court-200 bg-court-50 text-court-900 mb-4 rounded-xl border px-4 py-2.5 text-sm"
            data-testid="board-notice"
            aria-live="polite"
          >
            {notice}
          </p>
        )}
        {board.errors.length > 0 && (
          <p className="text-ink-500 mb-4 text-xs">{board.errors.join(" · ")}</p>
        )}

        {!planId ? (
          /* NOTHING OPEN (owner ruling 2026-08-05, #2). A visit that has not
             chosen a plan gets the chooser, not the league's imported
             calendar quietly loaded under its hands. */
          <PlanEmptyState locked={locked} busy={busy !== null} />
        ) : board.windows.length === 0 ? (
          <p className="border-ink-200 text-ink-500 rounded-xl border border-dashed px-4 py-6 text-center text-sm">
            This season has no weekends yet. Add them in step 2 and the calendar builds itself here.
          </p>
        ) : (
          <>
            <ArmedLines
              armed={armed}
              armedVenue={armedVenue}
              armedBlock={armedBlock}
              armedSection={armedSection}
              gymShort={gymShort}
              gradeList={gradeList}
            />

            {/* AN EMPTY CALENDAR LEADS WITH THE BUTTON (owner ruling 2026-08-05,
                #1). A plan with weekends and gym time is one tap from its
                calendar, so the board says so in the middle of the screen instead
                of leaving five empty months and a row of quiet links. A plan with
                no world to solve in points at the step that gives it one. */}
            {calendarEmpty && interactive && !showingKept && (
              <DrawHero
                usable={worldUsable}
                busy={busy !== null}
                onDraw={() => draw(COPY.drawn)}
                onGoToStep={onGoToStep}
              />
            )}

            <StrandedBanner
              stranded={stranded}
              interactive={interactive}
              busy={busy}
              strandedMove={strandedMove}
              onResolve={() => draw(COPY.resolved, "redrawing the calendar")}
              onMoveStranded={() =>
                strandedMove &&
                moveBlock(strandedMove.unitKeys, strandedMove.fromSessionId, strandedMove.to.sessionId)
              }
            />

            {/* The world this plan was saved in, where it is not the world the
                season is in now. Above the calendar, because it is a fact about
                every number below it. */}
            <DriftLine drift={drift} unknown={worldUnknown} onPlanWorld={onPlanWorld} />

            {/* The colour key for the whole step, above the calendar in both
                views: which gym is which colour, in full names. */}
            <GymLegend
              order={gyms.order}
              hue={gyms.hue}
              fillsFirst={fillsFirst}
              backup={backupGyms}
            />

            {/* WHO CHOOSES THE RENTED GYMS (owner ruling 2026-08-03). Two modes,
                above the board, because the answer changes what the board is
                for: reading the pool's answer, or placing gyms yourself. */}
            {view === "board" && interactive && !showingKept && (
              <div className="mb-2.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Segmented
                    label="How rented gyms get chosen"
                    value={assignMode}
                    testId="assign-mode"
                    options={[
                      { value: "solve" as const, label: "Assign gyms for me" },
                      { value: "place" as const, label: "I will place them" },
                    ]}
                    onChange={(next) => {
                      setAssignMode(next)
                      setArmed(null)
                      setArmedVenue(null)
                    }}
                  />
                  {assignMode === "solve" && (
                    <button
                      type="button"
                      data-testid="assign-from-pool"
                      disabled={busy !== null}
                      onClick={(e) => {
                        e.stopPropagation()
                        fillFromPool()
                      }}
                      className="border-play-600 bg-play-600 hover:bg-play-700 inline-flex min-h-[36px] cursor-pointer items-center rounded-lg border px-3 text-xs font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Fill the gaps from my pool
                    </button>
                  )}
                  <span className="text-ink-400 text-[11.5px]">
                    {assignMode === "solve" ? COPY.assignSolve : COPY.assignPlace}
                  </span>
                </div>
                {/**
                 * THE TRAY IS ALWAYS THERE (owner ruling 2026-08-05, the tray
                 * regression). It used to be drawn only in "I will place them"
                 * mode, and when the compact-first pass made "Assign gyms for
                 * me" the default the pool simply vanished from the board — an
                 * operator could not see which gyms they had to rent, let alone
                 * pick one up, without first finding a mode switch.
                 *
                 * So it is rendered whenever a plan is open on the board. The
                 * mode still says who CHOOSES by default; picking a gym up is a
                 * decision the operator is allowed to make either way, and doing
                 * so arms the drop targets (see `placing`).
                 */}
                <VenueTray
                  gyms={trayGyms}
                  hue={gyms.hue}
                  armedVenueId={armedVenue}
                  onArm={setArmedVenue}
                />
              </div>
            )}

            {/**
             * THE STAGE AND THE RAIL (owner ruling 2026-08-04). The calendar
             * scrolls sideways under a column that does not move: what is left
             * to do is the one thing an operator should never have to go and
             * find, so it stays on screen at every altitude and every scroll
             * position.
             *
             * The rail is sticky against the PAGE, which is why the full-bleed
             * stage takes overflow-x: clip off <main> rather than hidden: a
             * scroll container that never scrolls kills sticky outright.
             */}
            <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-w-0">
                {view === "board" ? (
                  zoomWeekend ? (
                    <WeekendZoom
                      weekend={zoomWeekend}
                      units={board.units}
                      keys={assignment[zoomWeekend.sessionId] ?? []}
                      playsIn={shown.venues[zoomWeekend.sessionId] ?? {}}
                      whyIn={whyIn[zoomWeekend.sessionId] ?? {}}
                      cameFrom={shown.homes[zoomWeekend.sessionId] ?? {}}
                      blocks={blocks.filter((b) => b.sessionId === zoomWeekend.sessionId)}
                      statusOf={statusOf}
                      unitByKey={unitByKey}
                      hue={gyms.hue}
                      courtCaps={courtCaps}
                      interactive={interactive}
                      onBack={() => setZoomSession(null)}
                      onCorrectCourts={correctCourts}
                      splitAxesFor={splitAxesFor}
                    />
                  ) : (
                    <BoardView
                      state={board}
                      assignment={assignment}
                      playsIn={shown.venues}
                      whyIn={whyIn}
                      cameFrom={shown.homes}
                      blocks={blocks}
                      statusOf={statusOf}
                      unitByKey={unitByKey}
                      hue={gyms.hue}
                      armed={armed}
                      // A gym picked up from the tray is a decision, whichever
                      // mode the board is in: the sections become drop targets
                      // for as long as one is armed.
                      armedVenue={armedVenue}
                      armedBlock={armedBlock}
                      armedSection={armedSection}
                      placing={interactive && (assignMode === "place" || armedVenue !== null)}
                      interactive={interactive}
                      scrollRef={boardScroll}
                      flashSessions={flashSessions}
                      flashUnits={flashUnits}
                      ghosts={ghosts}
                      addable={addable}
                      courtCaps={courtCaps}
                      strandedAt={strandedAt}
                      poolOn={poolOn}
                      roomsOn={roomsOn}
                      onArm={setArmed}
                      onArmBlock={setArmedBlock}
                      onArmSection={armSection}
                      onMove={move}
                      onMoveBlock={moveBlock}
                      onMoveSection={moveSection}
                      onRemove={removeUnit}
                      onSwitchGym={switchGym}
                      onDrop={onDrop}
                      onDropVenue={onDropVenue}
                      onDropSection={onDropSection}
                      onPlaceVenue={placeVenue}
                      onCorrectCourts={correctCourts}
                      onOpenWeekend={setZoomSession}
                      onAddWeekend={addWeekend}
                      splitAxesFor={splitAxesFor}
                      compare={compare}
                    />
                  )
                ) : (
                  <StripView
                    state={board}
                    shown={showingKept ? (kept ?? assignment) : assignment}
                    playsIn={showingKept ? keptShown.venues : shown.venues}
                    whyIn={showingKept ? keptShown.reasons : whyIn}
                    hasKept={Boolean(kept)}
                    side={side}
                    onSide={(next) => {
                      setSide(next)
                      setArmed(null)
                    }}
                    venueGrid={venueGrid}
                    interactive={interactive && !showingKept}
                    armed={armed}
                    onArm={setArmed}
                    onMove={move}
                  />
                )}
              </div>

              {/* The work rail, and the two things an operator reads next to
                  it: what this calendar rents, and what they have to go and
                  book. All three follow the board down the page. */}
              {!showingKept && (
                <aside
                  className="flex flex-col gap-2.5 xl:sticky xl:top-3"
                  data-testid="work-rail"
                  aria-label="What is left to do"
                >
                  <WorkRail
                    state={board}
                    assignment={gone.assignment}
                    venues={gone.venues}
                    playsIn={shown.venues}
                    suggestions={suggestions}
                    blocks={blocks}
                    blockCounts={blockCounts}
                    stranded={stranded}
                    hue={gyms.hue}
                    gymShort={gymShort}
                    // The rail critiques the plan on the board, and now the plan
                    // has a name the operator chose.
                    aboutLabel={selectedPlan?.name}
                    interactive={interactive}
                    onMove={move}
                    onJump={jumpToWeekend}
                  />
                  {/* WHAT YOU NEED TO BOOK (owner ruling 2026-08-03): the
                      season's whole off-home ask, with no dates in it, where an
                      operator picks up the phone. */}
                  {ask && blocks.length > 0 && <AskSheet ask={ask} blocks={blockRows} />}
                </aside>
              )}
            </div>

            {interactive && !showingKept && (
              <BoardTools
                showRules={showRules}
                showHours={showHours}
                onToggleRules={() => setShowRules((v) => !v)}
                onToggleHours={() => {
                  setShowHours((v) => !v)
                  setHoursChip(null)
                  setHoursPreview(null)
                  setHoursError(null)
                }}
                kept={kept}
                view={view}
                comparing={comparing}
                onToggleCompare={() => setComparing((v) => !v)}
                busy={busy}
                dirty={dirty}
                worldUsable={worldUsable}
                onPlanWorld={onPlanWorld}
                hoursChip={hoursChip}
                hoursPreview={hoursPreview}
                hoursError={hoursError}
                previewHours={previewHours}
                applyHours={applyHours}
                onCancelHours={() => {
                  setHoursChip(null)
                  setHoursPreview(null)
                }}
                runLever={runLever}
                plans={plans}
                selectedPlan={selectedPlan}
                activePlan={activePlan}
                naming={naming}
                setNaming={setNaming}
                onRevert={revert}
                onSaveNew={saveAsNew}
                onSavePlan={savePlan}
                onActivate={activatePlan}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
