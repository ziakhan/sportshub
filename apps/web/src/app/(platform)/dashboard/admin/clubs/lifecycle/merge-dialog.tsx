"use client"

import { useEffect, useState } from "react"
import { BrandCheckbox, Button } from "@/components/ui"

/**
 * The one screen where two clubs become one.
 *
 * Reached by ticking exactly two rows and pressing Merge, so there is no
 * per-row merge affordance to mis-click. Both clubs arrive as equals and the
 * direction is chosen HERE, side by side, with the evidence for choosing on
 * screen: which one holds the teams, the payments, the contact details.
 *
 * That mattered on 2026-08-15, when the old two-click flow moved 113 records,
 * 92 of them payments, onto a club that had nothing to do with them, with no
 * confirmation and no way back.
 */

type Club = { id: string; name: string; city: string | null; status: string }
type Preview = {
  source: Club
  target: Club
  moves: Array<{ label: string; count: number }>
  backwards: boolean
  bothClaimed: boolean
}

/** "5 teams", "1 camp" - plural only when it needs to be. */
function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : word.endsWith("s") ? "es" : "s"}`
}

/** "a, b and c" - a list a person would read aloud. */
function sentenceList(parts: string[]) {
  if (parts.length <= 1) return parts.join("")
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
}

function ClubPane({
  club,
  chosen,
  picked,
  onChoose,
}: {
  club: Club
  /** This club is the survivor. */
  chosen: boolean
  /** A choice has been made at all - before that, neither pane is "retired". */
  picked: boolean
  onChoose: () => void
}) {
  return (
    <button
      type="button"
      onClick={onChoose}
      aria-pressed={chosen}
      className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors duration-200 ${
        chosen
          ? "border-emerald-300 bg-emerald-50"
          : picked
            ? "border-amber-200 bg-amber-50"
            : "border-ink-200 bg-white hover:border-ink-300"
      }`}
    >
      <div
        className={`text-[11px] font-semibold uppercase tracking-wide ${
          chosen ? "text-emerald-700" : picked ? "text-amber-700" : "text-ink-500"
        }`}
      >
        {chosen ? "Keeps everything" : picked ? "Retired" : "Keep this one"}
      </div>
      <div className="text-ink-950 text-sm font-semibold">{club.name}</div>
      <div className="text-ink-600 text-xs">{club.city || "no town on file"}</div>
    </button>
  )
}

export function MergeDialog({
  clubs,
  onCancel,
  onConfirm,
  busy,
}: {
  /** Exactly the two clubs the admin ticked, in list order. */
  clubs: [Club, Club]
  onCancel: () => void
  /** Called with the chosen direction once the admin confirms. */
  onConfirm: (opts: { sourceId: string; targetId: string }) => void
  busy: boolean
}) {
  // Nothing is preselected on the strength of list order. The admin picks, and
  // the preview then says whether the pick makes sense.
  const [survivorId, setSurvivorId] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [understood, setUnderstood] = useState(false)

  const survivor = clubs.find((c) => c.id === survivorId) ?? null
  const retired = survivor ? clubs.find((c) => c.id !== survivorId)! : null

  useEffect(() => {
    if (!survivor || !retired) return
    let live = true
    setPreview(null)
    setUnderstood(false)
    setError(null)
    fetch(`/api/admin/clubs/lifecycle?preview=merge&sourceId=${retired.id}&targetId=${survivor.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!live) return
        if (d.error) setError(d.error)
        else setPreview(d)
      })
      .catch(() => live && setError("Could not work out what this merge would move"))
    return () => {
      live = false
    }
  }, [survivor?.id, retired?.id])

  // A merge carrying real records, or one that looks the wrong way round, has
  // to be said out loud before it runs.
  const heavy = !!preview && (preview.backwards || preview.moves.some((m) => m.count > 20))
  const ready = !!survivor && !!preview && (!heavy || understood)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Merge two clubs"
    >
      <div className="border-ink-100 w-full max-w-lg rounded-3xl border bg-white p-6 shadow-[0_22px_70px_-42px_rgba(15,23,42,0.45)]">
        <h3 className="text-ink-950 text-lg font-semibold">Merge these two clubs</h3>
        <p className="text-ink-600 mt-1 text-sm leading-6">
          Pick the one to keep. The other is retired and everything it holds moves across.
        </p>

        <div className="mt-4 space-y-2">
          {clubs.map((c) => (
            <ClubPane
              key={c.id}
              club={c}
              chosen={survivorId === c.id}
              picked={!!survivorId}
              onChoose={() => setSurvivorId(c.id)}
            />
          ))}
        </div>

        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        {survivorId && !preview && !error && (
          <p className="text-ink-600 mt-3 text-sm">Checking what would move…</p>
        )}

        {preview && (
          <>
            <p className="text-ink-700 mt-3 text-sm leading-6">
              {preview.moves.length === 0
                ? "Nothing is attached to the retired club, so only the listing itself goes."
                : `Moving ${sentenceList(preview.moves.map((m) => plural(m.count, m.label)))}.`}
            </p>

            {preview.backwards && (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm leading-6 text-red-800">
                <strong>This looks the wrong way round.</strong> {preview.source.name} holds all the
                activity and {preview.target.name} has none. Retiring the club with the teams and
                payments is almost never what you want. Pick the other one above, or tick below if
                you are sure.
              </p>
            )}

            {preview.bothClaimed && (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm leading-6 text-red-800">
                Both clubs are claimed. One of the two owners loses their club, so settle it with
                them before merging.
              </p>
            )}

            {heavy && (
              <div className="mt-4">
                <BrandCheckbox
                  checked={understood}
                  onChange={setUnderstood}
                  label="I have checked the direction"
                  subLabel={`${preview.source.name} is the one that should be retired.`}
                />
              </div>
            )}
          </>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="subtle" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              survivor && retired && onConfirm({ sourceId: retired.id, targetId: survivor.id })
            }
            disabled={busy || !ready}
          >
            {busy ? "Merging…" : "Merge"}
          </Button>
        </div>
      </div>
    </div>
  )
}
