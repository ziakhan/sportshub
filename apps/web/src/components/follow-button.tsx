"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/components/ui/cn"

type FollowState = "none" | "pending" | "active"

interface FollowButtonProps {
  teamId?: string
  tenantId?: string
  leagueId?: string
  /** Player follows can be request-gated (social-feed-plan P3) */
  playerId?: string
  initialFollowing: boolean
  /** For player targets: pass "pending" when a request is already waiting */
  initialStatus?: FollowState
  isAuthenticated: boolean
  /** Renders on dark banners (EntityHeader) by default; "light" for cards. */
  variant?: "banner" | "light"
  /** Icon-only star, for directory cards and dropdown rows. */
  compact?: boolean
  className?: string
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    >
      <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 18.5 6.1 21.3l1.2-6.6L2.5 9.5l6.6-.9z" />
    </svg>
  )
}

/**
 * Follow/unfollow a team, club, league, or player (plan §3 + social-feed-plan
 * P3). Private players return a PENDING request ("Requested") that their
 * parent approves; tapping again cancels it. Anonymous visitors are sent to
 * sign-in with a callback to the current page.
 */
export function FollowButton({
  teamId,
  tenantId,
  leagueId,
  playerId,
  initialFollowing,
  initialStatus,
  isAuthenticated,
  variant = "banner",
  compact = false,
  className,
}: FollowButtonProps) {
  const [state, setState] = useState<FollowState>(
    initialStatus ?? (initialFollowing ? "active" : "none")
  )
  const [busy, setBusy] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  const following = state === "active"
  const pending = state === "pending"

  const toggle = async () => {
    if (!isAuthenticated) {
      router.push(`/sign-in?callbackUrl=${encodeURIComponent(pathname || "/")}`)
      return
    }
    if (busy) return
    setBusy(true)
    const wasState = state
    const creating = state === "none"
    setState(creating ? "active" : "none") // optimistic; corrected from response
    try {
      const res = await fetch("/api/follows", {
        method: creating ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, tenantId, leagueId, playerId }),
      })
      if (!res.ok) {
        setState(wasState)
      } else if (creating) {
        const data = await res.json().catch(() => ({}))
        setState(data.status === "PENDING" ? "pending" : "active")
      }
    } catch {
      setState(wasState)
    } finally {
      setBusy(false)
    }
  }

  const banner = variant === "banner"
  const label = pending ? "Requested" : following ? "Following" : "Follow"

  // Icon-only star for directory cards / dropdown rows
  if (compact) {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={following}
        title={
          pending
            ? "Request sent — tap to cancel"
            : following
              ? "Following — tap to unfollow"
              : "Follow"
        }
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-full transition disabled:opacity-60",
          following || pending
            ? "bg-amber-50 text-amber-500 ring-1 ring-amber-200 hover:bg-amber-100"
            : "text-ink-400 hover:text-amber-500 hover:bg-amber-50 bg-white ring-1 ring-ink-200",
          pending && "opacity-70",
          className
        )}
      >
        <Star filled={following || pending} />
        <span className="sr-only">{label}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={following}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-60",
        banner
          ? following || pending
            ? "bg-white/15 text-white ring-1 ring-white/40 hover:bg-white/25"
            : "text-ink-950 hover:bg-ink-50 bg-white"
          : following || pending
            ? "bg-amber-50 text-amber-600 ring-amber-200 ring-1 hover:bg-amber-100"
            : "bg-ink-950 hover:bg-ink-800 text-white",
        className
      )}
    >
      <Star filled={following || pending} />
      {label}
    </button>
  )
}
