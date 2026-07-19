"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { Badge, Button, StarRating, type BadgeTone } from "@/components/ui"

interface AdminReview {
  id: string
  rating: number
  title: string | null
  content: string | null
  status: string
  flaggedAt: string | null
  moderatedAt: string | null
  moderatorNotes: string | null
  createdAt: string
  reviewer: { id: string; firstName: string | null; lastName: string | null; email: string }
  tenant: { id: string; name: string; slug: string } | null
  league: { id: string; name: string } | null
  reviewee: { id: string; firstName: string | null; lastName: string | null } | null
}

const TABS = [
  { key: "PENDING", label: "Awaiting approval" },
  { key: "FLAGGED", label: "Flagged" },
  { key: "REMOVED", label: "Removed" },
] as const

const STATUS_TONES: Record<string, BadgeTone> = {
  PENDING: "play",
  FLAGGED: "warning",
  REMOVED: "danger",
  PUBLISHED: "success",
}

function targetLabel(review: AdminReview): { label: string; href: string | null } {
  if (review.tenant) return { label: review.tenant.name, href: `/club/${review.tenant.slug}` }
  if (review.league) return { label: review.league.name, href: null }
  if (review.reviewee) {
    return {
      label: [review.reviewee.firstName, review.reviewee.lastName].filter(Boolean).join(" ") || "A user",
      href: null,
    }
  }
  return { label: "Unknown target", href: null }
}

export default function AdminReviewsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("PENDING")
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [notesId, setNotesId] = useState<string | null>(null)
  const [notes, setNotes] = useState("")

  const fetchReviews = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/reviews?status=${tab}`)
      .then((res) => res.json())
      .then((data) => setReviews(data.reviews || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tab])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  const moderate = async (id: string, action: "approve" | "restore" | "remove", note?: string) => {
    setActionId(id)
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, notes: note?.trim() || undefined }),
      })
      if (res.ok) fetchReviews()
    } catch {
    } finally {
      setActionId(null)
      setNotesId(null)
      setNotes("")
    }
  }

  return (
    <div className="space-y-6">
      <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
        <div className="border-play-100 bg-play-50 text-play-600 mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">
          Admin
        </div>
        <h2 className="font-display text-ink-950 text-2xl font-bold">Review moderation</h2>
        <p className="text-ink-500 mt-1 text-sm">
          Flagged reviews stay publicly visible until moderated — restore to clear the flag, or
          remove to take the review down.
        </p>
        <div className="mt-4 flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                tab === t.key
                  ? "bg-ink-900 text-white"
                  : "bg-ink-50 text-ink-600 hover:bg-ink-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-ink-500 py-12 text-center">Loading reviews...</div>
      ) : reviews.length === 0 ? (
        <div className="border-ink-300 shadow-soft rounded-2xl border border-dashed bg-white p-12 text-center">
          <h3 className="font-display text-ink-950 mb-2 text-lg font-semibold">
            {tab === "PENDING" ? "No reviews awaiting approval" : tab === "FLAGGED" ? "No flagged reviews" : "No removed reviews"}
          </h3>
          <p className="text-ink-600">
            {tab === "FLAGGED"
              ? "When club owners or managers flag a review, it will appear here for a decision."
              : "Reviews you remove will be listed here for the record."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => {
            const target = targetLabel(review)
            const reviewerName =
              [review.reviewer.firstName, review.reviewer.lastName].filter(Boolean).join(" ") ||
              review.reviewer.email
            return (
              <div
                key={review.id}
                className="border-ink-100 shadow-soft rounded-2xl border bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StarRating rating={review.rating} />
                      <Badge tone={STATUS_TONES[review.status] || "neutral"}>
                        {review.status.toLowerCase()}
                      </Badge>
                    </div>
                    <p className="text-ink-600 mt-2 text-sm">
                      <strong className="text-ink-900">{reviewerName}</strong>{" "}
                      <span className="text-ink-400">({review.reviewer.email})</span> on{" "}
                      {target.href ? (
                        <Link
                          href={target.href}
                          className="text-play-600 font-semibold hover:underline"
                        >
                          {target.label}
                        </Link>
                      ) : (
                        <strong className="text-ink-900">{target.label}</strong>
                      )}
                    </p>
                    {review.title && (
                      <h4 className="text-ink-950 mt-2 text-sm font-semibold">{review.title}</h4>
                    )}
                    {review.content && (
                      <p className="text-ink-700 mt-1 whitespace-pre-line text-sm leading-relaxed">
                        {review.content}
                      </p>
                    )}
                    {review.moderatorNotes && (
                      <p className="text-ink-500 mt-2 text-xs">
                        <span className="font-semibold uppercase tracking-wide">
                          {review.status === "REMOVED" ? "Moderator notes:" : "Flag reason:"}
                        </span>{" "}
                        <span className="italic">&ldquo;{review.moderatorNotes}&rdquo;</span>
                      </p>
                    )}
                    <div className="text-ink-400 mt-2 flex flex-wrap gap-3 text-xs">
                      <span>Written {format(new Date(review.createdAt), "MMM d, yyyy")}</span>
                      {review.flaggedAt && (
                        <span>Flagged {format(new Date(review.flaggedAt), "MMM d, yyyy")}</span>
                      )}
                      {review.moderatedAt && (
                        <span>Moderated {format(new Date(review.moderatedAt), "MMM d, yyyy")}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 flex-col items-end gap-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        tone="court"
                        disabled={actionId === review.id}
                        onClick={() =>
                          moderate(review.id, review.status === "PENDING" ? "approve" : "restore")
                        }
                      >
                        {review.status === "PENDING" ? "Approve" : "Restore"}
                      </Button>
                      {review.status !== "REMOVED" &&
                        (notesId === review.id ? (
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              placeholder="Notes (optional)..."
                              className="border-ink-300 w-40 rounded-md border px-2 py-1 text-xs"
                            />
                            <Button
                              size="sm"
                              variant="primary"
                              tone="hoop"
                              disabled={actionId === review.id}
                              onClick={() => moderate(review.id, "remove", notes)}
                            >
                              Confirm
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="subtle"
                            disabled={actionId === review.id}
                            onClick={() => {
                              setNotesId(review.id)
                              setNotes("")
                            }}
                          >
                            Remove
                          </Button>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
