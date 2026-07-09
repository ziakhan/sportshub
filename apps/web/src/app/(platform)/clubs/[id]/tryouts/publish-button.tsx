"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui"

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
    <Button
      type="button"
      size="sm"
      onClick={handleToggle}
      disabled={loading}
      variant={isPublished ? "subtle" : "primary"}
    >
      {loading ? "..." : isPublished ? "Unpublish" : "Publish"}
    </Button>
  )
}
