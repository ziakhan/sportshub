"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * Program staff panel — the people running a camp / house league
 * (docs/roadmap/program-staff-plan.md). Club admins assign a LEAD +
 * ASSISTANTs from the club's staff pool; assigned staff get manage-lite on
 * the program. Mounted on the camp / house-league edit pages.
 */

type ProgramType = "camp" | "house-league"

interface StaffRow {
  userId: string
  name: string
  email: string
  designation: "LEAD" | "ASSISTANT"
}

interface AvailableStaff {
  userId: string
  firstName: string | null
  lastName: string | null
  email: string
}

function staffName(s: AvailableStaff): string {
  return `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || s.email
}

function DesignationChip({ designation }: { designation: "LEAD" | "ASSISTANT" }) {
  const isLead = designation === "LEAD"
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        isLead ? "bg-play-600 text-white" : "bg-ink-100 text-ink-600"
      }`}
    >
      {isLead ? "Lead" : "Assistant"}
    </span>
  )
}

export function ProgramStaffPanel({
  programType,
  programId,
  clubId,
}: {
  programType: ProgramType
  programId: string
  clubId: string
}) {
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [canManage, setCanManage] = useState(false)
  const [available, setAvailable] = useState<AvailableStaff[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState("")
  const [designation, setDesignation] = useState<"LEAD" | "ASSISTANT">("ASSISTANT")

  const staffUrl = `/api/programs/${programType}/${programId}/staff`

  const loadStaff = useCallback(async () => {
    const res = await fetch(staffUrl)
    if (!res.ok) throw new Error()
    const data = await res.json()
    setStaff(data.staff ?? [])
    setCanManage(!!data.canManage)
    return !!data.canManage
  }, [staffUrl])

  const loadAvailable = useCallback(async () => {
    const res = await fetch(`/api/clubs/${clubId}/staff/available`)
    if (!res.ok) return
    const data = await res.json()
    setAvailable(
      (data.staff ?? []).map((s: AvailableStaff) => ({
        userId: s.userId,
        firstName: s.firstName,
        lastName: s.lastName,
        email: s.email,
      }))
    )
  }, [clubId])

  useEffect(() => {
    let cancelled = false
    loadStaff()
      .then((manage) => {
        if (!cancelled && manage) return loadAvailable()
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load program staff.")
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [loadStaff, loadAvailable])

  async function assign() {
    if (!selectedUserId || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(staffUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, designation }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Couldn't assign that person.")
      }
      setSelectedUserId("")
      setDesignation("ASSISTANT")
      await loadStaff()
    } catch (e: unknown) {
      setError(e instanceof Error && e.message ? e.message : "Couldn't assign that person.")
    } finally {
      setBusy(false)
    }
  }

  async function remove(userId: string) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(staffUrl, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Couldn't remove that person.")
      }
      await loadStaff()
    } catch (e: unknown) {
      setError(e instanceof Error && e.message ? e.message : "Couldn't remove that person.")
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) {
    return (
      <div className="border-ink-100 rounded-2xl border bg-white p-4">
        <p className="text-ink-400 text-sm">Loading program staff…</p>
      </div>
    )
  }

  const assignedIds = new Set(staff.map((s) => s.userId))
  const assignable = available.filter((s) => !assignedIds.has(s.userId))

  return (
    <div className="border-ink-100 rounded-2xl border bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-ink-800 text-sm font-semibold">Program staff</h3>
        <span className="text-ink-400 text-xs">
          {staff.length} assigned
        </span>
      </div>
      <p className="text-ink-400 mt-0.5 text-xs">
        Assigned staff can see this program and its registrants; pricing and publishing stay with
        club admins.
      </p>

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {staff.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {staff.map((s) => (
            <li
              key={s.userId}
              className="border-ink-100 flex items-center justify-between gap-2 rounded-xl border px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <DesignationChip designation={s.designation} />
                <span className="text-ink-800 truncate text-sm font-medium">{s.name}</span>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => remove(s.userId)}
                  disabled={busy}
                  aria-label={`Remove ${s.name}`}
                  className="text-ink-400 shrink-0 text-lg leading-none hover:text-red-500 disabled:opacity-40"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-500 mt-3 text-sm">
          No one is assigned to run this program yet.
        </p>
      )}

      {canManage && (
        <div className="border-ink-100 mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          <select
            value={selectedUserId}
            disabled={busy}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="border-ink-200 min-w-[160px] flex-1 rounded-lg border px-2 py-1.5 text-sm"
          >
            <option value="">
              {assignable.length > 0 ? "Add club staff…" : "No available club staff"}
            </option>
            {assignable.map((s) => (
              <option key={s.userId} value={s.userId}>
                {staffName(s)}
              </option>
            ))}
          </select>
          <select
            value={designation}
            disabled={busy}
            onChange={(e) => setDesignation(e.target.value as "LEAD" | "ASSISTANT")}
            className="border-ink-200 rounded-lg border px-2 py-1.5 text-sm"
          >
            <option value="LEAD">Lead</option>
            <option value="ASSISTANT">Assistant</option>
          </select>
          <button
            type="button"
            onClick={assign}
            disabled={busy || !selectedUserId}
            className="bg-play-600 hover:bg-play-700 shrink-0 rounded-xl px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Assign
          </button>
        </div>
      )}
    </div>
  )
}
