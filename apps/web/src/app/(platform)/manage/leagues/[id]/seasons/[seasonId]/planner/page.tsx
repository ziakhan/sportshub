import { redirect } from "next/navigation"

/**
 * The standalone planner board folded into the plan wizard (wave 3,
 * 2026-08-02): the calendar is step 3 of one flow, not a separate screen an
 * operator has to know exists. Old links and bookmarks land where the board
 * lives now. The planner API routes did not move.
 */
export default function SeasonPlannerBoardRedirect({
  params,
}: {
  params: { id: string; seasonId: string }
}) {
  redirect(`/manage/leagues/${params.id}/seasons/${params.seasonId}/plan?step=3`)
}
