"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button, PanelHeader } from "@/components/ui"

/**
 * Create divisions — the guided flow (owner rulings 2026-08-09).
 * Divisions are a SCHEDULING-time decision made from real teams, in their
 * own space: the schedule tab shows one calm card only when a grade is big
 * enough (or already split); everything else happens inside this stepped
 * dialog — grade → shape (count + names) → teams (deal randomly / move
 * manually) → review → real. Leagues that never split never see more than
 * the card, and small grades never see anything at all.
 */

interface TeamRef {
  teamId: string
  name: string
}
interface GradeState {
  ageGroup: string
  teams: number
  divisions: Array<{ id: string; name: string; teams: TeamRef[] }>
}

const SPLIT_THRESHOLD = 10

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
      ? `${splitCount} grade${splitCount === 1 ? " is" : "s are"} split into divisions; ${splittable.length - splitCount || "no"} more could be.`
      : `${splittable.length} grade${splittable.length === 1 ? " is" : "s are"} large enough to split into divisions.`

  return (
    <div className="border-ink-100 mb-4 rounded-2xl border bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <PanelHeader title="Divisions" />
          <p className="text-ink-500 -mt-2 text-xs">{sentence}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          {splitCount > 0 ? "Manage divisions" : "Create divisions"}
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

type Step = "grade" | "shape" | "teams" | "review"

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
  const [step, setStep] = useState<Step>("grade")
  const [gradeKey, setGradeKey] = useState<string | null>(null)
  const [count, setCount] = useState(2)
  const [names, setNames] = useState<string[]>([])
  /** teamId -> division index */
  const [assign, setAssign] = useState<Record<string, number>>({})
  const [scheduling, setScheduling] = useState<"LOCKED" | "PREFER" | "OPEN">("LOCKED")
  const [pooling, setPooling] = useState<"GRADE" | "DIVISION">("GRADE")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const grade = grades.find((g) => g.ageGroup === gradeKey) ?? null
  const allTeams: TeamRef[] = useMemo(
    () => (grade ? grade.divisions.flatMap((d) => d.teams) : []),
    [grade]
  )

  const startShape = (g: GradeState) => {
    setGradeKey(g.ageGroup)
    const existing = g.divisions.filter((d) => d.teams.length > 0)
    const n = Math.max(1, existing.length)
    setCount(n > 1 ? n : 2)
    setNames(
      Array.from({ length: 4 }, (_, i) =>
        existing[i]?.name ?? `${g.ageGroup} · Division ${String.fromCharCode(65 + i)}`
      )
    )
    // Current membership seeds the board.
    const seeded: Record<string, number> = {}
    existing.forEach((d, i) => {
      for (const t of d.teams) seeded[t.teamId] = Math.min(i, 3)
    })
    setAssign(seeded)
    setError(null)
    setStep("shape")
  }

  const dealRandomly = () => {
    const shuffled = [...allTeams].sort(() => Math.random() - 0.5)
    const next: Record<string, number> = {}
    shuffled.forEach((t, i) => {
      next[t.teamId] = i % count
    })
    setAssign(next)
  }

  const goTeams = () => {
    if (count === 1) {
      const next: Record<string, number> = {}
      for (const t of allTeams) next[t.teamId] = 0
      setAssign(next)
      setStep("review")
      return
    }
    // Ensure everyone has a slot in range; spill-over evens out.
    const next: Record<string, number> = {}
    let i = 0
    for (const t of allTeams) {
      const cur = assign[t.teamId]
      next[t.teamId] = cur !== undefined && cur < count ? cur : i++ % count
    }
    setAssign(next)
    setStep("teams")
  }

  const columns = useMemo(() => {
    const cols: TeamRef[][] = Array.from({ length: count }, () => [])
    for (const t of allTeams) cols[Math.min(assign[t.teamId] ?? 0, count - 1)].push(t)
    for (const col of cols) col.sort((a, b) => a.name.localeCompare(b.name))
    return cols
  }, [allTeams, assign, count])

  const create = async () => {
    if (!grade) return
    setBusy(true)
    setError(null)
    const existing = grade.divisions.filter((d) => d.teams.length > 0)
    const specs = Array.from({ length: count }, (_, i) => ({
      id: existing[i]?.id ?? null,
      name: count === 1 ? grade.ageGroup : names[i],
      teamIds: columns[i]?.map((t) => t.teamId) ?? [],
    }))
    const res = await fetch(`/api/seasons/${seasonId}/divisions/formation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ageGroup: grade.ageGroup,
        divisions: specs,
        scheduling: count > 1 ? scheduling : "LOCKED",
        playoffPooling: count > 1 ? pooling : "GRADE",
      }),
    })
    const body = await res.json().catch(() => null)
    setBusy(false)
    if (!res.ok) {
      setError(body?.error ?? "That didn't save. Try again.")
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        {step === "grade" && (
          <>
            <p className="text-ink-900 text-sm font-semibold">Which grade?</p>
            <p className="text-ink-500 mt-0.5 text-xs">
              Pick the grade to split, reshuffle, or merge back to one division.
            </p>
            <div className="mt-3 space-y-1.5">
              {grades.map((g) => (
                <button
                  key={g.ageGroup}
                  type="button"
                  onClick={() => startShape(g)}
                  className="border-ink-200 hover:border-play-400 block w-full rounded-xl border px-3 py-2 text-left text-sm"
                >
                  <span className="text-ink-900 font-semibold">{g.ageGroup}</span>{" "}
                  <span className="text-ink-500 text-xs">
                    · {g.teams} teams ·{" "}
                    {g.divisions.length > 1 ? `${g.divisions.length} divisions` : "one division"}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === "shape" && grade && (
          <>
            <p className="text-ink-900 text-sm font-semibold">
              {grade.ageGroup} · {grade.teams} teams
            </p>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-ink-700">Run as</span>
              <select
                className="border-ink-200 rounded-lg border px-2 py-1"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              >
                <option value={1}>one division (merge back)</option>
                {[2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n} divisions · ~{Math.ceil(grade.teams / n)} teams each
                  </option>
                ))}
              </select>
            </label>
            {count > 1 && (
              <div className="mt-3 space-y-1.5">
                {Array.from({ length: count }, (_, i) => (
                  <input
                    key={i}
                    className="border-ink-200 w-full rounded-lg border px-2 py-1 text-sm"
                    value={names[i] ?? ""}
                    maxLength={60}
                    onChange={(e) =>
                      setNames((ns) => ns.map((n, j) => (j === i ? e.target.value : n)))
                    }
                  />
                ))}
              </div>
            )}
            {count > 1 && (
              <div className="mt-3 space-y-2 text-sm">
                <label className="block">
                  <span className="text-ink-700">In the regular season, divisions play</span>
                  <select
                    className="border-ink-200 mt-1 block w-full rounded-lg border px-2 py-1"
                    value={scheduling}
                    onChange={(e) => setScheduling(e.target.value as any)}
                  >
                    <option value="LOCKED">only within their own division</option>
                    <option value="PREFER">mostly their own division, sometimes across</option>
                    <option value="OPEN">freely across the whole grade</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-ink-700">In the playoffs</span>
                  <select
                    className="border-ink-200 mt-1 block w-full rounded-lg border px-2 py-1"
                    value={pooling}
                    onChange={(e) => setPooling(e.target.value as any)}
                  >
                    <option value="GRADE">the whole grade plays one championship, seeded together</option>
                    <option value="DIVISION">each division runs its own bracket</option>
                  </select>
                </label>
              </div>
            )}
            <div className="mt-4 flex justify-between">
              <Button size="sm" variant="secondary" onClick={() => setStep("grade")}>
                Back
              </Button>
              <Button size="sm" onClick={goTeams}>
                Next
              </Button>
            </div>
          </>
        )}

        {step === "teams" && grade && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-ink-900 text-sm font-semibold">Who goes where?</p>
              <Button size="sm" variant="secondary" onClick={dealRandomly}>
                Deal randomly
              </Button>
            </div>
            <p className="text-ink-500 mt-0.5 text-xs">
              Deal randomly for a fair start, then move any team with its selector.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {columns.map((col, i) => (
                <div key={i} className="border-ink-100 rounded-xl border p-2">
                  <p className="text-ink-900 mb-1 text-xs font-bold">
                    {names[i]} <span className="text-ink-400 font-normal">· {col.length}</span>
                  </p>
                  <div className="space-y-1">
                    {col.map((t) => (
                      <div key={t.teamId} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-ink-700 truncate">{t.name}</span>
                        <select
                          aria-label={`Division for ${t.name}`}
                          className="border-ink-200 rounded border px-1 py-0.5 text-[11px]"
                          value={assign[t.teamId] ?? i}
                          onChange={(e) =>
                            setAssign((a) => ({ ...a, [t.teamId]: Number(e.target.value) }))
                          }
                        >
                          {Array.from({ length: count }, (_, j) => (
                            <option key={j} value={j}>
                              {String.fromCharCode(65 + j)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between">
              <Button size="sm" variant="secondary" onClick={() => setStep("shape")}>
                Back
              </Button>
              <Button size="sm" onClick={() => setStep("review")} disabled={columns.some((c) => c.length < 2)}>
                Next
              </Button>
            </div>
            {columns.some((c) => c.length < 2) && (
              <p className="text-hoop-700 mt-2 text-xs">Every division needs at least 2 teams.</p>
            )}
          </>
        )}

        {step === "review" && grade && (
          <>
            <p className="text-ink-900 text-sm font-semibold">Ready to apply</p>
            <p className="text-ink-700 mt-1 text-sm">
              {count === 1
                ? `${grade.ageGroup} merges back to one division of ${grade.teams} teams.`
                : `${grade.ageGroup} becomes ${count} divisions: ${columns
                    .map((c, i) => `${names[i]} (${c.length})`)
                    .join(", ")}.`}
            </p>
            <p className="text-ink-500 mt-1 text-xs">
              This takes effect now — standings, scheduling, and playoffs follow it. Regenerate the
              schedule afterwards to rebuild games around the new divisions.
            </p>
            {error && <p className="text-hoop-700 mt-2 text-xs font-semibold">{error}</p>}
            <div className="mt-4 flex justify-between">
              <Button size="sm" variant="secondary" onClick={() => setStep(count === 1 ? "shape" : "teams")}>
                Back
              </Button>
              <Button size="sm" onClick={() => void create()} disabled={busy}>
                {busy ? "Applying…" : count === 1 ? "Merge to one division" : "Create divisions"}
              </Button>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={onClose}
          className="text-ink-400 hover:text-ink-600 mt-3 text-xs"
        >
          Close without saving
        </button>
      </div>
    </div>
  )
}
