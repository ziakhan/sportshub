"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AuthLink } from "@/components/auth-link"

export function ReviewForm({
  tenantId,
  signedIn,
  alreadyReviewed,
}: {
  tenantId: string
  signedIn: boolean
  alreadyReviewed: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

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

  if (alreadyReviewed || done) {
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

  async function submit(e: React.FormEvent) {
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

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <span className="text-ink-700 mb-1 block text-sm font-medium">Your rating</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
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
