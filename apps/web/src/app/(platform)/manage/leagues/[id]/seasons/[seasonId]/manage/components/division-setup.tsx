"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { Button, PanelHeader } from "@/components/ui"

/**
 * Divisions — final design (docs/roadmap/divisions-lifecycle-design-2026-08-09.md).
 *
 * The card is a list of grade rows. Two doors that never overlap:
 * - SET UP (unsplit grades only): checkbox the grades → walk them one at a
 *   time — shape → placement → drag board → ONE yes/no question.
 * - MANAGE (per split grade, its own button): the board seeded with
 *   today's divisions, inline rename, add/remove, merge at the bottom.
 * Team placement is always DRAG AND DROP; nothing is ever created
 * automatically; playoff questions live on the Playoffs tab, not here.
 * Once the schedule is published, divisions LOCK (owner ruling) — new
 * teams join an existing division.
 * Dialogs portal to <body> and anchor near the viewport top (fe910b7).
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

const SPLIT_MIN = 6
const MAX_DIVISIONS = 6

/** "Grade 7 Boys · ARETE" → "Grade 7 Boys" — the grade's plain name. */
const baseNameOf = (g: GradeState): string => {
  const n = g.divisions[0]?.name ?? g.ageGroup
  return n.includes(" · ") ? n.split(" · ")[0] : n
}

/** Division identity colors — the same dot follows a division into Team
 *  Check and the playoff cards (design §3). Cycle of four brand hues. */
const DIV_COLORS = [
  { dot: "bg-play-500", head: "bg-play-50 text-play-800 border-play-200" },
  { dot: "bg-court-500", head: "bg-court-50 text-court-800 border-court-200" },
  { dot: "bg-gold-500", head: "bg-gold-50 text-gold-800 border-gold-200" },
  { dot: "bg-hoop-500", head: "bg-hoop-50 text-hoop-800 border-hoop-200" },
]
const colorFor = (i: number) => DIV_COLORS[i % DIV_COLORS.length]

/** Live name editing (owner 2026-08-10, the Google-doc rule): click the
 *  pencil, type, step away — saved. No save button anywhere. */
function InlineName({
  name,
  short,
  onSave,
}: {
  name: string
  short: string
  onSave: (next: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  if (!editing) {
    return (
      <>
        {short}
        <button
          type="button"
          aria-label={`Rename ${name}`}
          title="Rename"
          onClick={() => {
            setValue(name)
            setEditing(true)
          }}
          className="text-ink-300 hover:text-ink-600 ml-0.5 align-middle"
        >
          ✎
        </button>
      </>
    )
  }
  return (
    <input
      autoFocus
      aria-label={`Name for ${name}`}
      className="border-play-300 rounded border bg-white px-1 py-0.5 text-xs"
      value={value}
      maxLength={60}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur()
        if (e.key === "Escape") setEditing(false)
      }}
      onBlur={async () => {
        setEditing(false)
        const next = value.trim()
        if (next && next !== name) await onSave(next)
      }}
    />
  )
}

