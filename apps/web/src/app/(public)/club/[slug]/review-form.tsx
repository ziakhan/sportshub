"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AuthLink } from "@/components/auth-link"

export interface OwnReview {
  id: string
  rating: number
  title: string | null
  content: string | null
  status: string
}

/** Shared star picker for the create + edit forms. */
function StarPicker({
  rating,
  onChange,
}: {
  rating: number
  onChange: (rating: number) => void
}) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className={`text-2xl leading-none transition ${
            star <= (hovered || rating) ? "text-gold-500" : "text-ink-200"
          }`}
          aria-label={`${star} star${star !== 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function ReviewFields({
  rating,
  setRating,
  title,
  setTitle,
  content,
  setContent,
}: {
  rating: number
  setRating: (n: number) => void
  title: string
  setTitle: (s: string) => void
  content: string
  setContent: (s: string) => void
}) {
  return (
    <>
      <div>
        <span className="text-ink-700 mb-1 block text-sm font-medium">Your rating</span>
        <StarPicker rating={rating} onChange={setRating} />
      </div>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={100}
        placeholder="Title (optional)"
        className="border-ink-200 focus:border-play-500 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={2000}
        rows={3}
        placeholder="What should other families know? (optional)"
        className="border-ink-200 focus:border-play-500 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
      />
    </>
  )
}

export function ReviewForm({
  tenantId,
  signedIn,
  ownReview,
}: {
  tenantId: string
  signedIn: boolean
  ownReview: OwnReview | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [rating, setRating] = useState(ownReview?.rating ?? 0)
  const [title, setTitle] = useState(ownReview?.title ?? "")
  const [content, setContent] = useState(ownReview?.content ?? "")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Relationship gate (403) — informational, not an error state.
  const [gateMessage, setGateMessage] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  if (!signedIn) {
    return (
      <p className="text-ink-500 text-sm">
        <AuthLink to="sign-in" className="text-play-600 font-semibold hover:underline">
          Sign in
        </AuthLink>{" "}
        to review this club.
      </p>
    )
  }

  if (gateMessage) {
    return (
      <div className="border-ink-200 bg-ink-50 rounded-xl border px-4 py-3">
        <p className="text-ink-700 text-sm font-medium">{gateMessage}</p>
        <p className="text-ink-500 mt-1 text-xs">
          Sign up for a tryout, camp, or program with this club first — then come back and share
          your experience.
        </p>
      </div>
    )
  }

  if (deleted) {
    return <p className="text-ink-500 text-sm">Your review was deleted.</p>
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault()
    if (rating < 1) {
      setError("Pick a star rating first.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          rating,
          title: title.trim() || undefined,
          content: content.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 403) {
        setGateMessage(
          data.error || "Only families and members who've participated with this club can review it."
        )
        return
      }
      if (!res.ok) {
        setError(data.error || "Couldn't submit your review — try again.")
        return
      }
      setDone(true)
      router.refresh()
    } catch {
      setError("Couldn't submit your review — check your connection.")
    } finally {
      setSubmitting(false)
    }
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!ownReview) return
    if (rating < 1) {
      setError("Pick a star rating first.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/reviews/${ownReview.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          title: title.trim() || null,
          content: content.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "Couldn't save your changes — try again.")
        return
      }
      setEditing(false)
      router.refresh()
    } catch {
      setError("Couldn't save your changes — check your connection.")
    } finally {
      setSubmitting(false)
    }
  }

  async function submitDelete() {
    if (!ownReview) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/reviews/${ownReview.id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "Couldn't delete your review — try again.")
        return
      }
      setDeleted(true)
      router.refresh()
    } catch {
      setError("Couldn't delete your review — check your connection.")
    } finally {
      setSubmitting(false)
      setConfirmingDelete(false)
    }
  }

  // ── Existing review: show it with Edit / Delete ──────────────────────────
  if (ownReview) {
    if (ownReview.status === "REMOVED") {
      return (
        <p className="text-ink-500 text-sm">
          Your review of this club was removed by our moderators.
        </p>
      )
    }

    if (editing) {
      return (
        <form onSubmit={submitEdit} className="space-y-3">
          <p className="text-ink-700 text-sm font-semibold">Edit your review</p>
          <ReviewFields
            rating={rating}
            setRating={setRating}
            title={title}
            setTitle={setTitle}
            content={content}
            setContent={setContent}
          />
          {error && <p className="text-hoop-600 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setError(null)
                setRating(ownReview.rating)
                setTitle(ownReview.title ?? "")
                setContent(ownReview.content ?? "")
              }}
              className="text-ink-600 hover:bg-ink-100 rounded-xl px-3 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )
    }

    return (
      <div className="space-y-2">
        <p className="text-ink-500 text-sm">
          Thanks — you&apos;ve reviewed this club.
          {ownReview.status === "FLAGGED" && (
            <span className="text-ink-400"> Your review is currently being checked by moderators.</span>
          )}
        </p>
        {error && <p className="text-hoop-600 text-sm">{error}</p>}
        <div className="flex items-center gap-2">
          {/* Editing is only possible while PUBLISHED — a flag locks the text
              for moderation (the API enforces this too). */}
          {ownReview.status === "PUBLISHED" && (
            <button
              onClick={() => {
                setEditing(true)
                setError(null)
              }}
              className="border-ink-200 text-ink-700 hover:bg-ink-50 rounded-xl border px-3 py-1.5 text-xs font-semibold"
            >
              Edit review
            </button>
          )}
          {confirmingDelete ? (
            <span className="flex items-center gap-2">
              <button
                onClick={submitDelete}
                disabled={submitting}
                className="bg-hoop-600 hover:bg-hoop-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {submitting ? "Deleting…" : "Yes, delete it"}
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="text-ink-500 hover:text-ink-700 text-xs"
              >
                Keep it
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="border-hoop-200 text-hoop-700 hover:bg-hoop-50 rounded-xl border px-3 py-1.5 text-xs font-semibold"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── No review yet: create flow ───────────────────────────────────────────
  // Post-create interim state (router.refresh() delivers ownReview shortly,
  // which then takes over with the Edit/Delete affordances above).
  if (done) {
    return <p className="text-ink-500 text-sm">Thanks — you&apos;ve reviewed this club.</p>
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white"
      >
        Write a review
      </button>
    )
  }

  return (
    <form onSubmit={submitCreate} className="space-y-3">
      <ReviewFields
        rating={rating}
        setRating={setRating}
        title={title}
        setTitle={setTitle}
        content={content}
        setContent={setContent}
      />
      {error && <p className="text-hoop-600 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit review"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-ink-600 hover:bg-ink-100 rounded-xl px-3 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

/**
 * Tiny flag affordance shown on each review to the club's owner/manager
 * viewing their own public page (the server only renders it for them).
 * Flagging sends the review to the platform moderation queue — it stays
 * visible until an admin decides.
 */
export function FlagReviewButton({ reviewId }: { reviewId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [flagged, setFlagged] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (flagged) {
    return <span className="text-ink-400 text-[11px] font-semibold uppercase">Flagged for review</span>
  }

  async function submitFlag() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "flag", reason: reason.trim() || undefined }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "Couldn't flag this review.")
        return
      }
      setFlagged(true)
      router.refresh()
    } catch {
      setError("Couldn't flag this review.")
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-ink-400 hover:text-hoop-600 text-[11px] font-semibold uppercase tracking-wide transition-colors"
        title="Flag this review for platform moderation"
      >
        Flag
      </button>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        placeholder="Reason (optional)"
        className="border-ink-200 w-36 rounded-md border px-2 py-1 text-xs focus:outline-none"
      />
      <button
        onClick={submitFlag}
        disabled={submitting}
        className="bg-hoop-600 hover:bg-hoop-700 rounded-md px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
      >
        {submitting ? "…" : "Flag"}
      </button>
      <button
        onClick={() => {
          setOpen(false)
          setError(null)
        }}
        className="text-ink-400 hover:text-ink-600 text-[11px]"
      >
        Cancel
      </button>
      {error && <span className="text-hoop-600 text-[11px]">{error}</span>}
    </span>
  )
}
