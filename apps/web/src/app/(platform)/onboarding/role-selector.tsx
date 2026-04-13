"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const ROLE_OPTIONS = [
  {
    id: "Parent",
    title: "I'm a Parent",
    description: "Find tryouts and teams for my child. Track schedules, games, and stats.",
    icon: "parent",
  },
  {
    id: "ClubOwner",
    title: "I run a Club",
    description: "Create a basketball club, organize teams, run tryouts, and accept payments.",
    icon: "club",
  },
  {
    id: "Staff",
    title: "I'm a Staff Member",
    description: "Manage teams, rosters, practices, and game preparation.",
    icon: "staff",
  },
  {
    id: "Referee",
    title: "I'm a Referee",
    description: "Officiate youth basketball games, set availability, and track assignments.",
    icon: "referee",
  },
  {
    id: "Player",
    title: "I'm a Player (13+)",
    description:
      "View my team, schedule, games, and stats. Must be 13 or older to create an account.",
    icon: "player",
  },
  {
    id: "LeagueOwner",
    title: "I run a League",
    description:
      "Organize competitive basketball leagues with divisions, schedules, and standings.",
    icon: "league",
  },
] as const

function RoleIcon({ icon }: { icon: (typeof ROLE_OPTIONS)[number]["icon"] }) {
  const iconClass = "h-5 w-5"

  if (icon === "parent") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={iconClass}
      >
        <path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        <path d="M8 14c-3 0-5 1.5-5 4v1h10v-1c0-2.5-2-4-5-4Z" />
        <path d="M16 13c2.2 0 4 1.1 4 3v1h-4" />
      </svg>
    )
  }

  if (icon === "club") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={iconClass}
      >
        <path d="M3 10 12 4l9 6" />
        <path d="M5 10v9h14v-9" />
        <path d="M9 19v-5h6v5" />
      </svg>
    )
  }

  if (icon === "staff") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={iconClass}
      >
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 7h8" />
        <path d="M8 11h8" />
        <path d="M8 15h5" />
      </svg>
    )
  }

  if (icon === "referee") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={iconClass}
      >
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M12 3v18" />
        <path d="M8 3v18" />
        <path d="M16 3v18" />
      </svg>
    )
  }

  if (icon === "player") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={iconClass}
      >
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4a14 14 0 0 1 0 16" />
        <path d="M12 4a14 14 0 0 0 0 16" />
        <path d="M4 12h16" />
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={iconClass}
    >
      <path d="m12 3 2.7 5.5 6.1.9-4.4 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.2 9.4l6.1-.9L12 3Z" />
    </svg>
  )
}

interface RoleSelectorProps {
  userName: string
}

export function RoleSelector({ userName }: RoleSelectorProps) {
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async () => {
    if (!selectedRole) {
      setError("Please select a role to continue.")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: [selectedRole] }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Something went wrong")
        return
      }

      router.push(data.nextStep)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="border-ink-100 rounded-3xl border bg-white p-8 shadow-[0_22px_70px_-42px_rgba(15,23,42,0.45)]">
      <h1 className="text-ink-900 mb-2 text-3xl font-semibold">Welcome, {userName}!</h1>
      <p className="text-ink-700 mb-8">
        What best describes you? Pick your primary role to get started. You can add more roles later
        from your settings.
      </p>

      <div className="space-y-3">
        {ROLE_OPTIONS.map((option) => {
          const isSelected = selectedRole === option.id

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelectedRole(option.id)}
              className={`flex w-full items-center gap-4 rounded-2xl border px-5 py-4 text-left transition ${
                isSelected
                  ? "border-play-500 bg-play-50"
                  : "border-ink-100 hover:border-play-300 hover:bg-play-50/50 bg-white"
              }`}
            >
              {/* Radio circle */}
              <div
                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition ${
                  isSelected ? "border-play-500 bg-play-500" : "border-ink-300 bg-white"
                }`}
              >
                {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
              </div>

              {/* Icon */}
              <div
                className={`rounded-xl p-2 ${isSelected ? "text-play-700 bg-white" : "bg-court-50 text-ink-700"}`}
              >
                <RoleIcon icon={option.icon} />
              </div>

              {/* Text */}
              <div className="flex-1">
                <div className="text-ink-900 text-lg font-semibold">{option.title}</div>
                <div className="text-ink-700 mt-0.5 text-sm">{option.description}</div>
              </div>
            </button>
          )
        })}
      </div>

      {error && (
        <div className="border-hoop-200 text-hoop-700 mt-6 rounded-lg border bg-red-50 p-3 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={isSubmitting || !selectedRole}
        className="bg-play-600 hover:bg-play-700 disabled:bg-ink-400 mt-8 w-full rounded-xl px-6 py-4 text-lg font-semibold text-white transition disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Setting up your account..." : "Continue"}
      </button>

      <p className="text-ink-500 mt-4 text-center text-sm">
        You can add more roles anytime from your account settings.
      </p>
    </div>
  )
}
