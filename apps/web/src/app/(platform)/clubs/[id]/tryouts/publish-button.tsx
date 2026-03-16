"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface PublishButtonProps {
  tryoutId: string
  isPublished: boolean
}

export function PublishButton({ tryoutId, isPublished }: PublishButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    setLoading(true)
    try {
      await fetch(`/api/tryouts/${tryoutId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !isPublished }),
      })
      router.refresh()
    } catch {
      alert("Failed to update")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
        isPublished
          ? "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          : "bg-green-600 text-white hover:bg-green-700"
      }`}
    >
      {loading ? "..." : isPublished ? "Unpublish" : "Publish"}
    </button>
  )
}
