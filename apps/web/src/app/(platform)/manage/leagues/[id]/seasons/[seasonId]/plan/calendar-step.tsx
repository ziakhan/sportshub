"use client"

import { AskSheet, GymList, NoticeSlot } from "./plan-ui"
import { PlanStepPointer } from "./plan-session"
import { StripView } from "./season-strip"
import type { PlanHeaderInfo } from "./teams-step"
import { PLAN_COPY } from "@/lib/scheduler/plan-documents"
import { COPY, headerPill } from "./board-shared"
import { BTN_LG, BTN_PRIMARY } from "./plan-shared"
import { useBoardState } from "./board-state"
import { useBoardPlans } from "./board-plans"
import { useBoardVerbs } from "./board-verbs"
import {
  ArmedLines,
  BoardHead,
  DrawHero,
  GradeFilter,
  StrandedBanner,
  UndoFloat,
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
 * The board is a working copy of ONE named plan, chosen in the picker.
 * WRITE-THROUGH DIED 2026-08-07 (ruling #2): saving writes to that plan's own
 * document and nowhere else, the plan the season is running included — there
 * is no more special case where saving writes straight through to the
 * season's rows. The board saves itself now (autosave, ruling #4); the league's
 * own imported calendar stays read only, its one escape "Save a copy". The
 * season only ever takes on a plan's calendar and world through the single
 * generate button (ruling #3), a separate control this step does not own.
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
 * The levers and the hours chips are DISABLED on a plan drawn in its own
 * saved world. They solve against the season as it stands, so their answer
 * would be in a different world from the board it landed on.
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
    worldGap,
    calendarEmpty,
    onPlanWorld,
    assignment,
    venues,
    undoStack,
    courtOverrides,
    placedGyms,
    dirty,
    armed,
    setArmed,
    armedVenue,
    setArmedVenue,
    armedBlock,
    setArmedBlock,
    armedSection,
    setArmedSection,
    dragging,
    setDragging,
    gradeFilter,
    gymFilter,
    filterUnits,
    highlight,
    gymHighlight,
    lensGyms,
    toggleGrade,
    toggleGym,
    clearLenses,
    zoomSession,
    setZoomSession,
    flashSessions,
    flashUnits,
    ghosts,
    boardScroll,
    locked,
    busy,
    notice,
    error,
    view,
    setView,
    side,
    setSide,
    naming,
    setNaming,
    kept,
    keptShown,
    plans,
    planId,
    session,
    openState,
    selectedPlan,
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
    hoursOn,
    summary,
    columns,
    fridayFits,
    ghostRoom,
  } = m
  // Only "save a copy" is still called from this file (owner ruling
  // 2026-08-07, #4: autosave ate the rest of the save-control row).
  // savePlan now runs only from the autosave effect inside useBoardPlans, and
  // activatePlan is kept exported there for the generate button's endpoint,
  // not called from any control here.
  const { saveAsNew, savePlan } = planDocs
  const {
    endMoveMarks,
    undoMove,
    move,
    removeUnit,
    moveBlock,
    moveSection,
    armSection,
    placeVenue,
    fillFromPool,
    onDrop,
    onDropVenue,
    onDropSection,
    draw,
    takeFriday,
    dropFriday,
    redraw,
    redrawSpread,
    splitAxesFor,
    correctCourts,
    setWeekendHours,
    dropOnGhost,
    jumpToWeekend,
    gradeList,
  } = verbs

  /**
   * A PLAN THE BOARD HAS NOT READ IS NOT DRAWN (the cold-open data-loss fix,
   * 2026-08-06).
   *
   * Choosing a plan is instant and reading it is a round trip. In between, the
   * board is still holding the SEASON's world, and drawing that under this
   * plan's name is not a slower truth, it is a different plan: the season's
   * gyms, the season's courts, the season's weekends, with the plan's name in
   * the picker above them. An operator who saved in that gap wrote the season's
   * world over their own.
   *
   * So the wait is shown instead of the board. The one that failed says so and
   * offers the read again, because the alternative is a screen that looks
   * finished and is lying.
   */
  if (openState === "opening" || openState === "unreadable") {
    const name = selectedPlan?.name ?? "that plan"
    const failed = openState === "unreadable"
    return (
      <div
        className="border-ink-100 shadow-soft rounded-2xl border bg-white px-6 py-10 text-center"
        data-testid="plan-opening"
        data-state={openState}
      >
        <p className="text-ink-900 text-[15px] font-bold">
          {failed ? PLAN_COPY.unreadable(name) : PLAN_COPY.opening(name)}
        </p>
        <p className="text-ink-500 mx-auto mt-1 max-w-md text-[12.5px]">
          {failed ? PLAN_COPY.unreadableHint : PLAN_COPY.openingHint}
        </p>
        {failed && (
          <button
            type="button"
            data-testid="plan-reopen"
            onClick={() => void session.refreshDoc()}
            disabled={session.docBusy}
            className={`${BTN_PRIMARY} ${BTN_LG} mt-3 rounded-xl`}
          >
            {PLAN_COPY.unreadableRetry}
          </button>
        )}
      </div>
    )
  }

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
        seasonId={seasonId}
        onBeforeGenerate={async () => {
          if (dirty) await savePlan()
        }}
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
        onGoToStep={onGoToStep}
        onUndo={undoMove}
        onRedraw={redraw}
        onRedrawSpread={redrawSpread}
        onFillFromPool={fillFromPool}
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
        <NoticeSlot testId="board-notice" error={error} notice={notice} className="mb-4" />
        {board.errors.length > 0 && (
          <p className="text-ink-500 mb-4 text-xs">{board.errors.join(" · ")}</p>
        )}

        {!planId ? (
          /* NOTHING OPEN (owner ruling 2026-08-05, #2; chooser rule 2026-08-06,
             B1). The board never loads the league's imported calendar under
             idle hands — and it never offers the picker either. Plans are
             chosen and made at step 1, so this points there and stops. */
          <PlanStepPointer
            detail="The calendar is a plan's own: its weekends, its gyms, its games. Open a plan and the board draws it here."
            onGoToStep={onGoToStep}
            testId="board-plan-pointer"
          />
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
                gap={worldGap}
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

            {/* ONE GYM LIST (owner ruling 2026-08-06, #1). The colour key and
                the tray were the same row twice; this is the one of them. Drag a
                card (or tap its grip) to place that gym, tap the card to
                spotlight it. Above the calendar in both views, because it is
                also the key. */}
            <GymList
              gyms={trayGyms}
              hue={gyms.hue}
              fillsFirst={fillsFirst}
              armedVenueId={armedVenue}
              lens={gymFilter}
              interactive={interactive && !showingKept}
              onArm={setArmedVenue}
              onToggleLens={toggleGym}
              onDragging={setDragging}
            />

            {/* ONE GRADE AT A TIME, WHEN YOU WANT IT (owner ruling 2026-08-05,
                #4). A lens over the calendar and nothing more: it moves no game
                and saves nothing. Board only, because the strip already reads
                one grade's season across the page by itself. */}
            {view === "board" && !zoomWeekend && (
              <GradeFilter
                units={filterUnits}
                selected={gradeFilter}
                gymsShowing={lensGyms}
                onToggle={toggleGrade}
                onClear={clearLenses}
              />
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
                      courtOverrides={courtOverrides}
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
                      // A gym picked up off the gym list arms every place it
                      // could land, for as long as it is held.
                      armedVenue={armedVenue}
                      armedBlock={armedBlock}
                      armedSection={armedSection}
                      interactive={interactive}
                      dragging={dragging}
                      highlight={highlight}
                      gymHighlight={gymHighlight}
                      scrollRef={boardScroll}
                      flashSessions={flashSessions}
                      flashUnits={flashUnits}
                      ghosts={ghosts}
                      // THE WHOLE SEASON, cards and ghost dates together (owner
                      // ruling 2026-08-06, slice B2).
                      columns={columns}
                      ghostRoom={ghostRoom}
                      gymShort={gymShort}
                      courtOverrides={courtOverrides}
                      hoursOn={hoursOn}
                      placedGyms={placedGyms}
                      strandedAt={strandedAt}
                      poolOn={poolOn}
                      roomsOn={roomsOn}
                      onArm={setArmed}
                      onArmBlock={setArmedBlock}
                      onArmSection={armSection}
                      onDragging={setDragging}
                      onMove={move}
                      onMoveBlock={moveBlock}
                      onMoveSection={moveSection}
                      onRemove={removeUnit}
                      onDrop={onDrop}
                      onDropVenue={onDropVenue}
                      onDropSection={onDropSection}
                      onPlaceVenue={placeVenue}
                      onCorrectCourts={correctCourts}
                      onSetHours={setWeekendHours}
                      onOpenWeekend={setZoomSession}
                      onGhostDrop={dropOnGhost}
                      splitAxesFor={splitAxesFor}
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
                    fridayFits={interactive ? fridayFits : []}
                    onTakeFriday={interactive ? takeFriday : undefined}
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
                busy={busy}
                dirty={dirty}
                plans={plans}
                selectedPlan={selectedPlan}
                naming={naming}
                setNaming={setNaming}
                onSaveNew={saveAsNew}
              />
            )}

            {/* ONE STEP BACK, WHEREVER THEY ARE (owner ruling 2026-08-05, #3).
                The header still carries Undo; this is the same verb, same words,
                pinned to the corner of the window so a mistaken drag four months
                across the board is never something to scroll back up for. */}
            {interactive && undoStack.length > 0 && (
              <UndoFloat
                label={undoStack[undoStack.length - 1].label}
                busy={busy !== null}
                onUndo={undoMove}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
