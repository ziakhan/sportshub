"use client"

import { useState } from "react"
import {
  formatRsvpSummary,
  summarizeRsvps,
  type RsvpStatus,
} from "@/lib/rsvp-shared"

/**
 * Shared RSVP widgets (team calendar + My Calendar).
 * RsvpControl — the family answer row: ✓ Going (green) · ? Maybe (amber) ·
 * ✕ Can't go (red); one row per kid, selected state solid-filled.
 * RsvpRollup — the staff who's-coming line with expandable names.
 */

export interface RsvpPlayer {
  id: string
  name: string
}
export type RsvpAnswers = Record<string, { status: RsvpStatus; note: string | null }>

const OPTIONS: Array<{
  status: RsvpStatus
  label: string
  mark: string
  on: string
  off: string
}> = [
  {
    status: "GOING",
    label: "Going",
    mark: "✓",
    on: "border-court-600 bg-court-600 text-white",
    off: "border-ink-200 text-ink-600 hover:border-court-400 hover:text-court-700",
  },
  {
    status: "MAYBE",
    label: "Maybe",
    mark: "?",
    on: "border-amber-500 bg-amber-500 text-white",
    off: "border-ink-200 text-ink-600 hover:border-amber-400 hover:text-amber-600",
  },
  {
    status: "NOT_GOING",
    label: "Can't go",
    mark: "✕",
    on: "border-red-600 bg-red-600 text-white",
    off: "border-ink-200 text-ink-600 hover:border-red-400 hover:text-red-600",
  },
]

export function RsvpControl({
  players,
  answers,
  onSet,
  showNames,
}: {
  players: RsvpPlayer[]
  answers: RsvpAnswers
  onSet: (playerId: string, status: RsvpStatus) => void
  /** Force name labels (multi-kid items); defaults to players.length > 1. */
  showNames?: boolean
}) {
  if (players.length === 0) return null
  const withNames = showNames ?? players.length > 1
  return (
    <div className="space-y-1.5">
      {players.map((p) => (
        <div key={p.id} className="flex flex-wrap items-center gap-1.5">
          {withNames && (
            <span className="text-ink-600 min-w-[64px] text-xs font-semibold">
              {p.name.split(" ")[0]}
            </span>
          )}
          {OPTIONS.map((o) => {
            const selected = answers[p.id]?.status === o.status
            return (
              <button
                key={o.status}
                onClick={() => onSet(p.id, o.status)}
                aria-pressed={selected}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                  selected ? o.on : o.off
                }`}
              >
                <span aria-hidden>{o.mark}</span>
                {o.label}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export function RsvpRollup({
  roster,
  answers,
}: {
  roster: RsvpPlayer[]
  answers: RsvpAnswers
}) {
  const [open, setOpen] = useState(false)
  if (roster.length === 0) return null
  const summary = summarizeRsvps(
    roster.length,
    Object.values(answers).map((a) => a.status)
  )
  const withNote = (p: RsvpPlayer) => {
    const note = answers[p.id]?.note
    return note ? `${p.name} (“${note}”)` : p.name
  }
  const groups = [
    { label: "Out", tone: "text-red-600", players: roster.filter((p) => answers[p.id]?.status === "NOT_GOING") },
    { label: "Maybe", tone: "text-amber-600", players: roster.filter((p) => answers[p.id]?.status === "MAYBE") },
    { label: "Going", tone: "text-court-700", players: roster.filter((p) => answers[p.id]?.status === "GOING") },
    { label: "No reply", tone: "text-ink-700", players: roster.filter((p) => !answers[p.id]) },
  ].filter((g) => g.players.length > 0)
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-ink-500 hover:text-ink-700 text-xs font-medium"
      >
        {formatRsvpSummary(summary)} {open ? "▴" : "▾"}
      </button>
      {open && (
        <div className="mt-1 space-y-0.5">
          {groups.map((g) => (
            <p key={g.label} className="text-ink-500 text-xs">
              <span className={`font-semibold ${g.tone}`}>{g.label}:</span>{" "}
              {g.players.map(withNote).join(", ")}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
