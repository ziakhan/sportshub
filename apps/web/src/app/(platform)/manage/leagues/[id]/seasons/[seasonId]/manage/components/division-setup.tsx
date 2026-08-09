"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { Button, PanelHeader } from "@/components/ui"

/**
 * Division setup — the guided flow (owner rulings 2026-08-09, refined same
 * day after first use):
 * - Nothing is ever created automatically. The card only OFFERS; the
 *   operator checkbox-picks which grades to set up, then walks them one at
 *   a time, step by step.
 * - Team placement is DRAG AND DROP ("the division setup box should not be
 *   a dropdown"): a pool of unassigned teams plus one column per division;
 *   teams drag pool→division, division→division, division→pool.
 * - "Deal randomly" pre-fills the same board for adjusting; "I'll place
 *   them myself" starts everyone unassigned.
 * - Only season-START questions live here (cross-division play). Playoff
 *   questions belong to the Playoffs tab when the season is ending — they
 *   were removed from this dialog by owner ruling.
 * - The dialog is PORTALED to <body>: an ancestor with a transform/filter
 *   turns position:fixed into page-relative and the box lands off-screen
 *   (the fe910b7 lesson — the owner found it centered two pages down).
 */

interface TeamRef {
  teamId: string
  name: string
}
interface GradeState {
  ageGroup: string
  teams: number
  scheduling?: "LOCKED" | "PREFER" | "OPEN"
  divisions: Array<{ id: string; name: string; teams: TeamRef[] }>
}

const SPLIT_THRESHOLD = 10

const SCHED_CHOICES: Array<{ value: "LOCKED" | "PREFER" | "OPEN"; label: string; hint: string }> = [
  {
    value: "LOCKED",
    label: "Divisions keep to themselves",
    hint: "Regular-season games stay inside each division.",
  },
  {
    value: "PREFER",
    label: "Mostly their own division",
    hint: "The schedule leans same-division but allows some crossover.",
  },
  {
    value: "OPEN",
    label: "Freely across the grade",
    hint: "Divisions are labels only; anyone can play anyone.",
  },
]

export function DivisionSetup({
  seasonId,
  onChanged,
}: {
  seasonId: string
  onChanged: () => void
}) {
  const [grades, setGrades] = useState<GradeState[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const res = await fetch(`/api/seasons/${seasonId}/divisions/formation`)
      if (res.ok) setGrades((await res.json()).grades ?? [])
      else setLoadError(`the server said ${res.status}`)
    } catch {
      setLoadError("the request did not reach the server")
    }
  }, [seasonId])
  useEffect(() => {
    void load()
  }, [load])

  const splittable = useMemo(
    () => (grades ?? []).filter((g) => g.teams >= SPLIT_THRESHOLD || g.divisions.length > 1),
    [grades]
  )
  // A failed load must say so — a silently missing card is undebuggable.
  if (loadError) {
    return (
      <div className="border-ink-100 mb-4 rounded-2xl border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <PanelHeader title="Divisions" />
            <p className="text-ink-500 -mt-2 text-xs">
              Couldn&apos;t load the division list — {loadError}.
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      </div>
    )
  }
  if (!grades || splittable.length === 0) return null

  const splitCount = splittable.filter((g) => g.divisions.length > 1).length
  const sentence =
    splitCount > 0
      ? `${splitCount} grade${splitCount === 1 ? " runs" : "s run"} as divisions today; nothing changes unless you change it.`
      : `${splittable.length} grade${splittable.length === 1 ? " has" : "s have"} enough teams to run as divisions, if you want that.`

  return (
    <div className="border-ink-100 mb-4 rounded-2xl border bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <PanelHeader title="Divisions" />
          <p className="text-ink-500 -mt-2 text-xs">{sentence}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          {splitCount > 0 ? "Manage divisions" : "Set up divisions"}
        </Button>
      </div>
      {open && (
        <DivisionDialog
          seasonId={seasonId}
          grades={splittable}
          onClose={() => setOpen(false)}
          onSaved={async () => {
            setOpen(false)
            await load()
            onChanged()
          }}
        />
      )}
    </div>
  )
}

