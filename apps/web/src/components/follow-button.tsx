"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/components/ui/cn"

interface FollowButtonProps {
  teamId?: string
  tenantId?: string
  leagueId?: string
  initialFollowing: boolean
  isAuthenticated: boolean
  /** Renders on dark banners (EntityHeader) by default; "light" for cards. */
  variant?: "banner" | "light"
  className?: string
}

/**
 * Follow/unfollow a team, club, or league (plan §3 — follows drive the
 * signed-in "Your teams" rail). Anonymous visitors are sent to sign-in with
 * a callback to the current page.
 */
export function FollowButton({
  teamId,
  tenantId,
  leagueId,
  initialFollowing,
  isAuthenticated,
  variant = "banner",
  className,
}: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing)
  const [busy, setBusy] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  const toggle = async () => {
    if (!isAuthenticated) {
      router.push(`/sign-in?callbackUrl=${encodeURIComponent(pathname || "/")}`)
      return
    }
    if (busy) return
    setBusy(true)
    const next = !following
    setFollowing(next) // optimistic
    try {
      const res = await fetch("/api/follows", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, tenantId, leagueId }),
      })
      if (!res.ok) setFollowing(!next)
    } catch {
      setFollowing(!next)
    } finally {
      setBusy(false)
    }
  }

  const banner = variant === "banner"
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-60",
        banner
          ? following
            ? "bg-white/15 text-white ring-1 ring-white/40 hover:bg-white/25"
            : "text-ink-950 hover:bg-ink-50 bg-white"
          : following
            ? "bg-ink-100 text-ink-700 ring-ink-200 ring-1 hover:bg-ink-200"
            : "bg-ink-950 hover:bg-ink-800 text-white",
        className
      )}
    >
      {following ? (
        <>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Following
        </>
      ) : (
        <>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Follow
        </>
      )}
    </button>
  )
}
