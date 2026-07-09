// Derived lifecycle states for club program entities (Tryout, Camp, HouseLeague).
//
// Two kinds of state exist in the app and must stay distinct:
//  - DECLARED state: a human decided it (isPublished, offer accepted, season finalized).
//    Stored in the DB and changed only through an explicit, authz-guarded action.
//  - DERIVED state: a fact of time or data (past, full, in-progress). NEVER stored —
//    computed at read time so it can't go stale and needs no cron to stay correct.
//
// This module is the single source of truth for the derived program lifecycle and for
// which actions are legal in each state. UIs render chips + buttons from it; API routes
// re-derive it server-side (the UI hiding a button is never the guard).
//
// Full audit + state matrix: docs/editability-audit.md

import type { BadgeTone } from "@/components/ui"

export type ProgramState = "DRAFT" | "OPEN" | "FULL" | "IN_PROGRESS" | "ENDED"

export interface ProgramLifecycleInput {
  isPublished: boolean
  /** Program start (Camp/HouseLeague startDate; Tryout scheduledAt). */
  startAt: Date | string
  /** Program end (endDate). Omit for single-moment events like tryouts. */
  endAt?: Date | string | null
  maxParticipants?: number | null
  /** Count of non-cancelled signups (used to derive FULL). */
  signupCount?: number
  /** Injectable clock for tests. */
  now?: Date
}

export interface ProgramActions {
  /** Edit non-money details (name, description, schedule, location, includes). */
  edit: boolean
  /** Edit fees. Gated off once the program is underway; UI should additionally
   *  warn when paid signups exist (never applies retroactively). */
  editFee: boolean
  publish: boolean
  unpublish: boolean
  /** Hard delete — only while nothing can depend on it (draft). Published
   *  programs are unpublished instead, ended programs are history. */
  delete: boolean
  /** Family-side: can a new registration be taken right now? */
  register: boolean
  /** Staff-side: registrant list is meaningful (signups can exist). */
  viewRegistrants: boolean
}

export interface ProgramLifecycle {
  state: ProgramState
  /** Human chip label ("Draft", "Open", "Full", "In progress", "Ended"). */
  label: string
  /** Kit <Badge> props for the status chip — one visual language everywhere. */
  badge: { tone: BadgeTone; dot: boolean }
  can: ProgramActions
}

const BADGES: Record<ProgramState, { label: string; tone: BadgeTone; dot: boolean }> = {
  DRAFT: { label: "Draft", tone: "neutral", dot: false },
  OPEN: { label: "Open", tone: "court", dot: true },
  FULL: { label: "Full", tone: "gold", dot: true },
  IN_PROGRESS: { label: "In progress", tone: "live", dot: true },
  ENDED: { label: "Ended", tone: "neutral", dot: false },
}

function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d)
}

/** Derive the current lifecycle state + legal actions for a program entity. */
export function programLifecycle(input: ProgramLifecycleInput): ProgramLifecycle {
  const now = input.now ?? new Date()
  const start = toDate(input.startAt)
  const end = input.endAt ? toDate(input.endAt) : start
  const isFull =
    input.maxParticipants != null &&
    input.maxParticipants > 0 &&
    (input.signupCount ?? 0) >= input.maxParticipants

  let state: ProgramState
  if (!input.isPublished) state = "DRAFT"
  else if (now > end) state = "ENDED"
  else if (now >= start) state = "IN_PROGRESS"
  else if (isFull) state = "FULL"
  else state = "OPEN"

  const b = BADGES[state]
  return {
    state,
    label: b.label,
    badge: { tone: b.tone, dot: b.dot },
    can: {
      // Details stay editable while the program is live (fix a typo, move a
      // location) — but an ENDED program is a historical record: read-only.
      edit: state !== "ENDED",
      // Money is editable until the program starts; from then on the only
      // levers are the payments console (waive/refund).
      editFee: state === "DRAFT" || state === "OPEN" || state === "FULL",
      // Publishing a program whose dates already passed makes no sense.
      publish: state === "DRAFT" && now <= end,
      // Unpublish = "take registrations down" — meaningful only before start.
      unpublish: state === "OPEN" || state === "FULL",
      delete: state === "DRAFT",
      register: state === "OPEN",
      viewRegistrants: state !== "DRAFT",
    },
  }
}
