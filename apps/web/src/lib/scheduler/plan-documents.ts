/**
 * Plans as documents, the pure half (owner 2026-08-02: "we can have multiple
 * plans, we can save them, we can name them, we can call one an NPH plan. We
 * should be able to go to the dropdown and choose them. When I do it fresh it
 * should be our own").
 *
 * season-plans.ts holds the server contracts and imports prisma, so step 3 —
 * a client component — cannot read a line of it. Everything the picker and the
 * save controls have to agree on lives here instead: the row shape, the quiet
 * markers a row wears, the name we suggest so nobody has to invent one, and
 * the single sentence that says where the board stands.
 */

/** A row of the dropdown: exactly what GET /api/seasons/[id]/plans returns. */
export interface PlanRow {
  id: string
  name: string
  /** "imported" is the league's own published calendar, and is read only. */
  source: string
  isActive: boolean
  updatedAt: string
}

/** The whole document, as GET /plans/[planId] hands it back. */
export interface PlanDocument extends PlanRow {
  assignment: Record<string, string[]>
  venues: Record<string, Record<string, string>>
}

/** The imported snapshot is the only record of what the league actually
 *  published, so the board reads it and never writes back onto it. */
export const isReferencePlan = (plan: Pick<PlanRow, "source"> | null | undefined): boolean =>
  plan?.source === "imported"

/**
 * The quiet words a row wears next to its name. Both are facts about the plan
 * rather than decoration: one plan drives the season, and one plan cannot be
 * written to. Everything else in the list is just a name.
 */
export function planMarkers(plan: PlanRow): string[] {
  const marks: string[] = []
  if (plan.isActive) marks.push("active")
  if (isReferencePlan(plan)) marks.push("reference")
  return marks
}

/** What the API takes, so the box can stop the operator before the server has
 *  to. */
export const PLAN_NAME_MAX = 60

/**
 * The name to put in the box: the base, or the first free number after it.
 * Saving your work should never start with inventing a word for it.
 */
export function suggestPlanName(plans: Array<Pick<PlanRow, "name">>, base = "Our plan"): string {
  const taken = new Set(plans.map((p) => p.name.trim().toLowerCase()))
  const root = (base.trim() || "Our plan").slice(0, PLAN_NAME_MAX).trim()
  if (!taken.has(root.toLowerCase())) return root
  let candidate = root
  for (let n = 2; n <= 999; n++) {
    const suffix = ` ${n}`
    candidate = `${root.slice(0, PLAN_NAME_MAX - suffix.length).trim()}${suffix}`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
  return candidate
}

/** The words the step says about plans, in one place so the picker, the save
 *  controls and the confirmations cannot drift apart. */
export const PLAN_COPY = {
  /** Said before anybody tries to save onto the reference, not after. */
  reference: "Reference plan, save changes as your own.",
  discard:
    "The board has changes you have not saved. Opening another plan throws them away. Open it anyway?",
  activate: (name: string) =>
    `Use ${name} for the season? The calendar everyone sees becomes this one.`,
  /** Under the save button, when saving writes straight through. */
  writeThrough: "This is the season's calendar, so saving updates it everywhere.",
  saveFirst: "Save your changes first.",
  /** The first plan of a season that has never kept a calendar. */
  takesOver: "Nothing runs this season yet, so this becomes its calendar.",
}

/**
 * Where the board stands, in one line: whose plan is on screen, whether it is
 * saved, and whether the season is actually running it. The old line only knew
 * "saved" and "not saved", which is now two thirds of the answer.
 */
export function planStateLine({
  selected,
  active,
  dirty,
}: {
  selected: PlanRow | null
  active: PlanRow | null
  dirty: boolean
}): string {
  if (dirty) {
    if (!selected) return "Nothing is saved until you name it and save it."
    if (isReferencePlan(selected)) return "Changes are not saved. Keep them as a plan of your own."
    return `Changes to ${selected.name} are not saved yet.`
  }
  if (!selected) return "This calendar is saved."
  if (selected.isActive) return `${selected.name} is the season's calendar.`
  if (active) return `Saved to ${selected.name}. The season still runs ${active.name}.`
  return `Saved to ${selected.name}.`
}
