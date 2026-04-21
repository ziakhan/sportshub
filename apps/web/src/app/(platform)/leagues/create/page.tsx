"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function CreateLeaguePage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  const labelClass = "block text-sm font-medium text-ink-700"
  const inputClass =
    "mt-1 block w-full rounded-xl border border-ink-200 px-3 py-2 text-sm text-ink-900 shadow-sm focus:border-play-500 focus:outline-none focus:ring-2 focus:ring-play-500/20"
  const cardClass =
    "space-y-4 rounded-3xl border border-ink-100 bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create")
      }

      const data = await res.json()
      router.push(`/leagues/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-xl">
        <h1 className="text-ink-900 mb-2 text-2xl font-semibold">Create League</h1>
        <p className="text-ink-500 mb-6 text-sm">
          A league is the persistent parent. You&apos;ll add seasons (Fall 2026, Winter 2026-27,
          etc.) on the next screen.
        </p>

        {error && (
          <div className="border-hoop-200 text-hoop-700 mb-4 rounded-xl border bg-red-50 p-3 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className={cardClass}>
            <div>
              <label className={labelClass}>League Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. NPH Showcase League"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="About this league..."
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex gap-4">
            <Link
              href="/leagues"
              className="border-ink-200 text-ink-700 hover:bg-court-50 rounded-xl border px-4 py-2 text-sm font-medium transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-play-600 hover:bg-play-700 flex-1 rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create League"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