export function DivisionSetup({
  seasonId,
  onChanged,
}: {
  seasonId: string
  onChanged: () => void
}) {
  const [grades, setGrades] = useState<GradeState[] | null>(null)
  const [locked, setLocked] = useState(false)
  const [staleGrades, setStaleGrades] = useState<string[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [setupOpen, setSetupOpen] = useState(false)
  const [manageGrade, setManageGrade] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const res = await fetch(`/api/seasons/${seasonId}/divisions/formation`)
      if (res.ok) {
        const data = await res.json()
        setGrades(data.grades ?? [])
        setLocked(!!data.locked)
        setStaleGrades(data.staleGrades ?? [])
      } else setLoadError(`the server said ${res.status}`)
    } catch {
      setLoadError("the request did not reach the server")
    }
  }, [seasonId])
  useEffect(() => {
    void load()
  }, [load])

  const split = useMemo(() => (grades ?? []).filter((g) => g.divisions.length > 1), [grades])
  const unsplit = useMemo(
    () => (grades ?? []).filter((g) => g.divisions.length <= 1 && g.teams >= SPLIT_MIN),
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
  if (!grades || (split.length === 0 && unsplit.length === 0)) return null

  const managed = manageGrade ? split.find((g) => g.ageGroup === manageGrade) : null

  return (
    <div className="border-ink-100 bg-ink-50/60 mb-4 rounded-2xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <PanelHeader title="Divisions" />
          <p className="text-ink-500 -mt-2 text-xs">
            {locked
              ? "Divisions are locked once the schedule is published. New teams join an existing division."
              : split.length > 0
                ? "Manage a grade's divisions below, any time before the schedule is published."
                : "Big grades can run as divisions. Nothing is created unless you set it up."}
          </p>
        </div>
        {!locked && unsplit.length > 0 && (
          <Button size="sm" variant="secondary" onClick={() => setSetupOpen(true)}>
            Set up divisions
          </Button>
        )}
      </div>

      {staleGrades.length > 0 && (
        <p className="border-gold-300 bg-gold-50 text-gold-800 mt-3 rounded-lg border px-2.5 py-1.5 text-xs font-semibold">
          {staleGrades.join(", ")} changed since the last schedule. Regenerate below to apply the
          new divisions.
        </p>
      )}

      {split.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {split.map((g) => (
            <div
              key={g.ageGroup}
              className="border-ink-100 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2"
            >
              <p className="text-ink-700 min-w-0 text-xs">
                <span className="text-ink-900 text-sm font-semibold">{g.ageGroup}</span>{" "}
                <span className="whitespace-nowrap">· {g.teams} teams:</span>{" "}
                {g.divisions.map((d, i) => (
                  <span key={d.id} className="mr-2 inline-flex items-center gap-1 whitespace-nowrap">
                    <span className={`inline-block h-2 w-2 rounded-full ${colorFor(i).dot}`} />
                    <InlineName
                      name={d.name}
                      short={`${d.name.replace(`${g.ageGroup} · `, "")} (${d.teams.length})`}
                      onSave={async (next) => {
                        await fetch(`/api/seasons/${seasonId}/divisions/formation`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ divisionId: d.id, name: next }),
                        })
                        await load()
                      }}
                    />
                  </span>
                ))}
              </p>
              {!locked && (
                <Button size="sm" variant="secondary" onClick={() => setManageGrade(g.ageGroup)}>
                  Manage
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {setupOpen && (
        <SetupDialog
          seasonId={seasonId}
          grades={unsplit}
          onClose={() => setSetupOpen(false)}
          onSaved={async () => {
            setSetupOpen(false)
            await load()
            onChanged()
          }}
        />
      )}
      {managed && (
        <ManageDialog
          seasonId={seasonId}
          grade={managed}
          onClose={() => setManageGrade(null)}
          onSaved={async () => {
            setManageGrade(null)
            await load()
            onChanged()
          }}
        />
      )}
    </div>
  )
}

/* ------------------------------ shared pieces ------------------------------ */

function useBoard(allTeams: TeamRef[]) {
  /** teamId -> division index, or null while in the unassigned pool. */
  const [assign, setAssign] = useState<Record<string, number | null>>({})
  const [hoverCol, setHoverCol] = useState<number | "pool" | null>(null)

  const dealRandomly = (count: number) => {
    const shuffled = [...allTeams].sort(() => Math.random() - 0.5)
    const next: Record<string, number | null> = {}
    shuffled.forEach((t, i) => {
      next[t.teamId] = i % count
    })
    setAssign(next)
  }
  const clearAll = () => {
    const next: Record<string, number | null> = {}
    for (const t of allTeams) next[t.teamId] = null
    setAssign(next)
  }
  return { assign, setAssign, hoverCol, setHoverCol, dealRandomly, clearAll }
}

function Board({
  teams,
  count,
  names,
  onRename,
  assign,
  setAssign,
  hoverCol,
  setHoverCol,
  onRemoveColumn,
}: {
  teams: TeamRef[]
  count: number
  names: string[]
  /** Present = names editable inline (Manage). */
  onRename?: (i: number, name: string) => void
  assign: Record<string, number | null>
  setAssign: (fn: (a: Record<string, number | null>) => Record<string, number | null>) => void
  hoverCol: number | "pool" | null
  setHoverCol: (v: number | "pool" | null) => void
  /** Present = empty columns removable (Manage). */
  onRemoveColumn?: (i: number) => void
}) {
  const pool = teams.filter((t) => assign[t.teamId] == null)
  const columns = useMemo(() => {
    const cols: TeamRef[][] = Array.from({ length: count }, () => [])
    for (const t of teams) {
      const c = assign[t.teamId]
      if (c != null && c < count) cols[c].push(t)
    }
    return cols
  }, [teams, assign, count])

  const dropTo = (target: number | "pool") => (e: React.DragEvent) => {
    e.preventDefault()
    const teamId = e.dataTransfer.getData("text/plain")
    if (!teamId) return
    setAssign((a) => ({ ...a, [teamId]: target === "pool" ? null : target }))
    setHoverCol(null)
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

  const shell = (target: number | "pool", body: React.ReactNode) => (
    <div
      key={String(target)}
      data-testid={`division-col-${target}`}
      onDragOver={(e) => {
        e.preventDefault()
        if (hoverCol !== target) setHoverCol(target)
      }}
      onDrop={dropTo(target)}
      className={`min-h-[7rem] rounded-xl border transition-colors ${
        hoverCol === target
          ? "border-play-400 bg-play-100"
          : target === "pool"
            ? "border-ink-300 bg-ink-50 border-dashed"
            : "border-ink-200 bg-ink-50"
      }`}
    >
      {body}
    </div>
  )

  return (
    <div
      className="mt-2 grid gap-2"
      style={{ gridTemplateColumns: `repeat(${count + 1}, minmax(0, 1fr))` }}
    >
      {shell(
        "pool",
        <div className="p-2">
          <p className="text-ink-700 mb-1.5 text-xs font-bold">
            Unassigned <span className="text-ink-400 font-normal">· {pool.length}</span>
          </p>
          {pool.length === 0 ? (
            <p className="text-ink-400 text-[11px]">Drag a team here to take it out.</p>
          ) : (
            <div className="space-y-1">{pool.map(chip)}</div>
          )}
        </div>
      )}
      {columns.map((col, i) =>
        shell(
          i,
          <div>
            <div
              className={`flex items-center gap-1.5 rounded-t-xl border-b px-2 py-1.5 ${colorFor(i).head}`}
            >
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${colorFor(i).dot}`} />
              {onRename ? (
                <input
                  aria-label={`Division ${i + 1} name`}
                  className="w-full min-w-0 bg-transparent text-xs font-bold outline-none"
                  value={names[i] ?? ""}
                  maxLength={60}
                  onChange={(e) => onRename(i, e.target.value)}
                />
              ) : (
                <span className="truncate text-xs font-bold">{names[i]}</span>
              )}
              <span className="ml-auto text-[11px] font-semibold opacity-70">{col.length}</span>
              {onRemoveColumn && col.length === 0 && count > 2 && (
                <button
                  type="button"
                  aria-label={`Remove ${names[i]}`}
                  onClick={() => onRemoveColumn(i)}
                  className="text-[11px] font-bold opacity-60 hover:opacity-100"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="space-y-1 p-2">{col.map(chip)}</div>
          </div>
        )
      )}
    </div>
  )
}

function CrossPlayChoice({
  value,
  onChange,
}: {
  value: "NO" | "YES"
  onChange: (v: "NO" | "YES") => void
}) {
  return (
    <>
      <p className="text-ink-800 mt-4 text-sm font-semibold">
        In the regular season, do divisions play each other?
      </p>
      <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
        {(
          [
            {
              v: "NO" as const,
              label: "No, they keep to themselves",
              hint: "Each division gets its own schedule.",
            },
            {
              v: "YES" as const,
              label: "Yes, they can mix",
              hint: "Same-division games lean first; crossing fills the rest (how NPH runs it).",
            },
          ] as const
        ).map((c) => (
          <button
            key={c.v}
            type="button"
            onClick={() => onChange(c.v)}
            aria-pressed={value === c.v}
            className={`rounded-xl border px-3 py-2 text-left ${
              value === c.v ? "border-play-600 bg-play-50" : "border-ink-200 bg-ink-50"
            }`}
          >
            <span className="text-ink-900 block text-xs font-semibold">{c.label}</span>
            <span className="text-ink-500 block text-[11px]">{c.hint}</span>
          </button>
        ))}
      </div>
    </>
  )
}

function Overlay({ wide, children }: { wide: boolean; children: React.ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40" role="dialog" aria-modal="true">
      <div className="flex min-h-full items-start justify-center p-4 pt-[6vh]">
        <div className={`w-full rounded-2xl bg-white p-5 shadow-xl ${wide ? "max-w-5xl" : "max-w-lg"}`}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}

const postFormation = async (
  seasonId: string,
  ageGroup: string,
  specs: Array<{ id: string | null; name: string; teamIds: string[] }>,
  crossPlay: "NO" | "YES"
): Promise<string | null> => {
  const res = await fetch(`/api/seasons/${seasonId}/divisions/formation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ageGroup,
      divisions: specs,
      scheduling: specs.length > 1 ? (crossPlay === "YES" ? "PREFER" : "LOCKED") : "LOCKED",
    }),
  })
  if (res.ok) return null
  const body = await res.json().catch(() => null)
  return body?.error ?? "That didn't save. Try again."
}

/* ------------------------------- SETUP (new) ------------------------------- */

function SetupDialog({
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
  const [step, setStep] = useState<"pick" | "grade" | "done">("pick")
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [queue, setQueue] = useState<string[]>([])
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<"shape" | "board">("shape")
  const [count, setCount] = useState(2)
  const [names, setNames] = useState<string[]>([])
  const [crossPlay, setCrossPlay] = useState<"NO" | "YES">("NO")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string[]>([])

  const grade = grades.find((g) => g.ageGroup === queue[idx]) ?? null
  const allTeams = useMemo(
    () =>
      (grade ? grade.divisions.flatMap((d) => d.teams) : []).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    [grade]
  )
  const board = useBoard(allTeams)

  const beginGrade = (g: GradeState) => {
    setCount(2)
    setNames(
      Array.from({ length: MAX_DIVISIONS }, (_, i) => `${baseNameOf(g)} · Division ${String.fromCharCode(65 + i)}`)
    )
    setCrossPlay("NO")
    board.setAssign(() => ({}))
    setError(null)
    setPhase("shape")
  }

  const startQueue = () => {
    const q = grades.filter((g) => checked[g.ageGroup]).map((g) => g.ageGroup)
    if (q.length === 0) return
    setQueue(q)
    setIdx(0)
    setDone([])
    beginGrade(grades.find((g) => g.ageGroup === q[0])!)
    setStep("grade")
  }

  const columnsOf = () => {
    const cols: TeamRef[][] = Array.from({ length: count }, () => [])
    for (const t of allTeams) {
      const c = board.assign[t.teamId]
      if (c != null && c < count) cols[c].push(t)
    }
    return cols
  }
  const pool = allTeams.filter((t) => board.assign[t.teamId] == null)
  const short = columnsOf()
    .map((c, i) => ({ i, n: c.length }))
    .filter((c) => c.n < 2)
  const ready = pool.length === 0 && short.length === 0

  const create = async () => {
    if (!grade) return
    setBusy(true)
    setError(null)
    const cols = columnsOf()
    const err = await postFormation(
      seasonId,
      grade.ageGroup,
      Array.from({ length: count }, (_, i) => ({
        id: i === 0 ? (grade.divisions[0]?.id ?? null) : null,
        name: names[i],
        teamIds: cols[i].map((t) => t.teamId),
      })),
      crossPlay
    )
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    const line = `${grade.ageGroup} → ${count} divisions: ${cols.map((c, i) => `${names[i].replace(`${grade.ageGroup} · `, "")} (${c.length})`).join(", ")}`
    setDone((d) => [...d, line])
    if (idx + 1 < queue.length) {
      const next = grades.find((g) => g.ageGroup === queue[idx + 1])!
      setIdx(idx + 1)
      beginGrade(next)
    } else {
      setStep("done")
    }
  }

  return (
    <Overlay wide={step === "grade" && phase === "board"}>
      {step === "pick" && (
        <>
          <p className="text-ink-900 text-sm font-semibold">Create divisions for teams</p>
          <p className="text-ink-500 mt-0.5 text-xs">
            Choose the grades to set up; you&apos;ll walk through them one at a time. Nothing is
            created until you finish a grade.
          </p>
          <div className="mt-3 space-y-1.5">
            {grades.map((g) => (
              <label
                key={g.ageGroup}
                className="border-ink-200 bg-ink-50 hover:border-play-400 flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm"
              >
                <input
                  type="checkbox"
                  checked={!!checked[g.ageGroup]}
                  onChange={(e) => setChecked((c) => ({ ...c, [g.ageGroup]: e.target.checked }))}
                />
                <span>
                  <span className="text-ink-900 font-semibold">{g.ageGroup}</span>{" "}
                  <span className="text-ink-500 text-xs">· {g.teams} teams, one group today</span>
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

          {phase === "shape" && (
            <>
              <p className="text-ink-800 mt-3 text-sm font-semibold">How many divisions?</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {[2, 3, 4, 5, 6]
                  .filter((n) => n * 2 <= grade.teams)
                  .map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCount(n)}
                      aria-pressed={count === n}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                        count === n
                          ? "border-play-600 bg-play-600 text-white"
                          : "border-ink-200 text-ink-700 bg-ink-50"
                      }`}
                    >
                      {n} <span className="font-normal">· ~{Math.ceil(grade.teams / n)} each</span>
                    </button>
                  ))}
              </div>
              <p className="text-ink-800 mt-3 text-sm font-semibold">Named</p>
              <div className="mt-1.5 space-y-1.5">
                {Array.from({ length: count }, (_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${colorFor(i).dot}`} />
                    <input
                      aria-label={`Division ${i + 1} name`}
                      className="border-ink-200 bg-ink-50 w-full rounded-lg border px-2 py-1 text-sm"
                      value={names[i] ?? ""}
                      maxLength={60}
                      onChange={(e) => setNames((ns) => ns.map((n, j) => (j === i ? e.target.value : n)))}
                    />
                  </div>
                ))}
              </div>
              <p className="text-ink-800 mt-4 text-sm font-semibold">Who goes where?</p>
              <div className="mt-1.5 space-y-1.5">
                <button
                  type="button"
                  onClick={() => {
                    board.dealRandomly(count)
                    setPhase("board")
                  }}
                  className="border-ink-200 bg-ink-50 hover:border-play-400 block w-full rounded-xl border px-3 py-2 text-left text-sm"
                >
                  <span className="text-ink-900 font-semibold">Deal randomly</span>
                  <span className="text-ink-500 block text-xs">
                    An even split to start from. You can still drag anyone anywhere.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    board.clearAll()
                    setPhase("board")
                  }}
                  className="border-ink-200 bg-ink-50 hover:border-play-400 block w-full rounded-xl border px-3 py-2 text-left text-sm"
                >
                  <span className="text-ink-900 font-semibold">I&apos;ll place them myself</span>
                  <span className="text-ink-500 block text-xs">
                    Everyone starts unassigned; drag each team into a division.
                  </span>
                </button>
              </div>
            </>
          )}

          {phase === "board" && (
            <>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-ink-500 text-xs">
                  Drag teams between the pool and the divisions, any direction.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => board.dealRandomly(count)}>
                    Deal randomly
                  </Button>
                  <Button size="sm" variant="secondary" onClick={board.clearAll}>
                    Clear all
                  </Button>
                </div>
              </div>
              <Board
                teams={allTeams}
                count={count}
                names={names}
                assign={board.assign}
                setAssign={board.setAssign}
                hoverCol={board.hoverCol}
                setHoverCol={board.setHoverCol}
              />
              <CrossPlayChoice value={crossPlay} onChange={setCrossPlay} />
              {!ready && (
                <p className="text-hoop-700 mt-3 text-xs">
                  {pool.length > 0
                    ? `${pool.length} team${pool.length === 1 ? " is" : "s are"} still unassigned.`
                    : `${short.map((c) => names[c.i]).join(" and ")} need${short.length === 1 ? "s" : ""} at least 2 teams.`}
                </p>
              )}
              {error && <p className="text-hoop-700 mt-2 text-xs font-semibold">{error}</p>}
              <div className="mt-4 flex justify-between">
                <Button size="sm" variant="secondary" onClick={() => setPhase("shape")}>
                  Back
                </Button>
                <Button size="sm" onClick={() => void create()} disabled={busy || !ready}>
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
            {done.map((l, i) => (
              <li key={i}>✓ {l}</li>
            ))}
          </ul>
          <p className="text-ink-500 mt-2 text-xs">
            Generate the schedule to build games around the new divisions. Playoff choices live on
            the Playoffs tab when the season is ending.
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
    </Overlay>
  )
}

/* --------------------------- MANAGE (existing) ---------------------------- */

function ManageDialog({
  seasonId,
  grade,
  onClose,
  onSaved,
}: {
  seasonId: string
  grade: GradeState
  onClose: () => void
  onSaved: () => void
}) {
  const existing = useMemo(() => grade.divisions.filter((d) => d.teams.length > 0), [grade])
  const allTeams = useMemo(
    () => grade.divisions.flatMap((d) => d.teams).sort((a, b) => a.name.localeCompare(b.name)),
    [grade]
  )
  const [count, setCount] = useState(existing.length)
  const [names, setNames] = useState<string[]>(() =>
    Array.from(
      { length: MAX_DIVISIONS },
      (_, i) => existing[i]?.name ?? `${baseNameOf(grade)} · Division ${String.fromCharCode(65 + i)}`
    )
  )
  const board = useBoard(allTeams)
  const [seeded, setSeeded] = useState(false)
  const [crossPlay, setCrossPlay] = useState<"NO" | "YES">(
    (grade.scheduling ?? "LOCKED") === "LOCKED" ? "NO" : "YES"
  )
  const [merging, setMerging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (seeded) return
    const a: Record<string, number | null> = {}
    existing.forEach((d, i) => {
      for (const t of d.teams) a[t.teamId] = i
    })
    board.setAssign(() => a)
    setSeeded(true)
  }, [existing, seeded, board])

  const columnsOf = () => {
    const cols: TeamRef[][] = Array.from({ length: count }, () => [])
    for (const t of allTeams) {
      const c = board.assign[t.teamId]
      if (c != null && c < count) cols[c].push(t)
    }
    return cols
  }
  const pool = allTeams.filter((t) => board.assign[t.teamId] == null)
  const short = columnsOf()
    .map((c, i) => ({ i, n: c.length }))
    .filter((c) => c.n < 2)
  const ready = pool.length === 0 && short.length === 0

  const removeColumn = (i: number) => {
    setCount((c) => c - 1)
    setNames((ns) => [...ns.slice(0, i), ...ns.slice(i + 1), `${baseNameOf(grade)} · Division ${String.fromCharCode(65 + MAX_DIVISIONS - 1)}`])
    board.setAssign((a) => {
      const next: Record<string, number | null> = {}
      for (const [tid, c] of Object.entries(a)) {
        next[tid] = c == null ? null : c === i ? null : c > i ? c - 1 : c
      }
      return next
    })
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    const cols = columnsOf()
    const err = await postFormation(
      seasonId,
      grade.ageGroup,
      Array.from({ length: count }, (_, i) => ({
        id: existing[i]?.id ?? null,
        name: names[i],
        teamIds: cols[i].map((t) => t.teamId),
      })),
      crossPlay
    )
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    onSaved()
  }

  const merge = async () => {
    setBusy(true)
    setError(null)
    const err = await postFormation(
      seasonId,
      grade.ageGroup,
      [{ id: existing[0]?.id ?? null, name: baseNameOf(grade), teamIds: allTeams.map((t) => t.teamId) }],
      "NO"
    )
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    onSaved()
  }

  return (
    <Overlay wide={!merging}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-ink-900 text-sm font-semibold">
          {grade.ageGroup} <span className="text-ink-500 font-normal">· {grade.teams} teams · manage divisions</span>
        </p>
        {!merging && (
          <div className="flex gap-2">
            {count < MAX_DIVISIONS && count < Math.floor(grade.teams / 2) && (
              <Button size="sm" variant="secondary" onClick={() => setCount((c) => c + 1)}>
                Add division
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => board.dealRandomly(count)}>
              Deal randomly
            </Button>
          </div>
        )}
      </div>

      {merging ? (
        <>
          <p className="text-ink-700 mt-3 text-sm">
            All {grade.teams} teams go back into one <b>{baseNameOf(grade)}</b> group. Standings,
            scheduling, and playoffs follow it. Generate the schedule afterwards.
          </p>
          {error && <p className="text-hoop-700 mt-2 text-xs font-semibold">{error}</p>}
          <div className="mt-4 flex justify-between">
            <Button size="sm" variant="secondary" onClick={() => setMerging(false)}>
              Back
            </Button>
            <Button size="sm" onClick={() => void merge()} disabled={busy}>
              {busy ? "Merging…" : "Merge to one group"}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-ink-500 mt-1 text-xs">
            Drag teams anywhere; rename a division right in its header. An emptied division shows ✕
            to remove it.
          </p>
          <Board
            teams={allTeams}
            count={count}
            names={names}
            onRename={(i, name) => setNames((ns) => ns.map((n, j) => (j === i ? name : n)))}
            assign={board.assign}
            setAssign={board.setAssign}
            hoverCol={board.hoverCol}
            setHoverCol={board.setHoverCol}
            onRemoveColumn={removeColumn}
          />
          <CrossPlayChoice value={crossPlay} onChange={setCrossPlay} />
          {!ready && (
            <p className="text-hoop-700 mt-3 text-xs">
              {pool.length > 0
                ? `${pool.length} team${pool.length === 1 ? " is" : "s are"} still unassigned.`
                : `${short.map((c) => names[c.i]).join(" and ")} need${short.length === 1 ? "s" : ""} at least 2 teams.`}
            </p>
          )}
          {error && <p className="text-hoop-700 mt-2 text-xs font-semibold">{error}</p>}
          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMerging(true)}
              className="text-ink-500 hover:text-ink-700 text-xs underline"
            >
              …or merge {grade.ageGroup} back to one group
            </button>
            <Button size="sm" onClick={() => void save()} disabled={busy || !ready}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={onClose}
        className="text-ink-400 hover:text-ink-600 mt-3 block text-xs"
      >
        Close without saving
      </button>
    </Overlay>
  )
}
