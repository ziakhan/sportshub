"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const ROLE_OPTIONS = [
  {
    id: "Parent",
    title: "I'm a Parent",
    description:
      "Find tryouts and teams for my child. Track schedules, games, and stats.",
    icon: "👨‍👩‍👧‍👦",
    color: "blue",
  },
  {
    id: "ClubOwner",
    title: "I run a Club",
    description:
      "Create a basketball club, organize teams, run tryouts, and accept payments.",
    icon: "🏀",
    color: "green",
  },
  {
    id: "Staff",
    title: "I'm a Staff Member",
    description:
      "Manage teams, rosters, practices, and game preparation.",
    icon: "📋",
    color: "cyan",
  },
  {
    id: "Referee",
    title: "I'm a Referee",
    description:
      "Officiate youth basketball games, set availability, and track assignments.",
    icon: "🏁",
    color: "orange",
  },
  {
    id: "Player",
    title: "I'm a Player (13+)",
    description:
      "View my team, schedule, games, and stats. Must be 13 or older to create an account.",
    icon: "⛹️",
    color: "yellow",
  },
  {
    id: "LeagueOwner",
    title: "I run a League",
    description:
      "Organize competitive basketball leagues with divisions, schedules, and standings.",
    icon: "🏆",
    color: "purple",
  },
] as const

const colorMap: Record<string, { selected: string; border: string; radio: string }> = {
  blue: {
    selected: "border-orange-500 bg-orange-50",
    border: "border-gray-200 hover:border-orange-300",
    radio: "border-orange-500 bg-orange-500",
  },
  green: {
    selected: "border-green-500 bg-green-50",
    border: "border-gray-200 hover:border-green-300",
    radio: "border-green-600 bg-green-600",
  },
  cyan: {
    selected: "border-cyan-500 bg-cyan-50",
    border: "border-gray-200 hover:border-cyan-300",
    radio: "border-cyan-600 bg-cyan-600",
  },
  orange: {
    selected: "border-orange-500 bg-orange-50",
    border: "border-gray-200 hover:border-orange-300",
    radio: "border-orange-600 bg-orange-600",
  },
  yellow: {
    selected: "border-yellow-500 bg-yellow-50",
    border: "border-gray-200 hover:border-yellow-300",
    radio: "border-yellow-600 bg-yellow-600",
  },
  purple: {
    selected: "border-purple-500 bg-purple-50",
    border: "border-gray-200 hover:border-purple-300",
    radio: "border-purple-600 bg-purple-600",
  },
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
    <div className="rounded-lg bg-white p-8 shadow-lg">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">
        Welcome, {userName}!
      </h1>
      <p className="mb-8 text-gray-600">
        What best describes you? Pick your primary role to get started.
        You can add more roles later from your settings.
      </p>

      <div className="space-y-3">
        {ROLE_OPTIONS.map((option) => {
          const isSelected = selectedRole === option.id
          const colors = colorMap[option.color]

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelectedRole(option.id)}
              className={`flex w-full items-center gap-4 rounded-xl border-2 p-5 text-left transition-all ${
                isSelected ? colors.selected : colors.border
              }`}
            >
              {/* Radio circle */}
              <div
                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                  isSelected ? colors.radio : "border-gray-300 bg-white"
                }`}
              >
                {isSelected && (
                  <div className="h-2 w-2 rounded-full bg-white" />
                )}
              </div>

              {/* Icon */}
              <div className="text-3xl">{option.icon}</div>

              {/* Text */}
              <div className="flex-1">
                <div className="text-lg font-semibold text-gray-900">
                  {option.title}
                </div>
                <div className="mt-0.5 text-sm text-gray-600">
                  {option.description}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={isSubmitting || !selectedRole}
        className="mt-8 w-full rounded-lg bg-orange-500 px-6 py-4 text-lg font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {isSubmitting ? "Setting up your account..." : "Continue"}
      </button>

      <p className="mt-4 text-center text-sm text-gray-500">
        You can add more roles anytime from your account settings.
      </p>
    </div>
  )
}
