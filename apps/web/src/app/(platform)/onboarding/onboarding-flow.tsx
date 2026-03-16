"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { ProfileData } from "@/lib/validations/onboarding"
import { ParentForm } from "./forms/parent-form"
import { PlayerForm } from "./forms/player-form"
import { StaffForm } from "./forms/staff-form"
import { RefereeForm } from "./forms/referee-form"
import { LeagueOwnerForm } from "./forms/league-owner-form"

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
    selected: "border-blue-500 bg-blue-50",
    border: "border-gray-200 hover:border-blue-300",
    radio: "border-blue-600 bg-blue-600",
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

interface OnboardingFlowProps {
  userName: string
}

export function OnboardingFlow({ userName }: OnboardingFlowProps) {
  const [step, setStep] = useState<"role" | "profile">("role")
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleRoleContinue = async () => {
    if (!selectedRole) {
      setError("Please select a role to continue.")
      return
    }

    setError(null)

    // ClubOwner skips step 2 — goes straight to API then /clubs/create
    if (selectedRole === "ClubOwner") {
      await submitOnboarding(selectedRole)
      return
    }

    setStep("profile")
  }

  const handleProfileSubmit = async (profileData: ProfileData) => {
    await submitOnboarding(selectedRole!, profileData)
  }

  const submitOnboarding = async (role: string, profileData?: ProfileData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roles: [role],
          profileData: profileData || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Something went wrong")
        setIsSubmitting(false)
        return
      }

      router.push(data.nextStep)
    } catch {
      setError("Network error. Please try again.")
      setIsSubmitting(false)
    }
  }

  if (step === "profile" && selectedRole) {
    return (
      <div className="rounded-lg bg-white p-8 shadow-lg">
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {selectedRole === "Parent" && (
          <ParentForm
            onSubmit={handleProfileSubmit}
            onBack={() => setStep("role")}
            isSubmitting={isSubmitting}
          />
        )}
        {selectedRole === "Player" && (
          <PlayerForm
            onSubmit={handleProfileSubmit}
            onBack={() => setStep("role")}
            isSubmitting={isSubmitting}
          />
        )}
        {selectedRole === "Staff" && (
          <StaffForm
            onSubmit={handleProfileSubmit}
            onBack={() => setStep("role")}
            isSubmitting={isSubmitting}
          />
        )}
        {selectedRole === "Referee" && (
          <RefereeForm
            onSubmit={handleProfileSubmit}
            onBack={() => setStep("role")}
            isSubmitting={isSubmitting}
          />
        )}
        {selectedRole === "LeagueOwner" && (
          <LeagueOwnerForm
            onSubmit={handleProfileSubmit}
            onBack={() => setStep("role")}
            isSubmitting={isSubmitting}
          />
        )}

        <p className="mt-4 text-center text-sm text-gray-500">
          Step 2 of 2 — Complete your profile
        </p>
      </div>
    )
  }

  // Step 1: Role Selection
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
        onClick={handleRoleContinue}
        disabled={isSubmitting || !selectedRole}
        className="mt-8 w-full rounded-lg bg-blue-600 px-6 py-4 text-lg font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {isSubmitting ? "Setting up your account..." : "Continue"}
      </button>

      <p className="mt-4 text-center text-sm text-gray-500">
        Step 1 of 2 — Choose your role
      </p>
    </div>
  )
}