/* ------------------------------- the dialog ------------------------------- */

type DialogStep = "pick" | "grade" | "done"
type GradeStep = "shape" | "board" | "merge"

function DivisionDialog({
  seasonId,
  grades,
  onClose,
  onSaved,
}: {
  seasonId: string
  grades: GradeState[]
  onClose: () => void
  onSaved: () => void
}) {
  const [step, setStep] = useState<DialogStep>("pick")
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [queue, setQueue] = useState<string[]>([])
  const [idx, setIdx] = useState(0)
  const [gradeStep, setGradeStep] = useState<GradeStep>("shape")
  const [count, setCount] = useState(2)
  const [names, setNames] = useState<string[]>([])
  /** teamId -> division index, or null while still in the unassigned pool. */
  const [assign, setAssign] = useState<Record<string, number | null>>({})
  const [scheduling, setScheduling] = useState<"LOCKED" | "PREFER" | "OPEN">("LOCKED")
  const [hoverCol, setHoverCol] = useState<number | "pool" | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdLines, setCreatedLines] = useState<string[]>([])

  const grade = grades.find((g) => g.ageGroup === queue[idx]) ?? null
  const allTeams: TeamRef[] = useMemo(
    () =>
      (grade ? grade.divisions.flatMap((d) => d.teams) : []).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    [grade]
  )
  const alreadySplit = (grade?.divisions.length ?? 0) > 1

  const beginGrade = (g: GradeState) => {
    const existing = g.divisions.filter((d) => d.teams.length > 0)
    const n = existing.length > 1 ? Math.min(existing.length, 4) : 2
    setCount(n)
    setNames(
      Array.from(
        { length: 4 },
        (_, i) => existing.length > 1 && existing[i]?.name
          ? existing[i].name
          : `${g.ageGroup} · Division ${String.fromCharCode(65 + i)}`
      )
    )
    if (existing.length > 1) {
      // Current membership seeds the board; the operator drags to adjust.
      const seeded: Record<string, number | null> = {}
      existing.forEach((d, i) => {
        for (const t of d.teams) seeded[t.teamId] = Math.min(i, 3)
      })
      setAssign(seeded)
    } else {
      setAssign({})
    }
    setScheduling(g.scheduling ?? "LOCKED")
    setError(null)
    setGradeStep("shape")
  }

  const startQueue = () => {
    const q = grades.filter((g) => checked[g.ageGroup]).map((g) => g.ageGroup)
    if (q.length === 0) return
    setQueue(q)
    setIdx(0)
    setCreatedLines([])
    const first = grades.find((g) => g.ageGroup === q[0])!
    beginGrade(first)
    setStep("grade")
  }

  const dealRandomly = () => {
    const shuffled = [...allTeams].sort(() => Math.random() - 0.5)
    const next: Record<string, number | null> = {}
    shuffled.forEach((t, i) => {
      next[t.teamId] = i % count
    })
    setAssign(next)
  }

  const clearBoard = () => {
    const next: Record<string, number | null> = {}
    for (const t of allTeams) next[t.teamId] = null
    setAssign(next)
  }

  /** Entering the board: anything pointing past the chosen count returns to
   *  the pool rather than being silently re-dealt. */
  const goBoard = (mode: "random" | "manual" | "keep") => {
    if (mode === "random") dealRandomly()
    else if (mode === "manual") clearBoard()
    else {
      setAssign((a) => {
        const next: Record<string, number | null> = {}
        for (const t of allTeams) {
          const cur = a[t.teamId]
          next[t.teamId] = cur != null && cur < count ? cur : null
        }
        return next
      })
    }
    setError(null)
    setGradeStep("board")
  }

  const pool = allTeams.filter((t) => assign[t.teamId] == null)
  const columns = useMemo(() => {
    const cols: TeamRef[][] = Array.from({ length: count }, () => [])
    for (const t of allTeams) {
      const c = assign[t.teamId]
      if (c != null && c < count) cols[c].push(t)
    }
    return cols
  }, [allTeams, assign, count])

  const shortColumns = columns
    .map((c, i) => ({ i, n: c.length }))
    .filter((c) => c.n < 2)
  const boardReady = pool.length === 0 && shortColumns.length === 0

  const dropTo = (target: number | "pool") => (e: React.DragEvent) => {
    e.preventDefault()
    const teamId = e.dataTransfer.getData("text/plain")
    if (!teamId) return
    setAssign((a) => ({ ...a, [teamId]: target === "pool" ? null : target }))
    setHoverCol(null)
  }

  const advance = (line: string) => {
    setCreatedLines((ls) => [...ls, line])
    if (idx + 1 < queue.length) {
      const next = grades.find((g) => g.ageGroup === queue[idx + 1])!
      setIdx(idx + 1)
      beginGrade(next)
    } else {
      setStep("done")
    }
  }

  const submit = async (specs: Array<{ id: string | null; name: string; teamIds: string[] }>, line: string) => {
    if (!grade) return
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/seasons/${seasonId}/divisions/formation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ageGroup: grade.ageGroup,
        divisions: specs,
        scheduling: specs.length > 1 ? scheduling : "LOCKED",
      }),
    })
    const body = await res.json().catch(() => null)
    setBusy(false)
    if (!res.ok) {
      setError(body?.error ?? "That didn't save. Try again.")
      return
    }
    advance(line)
  }

  const createDivisions = () => {
    if (!grade) return
    const existing = grade.divisions.filter((d) => d.teams.length > 0)
    void submit(
      Array.from({ length: count }, (_, i) => ({
        id: existing[i]?.id ?? null,
        name: names[i],
        teamIds: columns[i].map((t) => t.teamId),
      })),
      `${grade.ageGroup} → ${count} divisions: ${columns.map((c, i) => `${names[i]} (${c.length})`).join(", ")}`
    )
  }

  const mergeToOne = () => {
    if (!grade) return
    const existing = grade.divisions.filter((d) => d.teams.length > 0)
    void submit(
      [{ id: existing[0]?.id ?? null, name: grade.ageGroup, teamIds: allTeams.map((t) => t.teamId) }],
      `${grade.ageGroup} → back to one division of ${allTeams.length} teams`
    )
  }

  const chip = (t: TeamRef) => (
    <div
      key={t.teamId}
      draggable
      data-testid="team-chip"
      onDragStart={(e) => e.dataTransfer.setData("text/plain", t.teamId)}
      onDragEnd={() => setHoverCol(null)}
      title={t.name}
      className="border-ink-200 text-ink-800 cursor-grab truncate rounded-lg border bg-white px-2 py-1 text-xs shadow-sm active:cursor-grabbing"
    >
      {t.name}
    </div>
  )

  const columnShell = (
    key: string,
    target: number | "pool",
    title: string,
    items: TeamRef[],
    dashed: boolean
  ) => (
    <div
      key={key}
      data-testid={`division-col-${target}`}
      onDragOver={(e) => {
        e.preventDefault()
        if (hoverCol !== target) setHoverCol(target)
      }}
      onDrop={dropTo(target)}
      className={`min-h-[6rem] rounded-xl border p-2 transition-colors ${
        hoverCol === target
          ? "border-play-400 bg-play-50"
          : dashed
            ? "border-ink-200 bg-ink-50/50 border-dashed"
            : "border-ink-100 bg-white"
      }`}
    >
      <p className="text-ink-900 mb-1.5 text-xs font-bold">
        {title} <span className="text-ink-400 font-normal">· {items.length}</span>
      </p>
      <div className="space-y-1">{items.map(chip)}</div>
    </div>
  )

  const body = (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40" role="dialog" aria-modal="true">
      <div className="flex min-h-full items-start justify-center p-4 pt-[6vh]">
        <div
          className={`w-full rounded-2xl bg-white p-5 shadow-xl ${
            step === "grade" && gradeStep === "board" ? "max-w-5xl" : "max-w-lg"
          }`}
        >
          {step === "pick" && (
            <>
              <p className="text-ink-900 text-sm font-semibold">Divisions</p>
              <p className="text-ink-500 mt-0.5 text-xs">
                Choose the grades to set up. You&apos;ll walk through them one at a time —
                nothing is created until you finish a grade.
              </p>
              <div className="mt-3 space-y-1.5">
                {grades.map((g) => (
                  <label
                    key={g.ageGroup}
                    className="border-ink-200 hover:border-play-400 flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={!!checked[g.ageGroup]}
                      onChange={(e) =>
                        setChecked((c) => ({ ...c, [g.ageGroup]: e.target.checked }))
                      }
                    />
                    <span>
                      <span className="text-ink-900 font-semibold">{g.ageGroup}</span>{" "}
                      <span className="text-ink-500 text-xs">
                        · {g.teams} teams ·{" "}
                        {g.divisions.length > 1
                          ? `${g.divisions.length} divisions today`
                          : "one division today"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <button type="button" onClick={onClose} className="text-ink-400 hover:text-ink-600 text-xs">
                  Cancel
                </button>
                <Button size="sm" onClick={startQueue} disabled={grades.every((g) => !checked[g.ageGroup])}>
                  Set up {grades.filter((g) => checked[g.ageGroup]).length || ""}{" "}
                  {grades.filter((g) => checked[g.ageGroup]).length === 1 ? "grade" : "grades"}
                </Button>
              </div>
            </>
          )}

          {step === "grade" && grade && (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-ink-900 text-sm font-semibold">
                  {grade.ageGroup} <span className="text-ink-500 font-normal">· {grade.teams} teams</span>
                </p>
                {queue.length > 1 && (
                  <p className="text-ink-400 text-xs">
                    grade {idx + 1} of {queue.length}
                  </p>
                )}
              </div>

              {gradeStep === "shape" && (
                <>
                  <p className="text-ink-700 mt-3 text-sm font-semibold">How many divisions?</p>
                  <div className="mt-1.5 flex gap-1.5">
                    {[2, 3, 4].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setCount(n)}
                        aria-pressed={count === n}
                        className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                          count === n
                            ? "border-play-600 bg-play-600 text-white"
                            : "border-ink-200 text-ink-700 bg-white"
                        }`}
                      >
                        {n} <span className="font-normal">· ~{Math.ceil(grade.teams / n)} each</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-ink-700 mt-3 text-sm font-semibold">Named</p>
                  <div className="mt-1.5 space-y-1.5">
                    {Array.from({ length: count }, (_, i) => (
                      <input
                        key={i}
                        aria-label={`Division ${i + 1} name`}
                        className="border-ink-200 w-full rounded-lg border px-2 py-1 text-sm"
                        value={names[i] ?? ""}
                        maxLength={60}
                        onChange={(e) => setNames((ns) => ns.map((n, j) => (j === i ? e.target.value : n)))}
                      />
                    ))}
                  </div>
                  <p className="text-ink-700 mt-4 text-sm font-semibold">Who goes where?</p>
                  <div className="mt-1.5 space-y-1.5">
                    {alreadySplit && (
                      <button
                        type="button"
                        onClick={() => goBoard("keep")}
                        className="border-ink-200 hover:border-play-400 block w-full rounded-xl border px-3 py-2 text-left text-sm"
                      >
                        <span className="text-ink-900 font-semibold">Start from today&apos;s divisions</span>
                        <span className="text-ink-500 block text-xs">Drag teams around from where they are now.</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => goBoard("random")}
                      className="border-ink-200 hover:border-play-400 block w-full rounded-xl border px-3 py-2 text-left text-sm"
                    >
                      <span className="text-ink-900 font-semibold">Deal randomly</span>
                      <span className="text-ink-500 block text-xs">
                        An even split to start from — you can still drag anyone anywhere.
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => goBoard("manual")}
                      className="border-ink-200 hover:border-play-400 block w-full rounded-xl border px-3 py-2 text-left text-sm"
                    >
                      <span className="text-ink-900 font-semibold">I&apos;ll place them myself</span>
                      <span className="text-ink-500 block text-xs">
                        Everyone starts unassigned; drag each team into a division.
                      </span>
                    </button>
                  </div>
                  {alreadySplit && (
                    <button
                      type="button"
                      onClick={() => {
                        setError(null)
                        setGradeStep("merge")
                      }}
                      className="text-ink-500 hover:text-ink-700 mt-3 text-xs underline"
                    >
                      …or merge {grade.ageGroup} back to one division
                    </button>
                  )}
                </>
              )}

              {gradeStep === "merge" && (
                <>
                  <p className="text-ink-700 mt-3 text-sm">
                    All {grade.teams} teams go back into one <b>{grade.ageGroup}</b> division. Standings,
                    scheduling, and playoffs follow it.
                  </p>
                  {error && <p className="text-hoop-700 mt-2 text-xs font-semibold">{error}</p>}
                  <div className="mt-4 flex justify-between">
                    <Button size="sm" variant="secondary" onClick={() => setGradeStep("shape")}>
                      Back
                    </Button>
                    <Button size="sm" onClick={mergeToOne} disabled={busy}>
                      {busy ? "Merging…" : "Merge to one division"}
                    </Button>
                  </div>
                </>
              )}

              {gradeStep === "board" && (
                <>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-ink-500 text-xs">
                      Drag teams between the pool and the divisions — any direction.
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={dealRandomly}>
                        Deal randomly
                      </Button>
                      <Button size="sm" variant="secondary" onClick={clearBoard}>
                        Clear all
                      </Button>
                    </div>
                  </div>
                  <div
                    className="mt-2 grid gap-2"
                    style={{ gridTemplateColumns: `repeat(${count + 1}, minmax(0, 1fr))` }}
                  >
                    {columnShell("pool", "pool", "Unassigned", pool, true)}
                    {columns.map((col, i) => columnShell(`d${i}`, i, names[i], col, false))}
                  </div>

                  <p className="text-ink-700 mt-4 text-sm font-semibold">In the regular season</p>
                  <div className="mt-1.5 grid gap-1.5 sm:grid-cols-3">
                    {SCHED_CHOICES.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setScheduling(c.value)}
                        aria-pressed={scheduling === c.value}
                        className={`rounded-xl border px-3 py-2 text-left ${
                          scheduling === c.value
                            ? "border-play-600 bg-play-50"
                            : "border-ink-200 bg-white"
                        }`}
                      >
                        <span className="text-ink-900 block text-xs font-semibold">{c.label}</span>
                        <span className="text-ink-500 block text-[11px]">{c.hint}</span>
                      </button>
                    ))}
                  </div>

                  {!boardReady && (
                    <p className="text-hoop-700 mt-3 text-xs">
                      {pool.length > 0
                        ? `${pool.length} team${pool.length === 1 ? " is" : "s are"} still unassigned.`
                        : `${shortColumns.map((c) => names[c.i]).join(" and ")} need${shortColumns.length === 1 ? "s" : ""} at least 2 teams.`}
                    </p>
                  )}
                  {error && <p className="text-hoop-700 mt-2 text-xs font-semibold">{error}</p>}
                  <div className="mt-4 flex justify-between">
                    <Button size="sm" variant="secondary" onClick={() => setGradeStep("shape")}>
                      Back
                    </Button>
                    <Button size="sm" onClick={createDivisions} disabled={busy || !boardReady}>
                      {busy ? "Saving…" : `Create ${count} divisions`}
                    </Button>
                  </div>
                </>
              )}
            </>
          )}

          {step === "done" && (
            <>
              <p className="text-ink-900 text-sm font-semibold">Done</p>
              <ul className="text-ink-700 mt-2 space-y-1 text-sm">
                {createdLines.map((l, i) => (
                  <li key={i}>✓ {l}</li>
                ))}
              </ul>
              <p className="text-ink-500 mt-2 text-xs">
                Regenerate the schedule to rebuild games around the new divisions. Playoff choices
                live on the Playoffs tab when the season is ending.
              </p>
              <div className="mt-4 flex justify-end">
                <Button size="sm" onClick={onSaved}>
                  Close
                </Button>
              </div>
            </>
          )}

          {step !== "done" && (
            <button
              type="button"
              onClick={onClose}
              className="text-ink-400 hover:text-ink-600 mt-3 block text-xs"
            >
              Close without saving
            </button>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(body, document.body)
}
